import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"
LEVELS = ["L1", "L2", "L3", "L4"]


def load(name):
    return json.loads((SRC / name).read_text(encoding="utf-8"))


def test_conditioning_candidate_whitelist_is_curated_reference_safe_and_2f_only():
    conditioning = load("conditioning.json")
    actions = load("actions.json")["actions"]
    candidates = conditioning["conditioningActionMeta"]
    assert len(candidates) == 18

    required = {
        "families", "modalities", "protocolEligibility", "workMetrics",
        "impact", "coordinationDemand", "fatigueRisk", "levels",
        "powerEligible", "route",
    }
    for action_id, meta in candidates.items():
        assert action_id in actions, f"unknown Conditioning Action ID: {action_id}"
        action = actions[action_id]
        assert action["route"] == "CONDITIONING_2F", f"formal Conditioning route drifted: {action_id}"
        assert action["status"] == "可自动编排", f"Conditioning candidate not auto-programmable: {action_id}"
        assert meta["route"] == action["route"]
        assert set(meta) == required, f"Conditioning metadata fields drifted: {action_id}"
        for field in ("families", "modalities", "protocolEligibility", "workMetrics", "levels"):
            assert meta[field] and len(meta[field]) == len(set(meta[field])), f"duplicate/empty {field}: {action_id}"


def test_every_family_level_has_at_least_two_formal_candidates():
    conditioning = load("conditioning.json")
    candidates = conditioning["conditioningActionMeta"]
    for family_id in conditioning["conditioningFamilyIds"]:
        for level in LEVELS:
            legal = [
                action_id for action_id, meta in candidates.items()
                if family_id in meta["families"] and level in meta["levels"]
            ]
            assert len(legal) >= 2, f"{family_id} {level} needs >=2 candidates; got {legal}"


def test_every_family_protocol_pair_has_at_least_two_formal_candidates():
    conditioning = load("conditioning.json")
    candidates = conditioning["conditioningActionMeta"]
    for family_id, family in conditioning["conditioningFamilies"].items():
        for protocol_id in family["protocolEligibility"]:
            legal = [
                action_id for action_id, meta in candidates.items()
                if family_id in meta["families"] and protocol_id in meta["protocolEligibility"]
            ]
            assert len(legal) >= 2, f"{family_id} {protocol_id} needs >=2 candidates; got {legal}"


def test_con04_has_two_power_candidates_at_every_level():
    conditioning = load("conditioning.json")
    candidates = conditioning["conditioningActionMeta"]
    for level in LEVELS:
        legal = [
            action_id for action_id, meta in candidates.items()
            if "CON-04" in meta["families"] and level in meta["levels"] and meta["powerEligible"]
        ]
        assert len(legal) >= 2, f"CON-04 {level} needs >=2 power candidates; got {legal}"


def test_active_modalities_have_candidates_and_carry_remains_reserved():
    conditioning = load("conditioning.json")
    candidates = conditioning["conditioningActionMeta"]
    for modality_id, record in conditioning["conditioningModalities"].items():
        matched = [
            action_id for action_id, meta in candidates.items()
            if modality_id in meta["modalities"]
        ]
        if record["v1Status"] == "ACTIVE":
            assert matched, f"ACTIVE modality has no candidates: {modality_id}"
        else:
            assert modality_id == "CARRY"
            assert not matched, f"reserved CARRY must not be auto-programmed: {matched}"


def test_candidate_protocols_have_compatible_work_metrics():
    conditioning = load("conditioning.json")
    protocols = conditioning["conditioningProtocols"]
    for action_id, meta in conditioning["conditioningActionMeta"].items():
        for protocol_id in meta["protocolEligibility"]:
            assert set(meta["workMetrics"]) & set(protocols[protocol_id]["allowedWorkMetrics"]), (
                f"{action_id} has no work metric compatible with {protocol_id}"
            )


def test_power_candidate_contract_is_explicit():
    conditioning = load("conditioning.json")
    protocols = conditioning["conditioningProtocols"]
    for action_id, meta in conditioning["conditioningActionMeta"].items():
        if not meta["powerEligible"]:
            continue
        assert "POWER" in meta["modalities"], action_id
        assert any(protocols[p]["allowsPower"] for p in meta["protocolEligibility"]), action_id
