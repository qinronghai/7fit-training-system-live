import copy
import json
from pathlib import Path

from tools.validate_v148_schema import load_runtime_data, validate_payload

ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"
DATA = ROOT / "data" / "system-data.js"
SCHEMA_DIR = ROOT / "schemas" / "v14.8"

CONDITIONING_KEYS = [
    "conditioningFamilyIds", "conditioningFamilies",
    "conditioningProtocolIds", "conditioningProtocols",
    "conditioningModalityIds", "conditioningModalities",
    "conditioningLevelPolicies", "conditioningProtocolPolicies",
    "conditioningActionMeta", "conditioningTransitionPolicy",
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
    assert (SRC / "conditioning.json").is_file()
    assert (SCHEMA_DIR / "conditioning.schema.json").is_file()
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert "conditioning.json" in manifest["sourceFiles"]
    assert manifest["sourceFiles"].index("conditioning.json") == manifest["sourceFiles"].index("body.json") + 1
    for key in CONDITIONING_KEYS:
        assert manifest["owners"].get(key) == "conditioning.json"
        assert key in manifest["topLevelOrder"]


def test_generated_runtime_exposes_conditioning_domain_synchronously():
    data = load_runtime_data(DATA)
    for key in CONDITIONING_KEYS:
        assert key in data


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


def test_family_protocol_matrix_is_explicit():
    data = source()
    assert data["conditioningFamilies"]["CON-01"]["protocolEligibility"] == ["STEADY", "INTERVAL"]
    assert data["conditioningFamilies"]["CON-02"]["protocolEligibility"] == ["INTERVAL", "CIRCUIT"]
    assert data["conditioningFamilies"]["CON-03"]["protocolEligibility"] == ["INTERVAL", "CIRCUIT", "DENSITY"]
    assert data["conditioningFamilies"]["CON-04"]["protocolEligibility"] == ["INTERVAL", "CIRCUIT"]


def test_level_policy_progresses_training_variables_not_trick_complexity():
    levels = source()["conditioningLevelPolicies"]
    assert [levels[x]["powerExposure"] for x in LEVELS] == ["INTRO", "CONTROLLED", "MODERATE", "FULL"]
    assert [levels[x]["targetRpeRange"] for x in LEVELS] == [[5, 6], [5, 7], [6, 8], [7, 9]]
    assert levels["L1"]["impactCeiling"] == "low"
    assert levels["L4"]["impactCeiling"] == "high"
    assert levels["L1"]["coordinationCeiling"] == "low"
    assert levels["L4"]["coordinationCeiling"] == "high"


def test_carry_is_reserved_without_rewriting_existing_1f_route():
    data = source()
    assert data["conditioningModalities"]["CARRY"]["v1Status"] == "RESERVED"
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


def test_validator_rejects_post_cardio_candidate():
    runtime = load_runtime_data(DATA)
    bad = copy.deepcopy(runtime)
    moved = bad["conditioningActionMeta"].pop("huaxueji_wentai")
    bad["conditioningActionMeta"]["venue_treadmill_zone2"] = moved
    errors = validate_payload(bad)
    assert any("POST_CARDIO_ONLY" in error or "formal CONDITIONING_2F" in error for error in errors)


def test_validator_rejects_power_metadata_drift():
    runtime = load_runtime_data(DATA)
    bad = copy.deepcopy(runtime)
    bad["conditioningActionMeta"]["yaoqiu_zaidi"]["modalities"] = ["BALL"]
    errors = validate_payload(bad)
    assert any("powerEligible candidate must include POWER" in error for error in errors)


def test_validator_rejects_reserved_modality_becoming_formal():
    runtime = load_runtime_data(DATA)
    bad = copy.deepcopy(runtime)
    bad["conditioningActionMeta"]["huaxueji_jiange"]["modalities"].append("CARRY")
    errors = validate_payload(bad)
    assert any("RESERVED modality must not have formal V1 candidates" in error for error in errors)
