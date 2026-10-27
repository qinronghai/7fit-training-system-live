import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "data/src/workout-guide-media.json"


def test_workout_guide_manifest_is_local_and_attributed():
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    metadata = payload["metadata"]
    assets = payload["assets"]

    assert metadata["repository"] == "bryllim/workout-guide"
    assert metadata["assetLicense"] == "CC BY-SA 4.0"
    assert metadata["codeLicense"] == "MIT"
    assert metadata["attribution"]
    assert len(assets) >= 20
    assert len({item["formalActionId"] for item in assets}) == len(assets)

    for item in assets:
        assert item["sourceSlug"]
        assert item["formalActionName"]
        assert len(item["frames"]) == 3
        assert item["attribution"]["license"] == "CC BY-SA 4.0"
        for frame in item["frames"]:
            path = ROOT / frame["path"]
            assert path.is_file(), path
            assert path.suffix == ".svg"
            assert not frame["path"].startswith("http")


def test_workout_guide_bundle_matches_manifest():
    source = (ROOT / "data/workout-guide-media.js").read_text(encoding="utf-8")
    payload = json.loads(MANIFEST.read_text(encoding="utf-8"))
    assert "window.V14_WORKOUT_GUIDE=" in source
    assert str(len(payload["assets"])) in source
