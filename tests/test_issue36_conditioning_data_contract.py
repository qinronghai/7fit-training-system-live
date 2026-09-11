import json
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data

ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"
DATA = ROOT / "data" / "system-data.js"
SCHEMA_DIR = ROOT / "schemas" / "v14.8"

CONDITIONING_KEYS = [
    "conditioningFamilyIds",
    "conditioningFamilies",
    "conditioningProtocolIds",
    "conditioningProtocols",
    "conditioningModalityIds",
    "conditioningModalities",
    "conditioningLevelPolicies",
    "conditioningProtocolPolicies",
    "conditioningActionMeta",
    "conditioningTransitionPolicy",
    "conditioningConflictPolicy",
]


def test_conditioning_source_schema_and_manifest_contract_exist():
    assert (SRC / "conditioning.json").is_file(), "data/src/conditioning.json must be the Conditioning source of truth"
    assert (SCHEMA_DIR / "conditioning.schema.json").is_file(), "Conditioning Draft 2020-12 schema missing"

    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    source_files = manifest["sourceFiles"]
    assert "conditioning.json" in source_files
    assert source_files.index("conditioning.json") == source_files.index("body.json") + 1
    for key in CONDITIONING_KEYS:
        assert manifest["owners"].get(key) == "conditioning.json", f"{key} must be owned by conditioning.json"
        assert key in manifest["topLevelOrder"], f"{key} missing from runtime topLevelOrder"


def test_generated_runtime_exposes_conditioning_domain_synchronously():
    data = load_runtime_data(DATA)
    for key in CONDITIONING_KEYS:
        assert key in data, f"window.V14_DATA missing Conditioning key {key}"
