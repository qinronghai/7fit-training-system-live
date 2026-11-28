begin;

alter table public.training_session_items
  add column execution jsonb,
  add constraint training_session_items_execution_check check (
    execution is null or case
      when pg_catalog.jsonb_typeof(execution) = 'object'
        and execution->'schemaVersion' = '1'::jsonb
        and pg_catalog.jsonb_typeof(execution->'segments') = 'array'
      then pg_catalog.jsonb_array_length(execution->'segments') <= 100
      else false
    end
  );

create or replace function public.member_complete_training_session(
  p_session_id uuid,
  p_expected_revision integer,
  p_completed_at timestamptz,
  p_performed_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.training_sessions%rowtype;
  v_item jsonb;
  v_item_id uuid;
  v_expected_items integer;
  v_payload_items integer;
  v_distinct_items integer;
  v_updated integer;
  v_completion_fingerprint text;
begin
  if pg_catalog.jsonb_typeof(p_performed_items) is distinct from 'array'
    or p_completed_at is null
    or p_expected_revision is null
    or p_expected_revision < 1 then
    raise exception using errcode = '22023', message = 'MEMBER_INVALID_COMPLETION';
  end if;
  v_completion_fingerprint := pg_catalog.md5(p_performed_items::text);

  select * into v_session
    from public.training_sessions
   where id = p_session_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'MEMBER_SESSION_NOT_FOUND';
  end if;
  if v_session.status = 'COMPLETED' then
    if v_session.completion_fingerprint = v_completion_fingerprint then
      return pg_catalog.jsonb_build_object(
        'sessionId', v_session.id,
        'revision', v_session.revision,
        'status', v_session.status,
        'completedAt', v_session.completed_at,
        'idempotentReplay', true
      );
    end if;
    raise exception using errcode = '23505', message = 'MEMBER_COMPLETION_CONFLICT';
  end if;
  if v_session.revision <> p_expected_revision then
    raise exception using errcode = '40001', message = 'MEMBER_REVISION_CONFLICT';
  end if;
  if v_session.status <> 'PLANNED' then
    raise exception using errcode = '23514', message = 'MEMBER_INVALID_TRANSITION';
  end if;

  select count(*) into v_expected_items
    from public.training_session_items
   where session_id = p_session_id;
  v_payload_items := pg_catalog.jsonb_array_length(p_performed_items);
  select count(distinct value->>'id') into v_distinct_items
    from pg_catalog.jsonb_array_elements(p_performed_items) as input(value);
  if v_payload_items <> v_expected_items or v_distinct_items <> v_expected_items then
    raise exception using errcode = '22023', message = 'MEMBER_INVALID_COMPLETION_ITEMS';
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_performed_items) as input(value)
  loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
      or v_item->>'schemaVersion' is distinct from '1'
      or v_item->>'sessionId' is distinct from p_session_id::text then
      raise exception using errcode = '22023', message = 'MEMBER_INVALID_COMPLETION_ITEM';
    end if;
    v_item_id := (v_item->>'id')::uuid;
    if coalesce((v_item->>'completed')::boolean, false)
      and (v_item->>'performedActionId' is null or v_item->'performedActionSnapshot' is null or v_item->'performedActionSnapshot' = 'null'::jsonb) then
      raise exception using errcode = '22023', message = 'MEMBER_COMPLETED_ITEM_MISSING_PERFORMED_SNAPSHOT';
    end if;
    update public.training_session_items
       set performed_action_id = v_item->>'performedActionId',
           performed_action_snapshot = nullif(v_item->'performedActionSnapshot', 'null'::jsonb),
           performed_prescription = nullif(v_item->'performedPrescription', 'null'::jsonb),
           execution = nullif(v_item->'execution', 'null'::jsonb),
           sets = nullif(v_item->>'sets', 'null')::integer,
           reps = v_item->>'reps',
           load_kg = nullif(v_item->>'loadKg', 'null')::numeric,
           rir = nullif(v_item->>'rir', 'null')::numeric,
           rpe = nullif(v_item->>'rpe', 'null')::numeric,
           completed = coalesce((v_item->>'completed')::boolean, false),
           note = v_item->>'note',
           updated_at = now()
     where id = v_item_id
       and session_id = p_session_id;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception using errcode = '22023', message = 'MEMBER_COMPLETION_ITEM_NOT_FOUND';
    end if;
  end loop;

  update public.training_sessions
     set status = 'COMPLETED',
         completed_at = p_completed_at,
         completion_fingerprint = v_completion_fingerprint,
         revision = revision + 1,
         updated_at = now()
   where id = p_session_id;

  return pg_catalog.jsonb_build_object(
    'sessionId', p_session_id,
    'revision', v_session.revision + 1,
    'status', 'COMPLETED',
    'completedAt', p_completed_at,
    'idempotentReplay', false
  );
end;
$$;

revoke all on function public.member_complete_training_session(uuid, integer, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.member_complete_training_session(uuid, integer, timestamptz, jsonb)
  to service_role;

commit;
