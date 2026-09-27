import re
from pathlib import Path


ROOT = Path(__file__).parents[1]
MIGRATIONS = ROOT / "supabase" / "migrations"
ANON_GATE = ROOT / "tests" / "fixtures" / "member-v1" / "anon_access.sql"


def migration_text():
    candidates = sorted(MIGRATIONS.glob("*_member_management_v1.sql"))
    assert candidates, "Member V1 database migration missing"
    assert len(candidates) == 1, "keep one canonical Member V1 migration"
    return candidates[0].read_text(encoding="utf-8").lower()


def compact(sql):
    return re.sub(r"\s+", " ", sql.lower()).strip()


def test_migration_creates_three_separate_contract_tables():
    sql = compact(migration_text())
    for table in ["members", "training_sessions", "training_session_items"]:
        assert f"create table public.{table}" in sql
        assert f"alter table public.{table} enable row level security" in sql
    assert "public.cases" not in sql
    assert "public.case_assets" not in sql


def test_member_fields_archive_and_level_constraints_match_contract():
    sql = compact(migration_text())
    members = sql.split("create table public.members", 1)[1].split(");", 1)[0]
    for column in ["id uuid primary key", "schema_version integer not null default 1", "display_name text not null", "status text not null", "training_level text", "primary_goal text", "training_profile jsonb not null", "coach_notes text", "created_at timestamptz not null", "updated_at timestamptz not null", "archived_at timestamptz"]:
        assert column in members
    assert "training_level is null or training_level in ('l1', 'l2', 'l3', 'l4')" in members
    assert "status in ('active', 'inactive')" in members
    assert "then pg_catalog.jsonb_array_length(training_profile->'movementconstraints') <= 40" in members
    assert "then pg_catalog.jsonb_array_length(training_profile->'preferredequipment') <= 80" in members
    assert "public.member_jsonb_string_array_is_valid(training_profile->'movementconstraints', 40, 240)" in members
    assert "public.member_jsonb_string_array_is_valid(training_profile->'preferredequipment', 80, 120)" in members
    assert "on delete restrict" in compact(sql.split("create table public.training_sessions", 1)[1].split(");", 1)[0])


def test_profile_array_constraint_rejects_non_string_blank_and_oversized_items():
    sql = compact(migration_text())
    signature = "create or replace function public.member_jsonb_string_array_is_valid"
    assert signature in sql
    helper = sql.split(signature, 1)[1].split("$member_jsonb_string_array_is_valid$;", 1)[0]
    assert "language sql immutable parallel safe" in helper
    assert "set search_path = ''" in helper
    assert "pg_catalog.jsonb_array_elements(p_value)" in helper
    assert "pg_catalog.jsonb_typeof(item.value) <> 'string'" in helper
    assert "pg_catalog.btrim(item.value #>> '{}')" in helper
    assert "pg_catalog.length(item.value #>> '{}') > p_max_length" in helper
    assert "revoke all on function public.member_jsonb_string_array_is_valid(jsonb, integer, integer) from public, anon, authenticated" in sql
    assert "grant execute on function public.member_jsonb_string_array_is_valid(jsonb, integer, integer) to service_role" in sql


def test_session_status_revision_and_retry_constraints():
    sql = compact(migration_text())
    sessions = sql.split("create table public.training_sessions", 1)[1].split(");", 1)[0]
    for column in ["member_id uuid not null", "session_date date not null", "status text not null", "template_key text not null", "template_version text", "level_snapshot text", "session_title text not null", "focus_snapshot jsonb not null", "resolved_session_snapshot jsonb not null", "schema_version integer not null", "idempotency_key text not null", "revision integer not null", "completed_at timestamptz", "completion_fingerprint text"]:
        assert column in sessions
    assert "status in ('planned', 'completed', 'cancelled')" in sessions
    assert "(status = 'completed' and completed_at is not null) or (status <> 'completed' and completed_at is null)" in sessions
    assert "create unique index" in sql and "(member_id, idempotency_key)" in sql
    assert "revision > 0" in sessions
    assert "length(idempotency_key) between 8 and 200" in sessions
    assert "completion_fingerprint is not null" in sessions


