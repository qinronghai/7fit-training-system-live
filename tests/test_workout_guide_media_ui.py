from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_workout_guide_bundle_is_loaded_before_action_detail():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert 'src="data/workout-guide-media.js"' in html
    assert html.index('src="data/workout-guide-media.js"') < html.index('src="js/action-detail.js"')


def test_action_detail_renders_workout_guide_animation_and_attribution():
    source = (ROOT / "js/action-detail.js").read_text(encoding="utf-8")
    assert "workout-guide-media" in source
    assert "data-media-source=\"workout-guide\"" in source
    assert "CC BY-SA 4.0" in source
    assert "prefers-reduced-motion" in (ROOT / "assets/app.css").read_text(encoding="utf-8")
