from pathlib import Path
ROOT=Path(__file__).parents[1]

def text(p): return (ROOT/p).read_text(encoding='utf-8')

def test_single_leg_system_page_exposes_two_branches():
    js=text('js/views-system.js')
    assert '单腿蹲' in js
    assert '单腿拉' in js
    assert '单腿双分支' in js
    assert 'singleLegBranches' in js


def test_maintenance_exposes_v147_composer_and_dynamic_runtime_anatomy():
    js=text('js/views-maintenance.js')
    for label in ['自由组合','20/20','单腿双分支','2/2']:
        assert label in js
    assert '全部 ${c.runtimeExpected} 个运行节点已有 anatomy' in js
    assert "'243 / 243'" not in js  # runtime note should be dynamic, not hard-coded


def test_version_copy_is_v147():
    html=text('index.html')
    assert 'V14.7' in html
    assert 'V14.6.3' not in html
