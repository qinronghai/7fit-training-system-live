#!/usr/bin/env python3
"""Build the review-only OpenGym movement catalogue used by the 7Fit library.

The importer deliberately reads only the 1,324 ExerciseDB-v1 entries identified by
openGym as MIT-licensed text. It never reads or copies openGym's media directory.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).parents[1]
DEFAULT_OUTPUT_JSON = ROOT / "data" / "src" / "opengym.json"
DEFAULT_OUTPUT_JS = ROOT / "data" / "opengym-candidates.js"

EQUIPMENT_MAP = {
    "body weight": "eq-mat",
    "dumbbell": "eq-dumbbell",
    "cable": "eq-cable",
    "barbell": "eq-barbell",
    "band": "eq-band",
    "resistance band": "eq-band",
    "smith machine": "eq-smith",
    "kettlebell": "eq-kb",
    "weighted": "eq-dumbbell",
    "assisted": "eq-assisted-pullup",
    "sled machine": "eq-sled",
    "medicine ball": "eq-medicineball",
    "rope": "eq-rope",
    "bosu ball": "eq-suspension-pad",
    "olympic barbell": "eq-barbell",
    "wheel roller": "eq-abmat",
    "upper body ergometer": "eq-rower",
    "skierg machine": "eq-ski",
    "trap bar": "eq-trapbar",
}

PATTERN_RULES = (
    ("蹲", ("squat", "leg press", "hack squat", "wall sit", "step-up")),
    ("单腿", ("lunge", "split squat", "pistol squat", "single leg", "step up")),
    ("髋铰链", ("deadlift", "good morning", "romanian", "stiff leg", "swing")),
    ("髋伸展", ("hip thrust", "glute bridge", "kickback", "hyperextension")),
    ("水平拉", ("row", "rear delt", "reverse fly", "face pull")),
    ("垂直拉", ("pull-up", "pull up", "chin-up", "chin up", "pulldown", "lat pull")),
    ("水平推", ("bench press", "push-up", "push up", "chest press", "chest fly", "dip")),
    ("垂直推", ("shoulder press", "military press", "overhead press", "push press", "handstand")),
    ("核心", ("plank", "crunch", "sit-up", "sit up", "russian twist", "wood chop", "dead bug")),
)


def source_commit(repo: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def patterns_for(exercise: dict) -> list[str]:
    text = " ".join(
        str(value or "")
        for value in [exercise.get("name"), exercise.get("description"), exercise.get("category")]
    ).lower()
    found = [pattern for pattern, keywords in PATTERN_RULES if any(k in text for k in keywords)]
    if not found and exercise.get("category") in {"mobility", "stretching", "pilates", "yoga"}:
        found = ["活动 / 灵活性"]
    return found


def load_exercises(repo: Path) -> list[dict]:
    exercise_dir = repo / "catalogue" / "exercises"
    rows = []
    for path in sorted(exercise_dir.glob("*.json")):
        exercise = json.loads(path.read_text(encoding="utf-8"))
        if exercise.get("textSource") != "exercisedb":
            continue
        equipment_id = EQUIPMENT_MAP.get(exercise.get("equipment"))
        if not equipment_id:
            continue
        patterns = patterns_for(exercise)
        rows.append(
            {
                "id": f"opengym-{exercise['id']}",
                "sourceExerciseId": exercise["id"],
                "sourceUrl": (
                    "https://github.com/DuarteSantos8/openGym/blob/"
                    f"{{SOURCE_COMMIT}}/catalogue/exercises/{exercise['id']}.json"
                ),
                "license": "MIT",
                "name": exercise["name"],
                "bodyPart": exercise["bodyPart"],
                "equipment": exercise["equipment"],
                "target": exercise["target"],
                "secondaryMuscles": exercise.get("secondaryMuscles", []),
                "category": exercise.get("category") or "strength",
                "description": exercise.get("description", ""),
                "instructions": exercise.get("instructions", []),
                "mapping": {
                    "equipmentId": equipment_id,
                    "patterns": patterns,
                    "pattern": patterns[0] if patterns else "",
                },
                "reviewStatus": "待人工验收",
                "autoCompileEligible": False,
                "media": {
                    "status": "not-imported",
                    "reason": "OpenGym media is licensed for OpenGym only",
                    "planned": "7Fit 自有照片或示意图，单独取得授权后再接入",
                },
            }
        )
    return rows


def build_payload(repo: Path) -> dict:
    commit = source_commit(repo)
    candidates = load_exercises(repo)
    for candidate in candidates:
        candidate["sourceUrl"] = candidate["sourceUrl"].replace("{SOURCE_COMMIT}", commit)
    return {
        "metadata": {
            "repository": "DuarteSantos8/openGym",
            "sourceCommit": commit,
            "sourcePath": "catalogue/exercises/*.json",
            "textSource": "ExerciseDB v1 via OpenGym",
            "textLicense": "MIT",
            "mediaPolicy": "not-imported",
            "reviewPolicy": "候选动作仅用于动作库发现，不进入正式编排；转正前需 7Fit 教练审核。",
        },
        "candidates": candidates,
    }


def render_js(payload: dict) -> str:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"window.V14_OPENGYM={body};\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_repo", type=Path, help="checked-out openGym repository")
    parser.add_argument("--output-json", type=Path, default=DEFAULT_OUTPUT_JSON)
    parser.add_argument("--output-js", type=Path, default=DEFAULT_OUTPUT_JS)
    parser.add_argument("--check", action="store_true", help="check generated files without writing")
    args = parser.parse_args()

    payload = build_payload(args.source_repo.resolve())
    expected_json = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    expected_js = render_js(payload)
    try:
        actual_json = args.output_json.read_text(encoding="utf-8")
        actual_js = args.output_js.read_text(encoding="utf-8")
    except FileNotFoundError:
        if args.check:
            print("OpenGym candidate bundle is stale or missing")
            return 1
        actual_json = actual_js = None
    if args.check:
        ok = actual_json == expected_json and actual_js == expected_js
        print("OpenGym candidate bundle check: " + ("PASS" if ok else "FAIL"))
        return 0 if ok else 1
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_js.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(expected_json, encoding="utf-8")
    args.output_js.write_text(expected_js, encoding="utf-8")
    print(f"wrote {args.output_json.relative_to(ROOT)}")
    print(f"wrote {args.output_js.relative_to(ROOT)}")
    print(f"candidates: {len(payload['candidates'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
