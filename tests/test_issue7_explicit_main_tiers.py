from copy import deepcopy
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
DATA_FILE = ROOT / "data" / "system-data.js"
MAIN_TIERS = {"T1", "T2", "T3", "T4"}


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def error_text(errors):
    return "\n".join(errors)


def test_all_main_modes_use_explicit_tier_candidates():
    data = payload()
    composer = data["composer"]
    for group_name in ("lowerModes", "upperModes"):
        for mode_key, mode in composer[group_name].items():
            assert "ids" not in mode, f"{group_name}.{mode_key}: legacy ids[] must be absent"
            candidates = mode["candidates"]
            assert len(candidates) == 4
            assert {candidate["tier"] for candidate in candidates} == MAIN_TIERS
            assert all(candidate["id"] in data["actions"] for candidate in candidates)


def test_duplicate_main_tier_is_rejected():
    data = payload()
    candidates = data["composer"]["lowerModes"]["squat"]["candidates"]
    candidates[1]["tier"] = candidates[0]["tier"]
    errors = validate_payload(data)
    text = error_text(errors)
    assert "composer.lowerModes.squat.candidates" in text
    assert "exactly one T1/T2/T3/T4" in text


def test_unknown_main_candidate_action_is_rejected():
    data = payload()
    data["composer"]["upperModes"]["horizontal_push"]["candidates"][0]["id"] = "missing-main-action"
    errors = validate_payload(data)
    text = error_text(errors)
    assert "composer.upperModes.horizontal_push.candidates" in text
    assert "missing-main-action" in text


def test_legacy_positional_ids_are_rejected_even_with_candidates_present():
    data = payload()
    mode = data["composer"]["lowerModes"]["hinge"]
    mode["ids"] = [candidate["id"] for candidate in mode["candidates"]]
    errors = validate_payload(data)
    text = error_text(errors)
    assert "composer.lowerModes.hinge.ids" in text
    assert "legacy positional ids[] is not allowed" in text
