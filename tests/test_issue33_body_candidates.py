import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"
REQUIRED_FIELDS = {
    "families", "levels", "roles", "directTargets", "secondaryTargets",
    "exerciseClass", "fatigueCost", "stabilityDemand", "repProfile", "laterality",
}
REQUIRED_ROLES = ["PRIMARY", "SECONDARY", "ACCESSORY", "ISOLATION"]
LEVELS = ["L1", "L2", "L3", "L4"]
FAMILIES = ["BODY-01", "BODY-02", "BODY-03", "BODY-04"]


def load(name):
    return json.loads((SRC / name).read_text(encoding="utf-8"))


def test_body_candidate_whitelist_is_curated_and_reference_safe():
    body = load("body.json")
    actions = load("actions.json")["actions"]
    candidates = body["bodyActionMeta"]
    assert 40 <= len(candidates) <= 60

    valid_families = set(body["bodyFamilyIds"])
    valid_roles = set(body["bodyRoleIds"])
    valid_targets = set(body["bodyTargetIds"])
    valid_profiles = set(body["bodyPrescriptionProfiles"])

    for action_id, meta in candidates.items():
        assert action_id in actions, f"unknown Body Action ID: {action_id}"
        action = actions[action_id]
        assert action["route"] in {"1F_ONLY", "FLEX_1F_2F"}, f"invalid Body strength route: {action_id}"
        assert action["status"] == "可自动编排", f"Body candidate not auto-programmable: {action_id}"
        assert set(meta) == REQUIRED_FIELDS, f"Body metadata fields drifted: {action_id}"
        for field in ("families", "levels", "roles", "directTargets", "secondaryTargets"):
            assert len(meta[field]) == len(set(meta[field])), f"duplicate {field}: {action_id}"
        assert meta["families"] and set(meta["families"]) <= valid_families
        assert meta["levels"] and set(meta["levels"]) <= set(LEVELS)
        assert meta["roles"] and set(meta["roles"]) <= valid_roles
        assert meta["directTargets"] and set(meta["directTargets"]) <= valid_targets
        assert set(meta["secondaryTargets"]) <= valid_targets
        assert not (set(meta["directTargets"]) & set(meta["secondaryTargets"])), f"direct/secondary overlap: {action_id}"
        assert meta["exerciseClass"] in {"compound", "accessory", "isolation"}
        assert meta["fatigueCost"] in {"low", "medium", "high"}
        assert meta["stabilityDemand"] in {"low", "medium", "high"}
        assert meta["repProfile"] in valid_profiles
        assert meta["laterality"] in {"bilateral", "unilateral"}


def test_every_family_level_required_role_has_at_least_two_legal_candidates():
    body = load("body.json")
    candidates = body["bodyActionMeta"]
    for family_id in FAMILIES:
        for level in LEVELS:
            for role in REQUIRED_ROLES:
                legal = [
                    action_id for action_id, meta in candidates.items()
                    if family_id in meta["families"] and level in meta["levels"] and role in meta["roles"]
                ]
                assert len(legal) >= 2, f"{family_id} {level} {role} needs >=2 candidates; got {legal}"


def test_primary_and_secondary_candidates_hit_family_primary_targets():
    body = load("body.json")
    candidates = body["bodyActionMeta"]
    families = body["bodyFamilies"]
    main_roles = {"PRIMARY", "SECONDARY"}

    for action_id, meta in candidates.items():
        active_main_roles = main_roles & set(meta["roles"])
        if not active_main_roles:
            continue
        direct_targets = set(meta["directTargets"])
        for family_id in meta["families"]:
            family_primary_targets = set(families[family_id]["primaryTargets"])
            assert direct_targets & family_primary_targets, (
                f"{action_id} cannot serve {sorted(active_main_roles)} in {family_id}: "
                f"directTargets={sorted(direct_targets)} do not hit "
                f"primaryTargets={sorted(family_primary_targets)}"
            )


def test_l4_preserves_stable_options_instead_of_forcing_complexity():
    body = load("body.json")
    candidates = body["bodyActionMeta"]
    for family_id in FAMILIES:
        stable = [
            action_id for action_id, meta in candidates.items()
            if family_id in meta["families"]
            and "L4" in meta["levels"]
            and ({"PRIMARY", "SECONDARY"} & set(meta["roles"]))
            and meta["stabilityDemand"] == "low"
        ]
        assert stable, f"{family_id} L4 must preserve at least one stable main option"


def test_candidate_audit_ledger_has_one_row_per_candidate():
    body = load("body.json")
    text = (ROOT / "docs" / "V15-BODY-CANDIDATE-AUDIT.md").read_text(encoding="utf-8")
    for action_id in body["bodyActionMeta"]:
        assert f"| {action_id} |" in text, f"candidate audit row missing: {action_id}"
