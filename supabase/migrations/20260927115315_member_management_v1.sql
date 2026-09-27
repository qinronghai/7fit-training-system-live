create table public.members (
  id uuid primary key default gen_random_uuid(),
  schema_version integer not null default 1,
  display_name text not null,
  status text not null default 'ACTIVE',
  training_level text,
  primary_goal text,
  training_profile jsonb not null default '{"schemaVersion":1,"experienceLevel":null,"movementConstraints":[],"preferredEquipment":[],"notes":null}'::jsonb,
  coach_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint members_display_name_nonempty check (length(btrim(display_name)) > 0),
  constraint members_schema_version_check check (schema_version = 1),
  constraint members_status_check check (status in ('ACTIVE', 'INACTIVE')),
  constraint members_archive_status_check check (archived_at is null or status = 'INACTIVE'),
  constraint members_training_level_check check (training_level is null or training_level in ('L1', 'L2', 'L3', 'L4')),
  constraint members_training_profile_v1_check check (
    pg_catalog.jsonb_typeof(training_profile) = 'object'
    and training_profile->>'schemaVersion' = '1'
    and training_profile ?& array['schemaVersion', 'experienceLevel', 'movementConstraints', 'preferredEquipment', 'notes']
    and (training_profile - array['schemaVersion', 'experienceLevel', 'movementConstraints', 'preferredEquipment', 'notes']::text[]) = '{}'::jsonb
    and pg_catalog.jsonb_typeof(training_profile->'movementConstraints') = 'array'
    and pg_catalog.jsonb_typeof(training_profile->'preferredEquipment') = 'array'
    and (training_profile->'experienceLevel' = 'null'::jsonb or training_profile->>'experienceLevel' in ('BEGINNER', 'INTERMEDIATE', 'ADVANCED'))
    and (pg_catalog.jsonb_typeof(training_profile->'notes') in ('null', 'string'))
  )
);

create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  session_date date not null,
  status text not null default 'PLANNED',
  template_key text not null,
  template_version text,
  level_snapshot text,
  session_title text not null,
  focus_snapshot jsonb not null,
  resolved_session_snapshot jsonb not null,
  member_copy_text text,
  coach_note text,
  schema_version integer not null default 1,
  idempotency_key text,
  request_fingerprint text,
  completion_fingerprint text,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint training_sessions_status_check check (status in ('PLANNED', 'COMPLETED', 'CANCELLED')),
  constraint training_sessions_level_snapshot_check check (level_snapshot is null or level_snapshot in ('L1', 'L2', 'L3', 'L4')),
  constraint training_sessions_schema_version_check check (schema_version = 1),
  constraint training_sessions_revision_check check (revision > 0),
  constraint training_sessions_template_key_nonempty check (length(btrim(template_key)) > 0),
  constraint training_sessions_title_nonempty check (length(btrim(session_title)) > 0),
  constraint training_sessions_focus_snapshot_v1_check check (
    pg_catalog.jsonb_typeof(focus_snapshot) = 'object'
    and focus_snapshot->>'schemaVersion' = '1'
    and pg_catalog.jsonb_typeof(focus_snapshot->'patterns') = 'array'
    and pg_catalog.jsonb_typeof(focus_snapshot->'primaryMuscles') = 'array'
  ),
  constraint training_sessions_resolved_snapshot_check check (
    pg_catalog.jsonb_typeof(resolved_session_snapshot) = 'object'
    and resolved_session_snapshot->>'schemaVersion' = '1'
    and resolved_session_snapshot->>'templateId' = template_key
  ),
  constraint training_sessions_completed_at_check check (
    (status = 'COMPLETED' and completed_at is not null)
    or (status <> 'COMPLETED' and completed_at is null)
  ),
  constraint training_sessions_idempotency_fingerprint_check check (
    (idempotency_key is null and request_fingerprint is null)
    or (idempotency_key is not null and request_fingerprint is not null)
  ),
  constraint training_sessions_completion_fingerprint_check check (
    (status = 'COMPLETED' and completion_fingerprint is not null)
    or (status <> 'COMPLETED' and completion_fingerprint is null)
  )
);

