from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_recent_action_service_and_loader_are_present():
    assert (ROOT / "js" / "recent-actions.js").is_file()
    index = text("index.html")
    assert '<script src="js/recent-actions.js"></script>' in index
    assert index.index("js/recent-actions.js") < index.index("js/coach/slot.js")


def test_v15_state_owns_recent_action_persistence_without_schema_bump():
    source = text("js/state.js")
    assert "SCHEMA_VERSION=1" in source
    for token in [
        "recentActions:[]",
        "recordRecentAction",
        "listRecentActions",
        "clearRecentActions",
        "contextKey",
        "actionId",
        "usedAt",
    ]:
        assert token in source


def test_recent_quick_swap_is_wired_to_all_three_templates():
    service = text("js/recent-actions.js")
    for token in ["f111Preset", "f111Composer", "body(", "conditioning(", "quickCandidates", "renderButtons"]:
        assert token in service

    f111 = text("js/views-coach.js")
    body = text("js/coach/body-session.js")
    conditioning = text("js/coach/conditioning-session.js")
    assert "V15RecentActions" in f111
    assert "V15RecentActions" in body
    assert "V15RecentActions" in conditioning
    assert "data-recent-action" in service


def test_recent_actions_browser_spec_is_in_real_playwright_discovery():
    config = text("playwright.config.js")
    assert "recent_actions_browser.spec.js" in config
    assert (ROOT / "tests" / "recent_actions_browser.spec.js").is_file()
