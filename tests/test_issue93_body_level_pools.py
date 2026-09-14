import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
SRC = ROOT / "data" / "src"
LEVELS = ["L1", "L2", "L3", "L4"]
FAMILIES = ["BODY-01", "BODY-02", "BODY-03", "BODY-04"]
SLOTS = ["PRIMARY", "SECONDARY", "ACCESSORY", "ISOLATION-1", "ISOLATION-2", "OPTIONAL"]


def body():
    return json.loads((SRC / "body.json").read_text(encoding="utf-8"))


def test_issue93_publishes_16_explicit_family_level_pools():
    data = body()
    assert len(data["bodyActionMeta"]) == 68
    for family_id in FAMILIES:
        family = data["bodyFamilies"][family_id]
        assert list(family["levelPools"]) == LEVELS
        assert len(family["progressionChains"]) >= 2
        for level in LEVELS:
            pool = family["levelPools"][level]
            assert pool["level"] == level
            assert pool["replacementActionIds"]
            assert set(pool["introducedActionIds"]).isdisjoint(pool["retainedActionIds"])
            assert set(pool["introducedActionIds"]) | set(pool["retainedActionIds"]) == set(pool["replacementActionIds"])
            assert pool["downwardCompatibleLevels"] == data["bodyLevelPolicies"][level]["eligibleEntryLevels"]
            assert pool["fallbackLevel"] == data["bodyLevelPolicies"][level]["fallbackLevel"]
            for slot in SLOTS:
                assert slot in pool["preferredBySlot"]
                if data["bodyLevelPolicies"][level]["defaultWorkingSets"][slot] > 0:
                    assert pool["preferredBySlot"][slot], f"{family_id} {level} {slot} preferred pool empty"


def test_issue93_repairs_beginner_learning_entries_with_existing_actions():
    data = body()
    assert "V13_SQ_DB_GOBLET" in data["bodyFamilies"]["BODY-01"]["levelPools"]["L2"]["replacementActionIds"]
    body02_l1 = data["bodyFamilies"]["BODY-02"]["levelPools"]["L1"]
    assert "movement_dowel_hip_hinge" in body02_l1["replacementActionIds"]
    assert "movement_supported_single_leg_hinge" in body02_l1["replacementActionIds"]
    body03_l1 = data["bodyFamilies"]["BODY-03"]["levelPools"]["L1"]
    assert "V13_HR_SCAP_ROW" in body03_l1["replacementActionIds"]
    assert "fuzhu_yinti_jianjia_xiachen" in body03_l1["replacementActionIds"]


def test_issue93_formal_barbell_endpoints_enter_at_l4_not_l3():
    data = body()
    for action_id in ["gangling_shendun", "gangling_yingla", "gangling_huachuan", "gangling_wotu"]:
        assert data["bodyActionMeta"][action_id]["levels"] == ["L4"], action_id
    assert "movement_bodyweight_pullup" in data["bodyFamilies"]["BODY-03"]["levelPools"]["L4"]["introducedActionIds"]
    assert "movement_barbell_overhead_press" in data["bodyFamilies"]["BODY-04"]["levelPools"]["L4"]["introducedActionIds"]


def test_issue93_l4_retains_stable_hypertrophy_tools():
    data = body()
    retained = {
        "BODY-01": "hake_shendun",
        "BODY-02": "tun_tui",
        "BODY-03": "feiji_labei_zhongba",
        "BODY-04": "qixie_xiongtui",
    }
    for family_id, action_id in retained.items():
        pool = data["bodyFamilies"][family_id]["levelPools"]["L4"]
        assert action_id in pool["replacementActionIds"]
        assert action_id in pool["retainedActionIds"]


def test_issue93_progression_chains_have_explicit_regression_fallbacks():
    data = body()
    for family_id in FAMILIES:
        family = data["bodyFamilies"][family_id]
        for chain_id, chain in family["progressionChains"].items():
            assert chain["chainId"] == chain_id
            assert [node["level"] for node in chain["nodes"]] == LEVELS
            assert chain["retentionPolicy"]
            for node in chain["nodes"]:
                assert node["actionId"] in data["bodyActionMeta"]
                assert node["fallbackActionId"] in data["bodyActionMeta"]
                assert family_id in data["bodyActionMeta"][node["actionId"]]["families"]
                assert family_id in data["bodyActionMeta"][node["fallbackActionId"]]["families"]
                assert node["qualificationReason"]


def test_issue93_level_priority_is_not_just_volume():
    data = body()
    expected_primary_heads = {
        "BODY-01": {"L1": "movement_bench_box_squat", "L2": "V13_SQ_DB_GOBLET", "L3": "hake_shendun", "L4": "hake_shendun"},
        "BODY-02": {"L1": "movement_dowel_hip_hinge", "L2": "yaling_luomaniya_yingla", "L3": "yaling_luomaniya_yingla", "L4": "hipthrust_pause_main"},
        "BODY-03": {"L1": "V13_HR_SCAP_ROW", "L2": "feiji_labei_zhongba", "L3": "zuozi_huachuan_bianshi", "L4": "movement_bodyweight_pullup"},
        "BODY-04": {"L1": "movement_incline_pushup", "L2": "qixie_xiongtui", "L3": "wotu_xiong_tui", "L4": "gangling_wotu"},
    }
    for family_id, by_level in expected_primary_heads.items():
        heads = []
        for level in LEVELS:
            head = data["bodyFamilies"][family_id]["levelPools"][level]["preferredBySlot"]["PRIMARY"][0]
            assert head == by_level[level]
            heads.append(head)
        assert len(set(heads)) >= 3, f"{family_id} level priorities remain overly homogeneous"


def test_issue93_preserves_venue_boundaries_for_followup_94():
    data = body()
    assert "smith_tuntui" not in data["bodyActionMeta"]
    assert "hake_shendun" not in data["bodyFamilies"]["BODY-01"]["levelPools"]["L1"]["replacementActionIds"]
    assert "liujiao_gantui_yingla" not in data["bodyFamilies"]["BODY-02"]["levelPools"]["L2"]["replacementActionIds"]
