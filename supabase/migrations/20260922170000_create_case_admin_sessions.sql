create table if not exists public.case_admin_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists case_admin_sessions_active_lookup_idx
  on public.case_admin_sessions (token_hash, expires_at)
  where revoked_at is null;

alter table public.case_admin_sessions enable row level security;

revoke all on table public.case_admin_sessions from anon, authenticated;
