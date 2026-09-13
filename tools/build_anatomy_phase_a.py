#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANATOMY_PATH = ROOT / "data" / "anatomy-data.js"
SYSTEM_PATH = ROOT / "data" / "system-data.js"
CURATION_PATH = ROOT / "docs" / "V14.5-ANATOMY-CURATION.md"


def load_js_object(path: Path, global_name: str):
    text = path.read_text(encoding="utf-8")
    m = re.search(rf"window\.{re.escape(global_name)}\s*=\s*(\{{.*\}});\s*$", text, re.S)
    if not m:
        raise RuntimeError(f"{global_name} payload not found in {path}")
    return json.loads(m.group(1))


def rec(primary, secondary, stabilizers, joints, actions, confidence="high", source="7Fit V14.5 curated anatomy layer"):
    return {
        "roleType": "strength",
        "primary": primary,
        "secondary": secondary,
        "stabilizers": stabilizers,
        "joints": joints,
        "movementActions": actions,
        "tissueTargets": [],
        "avoidRegions": [],
        "confidence": confidence,
        "sourceNote": source,
    }


STRENGTH = {
    "V13_HR_SCAP_ROW": rec(
        ["中斜方肌", "菱形肌"], ["三角肌后束", "背阔肌", "肱二头肌"],
        ["肩袖肌群", "腹壁"], ["肩胛胸廓关节", "肩关节", "肘关节"],
        ["肩胛后缩", "肩伸", "肘屈"], "medium",
        "7Fit V14.5 curated anatomy layer；场馆轻重量肩胛划船"
    ),
    "V13_SQ_DB_GOBLET": rec(
        ["股四头肌", "臀大肌"], ["内收肌群", "腘绳肌"],
        ["腹壁", "竖脊肌", "臀中肌"], ["髋关节", "膝关节", "踝关节"],
        ["髋伸", "膝伸"]
    ),
    "V13_VP_SEATED_LIGHT_DB": rec(
        ["三角肌前束", "三角肌中束"], ["肱三头肌"],
        ["肩袖肌群", "前锯肌", "斜方肌上束", "斜方肌下束", "腹壁"],
        ["肩关节", "肘关节", "肩胛胸廓关节"], ["肩屈/外展", "肘伸", "肩胛上旋"]
    ),
    "baojiayali_fentundun": rec(
        ["股四头肌", "臀大肌"], ["内收肌群", "腘绳肌"],
        ["臀中肌", "腹壁", "足踝稳定肌群"], ["髋关节", "膝关节", "踝关节"],
        ["髋伸", "膝伸"]
    ),
    "feiji_labei_zhongba": rec(
        ["背阔肌", "中斜方肌", "菱形肌"], ["肱二头肌", "肱肌", "三角肌后束"],
        ["肩袖肌群"], ["肩关节", "肘关节", "肩胛胸廓关节"],
        ["肩伸", "肘屈", "肩胛后缩"]
    ),
    "fuzhu_yinti_jianjia_xiachen": rec(
        ["斜方肌下束", "背阔肌"], ["菱形肌"],
        ["肩袖肌群", "前锯肌", "腹壁"], ["肩胛胸廓关节", "肩关节"],
        ["肩胛下沉"], "medium"
    ),
    "fuzhu_yinti_xiangshang": rec(
        ["背阔肌"], ["肱二头肌", "肱肌", "大圆肌"],
        ["斜方肌下束", "菱形肌", "肩袖肌群", "腹壁"],
        ["肩关节", "肘关节", "肩胛胸廓关节"], ["肩内收/伸展", "肘屈", "肩胛下沉"]
    ),
    "gangling_huachuan": rec(
        ["背阔肌", "中斜方肌", "菱形肌"], ["肱二头肌", "肱肌", "三角肌后束"],
        ["竖脊肌", "腹壁", "臀大肌", "腘绳肌"],
        ["肩关节", "肘关节", "肩胛胸廓关节", "髋关节"],
        ["肩伸", "肘屈", "肩胛后缩", "躯干等长稳定"]
    ),
    "gangling_shendun": rec(
        ["股四头肌", "臀大肌"], ["内收肌群", "腘绳肌"],
        ["腹壁", "竖脊肌", "臀中肌"], ["髋关节", "膝关节", "踝关节"], ["髋伸", "膝伸"]
    ),
    "gangling_wotu": rec(
        ["胸大肌"], ["肱三头肌", "三角肌前束"],
        ["肩袖肌群", "肩胛稳定肌群", "腹壁"], ["肩关节", "肘关节"],
        ["肩水平内收", "肘伸"]
    ),
    "gangling_yingla": rec(
        ["臀大肌", "腘绳肌"], ["股四头肌", "内收肌群"],
        ["竖脊肌", "背阔肌", "腹壁", "前臂握力肌群"],
        ["髋关节", "膝关节", "踝关节"], ["髋伸", "膝伸", "躯干等长稳定"]
    ),
    "gaowei_xiala_vba": rec(
        ["背阔肌"], ["肱二头肌", "肱肌", "大圆肌"],
        ["斜方肌下束", "菱形肌", "肩袖肌群", "腹壁"],
        ["肩关节", "肘关节", "肩胛胸廓关节"], ["肩内收/伸展", "肘屈", "肩胛下沉"]
    ),
    "hake_shendun": rec(
        ["股四头肌", "臀大肌"], ["内收肌群"],
        ["腹壁", "竖脊肌", "臀中肌"], ["髋关节", "膝关节", "踝关节"], ["髋伸", "膝伸"]
    ),
    "hipthrust_pause_main": rec(
        ["臀大肌"], ["腘绳肌", "内收肌群"],
        ["腹壁", "臀中肌"], ["髋关节", "膝关节"], ["髋伸"]
    ),
    "houzu_sanji": rec(
        ["三角肌后束"], ["中斜方肌", "菱形肌"],
        ["肩袖肌群", "腹壁", "竖脊肌"], ["肩关节", "肩胛胸廓关节", "髋关节"],
        ["肩水平外展", "肩胛后缩", "躯干等长稳定"]
    ),
    "kuangnei_shou": rec(
        ["内收肌群"], [], ["腹壁", "骨盆稳定肌群"], ["髋关节"], ["髋内收"]
    ),
    "kuangwai_zhan": rec(
        ["臀中肌", "臀小肌"], ["阔筋膜张肌"], ["腹壁", "骨盆稳定肌群"], ["髋关节"], ["髋外展"]
    ),
    "liujiao_gantui_yingla": rec(
        ["臀大肌", "股四头肌"], ["腘绳肌", "内收肌群"],
        ["竖脊肌", "背阔肌", "腹壁", "前臂握力肌群"],
        ["髋关节", "膝关节", "踝关节"], ["髋伸", "膝伸", "躯干等长稳定"], "medium",
        "7Fit V14.5 curated anatomy layer；六角杠受把手高度与起始髋膝角度影响"
    ),
    "mianla": rec(
        ["三角肌后束", "中斜方肌", "菱形肌"], ["肩袖外旋肌群", "肱二头肌"],
        ["斜方肌下束", "前锯肌", "腹壁"], ["肩关节", "肘关节", "肩胛胸廓关节"],
        ["肩水平外展", "肩外旋", "肩胛后缩"], "medium",
        "7Fit V14.5 curated anatomy layer；面拉受绳索高度与肘线影响"
    ),
    "movement_barbell_overhead_press": rec(
        ["三角肌前束", "三角肌中束"], ["肱三头肌"],
        ["肩袖肌群", "前锯肌", "斜方肌上束", "斜方肌下束", "腹壁", "臀大肌"],
        ["肩关节", "肘关节", "肩胛胸廓关节"], ["肩屈/外展", "肘伸", "肩胛上旋"]
    ),
    "movement_bodyweight_pullup": rec(
        ["背阔肌"], ["肱二头肌", "肱肌", "大圆肌"],
        ["斜方肌下束", "菱形肌", "肩袖肌群", "腹壁"],
        ["肩关节", "肘关节", "肩胛胸廓关节"], ["肩内收/伸展", "肘屈", "肩胛下沉"]
    ),
    "movement_bodyweight_split_squat": rec(
        ["股四头肌", "臀大肌"], ["内收肌群", "腘绳肌"],
        ["臀中肌", "腹壁", "足踝稳定肌群"], ["髋关节", "膝关节", "踝关节"], ["髋伸", "膝伸"]
    ),
    "movement_dowel_hip_hinge": rec(
        ["臀大肌", "腘绳肌"], ["内收肌群"],
        ["腹壁", "竖脊肌"], ["髋关节", "膝关节"], ["髋伸", "髋铰链模式控制"]
    ),
    "movement_dumbbell_reverse_lunge": rec(
        ["股四头肌", "臀大肌"], ["内收肌群", "腘绳肌"],
        ["臀中肌", "腹壁", "足踝稳定肌群"], ["髋关节", "膝关节", "踝关节"], ["髋伸", "膝伸"]
    ),
    "movement_halfkneeling_landmine_press": rec(
        ["三角肌前束", "胸大肌上部"], ["肱三头肌"],
        ["前锯肌", "斜方肌下束", "肩袖肌群", "腹壁", "臀大肌"],
        ["肩关节", "肘关节", "肩胛胸廓关节", "髋关节"],
        ["肩屈/斜向推举", "肘伸", "肩胛上旋"], "medium",
        "7Fit V14.5 curated anatomy layer；地雷杆角度会改变胸肩贡献比例"
    ),
    "movement_incline_pushup": rec(
        ["胸大肌"], ["肱三头肌", "三角肌前束"],
        ["前锯肌", "肩袖肌群", "腹壁", "臀大肌"], ["肩关节", "肘关节", "肩胛胸廓关节"],
        ["肩水平内收", "肘伸", "肩胛前伸/后缩控制"]
    ),
    "movement_supported_split_squat": rec(
        ["股四头肌", "臀大肌"], ["内收肌群", "腘绳肌"],
        ["臀中肌", "腹壁"], ["髋关节", "膝关节", "踝关节"], ["髋伸", "膝伸"]
    ),
    "qixie_jian_tui": rec(
        ["三角肌前束", "三角肌中束"], ["肱三头肌"],
        ["肩袖肌群", "前锯肌", "斜方肌上束", "斜方肌下束"],
        ["肩关节", "肘关节", "肩胛胸廓关节"], ["肩屈/外展", "肘伸", "肩胛上旋"]
    ),
    "qixie_xiongtui": rec(
        ["胸大肌"], ["肱三头肌", "三角肌前束"],
        ["肩袖肌群", "肩胛稳定肌群"], ["肩关节", "肘关节"], ["肩水平内收", "肘伸"]
    ),
    "shengsuo_cepingju": rec(
        ["三角肌中束"], ["三角肌前束", "冈上肌"],
        ["前锯肌", "斜方肌上束", "斜方肌下束", "肩袖肌群"],
        ["肩关节", "肩胛胸廓关节"], ["肩外展", "肩胛上旋"]
    ),
    "shengsuo_ertou_wanju": rec(
        ["肱二头肌"], ["肱肌", "肱桡肌"],
        ["肩袖肌群", "肩胛稳定肌群", "腹壁"], ["肘关节", "前臂关节"], ["肘屈", "前臂旋后"]
    ),
    "shengsuo_santou_xiaya": rec(
        ["肱三头肌"], [], ["肩胛稳定肌群", "腹壁"], ["肘关节"], ["肘伸"]
    ),
    "tui_qushen": rec(
        ["股四头肌"], [], ["骨盆稳定肌群"], ["膝关节"], ["膝伸"]
    ),
    "tui_wanju": rec(
        ["腘绳肌"], ["腓肠肌"], ["骨盆稳定肌群"], ["膝关节"], ["膝屈"]
    ),
    "tun_tui": rec(
        ["臀大肌"], ["腘绳肌", "内收肌群"], ["腹壁", "臀中肌"], ["髋关节", "膝关节"], ["髋伸"]
    ),
    "tunqiao": rec(
        ["臀大肌"], ["腘绳肌"], ["腹壁", "臀中肌"], ["髋关节", "膝关节"], ["髋伸"]
    ),
    "tushen_shendun": rec(
        ["股四头肌", "臀大肌"], ["内收肌群", "腘绳肌"], ["腹壁", "竖脊肌", "臀中肌"],
        ["髋关节", "膝关节", "踝关节"], ["髋伸", "膝伸"]
    ),
    "wotu_xiong_tui": rec(
        ["胸大肌"], ["肱三头肌", "三角肌前束"], ["肩袖肌群", "肩胛稳定肌群", "腹壁"],
        ["肩关节", "肘关节"], ["肩水平内收", "肘伸"]
    ),
    "yaling_luomaniya_yingla": rec(
        ["臀大肌", "腘绳肌"], ["内收肌群"], ["竖脊肌", "背阔肌", "腹壁", "前臂握力肌群"],
        ["髋关节", "膝关节"], ["髋伸", "髋铰链"]
    ),
    "zuozi_huachuan_bianshi": rec(
        ["背阔肌", "中斜方肌", "菱形肌"], ["肱二头肌", "肱肌", "三角肌后束"],
        ["肩袖肌群", "腹壁", "竖脊肌"], ["肩关节", "肘关节", "肩胛胸廓关节"],
        ["肩伸", "肘屈", "肩胛后缩"], "medium",
        "7Fit V14.5 curated anatomy layer；坐姿划船具体把位与肘线可改变背部重点"
    ),
}



