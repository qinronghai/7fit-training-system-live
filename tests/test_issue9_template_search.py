from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_template_search_runtime_and_loader_are_present():
    assert (ROOT / "js" / "template-search.js").is_file()
    index = text("index.html")
    assert '<script src="js/template-search.js"></script>' in index
    assert index.index('js/template-search.js') < index.index('js/views-library.js')


def test_library_exposes_template_aware_controls_and_results():
    source = text("js/views-library.js")
    for token in [
        'id="action-search"',
        'data-filter="templateId"',
        'data-filter="kind"',
        'data-search-result-kind',
        'body-family',
        'conditioning-protocol',
        'f111-combination',
    ]:
        assert token in source


def test_template_search_browser_spec_is_in_real_playwright_discovery():
    config = text("playwright.config.js")
    assert "template_search_browser.spec.js" in config
    assert (ROOT / "tests" / "template_search_browser.spec.js").is_file()


def test_search_service_uses_formal_template_membership_sources():
    source = text("js/template-search.js")
    assert "bodyActionMeta" in source
    assert "conditioningActionMeta" in source
    assert "V14Composer.combinations" in source
    assert "supportIds" in source
    assert "coreIds" in source
    assert "#/coach/body/compose" in source
    assert "#/coach/conditioning/compose" in source
    assert "#/coach/f111/compose" in source
