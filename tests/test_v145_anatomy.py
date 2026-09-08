import json
import re
from pathlib import Path

ROOT = Path(__file__).parents[1]
DATA = ROOT / "data" / "anatomy-data.js"


def load_anatomy():
    text = DATA.read_text(encoding="utf-8")
    m = re.search(r"window\.V14_ANATOMY\s*=\s*(\{.*\});\s*$", text, re.S)
    assert m, "window.V14_ANATOMY missing"
    return json.loads(m.group(1))


def test_anatomy_payload_contract():
    data = load_anatomy()
    assert data["meta"]["version"] == "V14.6"
    assert data["meta"]["phaseAExpected"] == 120
    assert data["meta"]["exposureWeights"] == {
        "primary": 1.0,
        "secondary": 0.5,
        "stabilizers": 0.25,
    }
    assert isinstance(data["records"], dict)


def test_phase_a_manifest_is_frozen_at_120_unique_nodes():
    manifest_path = ROOT / "docs" / "V14.5-PHASE-A-MANIFEST.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["expected"] == 120
    assert len(manifest["ids"]) == 120
    assert len(set(manifest["ids"])) == 120
    assert len(manifest["groups"]["strength"]) == 40
    assert len(manifest["groups"]["support"]) == 30
    assert len(manifest["groups"]["core"]) == 20
    assert len(manifest["groups"]["prep"]) == 20
    assert len(manifest["groups"]["foam"]) == 12


def test_anatomy_scripts_are_loaded_in_safe_order_and_exist():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    expected = [
        "data/system-data.js",
        "data/anatomy-data.js",
        "js/router.js",
        "js/state.js",
        "js/anatomy.js",
        "js/conflict.js",
    ]
    positions = [html.index(f'src="{src}"') for src in expected]
    assert positions == sorted(positions)
    for src in expected:
        assert (ROOT / src).exists(), src


def load_manifest():
    return json.loads(
        (ROOT / "docs" / "V14.5-PHASE-A-MANIFEST.json").read_text(encoding="utf-8")
    )


def test_phase_a_strength_records_are_complete():
    anatomy = load_anatomy()
    manifest = load_manifest()
    for action_id in manifest["groups"]["strength"]:
        record = anatomy["records"].get(action_id)
        assert record, action_id
        assert record["roleType"] == "strength"
        assert record["primary"], action_id
        assert record["joints"], action_id
        assert record["confidence"] in {"high", "medium", "review"}


def load_v14_data():
    text = (ROOT / "data" / "system-data.js").read_text(encoding="utf-8")
    m = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    assert m
    return json.loads(m.group(1))


def test_support_core_anatomy_is_complete():
    anatomy = load_anatomy()["records"]
    base = load_v14_data()
    for action_id in base["supportIds"] + base["coreIds"]:
        rec = anatomy.get(action_id)
        assert rec, action_id
        assert rec["roleType"] == "support_core"
        assert rec["primary"], action_id
        assert rec["stabilizers"] or rec["secondary"], action_id
        assert rec["confidence"] in {"high", "medium", "review"}


def test_prep_and_foam_anatomy_are_complete_and_mapped():
    anatomy_payload = load_anatomy()
    records = anatomy_payload["records"]
    base = load_v14_data()

    for item in base["warmupDetails"].values():
        action_id = item["actionId"]
        assert records.get(action_id), action_id
        assert records[action_id]["roleType"] in {
            "support_core", "activation", "mobility", "stretch"
        }

    for item in base["foamRollDetails"].values():
        action_id = item["actionId"]
        rec = records.get(action_id)
        assert rec, action_id
        assert rec["roleType"] == "foam_roll"
        assert rec["tissueTargets"], action_id
        assert rec["avoidRegions"], action_id

    expected = {
        "胸大肌": "FOAM-01",
        "三角肌前束": "FOAM-02",
        "三角肌中束": "FOAM-02",
        "三角肌后束": "FOAM-02",
        "肱三头肌": "FOAM-03",
        "肱二头肌": "FOAM-04",
        "内收肌群": "FOAM-05",
        "股外侧肌": "FOAM-06",
        "竖脊肌": "FOAM-07",
        "背阔肌": "FOAM-08",
        "股四头肌": "FOAM-09",
        "腘绳肌": "FOAM-10",
        "臀大肌": "FOAM-11",
        "臀中肌": "FOAM-11",
        "腓肠肌": "FOAM-12",
        "比目鱼肌": "FOAM-12",
    }
    assert anatomy_payload["foamByMuscle"] == expected


