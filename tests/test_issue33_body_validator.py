from copy import deepcopy
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
DATA_FILE = ROOT / "data" / "system-data.js"


def payload():
    return deepcopy(load_runtime_data(DATA_FILE))


def has_error(errors, *needles):
    text = "\n".join(errors)
    return all(needle in text for needle in needles)


def first_candidate(data):
    action_id = next(iter(data["bodyActionMeta"]))
    return action_id, data["bodyActionMeta"][action_id]


def test_body_unknown_action_reference_is_rejected():
    data = payload()
    action_id, meta = first_candidate(data)
    data["bodyActionMeta"].pop(action_id)
    data["bodyActionMeta"]["BODY_UNKNOWN_ACTION"] = meta
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", "BODY_UNKNOWN_ACTION", "unknown action")


def test_body_unknown_target_is_rejected():
    data = payload()
    action_id, meta = first_candidate(data)
    meta["directTargets"][0] = "unknown_target"
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", action_id, "directTargets", "unknown_target")


def test_body_unknown_family_is_rejected():
    data = payload()
    action_id, meta = first_candidate(data)
    meta["families"][0] = "BODY-99"
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", action_id, "families", "BODY-99")


def test_body_unknown_role_is_rejected():
    data = payload()
    action_id, meta = first_candidate(data)
    meta["roles"][0] = "SUPERSET"
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", action_id, "roles", "SUPERSET")


def test_body_illegal_level_is_rejected():
    data = payload()
    action_id, meta = first_candidate(data)
    meta["levels"][0] = "L5"
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", action_id, "levels", "L5")


def test_body_unknown_rep_profile_is_rejected():
    data = payload()
    action_id, meta = first_candidate(data)
    meta["repProfile"] = "body_magic_profile"
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", action_id, "repProfile", "body_magic_profile")


def test_body_direct_secondary_overlap_is_rejected():
    data = payload()
    action_id, meta = first_candidate(data)
    meta["secondaryTargets"] = [meta["directTargets"][0]]
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", action_id, "directTargets", "secondaryTargets", "overlap")


def test_body_main_role_must_hit_family_primary_target():
    data = payload()
    action_id = "yaling_luomaniya_yingla"
    meta = data["bodyActionMeta"][action_id]
    meta["families"] = ["BODY-01"]
    meta["roles"] = ["PRIMARY"]
    assert meta["directTargets"] == ["hamstrings", "glute_max"]
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", action_id, "BODY-01", "primaryTargets")


def test_body_candidate_with_non_strength_route_is_rejected():
    data = payload()
    exemplar = deepcopy(next(iter(data["bodyActionMeta"].values())))
    exemplar["families"] = ["BODY-01"]
    exemplar["directTargets"] = ["quadriceps"]
    exemplar["secondaryTargets"] = []
    data["bodyActionMeta"]["gaojiaobei_shendun"] = exemplar
    assert data["actions"]["gaojiaobei_shendun"]["route"] == "2F_ONLY"
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", "gaojiaobei_shendun", "route", "2F_ONLY")


def test_body_candidate_count_below_40_is_rejected():
    data = payload()
    data["bodyActionMeta"] = dict(list(data["bodyActionMeta"].items())[:39])
    errors = validate_payload(data)
    assert has_error(errors, "bodyActionMeta", "40")
