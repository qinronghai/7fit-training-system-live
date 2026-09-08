import json
import re
from pathlib import Path

DATA = Path(__file__).parents[1] / "data" / "system-data.js"

def load_payload():
    text = DATA.read_text(encoding="utf-8")
    m = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    assert m, "window.V14_DATA payload missing"
    return json.loads(m.group(1))

def test_training_inventory_is_preserved():
    data = load_payload()
    assert len(data["sessions"]) == 32
    assert len(data["supportIds"]) == 30
    assert len(data["coreIds"]) == 20
    assert data["recipeIds"] == [f"F111-{i:02d}" for i in range(1, 9)]

def test_v11_baseline_marker_is_explicit():
    data = load_payload()
    assert data["meta"]["eightPatternBaseline"] == "V1.1"

def test_every_session_has_six_formal_slots_and_one_conflict_identity():
    data = load_payload()
    for session_id, session in data['sessions'].items():
        assert session_id.startswith('F111-')
        assert len(session['slots']) == 6
        assert len({s['slotKey'] for s in session['slots']}) == 6

def test_eight_pattern_v11_chains_are_frozen():
    data = load_payload()
    chains = data['eightPatterns']
    assert chains['蹲模式'] == ['tushen_shendun','V13_SQ_DB_GOBLET','hake_shendun','gangling_shendun']
    assert chains['髋铰链'] == ['movement_dowel_hip_hinge','yaling_luomaniya_yingla','liujiao_gantui_yingla','gangling_yingla']
    assert chains['臀推 / 髋伸展'] == ['tunqiao','tun_tui','hipthrust_pause_main','hipthrust_pause_main']
    assert chains['单腿'] == ['movement_supported_split_squat','movement_bodyweight_split_squat','movement_dumbbell_reverse_lunge','baojiayali_fentundun']
    assert chains['水平推'] == ['movement_incline_pushup','qixie_xiongtui','wotu_xiong_tui','gangling_wotu']
    assert chains['垂直推'] == ['V13_VP_SEATED_LIGHT_DB','qixie_jian_tui','movement_halfkneeling_landmine_press','movement_barbell_overhead_press']
    assert chains['水平拉'] == ['V13_HR_SCAP_ROW','feiji_labei_zhongba','zuozi_huachuan_bianshi','gangling_huachuan']
    assert chains['垂直拉'] == ['fuzhu_yinti_jianjia_xiachen','gaowei_xiala_vba','fuzhu_yinti_xiangshang','movement_bodyweight_pullup']

def test_v14_non_regression_inventory():
    data = load_payload()
    assert len(data['sessions']) == 32
    assert len(data['supportIds']) == 30
    assert len(data['coreIds']) == 20
    assert len(data['eightPatterns']) == 8
    assert len(data['actionDetails']) >= 189
    assert len(data['actions']) >= 239
    for session in data['sessions'].values():
        ids = [slot['baselineId'] for slot in session['slots']]
        assert len(ids) == 6
        for action_id in ids:
            assert action_id in data['actions']
            assert data['actions'][action_id]['route'] in {'1F_ONLY', 'FLEX_1F_2F'}
            assert data['actions'][action_id]['route'] != 'POST_CARDIO_ONLY'

def test_all_swap_options_reference_known_actions():
    data = load_payload()
    for view in data['sessionViews'].values():
        for options in view['slotOptions'].values():
            for option in options:
                assert option['id'] in data['actions']

def test_v143_warmup_library_and_matching_are_present():
    data = load_payload()
    assert len(data["warmupIds"]) == 20
    assert len(data["warmupDetails"]) == 20
    assert data["meta"]["warmupBaseline"] == "PREP-P1-P4"
    assert "PREP-01" in data["warmupDetails"]
    assert data["warmupDetails"]["PREP-01"]["name"] == "四足跪姿支撑"
    assert data["warmupDetails"]["PREP-03"]["name"] == "最伟大伸展（弓步 + 胸椎旋转）"
    assert data["warmupDetails"]["PREP-15"]["name"] == "徒手髋铰链"
    assert data["warmupDetails"]["PREP-17"]["name"] == "弹力带侧向螃蟹走"
    assert set(data["warmupMatchByPattern"].keys()) == {"蹲","髋铰链","髋伸展","单腿","水平推","垂直推","水平拉","垂直拉"}

def test_v144_foam_roll_library_and_pattern_matching_are_present():
    data = load_payload()
    assert len(data["foamRollIds"]) == 12
    assert len(data["foamRollDetails"]) == 12
    names = {v["name"] for v in data["foamRollDetails"].values()}
    required = {
        "泡沫轴松解-胸大肌",
        "泡沫轴松解-肩部",
        "泡沫轴松解-肱三头肌",
        "泡沫轴松解-肱二头肌",
        "泡沫轴松解-大腿内侧",
        "泡沫轴松解-大腿外侧",
        "泡沫轴松解-竖脊肌旁（胸腰段）",
    }
    assert required <= names
    assert set(data["foamRollMatchByPattern"].keys()) == {"蹲","髋铰链","髋伸展","单腿","水平推","垂直推","水平拉","垂直拉"}
    assert data["foamRollMatchByPattern"]["水平推"][:3] == ["FOAM-01","FOAM-02","FOAM-03"]
    assert data["foamRollMatchByPattern"]["垂直拉"][:2] == ["FOAM-08","FOAM-04"]
    assert "FOAM-05" in data["foamRollMatchByPattern"]["蹲"]
    assert "FOAM-07" in data["foamRollMatchByPattern"]["髋铰链"]

