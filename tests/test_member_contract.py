import json
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


ROOT = Path(__file__).parents[1]
SCHEMA_PATH = ROOT / "schemas" / "member-v1.schema.json"
FIXTURE_ROOT = ROOT / "tests" / "fixtures" / "member-v1"


def load_fixture(name):
    return json.loads((FIXTURE_ROOT / name).read_text(encoding="utf-8"))


def validator():
    assert SCHEMA_PATH.is_file(), "Member V1 contract schema missing"
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def errors(value):
    return sorted(validator().iter_errors(value), key=lambda error: list(error.absolute_path))


def test_schema_defines_all_v1_entities_and_context():
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    definitions = schema["$defs"]
    assert {"member", "trainingSession", "trainingSessionItem", "trainingSessionSnapshot", "memberTrainingContext"} <= set(definitions)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    Draft202012Validator.check_schema(schema)


def test_member_and_f111_snapshot_fixtures_match_schema():
    assert errors(load_fixture("member-active.json")) == []
    planned = load_fixture("f111-training-session.json")
    assert planned["schemaVersion"] == 1
    assert errors(planned["session"]) == []
    for item in planned["items"]:
        assert errors(item) == []
    assert planned["session"]["status"] == "PLANNED"
    assert len(planned["items"]) >= 5
    assert [item["phase"] for item in planned["items"]] == ["PRIMARY", "SECONDARY", "ACCESSORY", "ACCESSORY", "ACCESSORY", "CORE"]
    assert planned["session"]["resolvedSessionSnapshot"]["templateId"] == "f111"


def test_completed_replacement_fixture_retains_both_snapshots():
    value = load_fixture("replaced-action-completed.json")
    assert errors(value["session"]) == []
    for item in value["items"]:
        assert errors(item) == []
    assert value["session"]["status"] == "COMPLETED"
    replacements = [item for item in value["items"] if item["plannedActionId"] != item["performedActionId"]]
    assert replacements
    assert replacements[0]["plannedActionSnapshot"]["actionId"] == replacements[0]["plannedActionId"]
    assert replacements[0]["performedActionSnapshot"]["actionId"] == replacements[0]["performedActionId"]


def test_schema_rejects_unknown_status_and_arbitrary_profile_keys():
    member = load_fixture("member-active.json")
    member["status"] = "ARCHIVED"
    assert errors(member)

    member = load_fixture("member-active.json")
    member["trainingProfile"]["privateUiBlob"] = {"untracked": True}
    assert errors(member)


def test_database_entity_identifiers_are_uuids():
    member = load_fixture("member-active.json")
    member["id"] = "member-123"
    assert errors(member)

    session = load_fixture("f111-training-session.json")["session"]
    session["id"] = "session-123"
    assert errors(session)

    session = load_fixture("f111-training-session.json")["session"]
    session["memberId"] = "member-123"
    assert errors(session)


def test_schema_rejects_completed_session_without_completion_timestamp():
    session = load_fixture("replaced-action-completed.json")["session"]
    session["completedAt"] = None
    assert errors(session)


def test_schema_rejects_empty_goal_key_and_impossible_calendar_date():
    member = load_fixture("member-active.json")
    member["primaryGoal"] = ""
    assert errors(member)

    session = load_fixture("f111-training-session.json")["session"]
    session["idempotencyKey"] = ""
    assert errors(session)

    session = load_fixture("f111-training-session.json")["session"]
    session["idempotencyKey"] = None
    assert errors(session)

    session = load_fixture("f111-training-session.json")["session"]
    session["sessionDate"] = "2026-02-31"
    assert errors(session)


def test_schema_keeps_unknown_phase_explicit_and_non_load_bearing():
    planned = load_fixture("f111-training-session.json")
    item = dict(planned["items"][0])
    item["phase"] = "UNKNOWN"
    assert errors(item) == []
    item["phase"] = "MAGIC"
    assert errors(item)


def test_profile_and_prescription_limits_are_frozen_in_schema():
    member = load_fixture("member-active.json")
    member["trainingProfile"]["movementConstraints"] = ["knee"] * 41
    assert errors(member)

    member = load_fixture("member-active.json")
    member["trainingProfile"]["movementConstraints"] = ["x" * 241]
    assert errors(member)

    member = load_fixture("member-active.json")
    member["trainingProfile"]["preferredEquipment"] = ["dumbbell"] * 81
    assert errors(member)

    planned = load_fixture("f111-training-session.json")
    planned["items"][0]["sets"] = 101
    assert errors(planned["items"][0])
    planned = load_fixture("f111-training-session.json")
    planned["items"][0]["plannedPrescriptionSnapshot"]["sets"] = 101
    assert errors(planned["items"][0])