def sc_rec(primary, secondary, stabilizers, joints, actions, confidence="high", source="7Fit V14.5 curated anatomy layer"):
    return {
        "roleType": "support_core",
        "primary": primary,
        "secondary": secondary,
        "stabilizers": stabilizers,
        "joints": joints,
        "movementActions": actions,
        "tissueTargets": [],
        "avoidRegions": [],
        "confidence": confidence,
        "sourceNote": source,
    }


SUPPORT_CORE = {
    "SUP-S1-01": sc_rec(["腹横肌", "腹内外斜肌"], ["腹直肌", "前锯肌"], ["肩袖肌群", "骨盆稳定肌群"], ["肩关节", "肩胛胸廓关节", "髋关节"], ["躯干抗伸展", "四点支撑稳定"]),
    "SUP-S1-02": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["臀大肌", "股四头肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "肩胛胸廓关节", "髋关节"], ["躯干抗伸展"]),
    "SUP-S1-03": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["臀大肌", "股四头肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "肩胛胸廓关节", "髋关节"], ["躯干抗伸展"]),
    "SUP-S1-04": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["臀大肌", "股四头肌", "肱三头肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "肘关节", "髋关节"], ["躯干抗伸展"]),
    "SUP-S1-05": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["臀大肌", "股四头肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "髋关节"], ["躯干抗伸展"]),
    "SUP-S2-01": sc_rec(["腹横肌", "腹内外斜肌"], ["前锯肌"], ["肩袖肌群", "骨盆稳定肌群"], ["肩关节", "肩胛胸廓关节", "髋关节"], ["躯干抗旋转", "单侧支撑"]),
    "SUP-S2-02": sc_rec(["腹横肌", "腹内外斜肌"], ["臀大肌"], ["肩胛稳定肌群", "骨盆稳定肌群"], ["髋关节", "肩关节"], ["躯干抗旋转", "髋伸"]),
    "SUP-S2-03": sc_rec(["腹横肌", "腹内外斜肌"], ["臀大肌", "多裂肌"], ["肩胛稳定肌群", "骨盆稳定肌群"], ["肩关节", "髋关节"], ["躯干抗旋转", "对侧肢体伸展"]),
    "SUP-S2-04": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["臀大肌"], ["前锯肌", "肩袖肌群", "骨盆稳定肌群"], ["肩关节", "髋关节"], ["躯干抗伸展", "单腿支撑"]),
    "SUP-S2-05": sc_rec(["腹横肌", "腹内外斜肌"], ["前锯肌", "股四头肌"], ["肩袖肌群", "骨盆稳定肌群"], ["肩关节", "髋关节", "膝关节"], ["躯干抗旋转", "熊式悬膝支撑"]),
    "SUP-S3-01": sc_rec(["腹横肌", "腹内外斜肌"], ["臀大肌", "多裂肌"], ["肩胛稳定肌群", "骨盆稳定肌群"], ["肩关节", "髋关节"], ["躯干抗旋转", "对侧肢体动态伸展"]),
    "SUP-S3-02": sc_rec(["腹横肌", "腹内外斜肌"], ["前锯肌", "肱三头肌"], ["肩袖肌群", "臀中肌"], ["肩关节", "肘关节", "髋关节"], ["躯干抗旋转", "交替单臂支撑"]),
    "SUP-S3-03": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["臀大肌"], ["前锯肌", "肩袖肌群", "骨盆稳定肌群"], ["肩关节", "髋关节"], ["躯干抗伸展", "交替髋伸"]),
    "SUP-S3-04": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["髂腰肌"], ["前锯肌", "肩袖肌群", "骨盆稳定肌群"], ["肩关节", "髋关节", "膝关节"], ["躯干抗伸展", "交替髋屈"]),
    "SUP-S3-05": sc_rec(["腹横肌", "腹内外斜肌"], ["前锯肌", "股四头肌"], ["肩袖肌群", "臀中肌"], ["肩关节", "髋关节", "膝关节"], ["躯干抗旋转", "熊式悬膝交替支撑"]),
    "SUP-S4-01": sc_rec(["腹横肌", "腹内外斜肌"], ["前锯肌", "股四头肌", "髂腰肌"], ["肩袖肌群", "臀中肌", "足踝稳定肌群"], ["肩关节", "髋关节", "膝关节", "踝关节"], ["动态支撑", "对侧步态位移"]),
    "SUP-S4-02": sc_rec(["腹横肌", "腹内外斜肌"], ["前锯肌", "股四头肌", "臀大肌"], ["肩袖肌群", "臀中肌", "足踝稳定肌群"], ["肩关节", "髋关节", "膝关节", "踝关节"], ["动态支撑", "后向位移"]),
    "SUP-S4-03": sc_rec(["腹横肌", "腹内外斜肌"], ["前锯肌", "臀中肌", "股四头肌"], ["肩袖肌群", "骨盆稳定肌群", "足踝稳定肌群"], ["肩关节", "髋关节", "膝关节", "踝关节"], ["动态支撑", "侧向位移"]),
    "SUP-S4-04": sc_rec(["腹横肌", "腹内外斜肌", "腹直肌"], ["前锯肌", "三角肌", "肱三头肌"], ["肩袖肌群", "臀中肌"], ["肩关节", "肘关节", "髋关节"], ["躯干抗旋转", "侧向上肢位移"]),
    "SUP-S4-05": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["前锯肌", "三角肌", "肱三头肌"], ["臀大肌", "腘绳肌", "肩袖肌群"], ["肩关节", "髋关节", "膝关节"], ["躯干抗伸展", "手部向前位移"]),
    "SUP-S5-01": sc_rec(["胸段竖脊肌", "腹内外斜肌"], ["肩胛周围肌群"], ["骨盆稳定肌群", "肩袖肌群"], ["胸椎", "肩关节", "髋关节"], ["胸椎旋转"], "medium", "7Fit V14.5 curated anatomy layer；该节点兼具活动度属性"),
    "SUP-S5-02": sc_rec(["胸段竖脊肌", "腹内外斜肌"], ["三角肌后束", "肩胛周围肌群"], ["骨盆稳定肌群", "肩袖肌群"], ["胸椎", "肩关节"], ["胸椎旋转", "肩水平内收/外展"], "medium", "7Fit V14.5 curated anatomy layer；穿针轨迹受肩部活动范围影响"),
    "SUP-S5-03": sc_rec(["胸段竖脊肌", "腹内外斜肌"], ["臀大肌", "髂腰肌"], ["骨盆稳定肌群", "肩胛稳定肌群"], ["胸椎", "髋关节", "膝关节"], ["胸椎旋转", "弓步位稳定"], "medium", "7Fit V14.5 curated anatomy layer；旋转幅度与弓步位姿势影响参与比例"),
    "SUP-S5-04": sc_rec(["腹内外斜肌", "腹横肌"], ["前锯肌", "三角肌"], ["肩袖肌群", "臀中肌"], ["肩关节", "胸椎", "髋关节"], ["躯干旋转控制", "高位平板转侧支撑"]),
    "SUP-S5-05": sc_rec(["腹内外斜肌", "腹横肌"], ["胸段竖脊肌", "前锯肌"], ["肩袖肌群", "臀中肌"], ["肩关节", "胸椎", "髋关节"], ["侧向支撑", "胸椎旋转"]),
    "SUP-S6-01": sc_rec(["腹内外斜肌", "腹横肌"], ["腰方肌", "臀中肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "髋关节"], ["躯干抗侧屈", "单侧支撑"]),
    "SUP-S6-02": sc_rec(["腹内外斜肌", "腹横肌"], ["腰方肌", "臀中肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "髋关节", "膝关节"], ["躯干抗侧屈", "单侧支撑"]),
    "SUP-S6-03": sc_rec(["腹内外斜肌", "腹横肌"], ["腰方肌", "臀中肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "髋关节"], ["躯干抗侧屈", "单侧支撑"]),
    "SUP-S6-04": sc_rec(["腹内外斜肌", "腰方肌"], ["臀中肌", "腹横肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "髋关节"], ["侧向躯干稳定", "髋部升降"]),
    "SUP-S6-05": sc_rec(["臀中肌", "臀小肌", "腹内外斜肌"], ["腹横肌", "阔筋膜张肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "髋关节"], ["髋外展", "躯干抗侧屈"]),

    "CORE-L1-01": sc_rec(["腹横肌", "腹内外斜肌"], ["腹直肌", "髂腰肌"], ["腰盆稳定肌群"], ["髋关节", "腰椎"], ["躯干抗伸展", "单侧髋伸展控制"]),
    "CORE-L1-02": sc_rec(["腹横肌", "腹内外斜肌", "腹直肌"], ["髂腰肌"], ["腰盆稳定肌群"], ["髋关节", "腰椎"], ["躯干抗伸展", "交替髋屈/伸控制"]),
    "CORE-L1-03": sc_rec(["腹横肌", "腹内外斜肌", "腹直肌"], ["髂腰肌"], ["腰盆稳定肌群"], ["髋关节", "腰椎"], ["躯干抗伸展", "90/90保持"]),
    "CORE-L1-04": sc_rec(["腹横肌", "腹内外斜肌", "腹直肌"], ["髂腰肌"], ["腰盆稳定肌群"], ["髋关节", "腰椎"], ["躯干抗伸展", "交替髋屈"]),
    "CORE-L1-05": sc_rec(["腹横肌", "腹内外斜肌", "腹直肌"], ["背阔肌", "前锯肌"], ["腰盆稳定肌群", "肩袖肌群"], ["肩关节", "腰椎"], ["躯干抗伸展", "肩屈配合躯干控制"]),
    "CORE-L2-01": sc_rec(["腹横肌", "腹内外斜肌", "腹直肌"], ["髂腰肌"], ["腰盆稳定肌群"], ["髋关节", "肩关节", "腰椎"], ["躯干抗伸展", "肢体协调"]),
    "CORE-L2-02": sc_rec(["腹横肌", "腹内外斜肌", "腹直肌"], ["臀大肌", "髂腰肌"], ["腰盆稳定肌群", "肩胛稳定肌群"], ["髋关节", "肩关节", "腰椎"], ["躯干抗伸展", "对侧肢体伸展"]),
    "CORE-L2-03": sc_rec(["腹横肌", "腹内外斜肌", "腹直肌"], ["背阔肌", "髂腰肌"], ["腰盆稳定肌群", "肩胛稳定肌群"], ["髋关节", "肩关节", "腰椎"], ["躯干抗伸展", "肩伸等长配合"]),
    "CORE-L2-04": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["髂腰肌", "股四头肌"], ["腰盆稳定肌群"], ["髋关节", "腰椎"], ["躯干抗伸展", "长杠杆保持"]),
    "CORE-L2-05": sc_rec(["腹直肌", "腹内外斜肌"], ["髂腰肌"], ["腹横肌", "腰盆稳定肌群"], ["髋关节", "腰椎"], ["骨盆后倾", "躯干屈曲"]),
    "CORE-L3-01": sc_rec(["腹内外斜肌", "腹横肌"], ["腹直肌"], ["臀中肌", "肩胛稳定肌群"], ["腰椎", "髋关节", "肩关节"], ["躯干抗旋转", "上肢前推"]),
    "CORE-L3-02": sc_rec(["腹内外斜肌", "腹横肌"], ["腹直肌"], ["臀中肌", "肩胛稳定肌群"], ["腰椎", "髋关节", "肩关节"], ["躯干抗旋转", "等长保持"]),
    "CORE-L3-03": sc_rec(["腹横肌", "腹内外斜肌", "竖脊肌"], ["斜方肌上束", "前臂握力肌群"], ["臀中肌", "足踝稳定肌群"], ["脊柱", "髋关节", "踝关节"], ["负重行走", "躯干抗屈曲/侧屈"], "medium", "7Fit V14.5 curated anatomy layer；农夫行走受负重与步态影响"),
    "CORE-L3-04": sc_rec(["腹内外斜肌", "腰方肌", "腹横肌"], ["斜方肌上束", "前臂握力肌群"], ["臀中肌", "足踝稳定肌群"], ["脊柱", "髋关节", "踝关节"], ["负重行走", "躯干抗侧屈"], "medium", "7Fit V14.5 curated anatomy layer；单侧提重受负重位置影响"),
    "CORE-L3-05": sc_rec(["腹内外斜肌", "腹横肌"], ["腹直肌", "臀大肌"], ["臀中肌", "肩胛稳定肌群"], ["腰椎", "髋关节", "肩关节"], ["半跪位抗旋转", "等长保持"]),
    "CORE-L4-01": sc_rec(["腹直肌"], ["腹内外斜肌"], ["腹横肌", "骨盆稳定肌群"], ["腰椎", "髋关节"], ["躯干屈曲"]),
    "CORE-L4-02": sc_rec(["腹直肌", "腹横肌"], ["髂腰肌", "腹内外斜肌"], ["前锯肌", "肱三头肌", "肩袖肌群"], ["肩关节", "肘关节", "髋关节", "腰椎"], ["支撑稳定", "髋屈/提膝"]),
    "CORE-L4-03": sc_rec(["腹直肌", "腹横肌", "腹内外斜肌"], ["髂腰肌"], ["腰盆稳定肌群", "肩胛稳定肌群"], ["髋关节", "肩关节", "腰椎"], ["长杠杆抗伸展", "对侧肢体控制"]),
    "CORE-L4-04": sc_rec(["腹内外斜肌"], ["腹直肌", "腹横肌", "背阔肌"], ["臀大肌", "臀中肌", "肩胛稳定肌群"], ["胸椎", "腰椎", "髋关节", "肩关节"], ["躯干旋转/抗旋转", "斜向拉动"], "medium", "7Fit V14.5 curated anatomy layer；劈砍角度与躯干旋转策略影响参与比例"),
    "CORE-L4-05": sc_rec(["腹内外斜肌", "腰方肌", "腹横肌"], ["斜方肌上束", "前臂握力肌群"], ["臀中肌", "足踝稳定肌群"], ["脊柱", "髋关节", "踝关节"], ["高负荷行走", "躯干抗侧屈"], "medium", "7Fit V14.5 curated anatomy layer；高负荷单侧提重受负重位置与步态影响"),
}


def typed_rec(role_type, primary, secondary, stabilizers, joints, actions, confidence="high", source="7Fit V14.5 curated anatomy layer", tissue=None, avoid=None):
    return {
        "roleType": role_type,
        "primary": primary,
        "secondary": secondary,
        "stabilizers": stabilizers,
        "joints": joints,
        "movementActions": actions,
        "tissueTargets": tissue or [],
        "avoidRegions": avoid or [],
        "confidence": confidence,
        "sourceNote": source,
    }


PREP = {
    "warmup_quadruped_tspine_rotation": typed_rec("mobility", ["胸段竖脊肌", "腹内外斜肌"], ["肩胛周围肌群"], ["骨盆稳定肌群", "肩袖肌群"], ["胸椎", "肩关节", "髋关节"], ["胸椎旋转"], "medium"),
    "warmup_worlds_greatest_stretch": typed_rec("mobility", ["髂腰肌", "内收肌群", "腘绳肌"], ["臀肌", "胸段竖脊肌", "腹内外斜肌"], ["腹壁", "足踝稳定肌群"], ["髋关节", "踝关节", "胸椎"], ["髋伸展活动", "踝背屈", "胸椎旋转"], "medium", "7Fit V14.5 curated anatomy layer；多关节复合动态活动"),
    "warmup_band_shoulder_front_back_circle": typed_rec("mobility", ["胸大肌", "背阔肌", "三角肌"], ["肩胛周围肌群"], ["腹壁"], ["肩关节", "肩胛胸廓关节"], ["肩屈/伸", "肩外展/内收", "肩胛上旋/下旋"], "medium"),
    "warmup_band_shoulder_horizontal_circle": typed_rec("mobility", ["三角肌", "肩胛周围肌群"], ["胸大肌", "背阔肌"], ["腹壁"], ["肩关节", "肩胛胸廓关节"], ["肩水平运动", "肩胛滑动"], "review", "7Fit V14.5 curated anatomy layer；馆内‘左右环绕’具体轨迹待视频锁定"),
    "warmup_band_external_rotation": typed_rec("activation", ["肩袖外旋肌群"], ["三角肌后束"], ["肩胛稳定肌群", "腹壁"], ["肩关节", "肩胛胸廓关节"], ["肩外旋"]),
    "warmup_band_front_raise_external_rotation": typed_rec("activation", ["肩袖外旋肌群"], ["三角肌后束", "前锯肌"], ["肩胛稳定肌群", "腹壁"], ["肩关节", "肩胛胸廓关节"], ["抬臂位肩外旋", "肩胛控制"], "review", "7Fit V14.5 curated anatomy layer；前臂高度与具体轨迹待馆内视频锁定"),
    "pingban_zhi": typed_rec("support_core", ["腹直肌", "腹横肌", "腹内外斜肌"], ["臀大肌", "股四头肌"], ["前锯肌", "肩袖肌群"], ["肩关节", "髋关节"], ["躯干抗伸展"]),
    "warmup_deadbug_arm_reach": typed_rec("activation", ["腹横肌", "腹内外斜肌", "腹直肌"], ["背阔肌", "前锯肌"], ["腰盆稳定肌群"], ["肩关节", "腰椎", "髋关节"], ["躯干抗伸展", "肩屈配合"]),
    "warmup_deadbug_leg_reach": typed_rec("activation", ["腹横肌", "腹内外斜肌", "腹直肌"], ["髂腰肌"], ["腰盆稳定肌群"], ["髋关节", "腰椎"], ["躯干抗伸展", "单腿伸展控制"]),
    "warmup_hamstring_scoop": typed_rec("mobility", ["腘绳肌"], ["腓肠肌"], ["腹壁"], ["髋关节", "膝关节", "踝关节"], ["髋屈", "膝伸", "踝背屈"]),
    "warmup_frog_stretch": typed_rec("stretch", ["内收肌群"], ["臀部深层旋转肌群"], ["腹壁"], ["髋关节"], ["髋外展活动"], tissue=["内收肌群"], avoid=["腹股沟急性疼痛区域", "膝内侧骨点"]),
    "warmup_9090_forward_glute_stretch": typed_rec("stretch", ["臀大肌", "臀部深层旋转肌群"], ["臀中肌"], ["腹壁"], ["髋关节"], ["髋外旋位前倾"], tissue=["臀部后外侧软组织"], avoid=["髋关节夹挤痛范围"]),
    "warmup_dynamic_9090": typed_rec("mobility", ["臀部深层旋转肌群"], ["臀中肌", "内收肌群"], ["腹壁"], ["髋关节"], ["髋内旋", "髋外旋"]),
    "warmup_single_leg_frog": typed_rec("stretch", ["内收肌群"], ["臀部深层旋转肌群"], ["腹壁", "骨盆稳定肌群"], ["髋关节"], ["单侧髋外展活动"], tissue=["单侧内收肌群"], avoid=["腹股沟急性疼痛区域", "膝内侧骨点"]),
    "movement_bodyweight_hip_hinge": typed_rec("activation", ["臀大肌", "腘绳肌"], ["内收肌群"], ["腹壁", "竖脊肌"], ["髋关节", "膝关节"], ["髋铰链模式复习", "髋伸"]),
    "warmup_halfkneeling_lunge_hipflexor": typed_rec("stretch", ["髂腰肌", "股直肌"], ["阔筋膜张肌"], ["腹壁", "臀大肌"], ["髋关节", "膝关节"], ["髋伸展活动"], tissue=["髋屈肌群", "股四头肌近端"], avoid=["髋前侧夹挤痛范围", "跪姿膝部疼痛区域"]),
    "band_cezou": typed_rec("activation", ["臀中肌", "臀小肌"], ["臀大肌", "阔筋膜张肌"], ["腹壁", "足踝稳定肌群"], ["髋关节", "膝关节", "踝关节"], ["髋外展", "侧向步态稳定"]),
    "warmup_single_leg_glute_bridge": typed_rec("activation", ["臀大肌"], ["腘绳肌"], ["臀中肌", "腹横肌", "腹内外斜肌"], ["髋关节", "膝关节"], ["单侧髋伸", "骨盆稳定"]),
}


FOAM = {
    "paomozhou_xiongda": typed_rec("foam_roll", ["胸大肌"], ["胸前侧软组织"], [], ["肩关节"], [], tissue=["胸大肌", "胸前侧软组织"], avoid=["乳房组织", "锁骨", "肩前骨点", "急性疼痛区域"]),
    "foamroll_shoulder": typed_rec("foam_roll", ["三角肌", "肩周软组织"], [], [], ["肩关节"], [], tissue=["三角肌", "肩周软组织"], avoid=["肩峰", "锁骨", "肱骨头正面骨点", "急性撞击痛区域"]),
    "foamroll_triceps": typed_rec("foam_roll", ["肱三头肌"], [], [], ["肩关节", "肘关节"], [], tissue=["肱三头肌"], avoid=["肘尖", "腋窝", "明显淤青区域"]),
    "foamroll_biceps": typed_rec("foam_roll", ["肱二头肌"], ["上臂前侧软组织"], [], ["肩关节", "肘关节"], [], tissue=["肱二头肌", "上臂前侧软组织"], avoid=["腋窝", "肘窝神经血管区域"]),
    "foamroll_adductors": typed_rec("foam_roll", ["内收肌群"], [], [], ["髋关节", "膝关节"], [], tissue=["内收肌群"], avoid=["腹股沟", "膝内侧关节线", "明显肿胀区域"]),
    "foamroll_lateral_thigh": typed_rec("foam_roll", ["股外侧肌", "阔筋膜张肌周围软组织"], [], [], ["髋关节", "膝关节"], [], tissue=["股外侧肌", "阔筋膜张肌周围软组织"], avoid=["髂胫束直接强压", "大转子", "膝外侧骨点"]),
    "foamroll_erector_spinae": typed_rec("foam_roll", ["竖脊肌", "胸腰段背伸肌"], [], [], ["胸椎", "腰椎"], [], tissue=["竖脊肌旁软组织", "胸腰段背伸肌"], avoid=["腰椎正中", "棘突", "骨性突起", "放射性疼痛区域"]),
    "paomozhou_kuanbei": typed_rec("foam_roll", ["背阔肌"], ["大圆肌周围背侧软组织"], [], ["肩关节"], [], tissue=["背阔肌", "大圆肌周围背侧软组织"], avoid=["肋骨骨点", "腋窝深处神经血管区域"]),
    "paomozhou_tuibu": typed_rec("foam_roll", ["股四头肌"], [], [], ["髋关节", "膝关节"], [], tissue=["股四头肌"], avoid=["髌骨", "膝关节线"]),
    "paomozhou_tuihou": typed_rec("foam_roll", ["腘绳肌"], [], [], ["髋关节", "膝关节"], [], tissue=["腘绳肌"], avoid=["膝后腘窝", "坐骨附近神经样刺痛区域"]),
    "paomozhou_tunbu": typed_rec("foam_roll", ["臀大肌", "臀中肌"], [], [], ["髋关节"], [], tissue=["臀大肌", "臀中肌"], avoid=["坐骨神经明显刺激点", "放射性麻痛区域"]),
    "paomozhou_xiaotui": typed_rec("foam_roll", ["腓肠肌", "比目鱼肌"], [], [], ["膝关节", "踝关节"], [], tissue=["腓肠肌", "比目鱼肌"], avoid=["跟腱", "膝后腘窝", "静脉曲张明显区域"]),
}


FOAM_BY_MUSCLE = {
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

def write_payload(payload):
    ANATOMY_PATH.write_text(
        "window.V14_ANATOMY = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n",
        encoding="utf-8",
    )


def update_curation(payload):
    records = payload["records"]
    confidence_counts = {
        k: sum(1 for v in records.values() if v.get("confidence") == k)
        for k in ["high", "medium", "review"]
    }
    role_counts = {}
    for v in records.values():
        role_counts[v.get("roleType", "unknown")] = role_counts.get(v.get("roleType", "unknown"), 0) + 1
    reviews = [
        (k, v.get("sourceNote", ""))
        for k, v in records.items()
        if v.get("confidence") == "review"
    ]
    lines = [
        "# V14.5 Anatomy Curation",
        "",
        "## Phase A Coverage",
        "",
        f"- Phase A unique records: {len(records)}/120",
        f"- Strength: {role_counts.get('strength', 0)}/40",
        f"- SUPPORT / CORE / reused support-core: {role_counts.get('support_core', 0)}",
        f"- Activation: {role_counts.get('activation', 0)}",
        f"- Mobility: {role_counts.get('mobility', 0)}",
        f"- Stretch: {role_counts.get('stretch', 0)}",
        f"- Foam Roll: {role_counts.get('foam_roll', 0)}/12",
        "",
        "## Confidence",
        "",
        f"- HIGH: {confidence_counts['high']}",
        f"- MEDIUM: {confidence_counts['medium']}",
        f"- REVIEW: {confidence_counts['review']}",
        "",
        "## REVIEW IDs",
    ]
    lines += [f"- {action_id} — {note}" for action_id, note in reviews] or ["- 无"]
    CURATION_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    payload = load_js_object(ANATOMY_PATH, "V14_ANATOMY")
    payload["records"].update(STRENGTH)
    payload["records"].update(SUPPORT_CORE)
    payload["records"].update(PREP)
    payload["records"].update(FOAM)
    payload["foamByMuscle"] = FOAM_BY_MUSCLE
    manifest_path = ROOT / "docs" / "V14.5-PHASE-A-MANIFEST.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["meta"]["phaseAIds"] = manifest["ids"]
    write_payload(payload)
    update_curation(payload)
    print(f"Strength anatomy written: {len(STRENGTH)}/40")
    print(f"Support/Core anatomy written: {len(SUPPORT_CORE)}/50")
    print(f"PREP-only anatomy written: {len(PREP)}/18 (+2 reused canonical nodes)")
    print(f"Foam anatomy written: {len(FOAM)}/12")


if __name__ == "__main__":
    main()
