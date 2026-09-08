#!/usr/bin/env python3
import copy
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANATOMY_PATH = ROOT / 'data' / 'anatomy-data.js'
MANIFEST_PATH = ROOT / 'docs' / 'V14.6-PHASE-BC-MANIFEST.json'
CURATION_PATH = ROOT / 'docs' / 'V14.5-ANATOMY-CURATION.md'


def load_js(path, name):
    text = Path(path).read_text(encoding='utf-8')
    m = re.search(rf'window\.{re.escape(name)}\s*=\s*(\{{.*\}});\s*$', text, re.S)
    if not m:
        raise RuntimeError(f'{name} not found')
    return json.loads(m.group(1))


def base_rec(role, primary, secondary, stabilizers, joints, actions, confidence='high', note=''):
    source = '7Fit V14.6 curated anatomy layer'
    if note:
        source += '；' + note
    return {
        'roleType': role,
        'primary': primary,
        'secondary': secondary,
        'stabilizers': stabilizers,
        'joints': joints,
        'movementActions': actions,
        'tissueTargets': [],
        'avoidRegions': [],
        'confidence': confidence,
        'sourceNote': source,
    }


def strength(primary, secondary, stabilizers, joints, actions, confidence='high', note=''):
    return base_rec('strength', primary, secondary, stabilizers, joints, actions, confidence, note)


def activation(primary, secondary, stabilizers, joints, actions, confidence='high', note=''):
    return base_rec('activation', primary, secondary, stabilizers, joints, actions, confidence, note)


def core(primary, secondary, stabilizers, joints, actions, confidence='high', note=''):
    return base_rec('support_core', primary, secondary, stabilizers, joints, actions, confidence, note)


def mobility(primary, secondary, stabilizers, joints, actions, confidence='high', note=''):
    return base_rec('mobility', primary, secondary, stabilizers, joints, actions, confidence, note)


def stretch(primary, secondary, joints, actions, confidence='high', note=''):
    return base_rec('stretch', primary, secondary, [], joints, actions, confidence, note)


def foam(primary, related, joints, avoid, confidence='high', note=''):
    rec = base_rec('foam_roll', primary, related, [], joints, [], confidence, note)
    rec['tissueTargets'] = primary + related
    rec['avoidRegions'] = avoid
    return rec


def clone(records, base_id, *, role=None, primary=None, secondary=None, stabilizers=None,
          joints=None, actions=None, confidence=None, note=''):
    r = copy.deepcopy(records[base_id])
    if role is not None: r['roleType'] = role
    if primary is not None: r['primary'] = primary
    if secondary is not None: r['secondary'] = secondary
    if stabilizers is not None: r['stabilizers'] = stabilizers
    if joints is not None: r['joints'] = joints
    if actions is not None: r['movementActions'] = actions
    if confidence is not None: r['confidence'] = confidence
    r['sourceNote'] = '7Fit V14.6 curated anatomy layer' + (('；' + note) if note else '')
    return r


