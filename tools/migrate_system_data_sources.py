#!/usr/bin/env python3
"""One-time mechanical migration from data/system-data.js to data/src domains."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

from build_system_data import REQUIRED_SOURCE_FILES, build_payload, render_bundle

ROOT = Path(__file__).parents[1]
BUNDLE = ROOT / "data" / "system-data.js"
SRC = ROOT / "data" / "src"

OWNERS_BY_FILE = {
    "actions.json": (
        "actions",
        "actionDetails",
    ),
    "patterns.json": (
        "eightPatterns",
        "eightPatternDetails",
        "tenPatternCatalog",
        "singleLegBranches",
        "singleLegHingeIds",
    ),
    "sessions.json": (
        "sessions",
        "sessionViews",
        "recipeIds",
        "recipes",
    ),
    "support.json": (
        "supportIds",
        "supportDetails",
    ),
    "core.json": (
        "coreIds",
        "coreDetails",
    ),
    "prep.json": (
        "warmupIds",
        "warmupDetails",
        "warmupMatchByPattern",
        "warmupGradeMeta",
    ),
    "foam.json": (
        "foamRollIds",
        "foamRollDetails",
        "foamRollMatchByPattern",
    ),
    "composer.json": (
        "composer",
    ),
    "venue.json": (),
    "system.json": (
        "meta",
        "maintenanceCounts",
        "legacyHtml",
    ),
}


def load_bundle(path: Path = BUNDLE) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    if not match:
        raise ValueError("window.V14_DATA payload missing")
    value = json.loads(match.group(1))
    if not isinstance(value, dict):
        raise ValueError("window.V14_DATA must be an object")
    return value


def semantic_sha256(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def validate_ownership(runtime: dict) -> dict[str, str]:
    if tuple(OWNERS_BY_FILE) != REQUIRED_SOURCE_FILES:
        raise ValueError("migration domain file order differs from builder contract")

    owners: dict[str, str] = {}
    for filename, keys in OWNERS_BY_FILE.items():
        for key in keys:
            if key in owners:
                raise ValueError(f"duplicate migration owner for {key}: {owners[key]} and {filename}")
            owners[key] = filename

    runtime_keys = set(runtime)
    owner_keys = set(owners)
    missing_owner = sorted(runtime_keys - owner_keys)
    stale_owner = sorted(owner_keys - runtime_keys)
    if missing_owner or stale_owner:
        raise ValueError(
            f"ownership/runtime mismatch: unclassified={missing_owner}; absent_from_runtime={stale_owner}"
        )
    return owners


def write_json(path: Path, value) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def migrate() -> None:
    runtime = load_bundle()
    owners = validate_ownership(runtime)
    baseline_hash = semantic_sha256(runtime)
    original_bundle = BUNDLE.read_text(encoding="utf-8")

    SRC.mkdir(parents=True, exist_ok=True)
    for filename in REQUIRED_SOURCE_FILES:
        fragment = {
            key: runtime[key]
            for key in runtime
            if owners[key] == filename
        }
        write_json(SRC / filename, fragment)

    manifest = {
        "formatVersion": 1,
        "sourceFiles": list(REQUIRED_SOURCE_FILES),
        "owners": {key: owners[key] for key in runtime},
        "topLevelOrder": list(runtime),
        "baselinePayloadSha256": baseline_hash,
    }
    write_json(SRC / "manifest.json", manifest)

    rebuilt = build_payload(SRC)
    if rebuilt != runtime:
        raise ValueError("semantic parity failed after domain split")
    if semantic_sha256(rebuilt) != baseline_hash:
        raise ValueError("semantic hash changed after domain split")

    rendered = render_bundle(rebuilt)
    BUNDLE.write_text(rendered, encoding="utf-8")

    print(f"migration semantic parity: PASS ({len(runtime)} top-level keys)")
    print(f"baselinePayloadSha256={baseline_hash}")
    print(f"runtime byte parity before canonical write: {rendered == original_bundle}")
    for filename in REQUIRED_SOURCE_FILES:
        fragment = json.loads((SRC / filename).read_text(encoding="utf-8"))
        print(f"{filename}: {len(fragment)} top-level keys")


if __name__ == "__main__":
    migrate()
