#!/usr/bin/env python3
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


def rec(role, primary, secondary, stabilizers, joints, actions, confidence='high', note='', tissues=None, avoid=None):
    return {
        'roleType': role,
        'primary': primary,
        'secondary': secondary,
        'stabilizers': stabilizers,
        'joints': joints,
        'movementActions': actions,
        'tissueTargets': tissues or [],
        'avoidRegions': avoid or [],
        'confidence': confidence,
        'sourceNote': '7Fit V14.6 curated anatomy layer' + (('；' + note) if note else ''),
    }


def conditioning(primary, secondary, stabilizers, joints, actions, confidence='medium', note=''):
    return rec('conditioning', primary, secondary, stabilizers, joints, actions, confidence, note)


def stretch(primary, secondary, joints, actions, avoid, confidence='high', note=''):
    return rec('stretch', primary, secondary, [], joints, actions, confidence, note, tissues=primary+secondary, avoid=avoid)


def main():
    payload = load_js(ANATOMY_PATH, 'V14_ANATOMY')
    records = payload['records']
    manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    C = {}

    # ---- Conditioning 20 ----
    C['huaxueji_jiange'] = conditioning(
        ['背阔肌', '腹壁', '肱三头肌'], ['臀大肌', '腘绳肌', '股四头肌'],
        ['竖脊肌', '肩袖肌群', '足踝稳定肌群'], ['肩关节', '肘关节', '髋关节', '膝关节'],
        ['双臂下拉', '屈髋/伸髋节律', '间歇功率输出'], 'medium', '滑雪机间歇受阻力、节奏与髋躯干技术影响')
    C['zhansheng_jiange'] = conditioning(
        ['三角肌前束', '三角肌中束', '前臂握力肌群'], ['肱二头肌', '肱三头肌', '斜方肌'],
        ['腹壁', '臀大肌', '股四头肌', '肩袖肌群'], ['肩关节', '肘关节', '髋关节', '膝关节'],
        ['交替挥臂', '肩屈伸快速循环', '稳定站姿间歇'], 'medium', '战绳波形、绳长和挥臂幅度会改变上肢参与比例')
    C['huaxueji_wentai'] = conditioning(
        ['背阔肌', '腹壁', '肱三头肌'], ['臀大肌', '腘绳肌', '股四头肌'],
        ['竖脊肌', '肩袖肌群', '足踝稳定肌群'], ['肩关节', '肘关节', '髋关节', '膝关节'],
        ['双臂下拉', '屈髋/伸髋节律', '稳态耐力'], 'medium', '稳态滑雪机仍受技术与阻力影响，不进入肌群集中精确分数')
    C['zhansheng_bolang'] = conditioning(
        ['三角肌前束', '三角肌中束', '前臂握力肌群'], ['肱二头肌', '肱三头肌', '斜方肌'],
        ['腹壁', '臀大肌', '股四头肌', '肩袖肌群'], ['肩关节', '肘关节', '髋关节', '膝关节'],
        ['连续波浪', '交替肩屈伸', '躯干稳定'], 'medium', '战绳波浪幅度与频率影响肌群负担')
    C['paotong_baidong'] = conditioning(
        ['臀大肌', '腹内外斜肌'], ['背阔肌', '三角肌', '股四头肌'],
        ['腹横肌', '臀中肌', '内收肌群', '足踝稳定肌群'], ['髋关节', '胸椎', '肩关节', '膝关节'],
        ['髋驱动摆动', '躯干旋转/抗旋转切换', '减速控制'], 'medium', '“炮筒摆动”为场馆自定义动作，按源动作说明的髋与躯干协同建立 anatomy')
    C['yaoqiu_zaidi'] = conditioning(
        ['背阔肌', '腹直肌', '腹内外斜肌'], ['肱三头肌', '臀大肌', '股四头肌'],
        ['竖脊肌', '肩袖肌群'], ['肩关节', '肘关节', '髋关节', '膝关节', '胸腰椎'],
        ['过顶举球', '快速下砸', '屈髋屈膝捡球'], 'medium', '药球重量与是否主动跳起会改变下肢参与比例')
    C['tiaoxiang_dengjie'] = conditioning(
        ['臀大肌', '股四头肌'], ['腘绳肌', '腓肠肌'], ['臀中肌', '腹壁', '足踝稳定肌群'],
        ['髋关节', '膝关节', '踝关节'], ['单腿登阶', '髋伸', '膝伸', '控制下台'], 'high')
    C['dengshanpao'] = conditioning(
        ['髂腰肌', '腹直肌', '腹内外斜肌'], ['股四头肌'], ['前锯肌', '肩袖肌群', '腹横肌', '臀大肌'],
        ['肩关节', '髋关节', '膝关节', '腰椎'], ['交替髋屈', '高位支撑抗伸展', '快速步频'], 'medium', '速度变化会显著改变核心与髋屈肌负担')
    C['huachuanji_jiange'] = conditioning(
        ['股四头肌', '臀大肌', '背阔肌'], ['腘绳肌', '肱二头肌', '肱肌'],
        ['竖脊肌', '腹壁', '肩袖肌群'], ['踝关节', '膝关节', '髋关节', '肩关节', '肘关节'],
        ['蹬腿', '伸髋', '水平拉', '间歇划程'], 'medium', '划船机技术顺序与阻力设置影响各肌群相对贡献')
    C['huachuanji_wentai'] = conditioning(
        ['股四头肌', '臀大肌', '背阔肌'], ['腘绳肌', '肱二头肌', '肱肌'],
        ['竖脊肌', '腹壁', '肩袖肌群'], ['踝关节', '膝关节', '髋关节', '肩关节', '肘关节'],
        ['蹬腿', '伸髋', '水平拉', '稳态划程'], 'medium', '稳态划船动作相同，但强度更低且持续时间更长')
    C['xueqiao_tui'] = conditioning(
        ['股四头肌', '臀大肌', '腓肠肌'], ['腘绳肌'], ['腹壁', '前锯肌', '肩袖肌群', '足踝稳定肌群'],
        ['髋关节', '膝关节', '踝关节', '肩关节'], ['连续蹬地', '髋膝伸', '前倾位推行'], 'high')
    C['xueqiao_la'] = conditioning(
        ['股四头肌'], ['腓肠肌', '臀大肌', '胫骨前肌'], ['腹壁', '臀中肌', '足踝稳定肌群'],
        ['髋关节', '膝关节', '踝关节'], ['后退步行', '膝伸控制', '拖行'], 'high')
    C['qiangqiu_toushe'] = conditioning(
        ['股四头肌', '臀大肌', '三角肌前束'], ['肱三头肌', '腓肠肌'], ['腹壁', '肩袖肌群', '臀中肌'],
        ['髋关节', '膝关节', '踝关节', '肩关节', '肘关节'], ['深蹲起身', '髋膝伸展传力', '过顶投掷', '接球缓冲'], 'high')
    C['venue_jumping_jack_interval'] = conditioning(
        ['臀中肌', '内收肌群', '腓肠肌', '三角肌中束'], ['股四头肌'], ['腹壁', '足踝稳定肌群', '肩袖肌群'],
        ['髋关节', '膝关节', '踝关节', '肩关节'], ['跳跃开合', '髋外展/内收', '肩外展/内收', '落地缓冲'], 'medium', '节奏与跳跃幅度会改变冲击和肌群负担')
    C['venue_rocket_press_interval'] = conditioning(
        ['股四头肌', '臀大肌', '三角肌前束'], ['肱三头肌', '腓肠肌'], ['腹壁', '肩袖肌群', '臀中肌'],
        ['髋关节', '膝关节', '踝关节', '肩关节', '肘关节'], ['下肢伸展传力', '药球快速上推', '全身伸展'], 'medium', '“火箭推”为场馆自定义动作，按源口令“下肢伸展传力并向上推出药球”建立 anatomy')
    C['venue_kettlebell_swing_interval'] = conditioning(
        ['臀大肌', '腘绳肌'], ['内收肌群'], ['竖脊肌', '腹壁', '背阔肌', '前臂握力肌群'],
        ['髋关节', '膝关节', '肩关节'], ['爆发性髋伸', '髋铰链', '壶铃摆动'], 'medium', '体能版本受节奏与疲劳影响，不进入精准肌群集中分数')
    C['venue_box_jump_interval'] = conditioning(
        ['臀大肌', '股四头肌', '腓肠肌'], ['腘绳肌'], ['臀中肌', '腹壁', '足踝稳定肌群'],
        ['髋关节', '膝关节', '踝关节'], ['爆发性髋膝踝伸展', '跳跃', '落地缓冲'], 'high')
    C['venue_shuttle_run_interval'] = conditioning(
        ['臀大肌', '股四头肌', '腘绳肌', '腓肠肌'], [], ['臀中肌', '腹壁', '足踝稳定肌群', '内收肌群'],
        ['髋关节', '膝关节', '踝关节'], ['加速', '减速', '转向', '折返跑'], 'medium', '折返距离和转向技术决定减速肌群负担')
    C['venue_treadmill_zone2'] = conditioning(
        ['臀大肌', '股四头肌', '腓肠肌'], ['腘绳肌', '髂腰肌'], ['臀中肌', '腹壁', '足踝稳定肌群'],
        ['髋关节', '膝关节', '踝关节'], ['持续步行/慢跑', '坡度行走', '稳态有氧'], 'medium', '速度、坡度与走/跑形式会改变下肢参与比例；仅用于课后有氧')
    C['venue_stair_zone2'] = conditioning(
        ['臀大肌', '股四头肌'], ['腓肠肌', '腘绳肌'], ['臀中肌', '腹壁', '足踝稳定肌群'],
        ['髋关节', '膝关节', '踝关节'], ['连续登阶', '髋膝伸展', '稳态有氧'], 'medium', '踏阶高度和扶手依赖会影响下肢负担；仅用于课后有氧')

    # ---- Stretch / recovery 14 ----
    C['lashen_xiongjida'] = stretch(
        ['胸大肌'], ['胸小肌', '三角肌前束'], ['肩关节', '肩胛胸廓关节'], ['肩水平外展/外旋位伸展'],
        ['肩前侧疼痛位', '上肢神经牵拉样麻木位'], 'high')
    C['lashen_tunbu'] = stretch(
        ['臀大肌', '臀部深层外旋肌群'], ['臀中肌'], ['髋关节'], ['髋屈/外旋组合伸展'],
        ['坐骨神经牵拉样麻痛位', '急性髋痛位'], 'high')
    C['lashen_huansheng'] = stretch(
        ['腘绳肌'], ['腓肠肌'], ['髋关节', '膝关节'], ['髋屈配合膝伸伸展'],
        ['膝后腘窝强压位', '神经牵拉样麻痛位'], 'high')
    C['lashen_kuanju'] = stretch(
        ['髂腰肌', '股直肌'], ['阔筋膜张肌'], ['髋关节', '膝关节'], ['髋伸展位伸展'],
        ['腰椎过伸代偿位', '跪姿膝部疼痛位'], 'high')
    C['beikuo_lashen'] = stretch(
        ['背阔肌'], ['大圆肌', '肱三头肌长头'], ['肩关节', '胸椎'], ['肩屈/上举位背侧伸展'],
        ['肩前撞击痛位', '手臂麻木位'], 'high')
    C['passive_pec_stretch'] = stretch(
        ['胸大肌'], ['胸小肌', '三角肌前束'], ['肩关节', '肩胛胸廓关节'], ['教练辅助肩水平外展/外旋伸展'],
        ['肩前疼痛位', '关节不稳位', '上肢神经牵拉样麻木位'], 'high', '教练外力不以追求更大幅度为目标')
    C['passive_lat_stretch'] = stretch(
        ['背阔肌'], ['大圆肌', '肱三头肌长头'], ['肩关节', '胸椎'], ['教练辅助肩屈/上举位伸展'],
        ['肩前撞击痛位', '腰椎过伸代偿位', '手臂麻木位'], 'high')
    C['passive_posterior_shoulder_stretch'] = stretch(
        ['三角肌后束', '肩后侧软组织'], ['冈下肌', '小圆肌'], ['肩关节', '肩胛胸廓关节'], ['教练辅助肩水平内收伸展'],
        ['肩前撞击痛位', '强迫内旋位', '关节不稳位'], 'high')
    C['passive_triceps_stretch'] = stretch(
        ['肱三头肌长头'], ['背阔肌'], ['肩关节', '肘关节'], ['肩屈配合肘屈伸展'],
        ['肩前疼痛位', '肘部疼痛位', '腰椎过伸代偿位'], 'high')
    C['passive_glute_stretch'] = stretch(
        ['臀大肌', '臀部深层外旋肌群'], ['臀中肌'], ['髋关节'], ['教练辅助髋屈/外旋组合伸展'],
        ['坐骨神经牵拉样麻痛位', '急性髋痛位'], 'high')
    C['passive_hamstring_stretch'] = stretch(
        ['腘绳肌'], ['腓肠肌'], ['髋关节', '膝关节'], ['教练辅助髋屈配合膝伸伸展'],
        ['膝锁死强压位', '神经牵拉样麻痛位'], 'high', '保持膝关节可微屈，外力不追求压得更低')
    C['passive_hip_flexor_stretch'] = stretch(
        ['髂腰肌', '股直肌'], ['阔筋膜张肌'], ['髋关节', '膝关节'], ['教练辅助髋伸展位伸展'],
        ['腰椎过伸代偿位', '髋前夹挤痛位', '膝部疼痛位'], 'high')
    C['passive_adductor_stretch'] = stretch(
        ['内收肌群'], ['股薄肌'], ['髋关节', '膝关节'], ['教练辅助髋外展伸展'],
        ['腹股沟疼痛位', '膝内侧疼痛位'], 'high')
    C['passive_calf_stretch'] = stretch(
        ['腓肠肌', '比目鱼肌'], [], ['踝关节', '膝关节'], ['教练辅助踝背屈伸展'],
        ['前踝挤压痛位', '跟腱急性疼痛位'], 'high')

    phase_c_ids = manifest['phaseC']['体能'] + manifest['phaseC']['放松']
    missing_def = [aid for aid in phase_c_ids if aid not in C]
    extra_def = [aid for aid in C if aid not in phase_c_ids]
    assert not missing_def, f'Missing Phase C definitions: {missing_def}'
    assert not extra_def, f'Unexpected Phase C definitions: {extra_def}'
    assert len(C) == 34
    overlap = set(C) & set(records)
    assert not overlap, f'Phase C unexpectedly already covered: {sorted(overlap)}'
    records.update(C)

    payload['meta']['phaseCIds'] = phase_c_ids
    payload['meta']['runtimeExpected'] = 239
    payload['meta']['runtimeCovered'] = len(records)
    ANATOMY_PATH.write_text('window.V14_ANATOMY = ' + json.dumps(payload, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')

    counts = {'high': 0, 'medium': 0, 'review': 0}
    for aid in phase_c_ids:
        counts[records[aid]['confidence']] += 1
    with CURATION_PATH.open('a', encoding='utf-8') as f:
        f.write('\n\n## V14.6 Phase C\n\n')
        f.write('- Phase C：34/34\n')
        f.write(f'- HIGH：{counts["high"]}\n- MEDIUM：{counts["medium"]}\n- REVIEW：{counts["review"]}\n')
        f.write('- `conditioning`：20/20；`stretch`：14/14。\n')

    print('Phase C records:', len(C))
    print('Total anatomy records:', len(records))
    print('Confidence:', counts)


if __name__ == '__main__':
    main()
