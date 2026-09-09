import json
from copy import deepcopy
from pathlib import Path

from tools import validate_v148_schema as schema_validator
from tools.validate_v148_schema import load_runtime_data, validate_payload, validate_repository

ROOT = Path(__file__).parents[1]
SCHEMA_DIR = ROOT / "schemas" / "v14.8"
VALIDATOR = ROOT / "tools" / "validate_v148_schema.py"
DATA_FILE = ROOT / "data" / "system-data.js"
DEPLOY_WORKFLOW = ROOT / ".github" / "workflows" / "deploy-pages.yml"
SCHEMA_WORKFLOW = ROOT / ".github" / "workflows" / "schema-check.yml"


def load_schema_json(name):
    return json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def has_error(errors, *needles):
    text = "\n".join(errors)
    return all(needle in text for needle in needles)


def test_v148_schema_bundle_exists():
    expected = {
        "action.schema.json",
        "session.schema.json",
        "composer.schema.json",
        "support.schema.json",
        "core.schema.json",
        "prep.schema.json",
        "foam.schema.json",
    }
    assert SCHEMA_DIR.is_dir(), "schemas/v14.8 must exist"
    assert expected <= {p.name for p in SCHEMA_DIR.glob("*.json")}


def test_action_schema_declares_runtime_enums():
    schema = load_schema_json("action")
    assert schema["required"] == ["id", "name", "route", "status"]
    assert schema["properties"]["route"]["enum"] == [
        "1F_ONLY",
        "2F_ONLY",
        "FLEX_1F_2F",
        "POST_CARDIO_ONLY",
        "CONDITIONING_2F",
        "RECOVERY_2F",
    ]
    assert schema["properties"]["status"]["enum"] == [
        "可自动编排",
        "待人工验收",
        "SUPPORT_CANON",
        "CORE_CANON",
    ]
    assert schema["properties"]["tier"]["enum"] == [
        "",
        "T1",
        "T2",
        "T3",
        "T4",
        "CORE-L1",
        "CORE-L2",
        "CORE-L3",
        "CORE-L4",
    ]
    assert schema["properties"]["coreDemand"] == {"type": "string", "minLength": 1}


def test_session_schema_requires_six_formal_slots():
    schema = load_schema_json("session")
    slots = schema["properties"]["slots"]
    assert slots["minItems"] == 6
    assert slots["maxItems"] == 6
    slot_key = slots["items"]["properties"]["slotKey"]
    assert slot_key["type"] == "string"
    assert slot_key["minLength"] == 1
    assert slot_key["pattern"] == r"^F111-\d{2}-L[1-4]__(A|B|SUPPORT|2|3|CORE)$"


def test_composer_schema_freezes_core_structure():
    schema = load_schema_json("composer")
    assert schema["required"] == [
        "lowerModes",
        "upperModes",
        "levelMap",
        "supportMap",
        "coreMap",
        "coreDemands",
        "auxiliaryRules",
        "officialPresetMap",
    ]
    assert schema["properties"]["lowerModes"]["required"] == [
        "squat",
        "hinge",
        "hip_extension",
        "single_leg_squat",
        "single_leg_hinge",
    ]
    assert schema["properties"]["upperModes"]["required"] == [
        "horizontal_pull",
        "vertical_pull",
        "horizontal_push",
        "vertical_push",
    ]
    core_demands = schema["properties"]["coreDemands"]
    assert core_demands["required"] == [
        "anti_extension",
        "anti_rotation",
        "anti_lateral_flexion",
        "dynamic_rotation",
        "breathing_pressure",
        "loaded_integration",
    ]
    assert core_demands["additionalProperties"] is False
    preset_items = schema["properties"]["officialPresetMap"]["additionalProperties"]
    assert preset_items["type"] == "array"
    assert preset_items["minItems"] == 2
    assert preset_items["maxItems"] == 2


def test_collection_schemas_freeze_inventory_and_minimum_fields():
    expected = {
        "support": (30, ["ids", "details"]),
        "core": (20, ["ids", "details"]),
        "prep": (20, ["ids", "details", "matchByPattern"]),
        "foam": (12, ["ids", "details", "matchByPattern"]),
    }
    for name, (count, required) in expected.items():
        schema = load_schema_json(name)
        assert schema["required"] == required
        assert schema["properties"]["ids"]["minItems"] == count
        assert schema["properties"]["ids"]["maxItems"] == count
        assert schema["properties"]["ids"]["uniqueItems"] is True


