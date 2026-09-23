from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_issue132_release_gate_artifacts_exist_and_are_discovered():
    spec = ROOT / "tests" / "f111_preset_browser_release_gate_browser.spec.js"
    assert spec.is_file()

    config = text("playwright.config.js")
    assert "*_browser.spec.js" in config
    assert "fs.readdirSync" in config
    assert "browserName: 'chromium'" in config
    assert "workers: 1" in config


def test_issue132_browser_gate_freezes_the_new_f111_entrypoint():
    source = text("tests/f111_preset_browser_release_gate_browser.spec.js")
    for token in [
        "opens the free-composition page without the preset browser",
        "legacy composer URLs remain valid aliases",
        "legacy individual preset detail routes remain available",
        "[360,390,430,1080]",
        "scrollWidth",
        "clientWidth",
        "#/coach/f111/f111-07/l3",
        "#/coach/f111/compose?",
        "pageerror",
    ]:
        assert token in source, f"Issue #132 release gate missing {token!r}"


def test_issue132_keeps_shared_browser_view_model_and_real_resolver_path():
    browser = text("js/coach/f111-preset-browser.js")
    home = text("js/coach/f111-home.js")
    detail = text("js/coach/f111-preset-detail.js")

    assert "V15TemplateResolver" in browser
    assert "resolvePreview" in browser
    assert "buildIndex" in browser
    assert "F111PresetBrowser" not in home
    assert "F111PresetBrowser" in detail
    assert "32" not in browser or "32" not in browser.split("resolvePreview", 1)[-1]


def test_issue132_release_gate_is_inside_existing_pr_and_pages_verification_chain():
    pr_workflow = text(".github/workflows/schema-check.yml")
    pages_workflow = text(".github/workflows/deploy-pages.yml")

    for source in [pr_workflow, pages_workflow]:
        assert "python -m pytest -q" in source
        assert 'for f in tests/*_test.js; do node "$f"; done' in source
        assert "npx playwright test" in source
        assert "browser-smoke:" in source
        assert "needs: verify" in source

    assert "actions/deploy-pages@v4" in pages_workflow
    assert "needs: [verify, browser-smoke]" in pages_workflow
