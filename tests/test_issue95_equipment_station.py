import json
from copy import deepcopy
from pathlib import Path

from jsonschema import Draft202012Validator

from tools.validate_v148_schema import load_runtime_data, validate_payload, validate_repository


ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"


def load(name):
    return json.loads((SRC / name).read_text(encoding="utf-8"))


def test_body_station_policy_is_data_owned_and_declares_explicit_reuse_boundary():
    policy = load("venue.json")["venueCapabilityPolicy"]["stationDiversityPolicy"]
    assert policy == {
        "policyVersion": "body-station-v1",
        "formalRoles": ["PRIMARY", "SECONDARY", "ACCESSORY", "ISOLATION", "OPTIONAL"],
        "defaultReuseMode": "BLOCK",
        "unknownStationMode": "ALLOW_UNVERIFIED",
        "explicitReuseToken": "STATION_REUSE_ALLOWED",
        "stationGroups": {
            "cable-frame": {
                "stationGroupId": "cable-frame",
                "name": "小飞鸟 / 小龙门架",
                "maxFormalActions": 2,
                "severity": "warn",
            }
        },
    }


def test_confirmed_combo_actions_use_explicit_station_ids():
    actions = load("actions.json")["actions"]
    expected = {
        "tui_qushen": "leg-extension-curl-combo-01",
        "tui_wanju": "leg-extension-curl-combo-01",
        "kuangwai_zhan": "adductor-abductor-combo-01",
        "kuangnei_shou": "adductor-abductor-combo-01",
        "qixie_xiongtui": "chest-press-shoulder-combo-01",
        "qixie_jian_tui": "chest-press-shoulder-combo-01",
    }
    assert {action_id: actions[action_id]["stationId"] for action_id in expected} == expected


def test_unknown_station_action_is_not_assigned_a_fabricated_station():
    actions = load("actions.json")["actions"]
    assert "stationId" not in actions["mianla"]


def test_action_and_body_schema_accept_station_contract():
    action_schema = json.loads((ROOT / "schemas" / "v14.8" / "action.schema.json").read_text(encoding="utf-8"))
    body_schema = json.loads((ROOT / "schemas" / "v14.8" / "body.schema.json").read_text(encoding="utf-8"))
    action = load("actions.json")["actions"]["tui_qushen"]
    body = load("body.json")
    action_errors = list(Draft202012Validator(action_schema).iter_errors(action))
    body_errors = list(Draft202012Validator(body_schema).iter_errors(body))
    assert not action_errors, "; ".join(error.message for error in action_errors)
    assert not body_errors, "; ".join(error.message for error in body_errors)


def test_repository_validator_accepts_station_contract_and_rejects_unknown_station_policy_mode():
    assert validate_repository(ROOT) == []
    payload = deepcopy(load_runtime_data(ROOT / "data" / "system-data.js"))
    payload["venueCapabilityPolicy"]["stationDiversityPolicy"]["defaultReuseMode"] = "IGNORE"
    errors = validate_payload(payload)
    assert any("stationDiversityPolicy" in error and "defaultReuseMode" in error for error in errors)


def test_repository_validator_rejects_unknown_action_station_group_reference():
    payload = deepcopy(load_runtime_data(ROOT / "data" / "system-data.js"))
    payload["actions"]["tui_qushen"]["stationGroup"] = "not-a-real-station-group"
    errors = validate_payload(payload)
    assert any("tui_qushen" in error and "unknown station group" in error for error in errors)
