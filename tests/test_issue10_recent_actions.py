from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_recent_action_service_and_state_boundary_exist():
    state = text("js/state.js")
    service = text("js/recent-actions.js")
    assert "recentActions:[]" in state.replace(" ", "")
    for token in ["recordRecentAction", "listRecentActions", "clearRecentActions"]:
        assert token in state
    for token in [
        "f111Preset", "f111Composer", "body", "conditioning",
        "rank", "quick", "listRecentActions"
    ]:
        assert token in service


def test_recent_layer_intersects_current_candidates_instead_of_resolving_legality():
    service = text("js/recent-actions.js")
    assert "new Map" in service
    assert "byId.has(recent.actionId)" in service
    assert "V15BodyResolver" not in service
    assert "V15ConditioningResolver" not in service
    assert "V15TemplateResolver" not in service


def test_all_three_template_ui_paths_record_and_replay_recent_actions():
    f111 = text("js/views-coach.js")
    body = text("js/coach/body-session.js")
    conditioning = text("js/coach/conditioning-session.js")
    assert "data-recent-f111-preset" in text("js/coach/slot.js")
    assert "data-recent-f111-composer" in text("js/coach/slot.js")
    assert "V15RecentActions.record" in f111
    assert "data-recent-body" in body
    assert "V15RecentActions.record" in body
    assert "data-recent-conditioning" in conditioning
    assert "V15RecentActions.record" in conditioning


def test_recent_browser_acceptance_is_in_real_playwright_discovery():
    config = text("playwright.config.js")
    assert "recent_actions_browser.spec.js" in config
    source = text("tests/recent_actions_browser.spec.js")
    for token in [
        "390", "pageerror", "reset-session", "reset-body-session",
        "reset-conditioning-session", "CIRCUIT", "DENSITY",
        "data-recent-f111-preset", "data-recent-body", "data-recent-conditioning"
    ]:
        assert token in source


def test_recent_service_loads_before_coach_slots():
    index = text("index.html")
    assert '<script src="js/recent-actions.js"></script>' in index
    assert index.index("js/recent-actions.js") < index.index("js/coach/slot.js")
