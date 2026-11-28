import json
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]


def test_index_links_the_manifest_and_home_screen_icon():
    soup = BeautifulSoup((ROOT / "index.html").read_text(encoding="utf-8"), "html.parser")
    manifest = soup.select_one('link[rel="manifest"]')
    assert manifest and manifest["href"] == "assets/manifest.webmanifest"
    apple = soup.select_one('link[rel="apple-touch-icon"]')
    assert apple and (ROOT / apple["href"]).exists()
    assert soup.select_one('meta[name="apple-mobile-web-app-capable"]')["content"] == "yes"
    assert "viewport-fit=cover" in soup.select_one('meta[name="viewport"]')["content"]


def test_manifest_opens_the_coach_app_standalone_with_existing_icons():
    path = ROOT / "assets" / "manifest.webmanifest"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    assert manifest["display"] == "standalone"
    assert manifest["start_url"].endswith("#/coach")
    sizes = {icon["sizes"] for icon in manifest["icons"]}
    assert {"192x192", "512x512"} <= sizes
    for icon in manifest["icons"]:
        assert (path.parent / icon["src"]).exists(), icon["src"]