def test_item_fields_canonical_phase_and_delete_policy():
    sql = compact(migration_text())
    items = sql.split("create table public.training_session_items", 1)[1].split(");", 1)[0]
    for column in ["id uuid primary key", "session_id uuid not null", "schema_version integer not null default 1", "phase text not null", "sort_order integer not null", "planned_action_id text", "planned_action_snapshot jsonb", "performed_action_id text", "performed_action_snapshot jsonb", "planned_prescription_snapshot jsonb not null", "performed_prescription jsonb", "sets integer", "reps text", "load_kg numeric", "rir numeric", "rpe numeric", "completed boolean not null", "note text"]:
        assert column in items
    assert "phase in ('primary', 'secondary', 'accessory', 'core', 'conditioning', 'foam', 'prep', 'mobility', 'unknown')" in items
    assert "on delete cascade" in items
    assert "check (sort_order >= 0)" in items
    assert "sets between 0 and 100" in items
    sessions = compact(sql.split("create table public.training_sessions", 1)[1].split(");", 1)[0])
    assert "then pg_catalog.jsonb_array_length(focus_snapshot->'patterns') <= 120" in sessions
    assert "then pg_catalog.jsonb_array_length(focus_snapshot->'primarymuscles') <= 120" in sessions
    assert "training_session_items_prescription_sets_check" in items
    assert "(planned_prescription_snapshot->>'sets')::numeric between 0 and 100" in items
    assert "(planned_prescription_snapshot->>'sets')::numeric = pg_catalog.trunc" in items
    assert "(performed_prescription->>'sets')::numeric between 0 and 100" in items
    assert "(performed_prescription->>'sets')::numeric = pg_catalog.trunc" in items


def test_indexes_cover_member_history_archive_filters_and_item_order():
    sql = compact(migration_text())
    for fragment in [
        "on public.training_sessions (member_id, session_date desc)",
        "on public.training_sessions (member_id, status, session_date desc)",
        "on public.training_session_items (session_id, sort_order)",
        "on public.members (status, display_name)",
        "on public.members (archived_at desc, display_name) where archived_at is not null",
    ]:
        assert fragment in sql


def test_all_member_tables_have_closed_grants_and_no_browser_policy():
    sql = compact(migration_text())
    for table in ["members", "training_sessions", "training_session_items"]:
        assert f"revoke all on table public.{table} from public, anon, authenticated" in sql
        assert f"grant select, insert, update on table public.{table} to service_role" in sql
    assert "create policy" not in sql
    assert "grant select, insert, update, delete" not in sql


def test_atomic_member_rpcs_are_invoker_only_and_execute_is_service_role_only():
    sql = compact(migration_text())
    for function in ["member_save_planned_session", "member_complete_training_session", "member_cancel_training_session"]:
        assert f"function public.{function}" in sql
        body = sql.split(f"function public.{function}", 1)[1]
        assert "security invoker" in body[:1800]
        assert "set search_path = ''" in body[:1800]
        assert f"revoke all on function public.{function}" in sql
        assert f"grant execute on function public.{function}" in sql
    assert "to service_role" in sql
    assert "to anon" not in sql
    assert "to authenticated" not in sql
    complete = sql.split("function public.member_complete_training_session", 1)[1].split("create or replace function public.member_cancel_training_session", 1)[0]
    assert "completion_fingerprint = v_completion_fingerprint" in complete
    assert "'idempotentreplay', true" in complete
    assert "insert into public.training_session_items" in sql.split("function public.member_save_planned_session", 1)[1]


def test_anon_sql_gate_asserts_no_member_access_and_history_tables_stay_separate():
    assert ANON_GATE.is_file(), "anonymous-access SQL gate missing"
    sql = compact(ANON_GATE.read_text(encoding="utf-8"))
    for table in ["members", "training_sessions", "training_session_items"]:
        assert f"public.{table}" in sql
        assert "has_table_privilege('anon'" in sql
    assert "relrowsecurity" in sql
    assert "case_assets" not in sql
