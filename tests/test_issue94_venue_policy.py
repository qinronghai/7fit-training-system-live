import json
from pathlib import Path

from jsonschema import Draft202012Validator


ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"


def load(name):
    return json.loads((SRC / name).read_text(encoding="utf-8"))


def test_venue_capability_policy_has_formal_schema_and_runtime_ownership():
    policy = load("venue.json")["venueCapabilityPolicy"]
    schema = json.loads((ROOT / "schemas" / "v14.8" / "venue.schema.json").read_text(encoding="utf-8"))
    errors = sorted(Draft202012Validator(schema).iter_errors(policy), key=lambda error: list(error.absolute_path))
    assert not errors, "venue policy schema errors: " + "; ".join(error.message for error in errors)

    manifest = load("manifest.json")
    assert manifest["owners"]["venueCapabilityPolicy"] == "venue.json"
    assert "venueCapabilityPolicy" in manifest["topLevelOrder"]


def test_initial_hard_rules_are_data_not_resolver_constants():
    policy = load("venue.json")["venueCapabilityPolicy"]
    equipment = policy["equipment"]
    assert equipment["eq-hack"]["minimumSystemLoadKg"] == 20
    assert equipment["eq-trapbar"]["minimumSystemLoadKg"] == 20
    assert equipment["eq-hipthrust"]["minimumSystemLoadKg"] is None
    assert policy["bodyLevelMinimumSystemLoadCeilingKg"] == {"L1": 10, "L2": 15, "L3": 30, "L4": 60}
    assert policy["unknownEquipmentPolicy"] == "ALLOW_WITH_UNVERIFIED_AUDIT"


def test_gated_actions_declare_equipment_gate_and_explicit_fallback():
    actions = load("actions.json")["actions"]
    expected = {
        "banjie_hake": ("eq-hack", "BODY-01-KNEE"),
        "hake_shendun": ("eq-hack", "BODY-01-KNEE"),
        "hake_shendun_zhaiju": ("eq-hack", "BODY-01-KNEE"),
        "liujiao_gantui_yingla": ("eq-trapbar", "BODY-02-HINGE"),
    }
    for action_id, (equipment_id, fallback_group) in expected.items():
        action = actions[action_id]
        assert action["requiresEquipmentId"] == [equipment_id]
        assert action["entryLoadSensitivity"] == "fixed_system_load"
        assert action["beginnerLoadGate"] == {"type": "minimum_system_load", "manualOverrideAllowed": True}
        assert action["fallbackActionGroup"] == fallback_group

        schema = json.loads((ROOT / "schemas" / "v14.8" / "action.schema.json").read_text(encoding="utf-8"))
        errors = sorted(Draft202012Validator(schema).iter_errors(action), key=lambda error: list(error.absolute_path))
        assert not errors, f"action schema errors for {action_id}: " + "; ".join(error.message for error in errors)


def test_hip_thrust_family_keeps_machine_default_and_does_not_invent_barbell_machine_load():
    body = load("body.json")
    for level in ("L1", "L2", "L3", "L4"):
        primary = body["bodyFamilies"]["BODY-02"]["levelPools"][level]["preferredBySlot"]["PRIMARY"]
        assert all("barbell" not in action_id.lower() for action_id in primary)
    assert "hipthrust_pause_main" in body["bodyFamilies"]["BODY-02"]["levelPools"]["L4"]["preferredBySlot"]["PRIMARY"]
