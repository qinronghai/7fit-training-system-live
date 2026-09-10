import json
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data

ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"
DATA = ROOT / "data" / "system-data.js"
SCHEMA_DIR = ROOT / "schemas" / "v14.8"
BODY_KEYS = [
    "bodyTargetIds",
    "bodyTargetCatalog",
    "bodyRoleIds",
    "bodyRoles",
    "bodyFamilyIds",
    "bodyFamilies",
    "bodyLevelPolicies",
    "bodyPrescriptionProfiles",
    "bodyActionMeta",
    "bodyVolumePolicy",
    "bodyConflictPolicy",
]


def test_body_source_schema_and_manifest_contract_exist():
    assert (SRC / "body.json").is_file(), "data/src/body.json must be the Body source of truth"
    assert (SCHEMA_DIR / "body.schema.json").is_file(), "Body Draft 2020-12 schema missing"

    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert "body.json" in manifest["sourceFiles"]
    for key in BODY_KEYS:
        assert manifest["owners"].get(key) == "body.json", f"{key} must be owned by body.json"
        assert key in manifest["topLevelOrder"], f"{key} missing from runtime topLevelOrder"


def test_generated_runtime_exposes_body_domain_synchronously():
    data = load_runtime_data(DATA)
    for key in BODY_KEYS:
        assert key in data, f"window.V14_DATA missing Body key {key}"
