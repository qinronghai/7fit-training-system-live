do $member_management_v1_release_gate$
declare
  v_member_id uuid := gen_random_uuid();
  v_session_id uuid := gen_random_uuid();
  v_item_id uuid := gen_random_uuid();
  v_delete_session_id uuid := gen_random_uuid();
  v_delete_item_id uuid := gen_random_uuid();
  v_cancel_session_id uuid := gen_random_uuid();
  v_cancel_item_id uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_delete_snapshot jsonb;
  v_first jsonb;
  v_replay jsonb;
  v_completion jsonb;
  v_deleted jsonb;
  v_cancelled jsonb;
  v_performed_item jsonb;
  v_session public.training_sessions%rowtype;
  v_item public.training_session_items%rowtype;
  v_stale_rejected boolean := false;
  v_stale_delete_rejected boolean := false;
  v_completed_delete_rejected boolean := false;
  v_cancelled_delete_rejected boolean := false;
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

  begin
    perform public.member_delete_planned_training_session(v_session_id, 2);
    raise exception 'completed session unexpectedly allowed deletion';
  exception when check_violation then
    v_completed_delete_rejected := true;
  end;
  if not v_completed_delete_rejected then
    raise exception 'completed session deletion was not rejected';
  end if;

  v_delete_snapshot := jsonb_set(v_snapshot, '{session,id}', to_jsonb(v_delete_session_id::text));
  v_delete_snapshot := jsonb_set(v_delete_snapshot, '{session,idempotencyKey}', to_jsonb('member-v1-db-gate-delete-' || v_delete_session_id::text));
  v_delete_snapshot := jsonb_set(v_delete_snapshot, '{items,0,id}', to_jsonb(v_delete_item_id::text));
  v_delete_snapshot := jsonb_set(v_delete_snapshot, '{items,0,sessionId}', to_jsonb(v_delete_session_id::text));
  perform public.member_save_planned_session(v_delete_snapshot);

  begin
    perform public.member_delete_planned_training_session(v_delete_session_id, 2);
    raise exception 'stale planned-session deletion unexpectedly succeeded';
  exception when serialization_failure then
    v_stale_delete_rejected := true;
  end;
  if not v_stale_delete_rejected
    or not exists (select 1 from public.training_sessions where id = v_delete_session_id and status = 'PLANNED' and revision = 1)
    or (select count(*) from public.training_session_items where session_id = v_delete_session_id) <> 1 then
    raise exception 'stale deletion changed the planned session or its item';
  end if;

  v_deleted := public.member_delete_planned_training_session(v_delete_session_id, 1);
  if v_deleted->>'sessionId' <> v_delete_session_id::text
    or v_deleted->>'status' <> 'DELETED'
    or v_deleted->>'deleted' <> 'true'
    or (v_deleted->>'revision')::integer <> 2 then
    raise exception 'planned session deletion returned an invalid result';
  end if;
  if exists (select 1 from public.training_sessions where id = v_delete_session_id)
    or exists (select 1 from public.training_session_items where session_id = v_delete_session_id) then
    raise exception 'planned session deletion did not remove its row and cascade its item';
  end if;

  v_delete_snapshot := jsonb_set(v_delete_snapshot, '{session,id}', to_jsonb(v_cancel_session_id::text));
  v_delete_snapshot := jsonb_set(v_delete_snapshot, '{session,idempotencyKey}', to_jsonb('member-v1-db-gate-cancel-' || v_cancel_session_id::text));
  v_delete_snapshot := jsonb_set(v_delete_snapshot, '{items,0,id}', to_jsonb(v_cancel_item_id::text));
  v_delete_snapshot := jsonb_set(v_delete_snapshot, '{items,0,sessionId}', to_jsonb(v_cancel_session_id::text));
  perform public.member_save_planned_session(v_delete_snapshot);
  v_cancelled := public.member_cancel_training_session(v_cancel_session_id, 1);
  if v_cancelled->>'status' <> 'CANCELLED' then
    raise exception 'cancelled-session fixture did not enter CANCELLED';
  end if;

  begin
    perform public.member_delete_planned_training_session(v_cancel_session_id, 2);
    raise exception 'cancelled session unexpectedly allowed deletion';
  exception when check_violation then
    v_cancelled_delete_rejected := true;
  end;
  if not v_cancelled_delete_rejected
    or not exists (select 1 from public.training_sessions where id = v_cancel_session_id and status = 'CANCELLED')
    or (select count(*) from public.training_session_items where session_id = v_cancel_session_id) <> 1 then
    raise exception 'cancelled session or its item changed during rejected deletion';
  end if;

  delete from public.training_sessions where id = v_session_id;
  delete from public.training_sessions where id = v_cancel_session_id;
  delete from public.members where id = v_member_id;
  raise notice 'Member V1 release gate PASS: planned deletion is revision-safe, cascades items, and preserves completed/cancelled history';
exception when others then
  raise;
end;
$member_management_v1_release_gate$;

select 'PASS: planned deletion is revision-safe, cascades items, and preserves completed/cancelled history' as member_v1_database_release_gate;
