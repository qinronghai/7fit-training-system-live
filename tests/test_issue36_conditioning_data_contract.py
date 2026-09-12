import copy
import json
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"
DATA = ROOT / "data" / "system-data.js"
SCHEMA_DIR = ROOT / "schemas" / "v14.8"

CONDITIONING_KEYS = [
    "conditioningFamilyIds",
    "conditioningFamilies",
    "conditioningProtocolIds",
    "conditioningProtocols",
    "conditioningModalityIds",
    "conditioningModalities",
    "conditioningLevelPolicies",
    "conditioningProtocolPolicies",
    "conditioningActionMeta",
    "conditioningTransitionPolicy",
    "conditioningConflictPolicy",
]
FAMILIES = ["CON-01", "CON-02", "CON-03", "CON-04"]
PROTOCOLS = ["STEADY", "INTERVAL", "CIRCUIT", "DENSITY"]
MODALITIES = [
    "CYCLICAL", "SLED", "CARRY", "LOCOMOTION",
    "BALL", "SIMPLE_STRENGTH", "POWER", "CORE_INTEGRATION",
]
LEVELS = ["L1", "L2", "L3", "L4"]


def source():
    return json.loads((SRC / "conditioning.json").read_text(encoding="utf-8"))


def test_conditioning_source_schema_and_manifest_contract_exist():
    assert (SRC / "conditioning.json").is_file(), "data/src/conditioning.json must be the Conditioning source of truth"
    assert (SCHEMA_DIR / "conditioning.schema.json").is_file(), "Conditioning Draft 2020-12 schema missing"

    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    source_files = manifest["sourceFiles"]
    assert "conditioning.json" in source_files
    assert source_files.index("conditioning.json") == source_files.index("body.json") + 1
    for key in CONDITIONING_KEYS:
        assert manifest["owners"].get(key) == "conditioning.json", f"{key} must be owned by conditioning.json"
        assert key in manifest["topLevelOrder"], f"{key} missing from runtime topLevelOrder"


def test_generated_runtime_exposes_conditioning_domain_synchronously():
    data = load_runtime_data(DATA)
    for key in CONDITIONING_KEYS:
        assert key in data, f"window.V14_DATA missing Conditioning key {key}"


def test_conditioning_taxonomy_is_frozen_and_keyed_by_stable_ids():
    data = source()
    assert data["conditioningFamilyIds"] == FAMILIES
    assert data["conditioningProtocolIds"] == PROTOCOLS
    assert data["conditioningModalityIds"] == MODALITIES
    assert list(data["conditioningFamilies"]) == FAMILIES
    assert list(data["conditioningProtocols"]) == PROTOCOLS
    assert list(data["conditioningModalities"]) == MODALITIES
    assert list(data["conditioningLevelPolicies"]) == LEVELS
    assert list(data["conditioningProtocolPolicies"]) == PROTOCOLS

    for family_id, record in data["conditioningFamilies"].items():
        assert record["familyId"] == family_id
    for protocol_id, record in data["conditioningProtocols"].items():
        assert record["protocolId"] == protocol_id
    for modality_id, record in data["conditioningModalities"].items():
        assert record["modalityId"] == modality_id
    for level, record in data["conditioningLevelPolicies"].items():
        assert record["level"] == level
    for protocol_id, record in data["conditioningProtocolPolicies"].items():
        assert record["protocolId"] == protocol_id


def test_family_protocol_matrix_is_explicit_and_goal_driven():
    data = source()
    expected = {
        "CON-01": ["STEADY", "INTERVAL"],
        "CON-02": ["INTERVAL", "CIRCUIT"],
        "CON-03": ["INTERVAL", "CIRCUIT", "DENSITY"],
        "CON-04": ["INTERVAL", "CIRCUIT"],
    }
    for family_id, protocols in expected.items():
        family = data["conditioningFamilies"][family_id]
        assert family["protocolEligibility"] == protocols
        assert family["goal"]
        assert family["preferredModalities"]


def test_protocol_and_level_policy_freeze_training_variables_not_trick_complexity():
    data = source()
    protocols = data["conditioningProtocols"]
    assert protocols["STEADY"]["structure"] == "CONTINUOUS"
    assert protocols["INTERVAL"]["structure"] == "WORK_REST"
    assert protocols["CIRCUIT"]["structure"] == "STATIONS"
    assert protocols["DENSITY"]["structure"] == "FIXED_WINDOW"
    assert protocols["STEADY"]["allowsPower"] is False
    assert protocols["DENSITY"]["allowsPower"] is False

    levels = data["conditioningLevelPolicies"]
    assert [levels[level]["powerExposure"] for level in LEVELS] == ["INTRO", "CONTROLLED", "MODERATE", "FULL"]
    assert [levels[level]["targetRpeRange"] for level in LEVELS] == [[5, 6], [5, 7], [6, 8], [7, 9]]
    assert levels["L1"]["impactCeiling"] == "low"
    assert levels["L4"]["impactCeiling"] == "high"
    assert levels["L1"]["coordinationCeiling"] == "low"
    assert levels["L4"]["coordinationCeiling"] == "high"
    assert levels["L1"]["estimatedSessionMinutesRange"][1] <= levels["L4"]["estimatedSessionMinutesRange"][1]


def test_carry_is_reserved_without_rewriting_existing_1f_route():
    data = source()
    carry = data["conditioningModalities"]["CARRY"]
    assert carry["v1Status"] == "RESERVED"
    assert all("CARRY" not in meta["modalities"] for meta in data["conditioningActionMeta"].values())


def test_post_cardio_is_explicitly_not_formal_conditioning():
    data = source()
    assert "POST_CARDIO_ONLY" in data["conditioningTransitionPolicy"]["excludedRoutes"]
    assert data["conditioningConflictPolicy"]["postCardioOnlyEligible"] is False
    assert "venue_treadmill_zone2" not in data["conditioningActionMeta"]
    assert "venue_stair_zone2" not in data["conditioningActionMeta"]


def test_transition_policy_keeps_v1_formal_work_on_2f():
    policy = source()["conditioningTransitionPolicy"]
    assert policy["formalRoutes"] == ["CONDITIONING_2F"]
    assert policy["floorChangeAllowed"] is False
    assert policy["stationChangeSecondsRange"] == [15, 30]
    assert policy["equipmentChangeSecondsRange"] == [20, 45]


def test_validator_rejects_post_cardio_candidate_and_power_metadata_drift():
    runtime = load_runtime_data(DATA)

    bad_post = copy.deepcopy(runtime)
    moved = bad_post["conditioningActionMeta"].pop("huaxueji_wentai")
    bad_post["conditioningActionMeta"]["venue_treadmill_zone2"] = moved
    errors = validate_payload(bad_post)
    assert any("POST_CARDIO_ONLY" in error or "formal CONDITIONING_2F" in error for error in errors)

    bad_power = copy.deepcopy(runtime)
    bad_power["conditioningActionMeta"]["yaoqiu_zaidi"]["modalities"] = ["BALL"]
    errors = validate_payload(bad_power)
    assert any("powerEligible candidate must include POWER" in error for error in errors)


def test_validator_rejects_reserved_modality_becoming_formal_without_contract_change():
    runtime = load_runtime_data(DATA)
    bad = copy.deepcopy(runtime)
    bad["conditioningActionMeta"]["huaxueji_jiange"]["modalities"].append("CARRY")
    errors = validate_payload(bad)
    assert any("RESERVED modality must not have formal V1 candidates" in error for error in errors)
