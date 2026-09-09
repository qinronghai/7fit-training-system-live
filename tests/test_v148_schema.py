import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
SCHEMA_DIR = ROOT / "schemas" / "v14.8"
VALIDATOR = ROOT / "tools" / "validate_v148_schema.py"


def load_schema_json(name):
    return json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


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


def test_session_schema_requires_six_formal_slots():
    schema = load_schema_json("session")
    slots = schema["properties"]["slots"]
    assert slots["minItems"] == 6
    assert slots["maxItems"] == 6
    assert slots["items"]["properties"]["slotKey"]["enum"] == ["A", "B", "C", "D1", "D2", "CORE"]


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
    assert schema["properties"]["coreDemands"]["required"] == [
        "anti_extension",
        "anti_rotation",
        "anti_lateral_flexion",
        "dynamic_rotation",
        "breathing_pressure",
        "loaded_integration",
    ]


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
