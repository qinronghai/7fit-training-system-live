do $member_management_v1_release_gate$
declare
  v_member_id uuid := gen_random_uuid();
  v_session_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_first jsonb;
  v_replay jsonb;
  v_completion jsonb;
  v_performed_item jsonb;
  v_session public.training_sessions%rowtype;
  v_item public.training_session_items%rowtype;
  v_stale_rejected boolean := false;
begin
  insert into public.members (id, display_name, status, training_level, training_profile)
  values (
    v_member_id,
    'Member V1 Database Gate',
    'ACTIVE',
    'L2',
    '{"schemaVersion":1,"experienceLevel":"BEGINNER","movementConstraints":[],"preferredEquipment":[],"notes":null}'::jsonb
  );

  v_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'session', jsonb_build_object(
      'schemaVersion', 1,
      'id', v_session_id,
      'memberId', v_member_id,
      'sessionDate', current_date,
      'status', 'PLANNED',
      'templateKey', 'f111',
      'templateVersion', 'member-v1-database-gate',
      'levelSnapshot', 'L2',
      'sessionTitle', 'Member V1 Database Gate',
      'focusSnapshot', jsonb_build_object('schemaVersion', 1, 'patterns', jsonb_build_array('SQUAT'), 'primaryMuscles', jsonb_build_array('股四头肌')),
      'resolvedSessionSnapshot', jsonb_build_object('schemaVersion', 1, 'templateId', 'f111'),
      'memberCopyText', null,
      'coachNote', null,
      'createdAt', now(),
      'updatedAt', now(),
      'completedAt', null,
      'idempotencyKey', 'member-v1-db-gate-' || v_session_id::text
    ),
    'items', jsonb_build_array(jsonb_build_object(
      'schemaVersion', 1,
      'id', v_item_id,
      'sessionId', v_session_id,
      'phase', 'PRIMARY',
      'slotKey', 'A',
      'sortOrder', 0,
      'plannedActionId', 'db_gate_squat',
      'plannedActionSnapshot', jsonb_build_object(
        'schemaVersion', 1,
        'actionId', 'db_gate_squat',
        'name', '数据库门禁深蹲',
        'pattern', '蹲',
        'level', 'L2',
        'primaryMuscles', jsonb_build_array('股四头肌'),
        'secondaryMuscles', jsonb_build_array('臀大肌'),
        'equipment', '杠铃',
        'stationId', null
      ),
      'performedActionId', null,
      'performedActionSnapshot', null,
      'plannedPrescriptionSnapshot', jsonb_build_object(
        'schemaVersion', 1,
        'sets', 3,
        'reps', 10,
        'rir', 2,
        'restSeconds', 90,
        'tempo', null,
        'loadPrescription', null,
        'rawText', '3组 × 10次'
      ),
      'performedPrescription', null,
      'sets', null,
      'reps', null,
      'loadKg', null,
      'rir', null,
      'rpe', null,
      'completed', false,
      'note', null
    ))
  );

  v_first := public.member_save_planned_session(v_snapshot);
  v_replay := public.member_save_planned_session(v_snapshot);
  if v_first->>'idempotentReplay' <> 'false' or v_replay->>'idempotentReplay' <> 'true'
    or v_first->>'sessionId' <> v_session_id::text or v_replay->>'sessionId' <> v_session_id::text then
    raise exception 'planned session idempotency replay contract failed';
  end if;
  if (select count(*) from public.training_sessions where member_id = v_member_id) <> 1
    or (select count(*) from public.training_session_items where session_id = v_session_id) <> 1 then
    raise exception 'planned request replay created duplicate session or items';
  end if;

  v_performed_item := jsonb_build_object(
    'schemaVersion', 1,
    'id', v_item_id,
    'sessionId', v_session_id,
    'performedActionId', 'db_gate_kettlebell_squat',
    'performedActionSnapshot', jsonb_build_object(
      'schemaVersion', 1,
      'actionId', 'db_gate_kettlebell_squat',
      'name', '数据库门禁壶铃深蹲',
      'pattern', '蹲',
      'level', 'L2',
      'primaryMuscles', jsonb_build_array('股四头肌', '臀大肌'),
      'secondaryMuscles', jsonb_build_array('腹肌'),
      'equipment', '壶铃',
      'stationId', null
    ),
    'performedPrescription', null,
    'sets', 3,
    'reps', '10',
    'loadKg', 20,
    'rir', 2,
    'rpe', 8,
    'completed', true,
    'note', '数据库并发门禁实际记录'
  );
  v_completion := public.member_complete_training_session(v_session_id, 1, now(), jsonb_build_array(v_performed_item));
  if v_completion->>'status' <> 'COMPLETED' or (v_completion->>'revision')::integer <> 2 then
    raise exception 'first writer did not complete at revision 2';
  end if;

  begin
    perform public.member_cancel_training_session(v_session_id, 1);
    raise exception 'stale second writer unexpectedly succeeded';
  exception when serialization_failure then
    v_stale_rejected := true;
  end;
  if not v_stale_rejected then
    raise exception 'stale second writer was not rejected';
  end if;

  select * into v_session from public.training_sessions where id = v_session_id;
  select * into v_item from public.training_session_items where id = v_item_id;
  if v_session.status <> 'COMPLETED' or v_session.revision <> 2 or v_session.completion_fingerprint is null then
    raise exception 'stale second writer changed the winning session state';
  end if;
  if v_item.performed_action_snapshot is distinct from v_performed_item->'performedActionSnapshot'
    or v_item.planned_action_snapshot is distinct from v_snapshot#>'{items,0,plannedActionSnapshot}'
    or v_item.sets <> 3 or v_item.reps <> '10' or v_item.load_kg <> 20 or not v_item.completed then
    raise exception 'stale second writer changed winning item data or planned snapshot';
  end if;

  delete from public.training_sessions where id = v_session_id;
  delete from public.members where id = v_member_id;
  raise notice 'Member V1 release gate PASS: replay is idempotent and stale revision writes preserve the winning data';
exception when others then
  raise;
end;
$member_management_v1_release_gate$;

select 'PASS: planned save replay is idempotent and stale revision writes preserve winning data' as member_v1_database_release_gate;
