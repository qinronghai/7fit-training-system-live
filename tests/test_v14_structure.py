from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).parents[1]

def soup():
    return BeautifulSoup((ROOT / 'index.html').read_text(encoding='utf-8'), 'html.parser')

def test_app_shell_has_single_main_outlet():
    s = soup()
    assert s.select_one('#app-sidebar')
    assert s.select_one('#app-main')
    assert s.select_one('#mobile-nav')
    assert len(s.select('#app-main')) == 1

def test_primary_navigation_is_role_oriented_not_version_oriented():
    labels = [a.get_text(' ', strip=True) for a in soup().select('[data-primary-nav]')]
    assert labels == ['编课中心', '训练体系', '编排规则', '动作库', '系统维护']

def test_library_has_search_and_filter_mount_points():
    text = (ROOT / 'js' / 'views-library.js').read_text(encoding='utf-8')
    assert 'id="action-search"' in text
    assert 'data-filter="pattern"' in text
    assert 'data-filter="tier"' in text
    assert 'data-filter="zone"' in text
    assert 'data-filter="equipment"' in text

def test_system_maintenance_is_not_a_default_coach_primary_surface():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert 'id="mode-toggle"' in html
    assert 'data-mode="coach"' in html

def test_maintenance_view_contains_data_health_labels():
    text = (ROOT / 'js' / 'views-maintenance.js').read_text(encoding='utf-8')
    for label in ['动作库总数', '待回写', '层级差异', 'Venue Overlay']:
        assert label in text

def test_all_local_assets_exist():
    s = soup()
    refs = []
    refs += [x.get('src') for x in s.select('script[src]')]
    refs += [x.get('href') for x in s.select('link[href]')]
    for ref in refs:
        assert ref and not ref.startswith(('http://','https://'))
        assert (ROOT / ref).exists(), ref

def test_mobile_navigation_has_five_primary_destinations():
    s = soup()
    links = s.select('#mobile-nav a')
    assert len(links) == 5
    assert [a.get_text(' ', strip=True) for a in links] == ['编课','体系','规则','动作库','更多']


def test_coach_home_contains_approved_f111_course_introduction():
    text = (ROOT / 'js' / 'views-coach.js').read_text(encoding='utf-8')
    required = [
        '为什么是「1+1+1」',
        '一下肢 + 一上肢 + 一支撑',
        '每节课只锁定一个下肢主模式、一个上肢主模式和一个支撑任务',
        '① 全身都能练到，但重点非常清楚',
        '② 更适合女性长期塑形',
        '臀腿线条、背肩塑形、基础力量、核心稳定、动作质量和整体体态。',
        '③ 可以连续进阶',
        '动作控制 → 基础负重 → 独立负重 → 完整能力。'
    ]
    for item in required:
        assert item in text


def test_v141_readability_overrides_exist():
    css = (ROOT / "assets" / "app.css").read_text(encoding="utf-8")
    assert "V14.1 READABILITY UPGRADE" in css
    assert ".view-hero p{font-size:14px" in css
    assert ".section-head p{font-size:13px" in css
    assert ".slot-actions select{font-size:12px" in css
    assert ".detail-copy p{font-size:12.5px" in css
    assert ".coach-home-intro .intro-summary{font-size:12.5px" in css
    assert ".intro-points article p{font-size:11.5px!important" in css


def test_v142_uses_official_7fit_logo_asset():
    from bs4 import BeautifulSoup
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    soup = BeautifulSoup(html, "html.parser")
    logo = soup.select_one('.brand-mark img[data-brand-logo="official"]')
    assert logo is not None
    assert logo.get("src") == "assets/7fit-logo-official.jpeg"
    assert logo.get("alt") == "7Fit"
    assert (ROOT / "assets" / "7fit-logo-official.jpeg").exists()
    assert soup.select_one('.brand-mark').get_text(strip=True) != "7"
    icon = soup.select_one('link[rel~="icon"]')
    assert icon is not None
    assert icon.get("href") == "assets/7fit-logo-official.jpeg"

def test_v143_prep_view_has_level_and_pattern_match_controls():
    text = (ROOT / 'js' / 'views-system.js').read_text(encoding='utf-8')
    assert 'PREP 热身体系' in text
    assert 'id="prep-pattern"' in text
    assert 'id="prep-session-level"' in text
    assert 'id="prep-main-tier"' in text
    assert 'data-prep-id' in text

def test_v143_coach_session_renders_matched_warmup_recommendations():
    text = (ROOT / 'js' / 'views-coach.js').read_text(encoding='utf-8')
    assert '当前课程热身匹配' in text
    assert 'warmupDetails' in text
    assert '#/system/prep?' in text

def test_v144_prep_matcher_renders_foam_roll_recommendations():
    system = (ROOT / 'js' / 'views-system.js').read_text(encoding='utf-8')
    coach = (ROOT / 'js' / 'views-coach.js').read_text(encoding='utf-8')
    assert '泡沫轴松解建议' in system
    assert 'foamRollMatchByPattern' in system
    assert '当前课程泡沫轴匹配' in coach
    assert 'foamRollDetails' in coach


def test_v145_action_detail_and_coach_surface_anatomy():
    detail = (ROOT / 'js' / 'action-detail.js').read_text(encoding='utf-8')
    coach = (ROOT / 'js' / 'views-coach.js').read_text(encoding='utf-8')
    system = (ROOT / 'js' / 'views-system.js').read_text(encoding='utf-8')
    for label in ['肌群解剖', '解剖数据待补齐']:
        assert label in detail
    for label in ['本节主要训练肌群', '主要刺激', '协同参与', '核心 / 稳定']:
        assert label in coach
    assert '基于当前动作主要 / 辅助肌群排序' in coach
    assert 'V14Anatomy.rankWarmups' in coach
    assert 'V14Anatomy.rankFoam' in coach
    assert '解剖数据' in system

def test_v145_maintenance_has_anatomy_coverage_and_uncovered_lists():
    text = (ROOT / 'js' / 'views-maintenance.js').read_text(encoding='utf-8')
    for label in ['Anatomy Coverage', 'Phase A', 'HIGH', 'MEDIUM', 'REVIEW', '未覆盖运行节点']:
        assert label in text


def test_v146_conditioning_and_full_coverage_ui_contract():
    detail = (ROOT / 'js' / 'action-detail.js').read_text(encoding='utf-8')
    maintenance = (ROOT / 'js' / 'views-maintenance.js').read_text(encoding='utf-8')
    anatomy = (ROOT / 'js' / 'anatomy.js').read_text(encoding='utf-8')
    for label in ['主要参与肌群', '协同参与肌群', '动作特点']:
        assert label in detail or label in anatomy
    for label in ['Runtime Anatomy', 'Phase B', 'Phase C']:
        assert label in maintenance
    assert 'c.runtimeExpected' in maintenance
    assert '未覆盖运行节点' in maintenance
    assert '目标关节' in detail
    assert '安全边界' in detail

def test_v1461_session_copy_controls_exist():
    coach = (ROOT / 'js' / 'views-coach.js').read_text(encoding='utf-8')
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    assert '复制教练版' in coach
    assert '复制会员版' in coach
    assert 'id="copy-coach-session"' in coach
    assert 'id="copy-member-session"' in coach
    assert 'id="copy-session-status"' in coach
    assert 'js/session-copy.js' in html


def test_v1461_copy_helper_exposes_formatters():
    text = (ROOT / 'js' / 'session-copy.js').read_text(encoding='utf-8')
    for symbol in ['formatCoach', 'formatMember', 'copyText', 'window.V14SessionCopy']:
        assert symbol in text
