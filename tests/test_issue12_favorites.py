from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_favorites_services_and_loaders_are_present():
    for path in ["js/favorites.js", "js/coach/favorites.js"]:
        assert (ROOT / path).is_file()
    index = text("index.html")
    assert '<script src="js/favorites.js"></script>' in index
    assert '<script src="js/coach/favorites.js"></script>' in index
    assert index.index("js/favorites.js") < index.index("js/coach/favorites.js")


def test_favorites_use_reserved_v15_state_without_root_schema_bump():
    source = text("js/state.js")
    assert "SCHEMA_VERSION=1" in source
    assert "FAVORITE_SCHEMA_VERSION=1" in source
    for token in ["setFavorite", "getFavorite", "listFavorites", "hasFavorite", "removeFavorite"]:
        assert token in source


def test_favorites_re_resolve_current_search_and_router_truth():
    source = text("js/favorites.js")
    assert "V15TemplateSearch" in source
    assert "V14Router" in source
    assert "ENTRY_NOT_FOUND" in source
    assert "TEMPLATE_MISMATCH" in source
    assert "ROUTE_INVALID" in source


def test_library_and_coach_center_expose_favorite_controls():
    library = text("js/views-library.js")
    home = text("js/coach/home.js")
    coach_ui = text("js/coach/favorites.js")
    assert "data-favorite-toggle" in library
    assert "FavoritesUI?.section" in home
    assert "常用收藏" in coach_ui
    assert "data-favorite-remove" in coach_ui


def test_favorites_browser_spec_is_in_real_playwright_discovery():
    config = text("playwright.config.js")
    assert "favorites_browser.spec.js" in config
    assert (ROOT / "tests" / "favorites_browser.spec.js").is_file()
