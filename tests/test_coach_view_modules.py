from pathlib import Path

from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
COACH_MODULES = [
    "js/coach/common.js",
    "js/coach/home.js",
    "js/coach/slot.js",
    "js/coach/prep.js",
    "js/coach/foam.js",
    "js/coach/summary.js",
    "js/coach/conflict-view.js",
    "js/coach/session.js",
    "js/coach/composer-view.js",
]


def test_coach_view_modules_exist_and_load_before_facade():
    missing = [path for path in COACH_MODULES if not (ROOT / path).exists()]
    assert not missing, f"missing Coach view modules: {missing}"

    soup = BeautifulSoup((ROOT / "index.html").read_text(encoding="utf-8"), "html.parser")
    scripts = [tag.get("src") for tag in soup.find_all("script") if tag.get("src")]
    facade_index = scripts.index("js/views-coach.js")

    for module in COACH_MODULES:
        assert module in scripts, f"{module} must be loaded by index.html"
        assert scripts.index(module) < facade_index, f"{module} must load before views-coach.js"


def test_views_coach_is_a_thin_compatibility_facade():
    source = (ROOT / "js/views-coach.js").read_text(encoding="utf-8")

    for legacy_body in [
        "function home(",
        "function session(",
        "function slotCard(",
        "function matchedWarmups(",
        "function matchedFoamRolls(",
        "function muscleSummaryHtml(",
        "function conflictHtml(",
        "function composer(",
    ]:
        assert legacy_body not in source, f"facade still owns rendering responsibility: {legacy_body}"

    for public_contract in [
        "window.V14Views",
        "window.V14Bind",
        "window.V14CoachAnatomy",
    ]:
        assert public_contract in source, f"missing compatibility export: {public_contract}"

    assert len(source.encode("utf-8")) < 12000, "views-coach.js should be a thin facade after the split"
