from pathlib import Path

from tools.check_artifact_hygiene import find_literal_newlines, scan_targets


def test_artifact_hygiene_accepts_real_newlines(tmp_path: Path):
    index = tmp_path / "index.html"
    css = tmp_path / "assets" / "app.css"
    css.parent.mkdir()
    index.write_text("<head>\n<meta charset=\"utf-8\">\n</head>\n", encoding="utf-8")
    css.write_text(".a { display: block; }\n.b { display: grid; }\n", encoding="utf-8")

    assert scan_targets([index, css.parent]) == []


def test_artifact_hygiene_reports_literal_backslash_n_with_location(tmp_path: Path):
    index = tmp_path / "index.html"
    index.write_text("<head>\\\\n<meta charset=\"utf-8\">\n</head>\n", encoding="utf-8")

    findings = find_literal_newlines(index)

    assert len(findings) == 1
    assert str(index) in findings[0]
    assert ":1:" in findings[0]
    assert "literal \\\\n" in findings[0]


def test_artifact_hygiene_scans_nested_css(tmp_path: Path):
    assets = tmp_path / "assets"
    nested = assets / "nested"
    nested.mkdir(parents=True)
    bad = nested / "component.css"
    bad.write_text(".a{}\\\\n.b{}\n", encoding="utf-8")

    findings = scan_targets([assets])

    assert len(findings) == 1
    assert "component.css" in findings[0]
