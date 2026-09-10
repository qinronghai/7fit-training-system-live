#!/usr/bin/env python3
"""Build the generated V14 runtime bundle from domain JSON sources."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).parents[1]
DEFAULT_SRC = ROOT / "data" / "src"
DEFAULT_BUNDLE = ROOT / "data" / "system-data.js"
REQUIRED_SOURCE_FILES = (
    "actions.json",
    "patterns.json",
    "sessions.json",
    "templates.json",
    "support.json",
    "core.json",
    "prep.json",
    "foam.json",
    "composer.json",
    "venue.json",
    "system.json",
)
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")


class SourceContractError(ValueError):
    """Raised when split-source ownership or shape is invalid."""


def _reject_duplicate_json_keys(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise SourceContractError(f"duplicate JSON key: {key}")
        value[key] = item
    return value


def _load_json_object(path: Path) -> dict:
    try:
        value = json.loads(
            path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_json_keys,
        )
    except FileNotFoundError as exc:
        raise SourceContractError(f"missing source file: {path.name}") from exc
    except json.JSONDecodeError as exc:
        raise SourceContractError(f"invalid JSON in {path.name}: {exc}") from exc
    if not isinstance(value, dict):
        raise SourceContractError(f"{path.name} must contain a JSON object")
    return value


def load_manifest(src_dir: Path = DEFAULT_SRC) -> dict:
    manifest = _load_json_object(src_dir / "manifest.json")
    if manifest.get("formatVersion") != 1:
        raise SourceContractError("manifest formatVersion must be 1")

    source_files = manifest.get("sourceFiles")
    if source_files != list(REQUIRED_SOURCE_FILES):
        raise SourceContractError(
            "manifest sourceFiles must equal the formal ordered domain file list"
        )
    if len(source_files) != len(set(source_files)):
        raise SourceContractError("manifest sourceFiles contains duplicates")

    owners = manifest.get("owners")
    if not isinstance(owners, dict) or not owners:
        raise SourceContractError("manifest owners must be a non-empty object")
    unknown_owner_files = sorted(set(owners.values()) - set(source_files))
    if unknown_owner_files:
        raise SourceContractError(
            f"manifest owners reference unknown source files: {unknown_owner_files}"
        )

    top_level_order = manifest.get("topLevelOrder")
    if not isinstance(top_level_order, list) or not top_level_order:
        raise SourceContractError("manifest topLevelOrder must be a non-empty array")
    if len(top_level_order) != len(set(top_level_order)):
        raise SourceContractError("manifest topLevelOrder contains duplicates")
    if set(top_level_order) != set(owners):
        missing = sorted(set(owners) - set(top_level_order))
        extra = sorted(set(top_level_order) - set(owners))
        raise SourceContractError(
            f"manifest topLevelOrder/owners mismatch: missing={missing}; extra={extra}"
        )

    baseline_hash = manifest.get("baselinePayloadSha256")
    if not isinstance(baseline_hash, str) or not SHA256_RE.fullmatch(baseline_hash):
        raise SourceContractError("manifest baselinePayloadSha256 must be 64 lowercase hex chars")
    return manifest


def load_fragments(src_dir: Path, manifest: dict) -> dict[str, dict]:
    owners = manifest["owners"]
    fragments: dict[str, dict] = {}
    seen: dict[str, str] = {}

    for filename in manifest["sourceFiles"]:
        fragment = _load_json_object(src_dir / filename)
        fragments[filename] = fragment
        for key in fragment:
            if key in seen:
                raise SourceContractError(
                    f"Duplicate top-level key: {key}; owned by {seen[key]}; also found in {filename}"
                )
            seen[key] = filename
            if key not in owners:
                raise SourceContractError(f"undeclared top-level key: {key} in {filename}")
            if owners[key] != filename:
                raise SourceContractError(
                    f"owner mismatch for {key}: manifest={owners[key]}, actual={filename}"
                )

    missing = sorted(set(owners) - set(seen))
    if missing:
        raise SourceContractError(f"declared top-level keys missing from fragments: {missing}")
    return fragments


def build_payload(src_dir: Path = DEFAULT_SRC) -> dict:
    manifest = load_manifest(src_dir)
    fragments = load_fragments(src_dir, manifest)
    values: dict = {}
    for filename in manifest["sourceFiles"]:
        values.update(fragments[filename])
    return {key: values[key] for key in manifest["topLevelOrder"]}


def render_bundle(payload: dict) -> str:
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    return f"window.V14_DATA={body};\n"


def check_bundle(src_dir: Path = DEFAULT_SRC, bundle_path: Path = DEFAULT_BUNDLE) -> bool:
    expected = render_bundle(build_payload(src_dir))
    try:
        actual = bundle_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return False
    return actual == expected


def write_bundle(src_dir: Path = DEFAULT_SRC, bundle_path: Path = DEFAULT_BUNDLE) -> None:
    bundle_path.write_text(render_bundle(build_payload(src_dir)), encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if generated bundle is stale")
    args = parser.parse_args(argv)

    try:
        if args.check:
            if not check_bundle(DEFAULT_SRC, DEFAULT_BUNDLE):
                print("system-data.js is stale; run: python tools/build_system_data.py", file=sys.stderr)
                return 1
            print("system-data.js build check: PASS")
            return 0
        write_bundle(DEFAULT_SRC, DEFAULT_BUNDLE)
        print(f"wrote {DEFAULT_BUNDLE.relative_to(ROOT)}")
        return 0
    except SourceContractError as exc:
        print(f"system data source contract: FAIL: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