def test_phase_a_120_records_are_complete():
    anatomy = load_anatomy()
    manifest = load_manifest()
    assert len(manifest["ids"]) == 120
    missing = [x for x in manifest["ids"] if x not in anatomy["records"]]
    assert missing == []


def test_v146_phase_bc_manifest_counts_and_runtime_gap():
    manifest_path = ROOT / "docs" / "V14.6-PHASE-BC-MANIFEST.json"
    assert manifest_path.exists(), "V14.6 phase B/C manifest missing"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert manifest["runtimeExpected"] == 239
    assert manifest["phaseA"] == 120
    assert manifest["remaining"] == 119
    assert manifest["phaseBExpected"] == 85
    assert manifest["phaseCExpected"] == 34
    assert len(manifest["phaseB"]["主训练"]) == 65
    assert len(manifest["phaseB"]["激活"]) == 12
    assert len(manifest["phaseB"]["热身"]) == 8
    assert len(manifest["phaseC"]["体能"]) == 20
    assert len(manifest["phaseC"]["放松"]) == 14
    ids = (
        manifest["phaseB"]["主训练"]
        + manifest["phaseB"]["激活"]
        + manifest["phaseB"]["热身"]
        + manifest["phaseC"]["体能"]
        + manifest["phaseC"]["放松"]
    )
    assert len(ids) == 119
    assert len(set(ids)) == 119


def load_v146_manifest():
    return json.loads((ROOT / "docs" / "V14.6-PHASE-BC-MANIFEST.json").read_text(encoding="utf-8"))


def test_v146_phase_b_85_records_are_complete():
    anatomy = load_anatomy()
    manifest = load_v146_manifest()
    ids = (
        manifest["phaseB"]["主训练"]
        + manifest["phaseB"]["激活"]
        + manifest["phaseB"]["热身"]
    )
    assert len(ids) == 85
    missing = [aid for aid in ids if aid not in anatomy["records"]]
    assert missing == []
    for aid in manifest["phaseB"]["主训练"]:
        assert anatomy["records"][aid]["roleType"] in {"strength", "activation"}
    for aid in manifest["phaseB"]["激活"]:
        assert anatomy["records"][aid]["roleType"] == "support_core"
    for aid in manifest["phaseB"]["热身"]:
        assert anatomy["records"][aid]["roleType"] in {"mobility", "stretch", "activation", "foam_roll", "strength"}
    assert anatomy["records"]["paomozhou_xiongzhui"]["confidence"] == "review"
    assert anatomy["records"]["xiongzhui_shenzhan"]["confidence"] == "review"


def test_v146_phase_c_34_records_remain_complete_inside_v147_runtime():
    anatomy = load_anatomy()
    manifest = load_v146_manifest()
    for aid in manifest["phaseC"]["体能"]:
        rec = anatomy["records"].get(aid)
        assert rec, aid
        assert rec["roleType"] == "conditioning"
        assert rec["primary"], aid
        assert rec["joints"], aid
    for aid in manifest["phaseC"]["放松"]:
        rec = anatomy["records"].get(aid)
        assert rec, aid
        assert rec["roleType"] == "stretch"
        assert rec["primary"], aid
        assert rec["joints"], aid
    base = load_v14_data()
    assert len(base["actions"]) >= 239
    assert len(anatomy["records"]) >= 239
    assert [aid for aid in base["actions"] if aid not in anatomy["records"]] == []
