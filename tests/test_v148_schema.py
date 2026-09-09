from pathlib import Path

ROOT = Path(__file__).parents[1]
SCHEMA_DIR = ROOT / "schemas" / "v14.8"


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