def main():
    payload = load_js(ANATOMY_PATH, 'V14_ANATOMY')
    records = payload['records']
    manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))

    B = {}

    # ---- Remaining strength / main-training nodes ----
    B['qiangmian_huadong'] = activation(
        ['前锯肌', '斜方肌下束'], ['斜方肌上束'], ['肩袖肌群', '腹壁'],
        ['肩关节', '肩胛胸廓关节', '胸椎'], ['肩屈', '肩胛上旋', '肩胛后倾'],
        note='墙面滑动按肩胛控制/激活语义处理')
    B['band_lahuang'] = activation(
        ['中斜方肌', '菱形肌'], ['三角肌后束'], ['肩袖肌群', '腹壁'],
        ['肩关节', '肩胛胸廓关节'], ['肩水平外展', '肩胛后缩'],
        note='弹力带拉环按 pull-apart 肩胛后缩动作理解')
    B['diwei_huachuan'] = clone(records, 'zuozi_huachuan_bianshi', confidence='medium', note='低位划船把位未完全锁定')
    B['zhibi_xiala'] = strength(
        ['背阔肌'], ['大圆肌', '肱三头肌长头'], ['腹壁', '斜方肌下束', '肩袖肌群'],
        ['肩关节', '肩胛胸廓关节'], ['肩伸', '肩胛下沉'], 'high')
    B['xiao_longmen_wai_zhan'] = strength(
        ['臀中肌', '臀小肌'], ['阔筋膜张肌'], ['对侧臀中肌', '腹壁', '足踝稳定肌群'],
        ['髋关节', '踝关节'], ['髋外展', '单腿站立稳定'], 'high')
    B['tunbu_houti'] = strength(
        ['臀大肌'], ['腘绳肌'], ['臀中肌', '腹壁', '对侧骨盆稳定肌群'],
        ['髋关节', '膝关节'], ['髋伸'], 'medium', '膝屈角度会影响腘绳肌参与比例')
    B['shanyan_tingshen'] = strength(
        ['臀大肌', '腘绳肌'], [], ['竖脊肌', '腹壁'], ['髋关节', '脊柱'],
        ['髋伸', '躯干等长稳定'], 'medium', '场馆执行若偏脊柱伸展会改变竖脊肌角色')
    B['dileigan_hinge'] = strength(
        ['臀大肌', '腘绳肌'], ['内收肌群'], ['竖脊肌', '腹壁', '背阔肌'],
        ['髋关节', '膝关节'], ['髋伸', '髋铰链'], 'medium', '地雷杆负重路径会改变躯干与膝屈比例')
    B['banjie_hake'] = clone(records, 'hake_shendun', primary=['股四头肌'], secondary=['臀大肌', '内收肌群'], confidence='medium', note='半蹲幅度使股四头相对占比提高；实际深度需场馆锁定')
    B['xiongjia_jiaxiong'] = strength(
        ['胸大肌'], ['三角肌前束'], ['肩袖肌群', '肩胛稳定肌群'],
        ['肩关节'], ['肩水平内收'], 'high')
    B['danbi_yaling_huachuan'] = strength(
        ['背阔肌', '中斜方肌', '菱形肌'], ['肱二头肌', '肱肌', '三角肌后束'],
        ['竖脊肌', '腹内外斜肌', '臀大肌'], ['肩关节', '肘关节', '肩胛胸廓关节', '髋关节'],
        ['肩伸', '肘屈', '肩胛后缩', '躯干抗旋转'], 'medium', '单臂与支撑方式影响躯干稳定需求')
    B['gaowei_xiala_kuanwo'] = clone(records, 'gaowei_xiala_vba', confidence='medium', note='宽握会改变肩内收路径与肘线，但背阔肌仍为主要肌群')
    B['danbi_xiala'] = strength(
        ['背阔肌'], ['肱二头肌', '肱肌', '大圆肌'], ['腹内外斜肌', '斜方肌下束', '肩袖肌群', '骨盆稳定肌群'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩内收/伸展', '肘屈', '肩胛下沉', '躯干抗旋转'],
        'medium', '单臂下拉增加抗旋转稳定需求')
    B['fushen_y_ju'] = strength(
        ['斜方肌下束'], ['中斜方肌', '三角肌后束'], ['肩袖肌群', '竖脊肌', '腹壁'],
        ['肩关节', '肩胛胸廓关节', '髋关节'], ['肩屈/斜向外展', '肩胛上旋/后倾', '躯干等长稳定'],
        'medium', 'Y举角度与拇指方向影响肩胛/三角肌贡献')
    B['fuwoceng'] = clone(records, 'movement_incline_pushup', confidence='high', note='标准地面俯卧撑')
    B['gaojiaobei_shendun'] = clone(records, 'V13_SQ_DB_GOBLET', confidence='high', note='高脚杯深蹲')
    B['gaowei_xiala_zhaiwo_fanshou'] = clone(
        records, 'gaowei_xiala_vba', secondary=['肱二头肌', '肱肌', '大圆肌'], confidence='medium',
        note='窄握反手提高屈肘肌参与，但不改变背阔肌主要角色')
    B['diwei_huachuan_kuanwo'] = strength(
        ['中斜方肌', '菱形肌', '三角肌后束'], ['背阔肌', '肱二头肌', '肱肌'],
        ['肩袖肌群', '腹壁', '竖脊肌'], ['肩关节', '肘关节', '肩胛胸廓关节'],
        ['肩水平外展/伸展', '肘屈', '肩胛后缩'], 'medium', '宽握肘外展提高上背与后三角参与')
    B['hake_shendun_zhaiju'] = clone(records, 'hake_shendun', confidence='medium', note='窄距改变相对膝髋力矩，但不构成不同肌群系统')
    B['feiji_labei'] = clone(records, 'feiji_labei_zhongba', confidence='medium', note='未指定把位，按胸托水平拉综合模式处理')
    B['shengsuo_mianla'] = clone(records, 'mianla', confidence='medium', note='绳索面拉受绳索高度与肘线影响')
    B['tuntui_hipthrust'] = clone(records, 'tun_tui', confidence='high', note='臀推机臀推')
    B['dileigan_tuiju'] = strength(
        ['三角肌前束', '胸大肌上部'], ['肱三头肌'], ['前锯肌', '斜方肌下束', '肩袖肌群', '腹壁'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['斜向肩屈/推举', '肘伸', '肩胛上旋'],
        'medium', '地雷杆角度改变胸肩贡献比例；姿势未完全锁定')
    B['dileigan_huachuan'] = strength(
        ['背阔肌', '中斜方肌', '菱形肌'], ['肱二头肌', '肱肌', '三角肌后束'],
        ['竖脊肌', '腹壁', '臀大肌', '腘绳肌'], ['肩关节', '肘关节', '肩胛胸廓关节', '髋关节'],
        ['肩伸', '肘屈', '肩胛后缩', '躯干等长稳定'], 'medium', '地雷杆角度和握法影响拉力方向')
    B['yaling_jiantui'] = clone(records, 'V13_VP_SEATED_LIGHT_DB', confidence='medium', note='动作名称未明确坐姿/站姿，主要肩推肌群一致，稳定需求可能不同')
    B['yaling_luomaniya'] = clone(records, 'yaling_luomaniya_yingla', confidence='high', note='基础哑铃RDL')
    B['shangxie_yaling_wotu'] = strength(
        ['胸大肌', '三角肌前束'], ['肱三头肌'], ['肩袖肌群', '肩胛稳定肌群', '腹壁'],
        ['肩关节', '肘关节'], ['斜向肩水平内收/屈曲', '肘伸'], 'medium', '上斜角度影响胸大肌锁骨部与前三角相对贡献')
    B['huling_baidong'] = strength(
        ['臀大肌', '腘绳肌'], ['内收肌群'], ['竖脊肌', '腹壁', '背阔肌', '前臂握力肌群'],
        ['髋关节', '膝关节', '肩关节'], ['爆发性髋伸', '髋铰链', '上肢摆动传力'],
        'medium', '壶铃摆动技术差异会显著影响腰背与上肢代偿')
    B['huling_gaojiaobei'] = clone(records, 'V13_SQ_DB_GOBLET', confidence='high', note='壶铃高脚杯深蹲')
    B['shangxie_yaling_wotu_jinjie'] = copy.deepcopy(B['shangxie_yaling_wotu']); B['shangxie_yaling_wotu_jinjie']['sourceNote'] += '；进阶负重不改变基本解剖角色'
    B['dileigan_tuiju_jinjie'] = copy.deepcopy(B['dileigan_tuiju']); B['dileigan_tuiju_jinjie']['sourceNote'] += '；进阶负重不改变基本解剖角色'
    B['zhaiwo_fuwoceng_jinjie'] = strength(
        ['胸大肌'], ['肱三头肌', '三角肌前束'], ['前锯肌', '肩袖肌群', '腹壁', '臀大肌'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩水平内收', '肘伸', '肩胛前伸/后缩控制'],
        'high', '窄握提高肱三头肌相对参与')
    B['xiongtuo_huachuan'] = strength(
        ['背阔肌', '中斜方肌', '菱形肌'], ['肱二头肌', '肱肌', '三角肌后束'],
        ['肩袖肌群'], ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩伸', '肘屈', '肩胛后缩'], 'high',
        '胸托降低竖脊肌等长稳定需求')
    B['danbi_gaowei_lasheng_hua'] = strength(
        ['背阔肌', '菱形肌', '中斜方肌'], ['肱二头肌', '肱肌', '三角肌后束'],
        ['腹内外斜肌', '肩袖肌群', '骨盆稳定肌群'], ['肩关节', '肘关节', '肩胛胸廓关节'],
        ['斜向肩伸', '肘屈', '肩胛后缩', '躯干抗旋转'], 'medium', '高位单臂绳索路径需场馆示范最终锁定')
    B['xieban_ytw_jinjie'] = strength(
        ['斜方肌中下束', '菱形肌', '三角肌后束'], ['肩袖外旋肌群', '前锯肌'], ['肩袖肌群', '腹壁'],
        ['肩关节', '肩胛胸廓关节'], ['Y/T/W多方向肩胛控制', '肩水平外展', '肩外旋'],
        'medium', 'Y/T/W三个字母位的肌群重点不同，合并节点仅作综合标签')
    B['dixie_mianla_shangju'] = strength(
        ['三角肌后束', '斜方肌下束'], ['中斜方肌', '菱形肌', '肩袖外旋肌群'], ['前锯肌', '肩袖肌群', '腹壁'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩水平外展', '肩外旋', '肩胛上旋/后倾'],
        'medium', '面拉接上举的实际绳索高度和动作幅度影响参与比例')
    B['jianjia_housuo_kangzu_hua'] = activation(
        ['中斜方肌', '菱形肌'], ['三角肌后束'], ['肩袖肌群', '腹壁'],
        ['肩胛胸廓关节', '肩关节'], ['肩胛后缩', '轻度肩伸'], 'high')
    B['qianghua_qiangmian_huadong'] = activation(
        ['前锯肌', '斜方肌下束'], ['斜方肌上束'], ['肩袖肌群', '腹壁'],
        ['肩关节', '肩胛胸廓关节', '胸椎'], ['肩屈', '肩胛上旋', '肩胛后倾'],
        'medium', '弹力带抗阻方向会改变肩袖与三角肌参与')
    B['mat_pushup_plus_main'] = strength(
        ['胸大肌', '前锯肌'], ['肱三头肌', '三角肌前束'], ['肩袖肌群', '腹壁', '臀大肌'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩水平内收', '肘伸', '肩胛主动前伸'], 'high')
    B['lowrow_danbi_main'] = copy.deepcopy(B['danbi_yaling_huachuan']); B['lowrow_danbi_main']['sourceNote'] = '7Fit V14.6 curated anatomy layer；低位单臂划船增加抗旋转需求'
    B['lowrow_pause_main'] = clone(records, 'zuozi_huachuan_bianshi', confidence='medium', note='顶峰停顿提高肩胛后缩控制，但不改变主要肌群')
    B['backext_load_main'] = copy.deepcopy(B['shanyan_tingshen']); B['backext_load_main']['sourceNote'] = '7Fit V14.6 curated anatomy layer；负重山羊挺身，执行偏髋伸或脊柱伸会改变竖脊肌角色'
    B['pecdeck_unilateral_press_main'] = strength(
        ['胸大肌'], ['肱三头肌', '三角肌前束'], ['腹内外斜肌', '肩袖肌群', '肩胛稳定肌群'],
        ['肩关节', '肘关节'], ['单侧肩水平内收', '肘伸', '躯干抗旋转'], 'medium', '单侧器械路径与坐姿固定程度影响抗旋转需求')
    B['smith_shendun'] = clone(records, 'gangling_shendun', confidence='medium', note='史密斯固定杆路降低部分平衡需求但不改变主要膝髋伸肌群')
    B['smith_tuntui'] = clone(records, 'tun_tui', confidence='medium', note='史密斯杆路与脚位影响腘绳肌/内收肌辅助比例')
    B['smith_wotu'] = clone(records, 'gangling_wotu', confidence='medium', note='史密斯固定杆路降低自由稳定需求')
    B['smith_huachuan'] = strength(
        ['背阔肌', '中斜方肌', '菱形肌'], ['肱二头肌', '肱肌', '三角肌后束'],
        ['竖脊肌', '腹壁', '臀大肌', '腘绳肌'], ['肩关节', '肘关节', '肩胛胸廓关节', '髋关节'],
        ['肩伸', '肘屈', '肩胛后缩', '躯干等长稳定'], 'medium', '史密斯固定杆路和躯干角度影响背部重点')
    B['fuzhu_yinti_zhaiwo'] = clone(records, 'fuzhu_yinti_xiangshang', confidence='medium', note='窄距对握提高屈肘肌参与')
    B['fuzhu_yinti_kuanwo'] = clone(records, 'fuzhu_yinti_xiangshang', confidence='medium', note='宽握改变肩内收路径但背阔肌仍为主要肌群')
    B['feiji_labei_shangba'] = strength(
        ['中斜方肌', '菱形肌', '三角肌后束'], ['背阔肌', '肱二头肌', '肱肌'], ['肩袖肌群'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩水平外展/伸展', '肘屈', '肩胛后缩'],
        'medium', '上把位通常提高上背与后三角相对参与，器械轨迹需场馆确认')
    B['feiji_labei_xiaba'] = strength(
        ['背阔肌'], ['肱二头肌', '肱肌', '大圆肌'], ['中下斜方肌', '菱形肌', '肩袖肌群'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩伸/内收', '肘屈', '肩胛下沉'],
        'medium', '下把位按更偏垂直/下拉路径处理，实际器械轨迹需场馆确认')
    B['xiongtuo_huachuan_zhaiwo'] = strength(
        ['背阔肌', '中斜方肌', '菱形肌'], ['肱二头肌', '肱肌'], ['肩袖肌群'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩伸', '肘屈', '肩胛后缩'], 'medium', '窄握通常提高背阔与屈肘肌参与')
    B['xiongtuo_huachuan_kuanwo'] = strength(
        ['中斜方肌', '菱形肌', '三角肌后束'], ['背阔肌', '肱二头肌'], ['肩袖肌群'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肩水平外展/伸展', '肘屈', '肩胛后缩'], 'medium', '宽握肘外展提高上背与后三角相对参与')
    B['xiongtuo_huachuan_danbi'] = strength(
        ['背阔肌', '中斜方肌', '菱形肌'], ['肱二头肌', '肱肌', '三角肌后束'], ['肩袖肌群', '腹内外斜肌'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['单侧肩伸', '肘屈', '肩胛后缩', '轻度抗旋转'],
        'medium', '胸托减少但不完全消除单侧抗旋转需求')
    B['qixie_xiong_tui_zhaiwo'] = strength(
        ['胸大肌'], ['肱三头肌', '三角肌前束'], ['肩袖肌群', '肩胛稳定肌群'],
        ['肩关节', '肘关节'], ['肩水平内收', '肘伸'], 'medium', '窄握提高肱三头肌相对参与')
    B['hudieji_fanxiang_feiniao'] = strength(
        ['三角肌后束'], ['中斜方肌', '菱形肌'], ['肩袖肌群', '斜方肌下束'],
        ['肩关节', '肩胛胸廓关节'], ['肩水平外展', '肩胛后缩'], 'high')
    B['shengsuo_jiaxiong_zhongwei'] = strength(
        ['胸大肌'], ['三角肌前束'], ['肩袖肌群', '腹壁', '前锯肌'], ['肩关节'], ['肩水平内收'],
        'medium', '绳索高度与躯干位置影响胸大肌不同纤维相对贡献')
    B['shengsuo_jiaxiong_gaowei'] = strength(
        ['胸大肌'], ['三角肌前束'], ['肩袖肌群', '腹壁', '前锯肌'], ['肩关节'], ['斜向肩水平内收'],
        'medium', '高位绳索路径改变胸大肌纤维相对重点')
    B['shengsuo_danbi_huachuan'] = strength(
        ['背阔肌', '中斜方肌', '菱形肌'], ['肱二头肌', '肱肌', '三角肌后束'],
        ['腹内外斜肌', '肩袖肌群', '骨盆稳定肌群'], ['肩关节', '肘关节', '肩胛胸廓关节'],
        ['单侧肩伸', '肘屈', '肩胛后缩', '躯干抗旋转'], 'medium', '单臂绳索站姿/坐姿未完全锁定')
    B['movement_bench_box_squat'] = clone(records, 'tushen_shendun', confidence='high', note='触凳箱式深蹲；箱凳作为深度与控制参考')
    B['movement_light_bar_box_squat'] = clone(records, 'gangling_shendun', confidence='medium', note='轻杠铃箱式深蹲；箱凳与杆位会影响髋膝力矩')
    B['movement_kettlebell_deadlift'] = strength(
        ['臀大肌', '股四头肌'], ['腘绳肌', '内收肌群'], ['竖脊肌', '腹壁', '背阔肌', '前臂握力肌群'],
        ['髋关节', '膝关节', '踝关节'], ['髋伸', '膝伸', '躯干等长稳定'], 'high')
    B['movement_pullup_eccentric'] = clone(records, 'movement_bodyweight_pullup', confidence='medium', note='离心阶段强调肩胛与肘屈肌离心控制')
    B['movement_weighted_pullup'] = clone(records, 'movement_bodyweight_pullup', confidence='high', note='负重提高强度但不改变基本肌群角色')
    B['movement_single_leg_hip_thrust'] = strength(
        ['臀大肌'], ['腘绳肌'], ['臀中肌', '腹内外斜肌', '骨盆稳定肌群'],
        ['髋关节', '膝关节'], ['单侧髋伸', '骨盆抗旋转'], 'high')

    # ---- Activation / core source nodes ----
    B['diaoweng_shi'] = core(
        ['腹横肌', '腹内外斜肌'], ['臀大肌', '多裂肌'], ['肩胛稳定肌群', '骨盆稳定肌群'],
        ['肩关节', '髋关节', '腰椎'], ['躯干抗旋转', '对侧肢体伸展'])
    B['sichong'] = core(
        ['腹横肌', '腹内外斜肌', '腹直肌'], ['髂腰肌'], ['腰盆稳定肌群'],
        ['髋关节', '肩关节', '腰椎'], ['躯干抗伸展', '肢体协调'])
    B['pallof_press'] = core(
        ['腹内外斜肌', '腹横肌'], ['腹直肌'], ['臀中肌', '肩胛稳定肌群'],
        ['脊柱', '髋关节', '肩关节'], ['躯干抗旋转', '上肢前伸'])
    B['cepinban_zhi'] = core(
        ['腹内外斜肌', '腹横肌'], ['臀中肌', '腰方肌'], ['肩胛稳定肌群', '骨盆稳定肌群'],
        ['肩关节', '髋关节', '脊柱'], ['躯干抗侧屈', '侧向支撑'])
    B['pallof_hold'] = core(
        ['腹内外斜肌', '腹横肌'], ['腹直肌'], ['臀中肌', '肩胛稳定肌群'],
        ['脊柱', '髋关节', '肩关节'], ['躯干抗旋转', '前伸位等长保持'])
    B['kongxin_zhicheng'] = core(
        ['腹直肌', '腹横肌', '腹内外斜肌'], ['髂腰肌', '股四头肌'], ['腰盆稳定肌群'],
        ['髋关节', '腰椎'], ['躯干抗伸展', '长杠杆保持'])
    B['nongfu_zou'] = core(
        ['腹内外斜肌', '腹横肌', '前臂握力肌群'], ['斜方肌', '臀中肌'], ['竖脊肌', '足踝稳定肌群', '肩带稳定肌群'],
        ['脊柱', '髋关节', '膝关节', '踝关节', '肩关节'], ['躯干抗侧屈/抗旋转', '负重步行', '握持'])
    B['yaoqiu_luosi'] = core(
        ['腹内外斜肌'], ['腹直肌', '髋屈肌群'], ['腹横肌', '竖脊肌'],
        ['胸椎', '髋关节'], ['躯干动态旋转'], 'medium', '药球俄罗斯转体的躯干/髋旋转比例需以场馆示范为准')
    B['juanfudian_juanfu'] = core(
        ['腹直肌'], ['腹内外斜肌'], ['腹横肌'], ['胸腰椎'], ['躯干屈曲'])
    B['xiajuanfu_qixie'] = core(
        ['腹直肌'], ['腹内外斜肌'], ['腹横肌'], ['胸腰椎'], ['负重躯干屈曲'], 'medium', '器械轴线和骨盆固定方式影响髋屈肌参与')
    B['shuanggang_zhicheng'] = core(
        ['肱三头肌', '斜方肌下束'], ['前锯肌'], ['肩袖肌群', '腹壁'],
        ['肩关节', '肘关节', '肩胛胸廓关节'], ['肘伸等长', '肩胛下沉', '支撑稳定'], 'medium', '双杠把位与肩胛姿势需保持无痛')
    B['shuanggang_tixi'] = core(
        ['腹直肌', '腹横肌'], ['髂腰肌', '腹内外斜肌'], ['肱三头肌', '斜方肌下束', '前锯肌', '肩袖肌群'],
        ['髋关节', '肩关节', '肘关节'], ['髋屈/骨盆后倾', '上肢支撑稳定'], 'medium', '提膝是否伴骨盆卷曲会改变腹直肌与髋屈肌比例')

    # ---- Warm-up source nodes ----
    B['mao_niu'] = mobility(
        ['胸椎周围软组织', '腰背伸肌群'], ['腹壁'], [], ['胸椎', '腰椎', '骨盆'], ['脊柱屈曲', '脊柱伸展'],
        'medium', '猫牛为脊柱分节活动，个体活动度影响各段贡献')
    B['kuanju_shenzhan'] = stretch(
        ['髂腰肌', '股直肌'], ['阔筋膜张肌'], ['髋关节', '膝关节'], ['髋伸展位伸展'], 'high')
    B['huan_jie_qianyi'] = mobility(
        ['比目鱼肌', '腓肠肌'], ['踝关节后侧软组织'], [], ['踝关节', '膝关节'], ['踝背屈', '胫骨前移'], 'high')
    B['kaishu_shi_xiongzhuan'] = mobility(
        ['胸椎周围软组织', '腹内外斜肌'], ['胸大肌', '肩后侧软组织'], [], ['胸椎', '肩关节'], ['胸椎旋转', '肩水平外展'],
        'medium', '开书式肩位和下肢固定方式会影响胸椎旋转幅度')
    B['shengsuo_jianwai_xuanzhuan'] = activation(
        ['肩袖外旋肌群'], ['三角肌后束'], ['肩胛稳定肌群', '腹壁'], ['肩关节', '肩胛胸廓关节'], ['肩外旋'], 'high')
    B['shengsuo_kuan_neishou'] = activation(
        ['内收肌群'], [], ['对侧臀中肌', '腹壁', '足踝稳定肌群'], ['髋关节', '踝关节'], ['髋内收', '单腿站立稳定'],
        'review', '动作名称为“髋内收”，但源动作模式字段为“髋外展”；按名称建立 anatomy 并保留 REVIEW，等待源字段复核')
    B['paomozhou_xiongzhui'] = foam(
        ['胸椎旁肌群', '上背软组织'], [], ['胸椎'], ['胸椎棘突直接强压', '颈椎', '急性背痛区域'],
        'review', '源动作待人工验收；“胸椎”按周围软组织松解理解，不直接滚压椎体')
    B['xiongzhui_shenzhan'] = mobility(
        ['胸椎伸展活动', '胸廓前侧软组织'], ['背阔肌'], [], ['胸椎', '肩关节'], ['胸椎伸展'],
        'review', '泡沫轴位置、手臂位与伸展幅度需馆内示范视频最终锁定')

    phase_b_ids = manifest['phaseB']['主训练'] + manifest['phaseB']['激活'] + manifest['phaseB']['热身']
    missing_def = [aid for aid in phase_b_ids if aid not in B]
    extra_def = [aid for aid in B if aid not in phase_b_ids]
    assert not missing_def, f'Missing Phase B definitions: {missing_def}'
    assert not extra_def, f'Unexpected Phase B definitions: {extra_def}'
    assert len(B) == 85

    overlap = set(B) & set(records)
    assert not overlap, f'Phase B unexpectedly already covered: {sorted(overlap)}'
    records.update(B)

    payload['meta']['version'] = 'V14.6'
    payload['meta']['runtimeExpected'] = 239
    payload['meta']['phaseBExpected'] = 85
    payload['meta']['phaseCExpected'] = 34
    payload['meta']['phaseBIds'] = phase_b_ids
    payload['meta']['phaseCIds'] = manifest['phaseC']['体能'] + manifest['phaseC']['放松']

    ANATOMY_PATH.write_text('window.V14_ANATOMY = ' + json.dumps(payload, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')

    counts = {'high': 0, 'medium': 0, 'review': 0}
    for aid in phase_b_ids:
        counts[records[aid]['confidence']] += 1
    with CURATION_PATH.open('a', encoding='utf-8') as f:
        f.write('\n\n## V14.6 Phase B\n\n')
        f.write('- Phase B：85/85\n')
        f.write(f'- HIGH：{counts["high"]}\n- MEDIUM：{counts["medium"]}\n- REVIEW：{counts["review"]}\n')
        f.write('- REVIEW：`shengsuo_kuan_neishou`（名称/源模式字段冲突）、`paomozhou_xiongzhui`、`xiongzhui_shenzhan`。\n')

    print('Phase B records:', len(B))
    print('Total anatomy records:', len(records))
    print('Confidence:', counts)


if __name__ == '__main__':
    main()
