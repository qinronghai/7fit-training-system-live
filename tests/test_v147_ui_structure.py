from pathlib import Path

ROOT=Path(__file__).parents[1]

def text(path): return (ROOT/path).read_text(encoding='utf-8')

def coach_source():
    paths=['js/coach/common.js','js/coach/home.js','js/coach/f111-home.js','js/coach/slot.js','js/coach/f111-compose-ui.js','js/coach/composer-view.js','js/views-coach.js']
    return '\n'.join(text(path) for path in paths)

def test_composer_script_is_loaded_before_coach_view():
    html=text('index.html')
    assert 'js/composer.js' in html
    assert html.index('js/composer.js') < html.index('js/views-coach.js')
    assert 'js/coach/f111-compose-ui.js' in html
    assert html.index('js/coach/f111-compose-ui.js') < html.index('js/coach/composer-view.js')


def test_coach_center_has_preset_and_free_composer_modes():
    js=coach_source()
    for label in ['7Fit 推荐预设','自由组合编课','F111｜女性综合训练','选择训练阶段','选择训练模式','1F｜力量训练']:
        assert label in js
    assert '#/coach/f111/compose' in js


def test_free_composer_ui_exposes_stage_navigation_and_drawer_slots():
    ui=text('js/coach/f111-compose-ui.js')
    view=text('js/coach/composer-view.js')
    data=text('data/system-data.js')
    for marker in ['f111-level-switch','f111-strength-grid','f111-support-grid']:
        assert marker in view
    assert 'data-f111-mode-drawer' in ui
    assert 'data-f111-action-drawer' in ui
    for label in ['A｜下肢主项','B｜上肢主项','C｜支撑模式','D1｜下肢辅助','D2｜上肢辅助','CORE｜核心模式']:
        assert label in ui
    for lower in ['下肢推','下肢拉','臀伸','单腿蹲','单腿拉']:
        assert lower in data
    for upper in ['水平拉','垂直拉','水平推','垂直推']:
        assert upper in data


def test_composer_css_has_responsive_f111_layout_and_drawer_controls():
    css=text('assets/app.css')
    for marker in ['.f111-compose-hero','.f111-level-switch','.f111-strength-grid','.f111-support-grid','.f111-action-drawer-trigger']:
        assert marker in css
    assert '@media(max-width:620px)' in css


def test_official_f111_routes_and_32_sessions_are_not_removed():
    data=text('data/system-data.js')
    assert 'F111-01-L1' in data
    assert 'F111-08-L4' in data
