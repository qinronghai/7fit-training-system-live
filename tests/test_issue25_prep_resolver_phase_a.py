from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).parents[1]


def test_prep_resolver_exists_and_loads_after_grade_and_anatomy():
    resolver = ROOT / "js" / "prep-resolver.js"
    assert resolver.is_file()

    soup = BeautifulSoup((ROOT / "index.html").read_text(encoding="utf-8"), "html.parser")
    scripts = [tag.get("src") for tag in soup.find_all("script") if tag.get("src")]

    grade = scripts.index("js/prep-grade.js")
    anatomy = scripts.index("js/anatomy.js")
    resolver_index = scripts.index("js/prep-resolver.js")
    composer = scripts.index("js/composer.js")

    assert grade < anatomy < resolver_index < composer


def test_phase_a_resolver_does_not_write_legacy_state_or_coach_ui():
    source = (ROOT / "js" / "prep-resolver.js").read_text(encoding="utf-8")
    assert "V14State" not in source
    assert "document." not in source
    assert "querySelector" not in source
    assert "copyText" not in source
    assert "V14SessionCopy" not in source


def test_phase_a_exports_shared_template_contract():
    source = (ROOT / "js" / "prep-resolver.js").read_text(encoding="utf-8")
    for marker in [
        "MOB-L",
        "MOB-U",
        "PRIMER",
        "CORE-ACT",
        "INTEGRATED",
        "f111",
        "body",
        "conditioning",
        "normalizeSelections",
        "contextFromF111",
        "rankSlotCandidates",
        "resolve",
        "V14PrepResolver",
    ]:
        assert marker in source
