from copy import deepcopy
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
DATA_FILE = ROOT / "data" / "system-data.js"
SLOTS = ["PRIMARY", "SECONDARY", "ACCESSORY", "ISOLATION-1", "ISOLATION-2", "OPTIONAL"]


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def errors_for(data):
    return "\n".join(validate_payload(data))


def test_all_body_families_publish_complete_slot_intent_contract():
    data = payload()
    for family_id in data["bodyFamilyIds"]:
        family = data["bodyFamilies"][family_id]
        assert list(family["slotIntents"]) == SLOTS
        intent_ids = set()
        for slot_key in SLOTS:
            intent = family["slotIntents"][slot_key]
            assert intent["slotKey"] == slot_key
            assert intent["role"] == family["slotPolicy"][slot_key]
            assert intent["intentId"] not in intent_ids
            intent_ids.add(intent["intentId"])
            assert intent["allowedExerciseClasses"]


def test_slot_intent_missing_slot_is_rejected():
    data = payload()
    del data["bodyFamilies"]["BODY-04"]["slotIntents"]["PRIMARY"]
    text = errors_for(data)
    assert "bodyFamilies" in text
    assert "BODY-04" in text
    assert "slotIntents" in text


def test_slot_intent_unknown_pattern_is_rejected():
    data = payload()
    data["bodyFamilies"]["BODY-03"]["slotIntents"]["PRIMARY"]["requiredPatterns"] = ["不存在的拉法"]
    text = errors_for(data)
    assert "bodyFamilies.BODY-03.slotIntents.PRIMARY.requiredPatterns" in text
    assert "不存在的拉法" in text


def test_slot_intent_role_must_match_family_slot_policy():
    data = payload()
    data["bodyFamilies"]["BODY-01"]["slotIntents"]["ACCESSORY"]["role"] = "PRIMARY"
    text = errors_for(data)
    assert "bodyFamilies.BODY-01.slotIntents.ACCESSORY.role" in text
    assert "slotPolicy role ACCESSORY" in text


def test_every_active_family_level_slot_has_static_candidate():
    data = payload()
    # Break one intent without inventing a new enum; cross-record validator must catch resolvability.
    data["bodyFamilies"]["BODY-04"]["slotIntents"]["PRIMARY"]["requiredDirectTargets"] = ["biceps"]
    text = errors_for(data)
    assert "bodyFamilies.BODY-04.slotIntents.PRIMARY" in text
    assert "has no statically legal candidates" in text


def test_body_v2_candidate_inventory_remains_bounded_and_audited():
    data = payload()
    assert len(data["bodyActionMeta"]) == 60
    assert "V13_VP_SEATED_LIGHT_DB" in data["bodyActionMeta"]
    assert "SECONDARY" in data["bodyActionMeta"]["shanyan_tingshen"]["roles"]