def test_repository_validator_entrypoint_exists():
    assert VALIDATOR.is_file(), "tools/validate_v148_schema.py must exist"


def test_current_runtime_payload_passes_v148_schema():
    assert validate_repository(ROOT) == []


def test_unknown_action_route_is_rejected():
    data = payload()
    action_id, action = next(iter(data["actions"].items()))
    action["route"] = "UNKNOWN_ROUTE"
    errors = validate_payload(data)
    assert has_error(errors, action_id, "route")


def test_unknown_action_status_is_rejected():
    data = payload()
    action_id, action = next(iter(data["actions"].items()))
    action["status"] = "UNKNOWN_STATUS"
    errors = validate_payload(data)
    assert has_error(errors, action_id, "status")


def test_unknown_action_tier_is_rejected():
    data = payload()
    action_id, action = next((item for item in data["actions"].items() if "tier" in item[1]))
    action["tier"] = "T99"
    errors = validate_payload(data)
    assert has_error(errors, action_id, "tier")


def test_unknown_composer_core_demand_key_is_rejected():
    data = payload()
    data["composer"]["coreDemands"]["unknown_demand"] = []
    errors = validate_payload(data)
    assert has_error(errors, "composer", "coreDemands", "unknown_demand")


def test_empty_action_core_demand_is_rejected_when_present():
    data = payload()
    action_id, action = next((item for item in data["actions"].items() if item[1].get("coreDemand")))
    action["coreDemand"] = ""
    errors = validate_payload(data)
    assert has_error(errors, action_id, "coreDemand")


def test_missing_required_action_id_is_rejected():
    data = payload()
    action_key, action = next(iter(data["actions"].items()))
    action.pop("id", None)
    errors = validate_payload(data)
    assert has_error(errors, action_key, "id")


def test_unknown_session_baseline_reference_is_rejected():
    data = payload()
    session_id, session = next(iter(data["sessions"].items()))
    session["slots"][0]["baselineId"] = "missing-action-id"
    errors = validate_payload(data)
    assert has_error(errors, session_id, "baselineId", "missing-action-id")


def test_session_slot_key_prefix_drift_is_rejected():
    data = payload()
    session_id, session = next(iter(data["sessions"].items()))
    session["slots"][0]["slotKey"] = "F111-99-L4__A"
    errors = validate_payload(data)
    assert has_error(errors, session_id, "slotKey")


def test_d1_d2_auxiliary_flex_route_is_rejected():
    data = payload()
    aux_id = data["composer"]["auxiliaryRules"]["lower"]["squat"][0]
    data["actions"][aux_id]["route"] = "FLEX_1F_2F"
    errors = validate_payload(data)
    assert has_error(errors, aux_id, "auxiliary", "1F_ONLY")


def test_official_preset_unknown_mode_is_rejected():
    data = payload()
    data["composer"]["officialPresetMap"]["F111-01"] = ["unknown_lower", "horizontal_pull"]
    errors = validate_payload(data)
    assert has_error(errors, "officialPresetMap", "F111-01", "unknown_lower")


def test_support_inventory_drift_is_rejected():
    data = payload()
    data["supportIds"] = data["supportIds"][:-1]
    errors = validate_payload(data)
    assert has_error(errors, "support", "30")


def test_schema_cli_success_output(monkeypatch, capsys):
    monkeypatch.setattr(schema_validator, "validate_repository", lambda root=ROOT: [])
    assert schema_validator.main() == 0
    assert "V14.8 schema validation: PASS" in capsys.readouterr().out


def test_schema_cli_failure_output(monkeypatch, capsys):
    monkeypatch.setattr(
        schema_validator,
        "validate_repository",
        lambda root=ROOT: ["actions.bad.route: invalid"],
    )
    assert schema_validator.main() == 1
    output = capsys.readouterr().out
    assert "V14.8 schema validation: FAIL" in output
    assert "actions.bad.route: invalid" in output


def test_release_workflows_gate_schema_validation():
    deploy = DEPLOY_WORKFLOW.read_text(encoding="utf-8")
    schema_workflow = SCHEMA_WORKFLOW.read_text(encoding="utf-8")
    assert "jsonschema" in deploy
    assert "tools/validate_v148_schema.py" in deploy
    assert "pull_request:" in schema_workflow
    assert 'branches: ["feature/issue-3-v148-data-schema"]' not in schema_workflow
    assert "tools/validate_v148_schema.py" in schema_workflow
