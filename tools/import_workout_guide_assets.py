#!/usr/bin/env python3
"""Import a small, licensed Workout Guide visual pack for formal 7Fit actions.

The source repository contains 302 exercises. 7Fit intentionally imports a
curated mapping rather than copying the whole catalogue: a visual is attached
to a formal action only when the movement and equipment are close enough for a
coach-facing preview. The SVG frames are copied unchanged and remain CC BY-SA
4.0 assets.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from pathlib import Path


ROOT = Path(__file__).parents[1]
DEFAULT_OUTPUT_JSON = ROOT / "data" / "src" / "workout-guide-media.json"
DEFAULT_OUTPUT_JS = ROOT / "data" / "workout-guide-media.js"
DEFAULT_ASSET_ROOT = ROOT / "assets" / "workout-guide"
MANIFEST_RELATIVE = Path("packages/workout-guide/manifest.json")

# The formal action id is deliberately kept next to the source slug so that
# every reuse is reviewable. This is not an automatic name/keyword matcher.
ACTION_SLUGS = {
    "gangling_shendun": "squat",
    "gangling_yingla": "deadlift",
    "yaling_luomaniya": "dumbbell-romanian-deadlift",
    "yaling_jiantui": "seated-dumbbell-press",
    "tun_tui": "hip-thrust",
    "tuntui_hipthrust": "hip-thrust",
    "qixie_xiongtui": "machine-chest-press",
    "gaowei_xiala_kuanwo": "wide-grip-lat-pulldown",
    "diwei_huachuan": "seated-row",
    "fuwoceng": "push-up",
    "huaxueji_wentai": "skierg",
    "huling_baidong": "kettlebell-swing",
    "tui_qushen": "leg-extension",
    "tui_wanju": "seated-leg-curl",
    "pingban_zhi": "plank",
    "tushen_shendun": "bodyweight-squat",
    "gaojiaobei_shendun": "goblet-squat",
    "movement_incline_pushup": "incline-push-up",
    "movement_barbell_overhead_press": "overhead-press",
    "warmup_worlds_greatest_stretch": "worlds-greatest-stretch",
    "warmup_halfkneeling_lunge_hipflexor": "kneeling-hip-flexor-stretch",
    "warmup_single_leg_glute_bridge": "single-leg-glute-bridge",
}


def source_commit(repo: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def load_actions() -> dict:
    return json.loads((ROOT / "data/src/actions.json").read_text(encoding="utf-8"))["actions"]


def load_source_manifest(repo: Path) -> dict[str, dict]:
    rows = json.loads((repo / MANIFEST_RELATIVE).read_text(encoding="utf-8"))
    return {row["slug"]: row for row in rows}


def build_payload(repo: Path) -> dict:
    source = load_source_manifest(repo)
    actions = load_actions()
    missing_actions = sorted(set(ACTION_SLUGS) - set(actions))
    missing_slugs = sorted(set(ACTION_SLUGS.values()) - set(source))
    if missing_actions or missing_slugs:
        raise SystemExit(
            f"mapping invalid: missing formal ids={missing_actions}, source slugs={missing_slugs}"
        )

    assets = []
    for formal_id, slug in ACTION_SLUGS.items():
        row = source[slug]
        attribution = row["attribution"]
        frames = []
        for frame in row["frames"]:
            frame_index = int(frame["index"])
            frames.append(
                {
                    "index": frame_index,
                    "path": f"assets/workout-guide/{slug}/frame-{frame_index}.svg",
                    "width": frame["width"],
                    "height": frame["height"],
                }
            )
        assets.append(
            {
                "formalActionId": formal_id,
                "formalActionName": actions[formal_id]["name"],
                "sourceSlug": slug,
                "sourceName": row["name"],
                "frames": frames,
                "attribution": attribution,
            }
        )

    return {
        "metadata": {
            "repository": "bryllim/workout-guide",
            "sourceCommit": source_commit(repo),
            "sourceManifest": str(MANIFEST_RELATIVE),
            "assetLicense": "CC BY-SA 4.0",
            "codeLicense": "MIT",
            "attribution": [
                {
                    "name": "Bryl Lim",
                    "url": "https://bryllim.com",
                    "role": "Workout Guide artwork",
                },
                {
                    "name": "Everkinetic",
                    "url": "https://github.com/everkinetic/data",
                    "role": "original pose artwork source for part of the set",
                },
            ],
            "policy": "Local SVG frames are copied unchanged. Keep CC BY-SA 4.0 attribution when reusing or adapting them.",
        },
        "assets": assets,
    }


def render_js(payload: dict) -> str:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return f"window.V14_WORKOUT_GUIDE={body};\n"


def copy_assets(repo: Path, payload: dict, asset_root: Path) -> None:
    source = load_source_manifest(repo)
    for item in payload["assets"]:
        slug = item["sourceSlug"]
        source_row = source[slug]
        for frame in source_row["frames"]:
            source_path = repo / "packages/workout-guide" / frame["path"]
            target_path = ROOT / frame_path(item, frame["index"])
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source_path, target_path)


def frame_path(item: dict, frame_index: int) -> str:
    return next(frame["path"] for frame in item["frames"] if frame["index"] == frame_index)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_repo", type=Path, help="checked-out workout-guide repository")
    parser.add_argument("--output-json", type=Path, default=DEFAULT_OUTPUT_JSON)
    parser.add_argument("--output-js", type=Path, default=DEFAULT_OUTPUT_JS)
    parser.add_argument("--check", action="store_true", help="check generated files and local frames")
    args = parser.parse_args()

    repo = args.source_repo.resolve()
    payload = build_payload(repo)
    expected_json = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    expected_js = render_js(payload)

    if args.check:
        try:
            actual_json = args.output_json.read_text(encoding="utf-8")
            actual_js = args.output_js.read_text(encoding="utf-8")
        except FileNotFoundError:
            print("Workout Guide media bundle check: FAIL (generated file missing)")
            return 1
        local_frames = [ROOT / frame["path"] for item in payload["assets"] for frame in item["frames"]]
        ok = actual_json == expected_json and actual_js == expected_js and all(path.is_file() for path in local_frames)
        print("Workout Guide media bundle check: " + ("PASS" if ok else "FAIL"))
        return 0 if ok else 1

    copy_assets(repo, payload, DEFAULT_ASSET_ROOT)
    args.output_json.parent.mkdir(parents=True, exist_ok=True)
    args.output_js.parent.mkdir(parents=True, exist_ok=True)
    args.output_json.write_text(expected_json, encoding="utf-8")
    args.output_js.write_text(expected_js, encoding="utf-8")
    print(f"wrote {args.output_json.relative_to(ROOT)}")
    print(f"wrote {args.output_js.relative_to(ROOT)}")
    print(f"formal mappings: {len(payload['assets'])}")
    print(f"unique source slugs: {len({item['sourceSlug'] for item in payload['assets']})}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
