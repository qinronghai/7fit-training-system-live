import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "src" / "opengym.json"


def load_source():
    return json.loads(SOURCE.read_text(encoding="utf-8"))


def test_opengym_candidates_are_traceable_and_stay_out_of_automatic_programming():
    payload = load_source()
    metadata = payload["metadata"]
    candidates = payload["candidates"]

    assert metadata["repository"] == "DuarteSantos8/openGym"
    assert metadata["textLicense"] == "MIT"
    assert metadata["mediaPolicy"] == "not-imported"
    assert len(candidates) >= 100

    source_ids = set()
    for candidate in candidates:
        assert candidate["id"].startswith("opengym-")
        assert candidate["sourceExerciseId"] not in source_ids
        source_ids.add(candidate["sourceExerciseId"])
        assert candidate["reviewStatus"] == "待人工验收"
        assert candidate["autoCompileEligible"] is False
        assert candidate["media"]["status"] == "not-imported"
        assert "url" not in candidate["media"]
        assert "imageUrl" not in candidate
        assert "gifUrl" not in candidate


def test_candidates_have_enough_structured_fields_for_library_browsing():
    candidates = load_source()["candidates"]
    required = {
        "id",
        "sourceExerciseId",
        "name",
        "bodyPart",
        "equipment",
        "target",
        "secondaryMuscles",
        "category",
        "description",
        "instructions",
        "mapping",
    }
    assert all(required <= set(candidate) for candidate in candidates)
    assert {candidate["mapping"]["equipmentId"] for candidate in candidates} >= {
        "eq-kb",
        "eq-band",
        "eq-medicineball",
    }
