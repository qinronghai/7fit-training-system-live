import json
import re
from pathlib import Path


ROOT = Path(__file__).parents[1]


def runtime_data():
    text = (ROOT / "data" / "system-data.js").read_text(encoding="utf-8")
    match = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    assert match, "runtime data bundle is missing"
    return json.loads(match.group(1))


def test_all_blueprints_reference_real_legal_conditioning_actions():
    data = runtime_data()
    blueprints = data["conditioningBlueprints"]
    actions = data["actions"]
    meta = data["conditioningActionMeta"]
    protocols = data["conditioningProtocols"]
    for family_id, levels in blueprints.items():
        for level, variants in levels.items():
            for variant_id, variant in variants.items():
                assert variant["sessionBlueprintId"] == f"{family_id}-{level}-{variant_id}"
                for block in variant["blocks"]:
                    assert block["protocolId"] in protocols
                    assert block["protocolId"] in data["conditioningFamilies"][family_id]["protocolEligibility"]
                    for station in block["stations"]:
                        action_id = station["actionId"]
                        assert action_id in actions
                        action = actions[action_id]
                        assert action["route"] == "CONDITIONING_2F"
                        assert action["status"] == "可自动编排"
                        assert family_id in meta[action_id]["families"]
                        assert level in meta[action_id]["levels"]
                        assert block["protocolId"] in meta[action_id]["protocolEligibility"]


def test_blueprints_do_not_promote_post_cardio_or_resolve_fake_actions():
    data = runtime_data()
    actions = data["actions"]
    for levels in data["conditioningBlueprints"].values():
        for variants in levels.values():
            for variant in variants.values():
                for block in variant["blocks"]:
                    for station in block["stations"]:
                        action = actions[station["actionId"]]
                        assert action["route"] != "POST_CARDIO_ONLY"
                        assert action["id"] == station["actionId"]
