create table public.member_device_grants (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('enrollment', 'device')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at)
);

alter table public.member_device_grants enable row level security;
revoke all on table public.member_device_grants from public, anon, authenticated;
grant select, insert, delete on table public.member_device_grants to service_role;

create function public.member_redeem_device_grant(p_enrollment_hash text, p_device_hash text)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  with claimed as (
    delete from public.member_device_grants
    where token_hash = p_enrollment_hash and kind = 'enrollment' and expires_at > now()
    returning token_hash
  ), issued as (
    insert into public.member_device_grants (token_hash, kind, expires_at)
    select p_device_hash, 'device', now() + interval '30 days'
    from claimed
    on conflict (token_hash) do nothing
    returning expires_at
  )
  select coalesce(
    (select expires_at from issued),
    (select expires_at from public.member_device_grants
     where token_hash = p_device_hash and kind = 'device' and expires_at > now())
  );
$$;

revoke execute on function public.member_redeem_device_grant(text, text) from public, anon, authenticated;
grant execute on function public.member_redeem_device_grant(text, text) to service_role;
