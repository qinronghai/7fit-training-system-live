import json
from copy import deepcopy
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).parents[1]
SCHEMA = ROOT / "schemas" / "v14.8" / "resolved-session.schema.json"


def slot_session():
    return {
        "schemaVersion": 1,
        "resolverVersion": "f111-adapter-v1",
        "templateId": "f111",
        "familyId": "F111-06",
        "level": "L3",
        "title": "F111-06｜下肢 + 上肢",
        "summary": "F111 preset sample",
        "main": {
            "kind": "SLOT",
            "content": [
                {
                    "key": "A",
                    "label": "A｜下肢主项",
                    "actionId": "sample-a",
                    "name": "Sample A",
                    "tier": "T3",
                    "grade": "",
                    "prescription": "3 × 10",
                    "source": "baseline",
                }
            ],
        },
        "prepContext": {
            "template": "f111",
            "level": "L3",
            "recipeId": "F111-06",
            "mainPatterns": ["单腿拉", "水平推"],
            "mainActionIds": ["sample-a"],
            "formalActionIds": ["sample-a"],
            "targetMuscles": [],
            "modalities": [],
            "impactDemand": "",
            "powerDemand": "",
        },
        "anatomyContext": {
            "actionIds": ["sample-a"],
            "primary": ["臀大肌"],
            "secondary": [],
            "stabilizers": ["核心"],
        },
        "conflictContext": {
            "status": "PASS",
            "hardCount": 0,
            "warnCount": 0,
            "issues": [],
        },
        "copyContext": {
            "title": "F111-06｜下肢 + 上肢",
            "summary": "F111 preset sample",
            "actionIds": ["sample-a"],
        },
        "warnings": [],
        "resolvedSelections": [
            {"key": "A", "actionId": "sample-a", "source": "baseline"}
        ],
        "source": {"type": "PRESET", "id": "F111-06-L3"},
    }


def protocol_session():
    data = slot_session()
    data.update(
        {
            "resolverVersion": "conditioning-contract-sample-v1",
            "templateId": "conditioning",
            "familyId": "COND-SAMPLE",
            "title": "Conditioning sample",
            "main": {
                "kind": "PROTOCOL",
                "content": {
                    "protocolId": "interval-sample",
                    "name": "Interval sample",
                    "blocks": [
                        {
                            "key": "B1",
                            "label": "主训练",
                            "items": [
                                {
                                    "actionId": "rower-sample",
                                    "name": "Rower",
                                    "prescription": "30s work / 30s rest",
                                }
                            ],
                        }
                    ],
                    "metrics": {"workRestRatio": "1:1"},
                },
            },
            "prepContext": {
                "template": "conditioning",
                "level": "L3",
                "recipeId": "",
                "mainPatterns": [],
                "mainActionIds": ["rower-sample"],
                "formalActionIds": ["rower-sample"],
                "targetMuscles": [],
                "modalities": ["rower"],
                "impactDemand": "low",
                "powerDemand": "moderate",
            },
            "anatomyContext": {
                "actionIds": ["rower-sample"],
                "primary": [],
                "secondary": [],
                "stabilizers": [],
            },
            "copyContext": {
                "title": "Conditioning sample",
                "summary": "F111 preset sample",
                "actionIds": ["rower-sample"],
            },
            "resolvedSelections": [],
            "source": {"type": "GENERATED", "id": "COND-SAMPLE-L3"},
        }
    )
    return data


def validator():
    assert SCHEMA.is_file(), "ResolvedSession schema missing"
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def errors_for(value):
    return sorted(validator().iter_errors(value), key=lambda e: list(e.absolute_path))


def test_resolved_session_schema_exists_and_is_draft_2020_12():
    assert SCHEMA.is_file()
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    Draft202012Validator.check_schema(schema)


def test_slot_and_protocol_samples_are_valid():
    assert errors_for(slot_session()) == []
    assert errors_for(protocol_session()) == []


def test_missing_public_field_is_rejected():
    value = slot_session()
    del value["copyContext"]
    assert errors_for(value)


def test_unknown_main_kind_is_rejected():
    value = slot_session()
    value["main"] = {"kind": "MAGIC", "content": []}
    assert errors_for(value)


def test_slot_kind_rejects_protocol_payload_shape():
    value = protocol_session()
    value["main"]["kind"] = "SLOT"
    assert errors_for(value)


def test_protocol_kind_rejects_slot_payload_shape():
    value = slot_session()
    value["main"]["kind"] = "PROTOCOL"
    assert errors_for(value)


def test_public_contract_does_not_require_f111_private_modes():
    value = slot_session()
    for private in ["lowerMode", "upperMode", "windows", "coreDemand"]:
        assert private not in value
    assert errors_for(value) == []


def test_schema_rejects_invalid_level_and_selection_source():
    bad_level = slot_session()
    bad_level["level"] = "L5"
    assert errors_for(bad_level)

    bad_source = slot_session()
    bad_source["resolvedSelections"][0]["source"] = "mystery"
    assert errors_for(bad_source)


def test_top_level_contract_is_strict_against_private_field_leakage():
    value = deepcopy(slot_session())
    value["lowerMode"] = "single_leg_hinge"
    assert errors_for(value)
