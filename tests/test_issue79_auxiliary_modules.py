import json
import re
from copy import deepcopy
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
DATA_FILE = ROOT / "data" / "system-data.js"

ALLOWED_CLASSES = {"fixed_machine", "cable_station", "free_weight", "bodyweight", "other", "unknown"}


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def unique_rule_ids(data, side):
    seen = []
    for pool in data["composer"]["auxiliaryRules"][side].values():
        for action_id in pool:
            if action_id not in seen:
                seen.append(action_id)
    return seen


def venue_equipment_ids(data):
    """Equipment ids from the 7Fit 器械清单 that ships inside system.legacyHtml."""
    html = data.get("legacyHtml", {}).get("equipment", "")
    ids = re.findall(r"eq-[a-z0-9-]+", html)
    assert ids, "the venue equipment inventory must stay present in the runtime data"
    return set(ids)


def test_issue79_auxiliary_inventory_and_explicit_equipment_classes():
    data = payload()
    upper_ids = unique_rule_ids(data, "upper")
    lower_ids = unique_rule_ids(data, "lower")
    assert len(upper_ids) == 19
    assert len(lower_ids) == 6
    assert len(data["tenPatternCatalog"]) == 10
    assert set(upper_ids) | set(lower_ids) <= set(data["actions"])

    for action_id in set(upper_ids) | set(lower_ids):
        assert data["actions"][action_id]["route"] == "1F_ONLY"
        assert data["actions"][action_id]["status"] == "可自动编排"
        assert action_id in data["actionDetails"]
        equipment_class = data["actions"][action_id].get("equipmentClass")
        assert equipment_class in ALLOWED_CLASSES, f"missing explicit equipmentClass: {action_id}"

    assert {data["actions"][x]["equipmentClass"] for x in lower_ids} == {
        "fixed_machine",
        "cable_station",
    }
    assert data["actions"]["houzu_sanji"]["equipmentClass"] == "free_weight"


def test_upper_auxiliary_actions_are_implementable_with_the_venue_equipment_list():
    data = payload()
    venue_ids = venue_equipment_ids(data)
    upper_ids = unique_rule_ids(data, "upper")

    for action_id in upper_ids:
        action = data["actions"][action_id]
        # D2 supplements the tiered A/B main windows instead of restating them.
        assert action["tier"] == "", f"upper auxiliary must not be a tiered main action: {action_id}"
        equipment_ids = [
            item.strip() for item in (action.get("equipmentId") or "").split("、") if item.strip()
        ]
        unknown = [item for item in equipment_ids if item not in venue_ids]
        assert not unknown, f"{action_id} uses equipment outside the venue list: {unknown}"
        details = data["actionDetails"][action_id]["fields"]
        missing = [
            field
            for field in ("训练目标", "教练口令", "执行步骤", "常见错误", "禁忌 / 限制")
            if not str(details.get(field, "")).strip()
        ]
        assert not missing, f"{action_id} would render as 待补齐 in module 11: {missing}"

    # Every upper pool keeps at least one candidate and never repeats an action.
    for pool_key, ids in data["composer"]["auxiliaryRules"]["upper"].items():
        assert ids, f"upper auxiliary pool {pool_key} must not be empty"
        assert len(ids) == len(set(ids)), f"upper auxiliary pool {pool_key} must not repeat an action"


def test_issue79_schema_declares_equipment_class_enum_and_validator_enforces_auxiliary_data():
    schema = json.loads((ROOT / "schemas/v14.8/action.schema.json").read_text(encoding="utf-8"))
    equipment_class = schema["properties"]["equipmentClass"]
    assert equipment_class["type"] == ["string", "null"]
    assert set(equipment_class["enum"]) == {
        "fixed_machine",
        "cable_station",
        "free_weight",
        "bodyweight",
        "other",
        "unknown",
        None,
    }

    data = payload()
    errors = validate_payload(data)
    assert not any("composer auxiliary" in error and "equipmentClass" in error for error in errors)

    broken = payload()
    del broken["actions"]["tui_qushen"]["equipmentClass"]
    errors = validate_payload(broken)
    assert any(
        "composer auxiliary tui_qushen" in error and "equipmentClass must be explicit" in error
        for error in errors
    )


def test_issue79_ui_contract_is_loaded_and_derived_from_auxiliary_api():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    view = (ROOT / "js/views-system.js").read_text(encoding="utf-8")
    helper = (ROOT / "js/auxiliary-modules.js").read_text(encoding="utf-8")
    changelog = (ROOT / "data/change-log.js").read_text(encoding="utf-8")

    assert "js/auxiliary-modules.js" in html
    assert html.index("js/auxiliary-modules.js") < html.index("js/views-system.js")
    for marker in ["V14AuxiliaryModules", "aux-upper", "aux-lower", "data-aux-filter", "auxiliary-subgroup", "data-aux-pool-button"]:
        assert marker in view or marker in helper
    assert re.search(r"issue\s*:\s*79", changelog)
