from pathlib import Path

from tools.prepare_static_site import prepare_site, version_index


def test_version_index_versions_local_runtime_assets_and_build_label():
    html = """
    <link href="assets/app.css" rel="stylesheet">
    <link href="assets/logo.jpeg" rel="icon">
    <script src="data/system-data.js"></script>
    <script src="js/app.js"></script>
    <div>Build __BUILD_ID__</div>
    """
    rendered = version_index(html, "1234567890abcdef")

    assert 'assets/app.css?v=12345678' in rendered
    assert 'assets/logo.jpeg?v=12345678' in rendered
    assert 'data/system-data.js?v=12345678' in rendered
    assert 'js/app.js?v=12345678' in rendered
    assert "Build 12345678" in rendered
    assert "__BUILD_ID__" not in rendered


def test_prepare_site_copies_runtime_and_rewrites_only_deployed_index(tmp_path: Path):
    root = tmp_path / "root"
    dest = tmp_path / "site"
    root.mkdir()
    (root / "index.html").write_text(
        '<link href="assets/app.css"><script src="js/app.js"></script>'
        '<span>__BUILD_ID__</span>',
        encoding="utf-8",
    )
    for directory, filename in (
        ("assets", "app.css"),
        ("data", "system-data.js"),
        ("js", "app.js"),
    ):
        path = root / directory
        path.mkdir()
        (path / filename).write_text("/* fixture */", encoding="utf-8")

    prepare_site(root, dest, "abcdef0123456789")

    deployed = (dest / "index.html").read_text(encoding="utf-8")
    source = (root / "index.html").read_text(encoding="utf-8")

    assert 'assets/app.css?v=abcdef01' in deployed
    assert 'js/app.js?v=abcdef01' in deployed
    assert "abcdef01" in deployed
    assert "__BUILD_ID__" in source
    assert (dest / ".nojekyll").exists()
    assert (dest / "data" / "system-data.js").exists()
