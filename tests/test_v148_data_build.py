import hashlib
import importlib.util
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]
DATA = ROOT / "data" / "system-data.js"
SRC = ROOT / "data" / "src"
BUILDER = ROOT / "tools" / "build_system_data.py"

DOMAIN_FILES = (
    "actions.json",
    "patterns.json",
    "sessions.json",
    "support.json",
    "core.json",
    "prep.json",
    "foam.json",
    "composer.json",
    "venue.json",
    "system.json",
)


def load_runtime_data(path: Path = DATA) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    assert match, "window.V14_DATA payload missing"
    return json.loads(match.group(1))


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def semantic_sha256(payload: dict) -> str:
    canonical = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def load_builder_module():
    assert BUILDER.is_file(), "tools/build_system_data.py missing"
    spec = importlib.util.spec_from_file_location("build_system_data", BUILDER)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_domain_source_contract_exists():
    runtime = load_runtime_data()
    assert SRC.is_dir(), f"data/src missing; current V14_DATA top-level keys={sorted(runtime)}"
    assert (SRC / "manifest.json").is_file(), "data/src/manifest.json missing"
    for name in DOMAIN_FILES:
        assert (SRC / name).is_file(), f"missing domain source: {name}"


def test_manifest_owns_exact_runtime_top_level_inventory():
    runtime = load_runtime_data()
    assert (SRC / "manifest.json").is_file(), "manifest missing"
    manifest = load_json(SRC / "manifest.json")
    owners = manifest["owners"]
    assert set(owners) == set(runtime), (
        f"manifest/runtime key mismatch: missing={sorted(set(runtime) - set(owners))}; "
        f"extra={sorted(set(owners) - set(runtime))}"
    )
    assert manifest["sourceFiles"] == list(DOMAIN_FILES)
    assert set(owners.values()).issubset(set(DOMAIN_FILES))


def test_fragments_have_unique_declared_ownership_and_assemble_runtime():
    runtime = load_runtime_data()
    manifest = load_json(SRC / "manifest.json")
    owners = manifest["owners"]
    assembled = {}
    seen = {}

    for filename in manifest["sourceFiles"]:
        fragment = load_json(SRC / filename)
        assert isinstance(fragment, dict), f"{filename} must contain a JSON object"
        for key, value in fragment.items():
            assert key not in seen, f"duplicate top-level key {key}: {seen.get(key)} and {filename}"
            seen[key] = filename
            assert owners.get(key) == filename, f"{key} owner mismatch: {owners.get(key)} != {filename}"
            assembled[key] = value

    assert set(seen) == set(owners), (
        f"fragment/manifest mismatch: missing={sorted(set(owners) - set(seen))}; "
        f"extra={sorted(set(seen) - set(owners))}"
    )
    assert assembled == runtime
    assert semantic_sha256(assembled) == manifest["baselinePayloadSha256"]


def test_builder_api_and_check_mode_contract():
    builder = load_builder_module()
    payload = builder.build_payload(SRC)
    assert builder.render_bundle(payload) == builder.render_bundle(builder.build_payload(SRC))
    assert builder.check_bundle(SRC, DATA) is True
