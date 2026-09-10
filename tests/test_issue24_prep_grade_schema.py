import json
from copy import deepcopy
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
SCHEMA = ROOT / "schemas" / "v14.8" / "prep.schema.json"
DATA_FILE = ROOT / "data" / "system-data.js"


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def error_text(errors):
    return "\n".join(errors)


def test_prep_schema_requires_formal_p_grade():
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    detail = schema["properties"]["details"]["additionalProperties"]
    assert "prepGrade" in detail["required"]
    assert detail["properties"]["prepGrade"]["enum"] == ["P1", "P2", "P3", "P4"]


def test_missing_prep_grade_is_rejected():
    data = payload()
    prep_id = data["warmupIds"][0]
    data["warmupDetails"][prep_id].pop("prepGrade", None)
    text = error_text(validate_payload(data))
    assert "prepGrade" in text and prep_id in text


def test_unknown_prep_grade_is_rejected():
    data = payload()
    prep_id = data["warmupIds"][0]
    data["warmupDetails"][prep_id]["prepGrade"] = "P5"
    text = error_text(validate_payload(data))
    assert "prepGrade" in text and "P5" in text
