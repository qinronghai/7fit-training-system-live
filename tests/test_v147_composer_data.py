import json, re
from pathlib import Path

ROOT=Path(__file__).parents[1]

def load_js_json(path, name):
    text=(ROOT/path).read_text(encoding='utf-8')
    m=re.search(rf"window\.{re.escape(name)}\s*=\s*(\{{.*\}});\s*$", text, re.S)
    assert m, f'{name} missing'
    return json.loads(m.group(1))


def test_single_leg_hinge_t1_t4_full_runtime_chain():
    d=load_js_json('data/system-data.js','V14_DATA')
    ids=[
        'movement_supported_single_leg_hinge',
        'movement_supported_db_single_leg_rdl',
        'movement_db_single_leg_rdl',
        'movement_advanced_db_single_leg_rdl',
    ]
    assert d['singleLegHingeIds']==ids
    assert [d['actions'][x]['tier'] for x in ids]==['T1','T2','T3','T4']
    assert all(d['actions'][x]['pattern']=='单腿拉' for x in ids)
    assert all(d['actions'][x]['route']=='1F_ONLY' for x in ids)
    assert all(d['actions'][x]['status']=='可自动编排' for x in ids)
    for x in ids:
        detail=d['actionDetails'][x]['fields']
        assert detail['来源处方 / RPE']
        assert 'RPE' in detail['来源处方 / RPE']
    assert d['actionDetails'][ids[0]]['fields']['进阶 ID']==ids[1]
    assert d['actionDetails'][ids[1]]['fields']['退阶 ID']==ids[0]
    assert d['actionDetails'][ids[1]]['fields']['进阶 ID']==ids[2]
    assert d['actionDetails'][ids[2]]['fields']['退阶 ID']==ids[1]
    assert d['actionDetails'][ids[2]]['fields']['进阶 ID']==ids[3]
    assert d['actionDetails'][ids[3]]['fields']['退阶 ID']==ids[2]


def test_single_leg_mode_has_two_branches_without_adding_eleventh_pattern():
    d=load_js_json('data/system-data.js','V14_DATA')
    assert len(d['tenPatternCatalog'])==10
    branches=d['singleLegBranches']
    assert list(branches)==['single_leg_squat','single_leg_hinge']
    assert branches['single_leg_squat']['ids']==d['eightPatterns']['单腿']
    assert branches['single_leg_hinge']['ids']==d['singleLegHingeIds']


def test_runtime_anatomy_expands_to_243_and_covers_new_chain():
    d=load_js_json('data/system-data.js','V14_DATA')
    a=load_js_json('data/anatomy-data.js','V14_ANATOMY')
    assert len(d['actions'])==243
    assert len(a['records'])==243
    assert set(d['singleLegHingeIds']) <= set(a['records'])
    for action_id in d['singleLegHingeIds']:
        rec=a['records'][action_id]
        assert rec['roleType']=='strength'
        assert '臀大肌' in rec['primary']
        assert '腘绳肌' in rec['primary']
        assert '髋关节' in rec['joints']
        assert rec['confidence'] in {'high','medium','review'}
