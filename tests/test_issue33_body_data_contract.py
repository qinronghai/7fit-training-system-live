import json
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data

ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"
DATA = ROOT / "data" / "system-data.js"
SCHEMA_DIR = ROOT / "schemas" / "v14.8"
BODY_KEYS = [
    "bodyTargetIds",
    "bodyTargetCatalog",
    "bodyRoleIds",
    "bodyRoles",
    "bodyFamilyIds",
    "bodyFamilies",
    "bodyLevelPolicies",
    "bodyPrescriptionProfiles",
    "bodyActionMeta",
    "bodyVolumePolicy",
    "bodyConflictPolicy",
]
EXPECTED_TARGETS = [
    "quadriceps", "hamstrings", "glute_max", "glute_med", "adductors", "calves",
    "lats", "upper_back", "rear_delts", "lateral_delts", "front_delts", "chest",
    "biceps", "triceps",
]
EXPECTED_ROLES = ["PRIMARY", "SECONDARY", "ACCESSORY", "ISOLATION", "OPTIONAL"]
EXPECTED_FAMILIES = ["BODY-01", "BODY-02", "BODY-03", "BODY-04"]
EXPECTED_DEFAULT_SETS = {
    "L1": {"PRIMARY": 3, "SECONDARY": 2, "ACCESSORY": 2, "ISOLATION-1": 2, "ISOLATION-2": 1, "OPTIONAL": 0},
    "L2": {"PRIMARY": 3, "SECONDARY": 3, "ACCESSORY": 2, "ISOLATION-1": 2, "ISOLATION-2": 2, "OPTIONAL": 0},
    "L3": {"PRIMARY": 3, "SECONDARY": 3, "ACCESSORY": 3, "ISOLATION-1": 2, "ISOLATION-2": 2, "OPTIONAL": 1},
    "L4": {"PRIMARY": 4, "SECONDARY": 3, "ACCESSORY": 3, "ISOLATION-1": 3, "ISOLATION-2": 2, "OPTIONAL": 1},
}
EXPECTED_TOTALS = {"L1": 10, "L2": 12, "L3": 14, "L4": 16}
EXPECTED_RANGES = {"L1": [10, 12], "L2": [12, 14], "L3": [14, 16], "L4": [16, 18]}
EXPECTED_PROFILES = {
    "compound_machine": ([8, 15], [90, 150]),
    "compound_freeweight": ([6, 12], [120, 180]),
    "single_leg_compound": ([8, 12], [90, 150]),
    "accessory_compound": ([10, 15], [75, 120]),
    "isolation_large": ([10, 20], [60, 90]),
    "isolation_small": ([12, 20], [45, 75]),
}


def source():
    return json.loads((SRC / "body.json").read_text(encoding="utf-8"))


def test_body_source_schema_and_manifest_contract_exist():
    assert (SRC / "body.json").is_file(), "data/src/body.json must be the Body source of truth"
    assert (SCHEMA_DIR / "body.schema.json").is_file(), "Body Draft 2020-12 schema missing"

    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert "body.json" in manifest["sourceFiles"]
    for key in BODY_KEYS:
        assert manifest["owners"].get(key) == "body.json", f"{key} must be owned by body.json"
        assert key in manifest["topLevelOrder"], f"{key} missing from runtime topLevelOrder"


def test_generated_runtime_exposes_body_domain_synchronously():
    data = load_runtime_data(DATA)
    for key in BODY_KEYS:
        assert key in data, f"window.V14_DATA missing Body key {key}"


def test_body_taxonomy_is_exact_and_keyed_by_stable_ids():
    data = source()
    assert data["bodyTargetIds"] == EXPECTED_TARGETS
    assert data["bodyRoleIds"] == EXPECTED_ROLES
    assert data["bodyFamilyIds"] == EXPECTED_FAMILIES
    assert list(data["bodyTargetCatalog"]) == EXPECTED_TARGETS
    assert list(data["bodyRoles"]) == EXPECTED_ROLES
    assert list(data["bodyFamilies"]) == EXPECTED_FAMILIES
    for target_id, record in data["bodyTargetCatalog"].items():
        assert record["id"] == target_id
        assert record["name"]
        assert record["region"] in {"lower", "upper"}
        assert record["anatomyAliases"] and all(isinstance(x, str) and x for x in record["anatomyAliases"])
    for role_id, record in data["bodyRoles"].items():
        assert record["id"] == role_id
        assert record["name"]


