from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_playwright_smoke_files_exist_and_freeze_critical_routes():
    config = ROOT / "playwright.config.js"
    smoke = ROOT / "tests" / "browser_smoke.spec.js"
    assert config.exists(), "playwright.config.js must exist"
    assert smoke.exists(), "tests/browser_smoke.spec.js must exist"

    source = smoke.read_text(encoding="utf-8")
    for token in [
        "#/coach",
        "#/coach/compose",
        "single_leg_hinge",
        "horizontal_push",
        "level=L3",
        "L3｜单腿拉 + 水平推",
        "pageerror",
        "scrollWidth",
        "clientWidth",
        "390",
        ".composer-slot-card",
        ".composer-slot-select",
    ]:
        assert token in source, f"browser smoke must preserve {token!r} coverage"


def test_playwright_config_is_local_chromium_only_and_serves_site_artifact():
    source = text("playwright.config.js")
    assert "127.0.0.1:4173" in source
    assert "_site" in source
    assert "chromium" in source.lower()
    assert "firefox" not in source.lower()
    assert "webkit" not in source.lower()


def test_pr_ci_has_pinned_browser_smoke_job_after_verify():
    source = text(".github/workflows/schema-check.yml")
    assert re.search(r"(?m)^  browser-smoke:\s*$", source)
    assert re.search(r"(?m)^    needs: verify\s*$", source)
    assert "@playwright/test@1.63.0" in source
    assert "playwright install chromium" in source
    assert "--with-deps" not in source
    assert "npx playwright test" in source


def test_master_deploy_is_blocked_by_browser_smoke():
    source = text(".github/workflows/deploy-pages.yml")
    assert re.search(r"(?m)^  browser-smoke:\s*$", source)
    assert re.search(r"(?m)^    needs: verify\s*$", source)
    assert "@playwright/test@1.63.0" in source
    assert "playwright install chromium" in source
    assert "--with-deps" not in source
    assert "npx playwright test" in source
    assert re.search(r"(?m)^    needs: \[verify, browser-smoke\]\s*$", source)