create table public.training_session_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  schema_version integer not null default 1,
  phase text not null,
  slot_key text,
  sort_order integer not null,
  planned_action_id text,
  planned_action_snapshot jsonb,
  performed_action_id text,
  performed_action_snapshot jsonb,
  planned_prescription_snapshot jsonb not null,
  performed_prescription jsonb,
  sets integer,
  reps text,
  load_kg numeric(8, 2),
  rir numeric(3, 1),
  rpe numeric(3, 1),
  completed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_session_items_phase_check check (
    phase in ('PRIMARY', 'SECONDARY', 'ACCESSORY', 'CORE', 'CONDITIONING', 'FOAM', 'PREP', 'MOBILITY', 'UNKNOWN')
  ),
  constraint training_session_items_sort_order_check check (sort_order >= 0),
  constraint training_session_items_schema_version_check check (schema_version = 1),
  constraint training_session_items_prescription_v1_check check (
    pg_catalog.jsonb_typeof(planned_prescription_snapshot) = 'object'
    and planned_prescription_snapshot->>'schemaVersion' = '1'
  ),
  constraint training_session_items_performed_prescription_v1_check check (
    performed_prescription is null
    or (pg_catalog.jsonb_typeof(performed_prescription) = 'object' and performed_prescription->>'schemaVersion' = '1')
  ),
  constraint training_session_items_planned_action_pair_check check (
    (planned_action_id is null and planned_action_snapshot is null)
    or (planned_action_id is not null and pg_catalog.jsonb_typeof(planned_action_snapshot) = 'object' and planned_action_snapshot->>'schemaVersion' = '1' and planned_action_snapshot->>'actionId' = planned_action_id)
  ),
  constraint training_session_items_performed_action_pair_check check (
    (performed_action_id is null and performed_action_snapshot is null)
    or (performed_action_id is not null and pg_catalog.jsonb_typeof(performed_action_snapshot) = 'object' and performed_action_snapshot->>'schemaVersion' = '1' and performed_action_snapshot->>'actionId' = performed_action_id)
  ),
  constraint training_session_items_actual_values_check check (
    (sets is null or sets >= 0)
    and (load_kg is null or load_kg >= 0)
    and (rir is null or rir between 0 and 10)
    and (rpe is null or rpe between 0 and 10)
  ),
  constraint training_session_items_session_order_unique unique (session_id, sort_order)
);

create index training_sessions_member_date_idx
  on public.training_sessions (member_id, session_date desc);

create index training_sessions_member_status_date_idx
  on public.training_sessions (member_id, status, session_date desc);

create unique index training_sessions_member_idempotency_idx
  on public.training_sessions (member_id, idempotency_key)
  where idempotency_key is not null;

create index members_status_display_name_idx
  on public.members (status, display_name);

create index members_archived_at_idx
  on public.members (archived_at desc, display_name)
  where archived_at is not null;

create index training_session_items_session_order_idx
  on public.training_session_items (session_id, sort_order);

alter table public.members enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_items enable row level security;

revoke all on table public.members from public, anon, authenticated;
revoke all on table public.training_sessions from public, anon, authenticated;
revoke all on table public.training_session_items from public, anon, authenticated;

grant select, insert, update on table public.members to service_role;
grant select, insert, update on table public.training_sessions to service_role;
grant select, insert, update on table public.training_session_items to service_role;