def test_four_body_families_freeze_targets_and_explicit_slot_roles():
    data = source()
    expected = {
        "BODY-01": (["quadriceps"], ["glute_max", "glute_med", "hamstrings", "adductors"]),
        "BODY-02": (["glute_max", "hamstrings"], ["glute_med", "adductors"]),
        "BODY-03": (["lats", "upper_back", "rear_delts", "lateral_delts"], ["biceps"]),
        "BODY-04": (["chest", "lateral_delts", "triceps"], ["front_delts", "biceps"]),
    }
    slot_role = {
        "PRIMARY": "PRIMARY",
        "SECONDARY": "SECONDARY",
        "ACCESSORY": "ACCESSORY",
        "ISOLATION-1": "ISOLATION",
        "ISOLATION-2": "ISOLATION",
        "OPTIONAL": "OPTIONAL",
    }
    for family_id, (primary, secondary) in expected.items():
        record = data["bodyFamilies"][family_id]
        assert record["familyId"] == family_id
        assert record["primaryTargets"] == primary
        assert record["secondaryTargets"] == secondary
        assert record["slotPolicy"] == slot_role
        assert set(record["volumeTargets"]).issubset(set(EXPECTED_TARGETS))
        assert set(record["allowedRoles"]).issubset(set(EXPECTED_ROLES))


def test_body_level_policy_freezes_default_set_skeleton_and_windows():
    data = source()
    assert list(data["bodyLevelPolicies"]) == ["L1", "L2", "L3", "L4"]
    for level in ["L1", "L2", "L3", "L4"]:
        policy = data["bodyLevelPolicies"][level]
        assert policy["level"] == level
        assert policy["defaultWorkingSets"] == EXPECTED_DEFAULT_SETS[level]
        assert sum(policy["defaultWorkingSets"].values()) == EXPECTED_TOTALS[level]
        assert policy["sessionWorkingSetRange"] == EXPECTED_RANGES[level]
        lo, hi = policy["sessionWorkingSetRange"]
        assert lo <= EXPECTED_TOTALS[level] <= hi
    assert data["bodyLevelPolicies"]["L1"]["rirRange"] == [3, 4]
    assert data["bodyLevelPolicies"]["L2"]["rirRange"] == [2, 3]
    assert data["bodyLevelPolicies"]["L3"]["rirRange"] == [2, 2]
    assert data["bodyLevelPolicies"]["L4"]["rirRange"] == [1, 2]
    assert data["bodyLevelPolicies"]["L1"]["optionalDefault"] is False
    assert data["bodyLevelPolicies"]["L2"]["optionalDefault"] is False
    assert data["bodyLevelPolicies"]["L3"]["optionalDefault"] is True
    assert data["bodyLevelPolicies"]["L4"]["optionalDefault"] is True


def test_body_prescription_profiles_are_machine_readable_and_do_not_duplicate_rir():
    data = source()
    assert set(data["bodyPrescriptionProfiles"]) == set(EXPECTED_PROFILES)
    for profile_id, (reps, rest) in EXPECTED_PROFILES.items():
        profile = data["bodyPrescriptionProfiles"][profile_id]
        assert profile["id"] == profile_id
        assert profile["repRange"] == reps
        assert profile["restSecondsRange"] == rest
        assert "rirRange" not in profile
    assert data["bodyPrescriptionProfiles"]["single_leg_compound"]["perSide"] is True
    for profile_id in set(EXPECTED_PROFILES) - {"single_leg_compound"}:
        assert data["bodyPrescriptionProfiles"][profile_id]["perSide"] is False


def test_body_volume_policy_explicitly_prevents_double_counting_and_pseudo_precision():
    policy = source()["bodyVolumePolicy"]
    assert policy["warmupSetsCountDirect"] is False
    assert policy["rampUpSetsCountDirect"] is False
    assert policy["prepSetsCountDirect"] is False
    assert policy["foamSetsCountDirect"] is False
    assert policy["secondaryExposureCountsDirect"] is False
    assert policy["fractionalEffectiveSets"] is False
    assert policy["unilateralSetCounting"] == "PER_SIDE_PRESCRIPTION_COUNTS_ONCE"
    assert policy["sessionTotalCounting"] == "SUM_SLOT_WORKING_SETS_ONCE"
    assert policy["directTargetCounting"] == "MULTI_LABEL_EACH_DIRECT_TARGET"


def test_body_conflict_policy_is_data_only_and_has_no_runtime_status_contract():
    policy = source()["bodyConflictPolicy"]
    assert set(policy) >= {"maxHighFatigueCompounds", "maxSamePatternActions", "isolationRatioWarnAbove", "estimatedSessionMinutesRange"}
    assert "status" not in policy
    assert "issues" not in policy
