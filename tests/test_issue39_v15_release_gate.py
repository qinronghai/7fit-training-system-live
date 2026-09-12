from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_v15_release_matrix_artifacts_are_frozen():
    required = [
        "tests/f111_migration_parity_test.js",
        "tests/f111_conflict_parity_test.js",
        "tests/body_resolver_baseline_test.js",
        "tests/conditioning_resolver_baseline_test.js",
        "tests/saved_sessions_restore_test.js",
        "tests/body_coach_browser.spec.js",
        "tests/body_recovery_browser.spec.js",
        "tests/conditioning_coach_browser.spec.js",
        "tests/saved_sessions_browser.spec.js",
        "tests/v15_release_gate_browser.spec.js",
    ]
    for path in required:
        assert (ROOT / path).is_file(), f"V15 release artifact missing: {path}"

    f111 = text("tests/f111_migration_parity_test.js")
    assert "presetCount,32" in f111.replace(" ", "")
    assert "composerCount,80" in f111.replace(" ", "")

    body = text("tests/body_resolver_baseline_test.js")
    assert "c06f4ddd03bebce65c8875dd66a03d99d897e54adec0190ea50a72e47e5f8005" in body

    conditioning = text("tests/conditioning_resolver_baseline_test.js")
    assert "16a3234e77412aa9a2cd5364e430bdf1d620732a1cb169539e20ef11be07dd6f" in conditioning


def test_playwright_release_gate_discovers_all_v15_critical_specs():
    config = text("playwright.config.js")
    for spec in [
        "browser_smoke.spec.js",
        "conflict_browser.spec.js",
        "router_browser.spec.js",
        "body_coach_browser.spec.js",
        "body_recovery_browser.spec.js",
        "conditioning_coach_browser.spec.js",
        "saved_sessions_browser.spec.js",
        "v15_release_gate_browser.spec.js",
    ]:
        assert spec in config, f"Playwright release gate is not discovering {spec}"
    assert "workers: 1" in config
    assert "browserName: 'chromium'" in config
    assert "127.0.0.1:4173" in config
    assert "_site" in config


def assert_full_verify_gate(source: str):
    for command in [
        "python -m pytest -q",
        "python tools/build_system_data.py --check",
        "python tools/validate_v148_schema.py",
        'for f in tests/*_test.js; do node "$f"; done',
        "find data js -type f -name '*.js'",
    ]:
        assert command in source, f"missing release verification command: {command}"


def assert_browser_gate(source: str):
    assert re.search(r"(?m)^  browser-smoke:\s*$", source)
    assert re.search(r"(?m)^    needs: verify\s*$", source)
    assert "@playwright/test@1.63.0" in source
    assert "playwright install chromium" in source
    assert "npx playwright test" in source
    assert "cp -a assets data js _site/" in source


def test_pr_workflow_requires_full_verify_then_browser_gate():
    source = text(".github/workflows/schema-check.yml")
    assert_full_verify_gate(source)
    assert_browser_gate(source)


def test_master_pages_release_requires_verify_browser_and_static_artifact():
    source = text(".github/workflows/deploy-pages.yml")
    assert_full_verify_gate(source)
    assert_browser_gate(source)
    assert "actions/configure-pages@v5" in source
    assert "actions/upload-pages-artifact@v4" in source
    assert "actions/deploy-pages@v4" in source
    assert re.search(r"(?m)^    needs: \[verify, browser-smoke\]\s*$", source)
    assert "path: _site" in source


def test_release_browser_contract_covers_cross_template_and_mobile_boundaries():
    source = text("tests/v15_release_gate_browser.spec.js")
    for token in [
        "#/coach/f111/f111-06/l3",
        "#/coach/f111-06/l3",
        "#/coach/f111/compose",
        "#/coach/compose",
        "#/coach/body/body-02/l3",
        "#/coach/conditioning/con-03/l2",
        "#/coach/posture",
        "goBack",
        "goForward",
        "reload",
        "页面不存在",
        "scrollWidth",
        "clientWidth",
        "390",
        "data-save-current-session",
        "saved-session-card",
        "pageerror",
    ]:
        assert token in source, f"V15 release browser gate missing {token!r}"