create or replace function public.member_save_planned_session(p_snapshot jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session jsonb;
  v_item jsonb;
  v_items jsonb;
  v_session_id uuid;
  v_member_id uuid;
  v_idempotency_key text;
  v_fingerprint text;
  v_revision integer;
  v_inserted integer;
  v_item_count integer;
  v_member_status text;
  v_archived_at timestamptz;
  v_existing public.training_sessions%rowtype;
begin
  if pg_catalog.jsonb_typeof(p_snapshot) is distinct from 'object'
    or p_snapshot->>'schemaVersion' is distinct from '1'
    or pg_catalog.jsonb_typeof(p_snapshot->'session') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_snapshot->'items') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'MEMBER_INVALID_SNAPSHOT';
  end if;

  v_session := p_snapshot->'session';
  v_items := p_snapshot->'items';
  v_item_count := pg_catalog.jsonb_array_length(v_items);
  if v_item_count < 1 or v_item_count > 80 then
    raise exception using errcode = '22023', message = 'MEMBER_INVALID_ITEM_COUNT';
  end if;
  if v_session->>'schemaVersion' is distinct from '1'
    or v_session->>'status' is distinct from 'PLANNED'
    or v_session->'completedAt' is distinct from 'null'::jsonb then
    raise exception using errcode = '22023', message = 'MEMBER_INVALID_PLANNED_SESSION';
  end if;

  v_session_id := (v_session->>'id')::uuid;
  v_member_id := (v_session->>'memberId')::uuid;
  v_idempotency_key := nullif(v_session->>'idempotencyKey', '');
  v_fingerprint := pg_catalog.md5(p_snapshot::text);

  select status, archived_at
    into v_member_status, v_archived_at
    from public.members
   where id = v_member_id
   for share;
  if not found then
    raise exception using errcode = '23503', message = 'MEMBER_NOT_FOUND';
  end if;
  if v_member_status <> 'ACTIVE' or v_archived_at is not null then
    raise exception using errcode = '23514', message = 'MEMBER_NOT_ACTIVE';
  end if;

  insert into public.training_sessions (
    id, member_id, session_date, status, template_key, template_version,
    level_snapshot, session_title, focus_snapshot, resolved_session_snapshot,
    member_copy_text, coach_note, schema_version, idempotency_key,
    request_fingerprint, completion_fingerprint, revision, created_at, updated_at, completed_at
  ) values (
    v_session_id,
    v_member_id,
    (v_session->>'sessionDate')::date,
    'PLANNED',
    v_session->>'templateKey',
    v_session->>'templateVersion',
    v_session->>'levelSnapshot',
    v_session->>'sessionTitle',
    v_session->'focusSnapshot',
    v_session->'resolvedSessionSnapshot',
    v_session->>'memberCopyText',
    v_session->>'coachNote',
    (v_session->>'schemaVersion')::integer,
    v_idempotency_key,
    case when v_idempotency_key is null then null else v_fingerprint end,
    null,
    1,
    (v_session->>'createdAt')::timestamptz,
    (v_session->>'updatedAt')::timestamptz,
    null
  )
  on conflict (member_id, idempotency_key) where idempotency_key is not null do nothing
  returning revision into v_revision;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    select * into v_existing
      from public.training_sessions
     where member_id = v_member_id
       and idempotency_key = v_idempotency_key;
    if not found then
      raise exception using errcode = '23505', message = 'MEMBER_IDEMPOTENCY_CONFLICT';
    end if;
    if v_existing.request_fingerprint is distinct from v_fingerprint then
      raise exception using errcode = '23505', message = 'MEMBER_IDEMPOTENCY_CONFLICT';
    end if;
    return pg_catalog.jsonb_build_object(
      'sessionId', v_existing.id,
      'revision', v_existing.revision,
      'status', v_existing.status,
      'idempotentReplay', true
    );
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(v_items) as input(value)
  loop
    if pg_catalog.jsonb_typeof(v_item) is distinct from 'object'
      or v_item->>'schemaVersion' is distinct from '1'
      or v_item->>'sessionId' is distinct from v_session_id::text
      or coalesce((v_item->>'completed')::boolean, true) then
      raise exception using errcode = '22023', message = 'MEMBER_INVALID_PLANNED_ITEM';
    end if;

    insert into public.training_session_items (
      id, session_id, schema_version, phase, slot_key, sort_order, planned_action_id,
      planned_action_snapshot, performed_action_id, performed_action_snapshot,
      planned_prescription_snapshot, performed_prescription, sets, reps,
      load_kg, rir, rpe, completed, note
    ) values (
      (v_item->>'id')::uuid,
      v_session_id,
      (v_item->>'schemaVersion')::integer,
      v_item->>'phase',
      v_item->>'slotKey',
      (v_item->>'sortOrder')::integer,
      v_item->>'plannedActionId',
      nullif(v_item->'plannedActionSnapshot', 'null'::jsonb),
      v_item->>'performedActionId',
      nullif(v_item->'performedActionSnapshot', 'null'::jsonb),
      v_item->'plannedPrescriptionSnapshot',
      nullif(v_item->'performedPrescription', 'null'::jsonb),
      nullif(v_item->>'sets', 'null')::integer,
      v_item->>'reps',
      nullif(v_item->>'loadKg', 'null')::numeric,
      nullif(v_item->>'rir', 'null')::numeric,
      nullif(v_item->>'rpe', 'null')::numeric,
      false,
      v_item->>'note'
    );
  end loop;

  return pg_catalog.jsonb_build_object(
    'sessionId', v_session_id,
    'revision', v_revision,
    'status', 'PLANNED',
    'idempotentReplay', false
  );
end;
$$;

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

create or replace function public.member_cancel_training_session(
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

  update public.training_sessions
     set status = 'CANCELLED',
         completed_at = null,
         revision = revision + 1,
         updated_at = now()
   where id = p_session_id;

  return pg_catalog.jsonb_build_object(
    'sessionId', p_session_id,
    'revision', v_session.revision + 1,
    'status', 'CANCELLED'
  );
end;
$$;

revoke all on function public.member_save_planned_session(jsonb) from public, anon, authenticated;
revoke all on function public.member_complete_training_session(uuid, integer, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.member_cancel_training_session(uuid, integer) from public, anon, authenticated;

grant execute on function public.member_save_planned_session(jsonb) to service_role;
grant execute on function public.member_complete_training_session(uuid, integer, timestamptz, jsonb) to service_role;
grant execute on function public.member_cancel_training_session(uuid, integer) to service_role;
