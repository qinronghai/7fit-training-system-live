import json
from copy import deepcopy
from pathlib import Path

from tools.build_system_data import load_manifest
from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
DATA_FILE = ROOT / "data" / "system-data.js"
TEMPLATE_SOURCE = ROOT / "data" / "src" / "templates.json"
REGISTRY_SCHEMA = ROOT / "schemas" / "v14.8" / "template-registry.schema.json"
EXPECTED_IDS = ["f111", "body", "conditioning", "posture"]
CAPABILITY_KEYS = {
    "preset",
    "composer",
    "prep",
    "anatomy",
    "copy",
    "save",
    "volume",
    "conditioningMetrics",
}


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def has_error(errors, *needles):
    text = "\n".join(errors)
    return all(needle in text for needle in needles)


def test_template_registry_source_and_schema_exist():
    assert TEMPLATE_SOURCE.is_file()
    assert REGISTRY_SCHEMA.is_file()


def test_registry_source_freezes_initial_four_templates():
    data = json.loads(TEMPLATE_SOURCE.read_text(encoding="utf-8"))
    assert data["templateIds"] == EXPECTED_IDS
    assert list(data["templateRegistry"]) == EXPECTED_IDS

    for template_id in EXPECTED_IDS:
        record = data["templateRegistry"][template_id]
        assert record["templateId"] == template_id
        assert record["engine"] == template_id
        assert record["levelSystem"] == "L1-L4"
        assert record["routeBase"] == f"#/coach/{template_id}"
        assert set(record["capabilities"]) == CAPABILITY_KEYS
        assert all(isinstance(value, bool) for value in record["capabilities"].values())

    assert data["templateRegistry"]["f111"]["status"] == "ACTIVE"
    assert data["templateRegistry"]["body"]["status"] == "ACTIVE"
    assert data["templateRegistry"]["conditioning"]["status"] == "ACTIVE"
    assert data["templateRegistry"]["posture"]["status"] == "FUTURE"
    assert not any(data["templateRegistry"]["posture"]["capabilities"].values())


def test_manifest_formally_owns_template_registry_domain():
    manifest = load_manifest(ROOT / "data" / "src")
    assert "templates.json" in manifest["sourceFiles"]
    assert manifest["owners"]["templateIds"] == "templates.json"
    assert manifest["owners"]["templateRegistry"] == "templates.json"
    assert "templateIds" in manifest["topLevelOrder"]
    assert "templateRegistry" in manifest["topLevelOrder"]


def test_generated_runtime_contains_registry_and_validates():
    data = payload()
    assert data["templateIds"] == EXPECTED_IDS
    assert set(data["templateRegistry"]) == set(EXPECTED_IDS)
    assert validate_payload(data) == []


def test_registry_rejects_unknown_engine():
    data = payload()
    data["templateRegistry"]["body"]["engine"] = "universal"
    errors = validate_payload(data)
    assert has_error(errors, "templateRegistry", "body", "engine")


def test_registry_rejects_unknown_status():
    data = payload()
    data["templateRegistry"]["body"]["status"] = "BETA"
    errors = validate_payload(data)
    assert has_error(errors, "templateRegistry", "body", "status")


def test_registry_rejects_unknown_capability():
    data = payload()
    data["templateRegistry"]["f111"]["capabilities"]["magic"] = True
    errors = validate_payload(data)
    assert has_error(errors, "templateRegistry", "f111", "capabilities", "magic")


def test_registry_rejects_id_key_drift():
    data = payload()
    data["templateRegistry"]["body"]["templateId"] = "f111"
    errors = validate_payload(data)
    assert has_error(errors, "templateRegistry.body.templateId", "body")


def test_registry_rejects_ids_registry_set_drift():
    data = payload()
    data["templateIds"] = data["templateIds"][:-1]
    errors = validate_payload(data)
    assert has_error(errors, "templateIds", "templateRegistry", "mismatch")


def test_registry_rejects_non_coach_route_base():
    data = payload()
    data["templateRegistry"]["conditioning"]["routeBase"] = "#/system/conditioning"
    errors = validate_payload(data)
    assert has_error(errors, "templateRegistry.conditioning.routeBase", "#/coach/")
