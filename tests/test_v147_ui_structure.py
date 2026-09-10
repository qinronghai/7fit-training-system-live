from pathlib import Path

ROOT=Path(__file__).parents[1]

def text(path): return (ROOT/path).read_text(encoding='utf-8')

def coach_source():
    paths=['js/coach/common.js','js/coach/home.js','js/coach/f111-home.js','js/coach/slot.js','js/coach/composer-view.js','js/views-coach.js']
    return '\n'.join(text(path) for path in paths)

def test_composer_script_is_loaded_before_coach_view():
    html=text('index.html')
    assert 'js/composer.js' in html
    assert html.index('js/composer.js') < html.index('js/views-coach.js')


def test_coach_center_has_preset_and_free_composer_modes():
    js=coach_source()
    for label in ['7Fit 推荐预设','自由组合编课','20 种基础组合','5 × 4 主模式矩阵']:
        assert label in js
    assert '#/coach/f111/compose' in js


def test_free_composer_ui_exposes_level_matrix_mobile_and_six_slots():
    js=coach_source()
    composer=text('js/composer.js')
    for marker in ['composer-level-switch','composer-matrix','composer-mobile-selectors','composer-slot-select']:
        assert marker in js
    for label in ['A｜下肢主项','B｜上肢主项','C｜支撑模式','D1｜下肢辅助','D2｜上肢辅助','CORE｜核心模式']:
        assert label in composer
    for lower in ['下肢推','下肢拉','臀伸','单腿蹲','单腿拉']:
        assert lower in js
    for upper in ['水平拉','垂直拉','水平推','垂直推']:
        assert upper in js


def test_composer_css_has_responsive_matrix_and_mobile_fallback():
    css=text('assets/app.css')
    assert 'V14.7 F111 COMPOSER' in css
    assert '.composer-matrix' in css
    assert '.composer-mobile-selectors' in css
    assert '@media(max-width:620px)' in css


def test_official_f111_routes_and_32_sessions_are_not_removed():
    data=text('data/system-data.js')
    assert 'F111-01-L1' in data
    assert 'F111-08-L4' in data