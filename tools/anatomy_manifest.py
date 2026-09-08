#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "system-data.js"
OUT = ROOT / "docs" / "V14.5-PHASE-A-MANIFEST.json"


def load_v14_data():
    text = SOURCE.read_text(encoding="utf-8")
    match = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    if not match:
        raise RuntimeError("window.V14_DATA payload not found")
    return json.loads(match.group(1))


def build_manifest(data):
    session_ids = {
        slot["baselineId"]
        for session in data["sessions"].values()
        for slot in session["slots"]
    }
    pattern_ids = {
        action_id
        for chain in data["eightPatterns"].values()
        for action_id in chain
    }
    support_ids = set(data["supportIds"])
    core_ids = set(data["coreIds"])
    prep_ids = {x["actionId"] for x in data["warmupDetails"].values()}
    foam_ids = {x["actionId"] for x in data["foamRollDetails"].values()}

    phase_a = session_ids | pattern_ids | support_ids | core_ids | prep_ids | foam_ids
    strength_ids = (session_ids | pattern_ids) - (
        support_ids | core_ids | prep_ids | foam_ids
    )

    if len(phase_a) != 120:
        raise AssertionError(f"Phase A expected 120 unique nodes, got {len(phase_a)}")
    if len(strength_ids) != 40:
        raise AssertionError(f"Strength group expected 40 unique nodes, got {len(strength_ids)}")

    return {
        "expected": 120,
        "ids": sorted(phase_a),
        "groups": {
            "strength": sorted(strength_ids),
            "support": sorted(support_ids),
            "core": sorted(core_ids),
            "prep": sorted(prep_ids),
            "foam": sorted(foam_ids),
        },
        "overlaps": {
            "prepSupport": sorted(prep_ids & support_ids),
            "prepCore": sorted(prep_ids & core_ids),
        },
    }


def main():
    manifest = build_manifest(load_v14_data())
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Phase A manifest frozen: {len(manifest['ids'])} unique nodes; "
        f"strength={len(manifest['groups']['strength'])}, "
        f"support={len(manifest['groups']['support'])}, "
        f"core={len(manifest['groups']['core'])}, "
        f"prep={len(manifest['groups']['prep'])}, "
        f"foam={len(manifest['groups']['foam'])}"
    )


if __name__ == "__main__":
    main()
