grant delete on table public.training_sessions to service_role;

create or replace function public.member_delete_planned_training_session(
  p_session_id uuid,
  p_expected_revision integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.training_sessions%rowtype;
begin
  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'MEMBER_INVALID_REVISION';
  end if;

  select * into v_session
    from public.training_sessions
   where id = p_session_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'MEMBER_SESSION_NOT_FOUND';
  end if;
  if v_session.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'MEMBER_REVISION_CONFLICT';
  end if;
  if v_session.status <> 'PLANNED' then
    raise exception using errcode = '23514', message = 'MEMBER_INVALID_TRANSITION';
  end if;

  delete from public.training_sessions where id = p_session_id;

  return pg_catalog.jsonb_build_object(
    'sessionId', p_session_id,
    'revision', v_session.revision + 1,
    'status', 'DELETED',
    'deleted', true
  );
end;
$$;

revoke all on function public.member_delete_planned_training_session(uuid, integer) from public, anon, authenticated;
grant execute on function public.member_delete_planned_training_session(uuid, integer) to service_role;
