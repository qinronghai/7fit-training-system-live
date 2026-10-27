from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def test_opengym_bundle_loads_before_search_and_library_modules():
    index = read("index.html")
    assert '<script src="data/opengym-candidates.js"></script>' in index
    assert index.index("data/opengym-candidates.js") < index.index("js/template-search.js")
    assert index.index("data/opengym-candidates.js") < index.index("js/views-library.js")


def test_library_exposes_external_candidate_filter_and_details():
    library = read("js/views-library.js")
    detail = read("js/action-detail.js")
    for token in [
        'data-filter="source"',
        "opengym-action",
        "data-opengym-action-id",
        "data-opengym-related-id",
        "相似动作 / 替代候选",
        "OpenGym 候选",
    ]:
        assert token in library or token in detail
    assert "V14_OPENGYM" in detail
    assert "not-imported" in detail
