import importlib.util
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]
DATA = ROOT / "data" / "system-data.js"
SRC = ROOT / "data" / "src"
BUILDER = ROOT / "tools" / "build_system_data.py"
SCHEMA_WORKFLOW = ROOT / ".github" / "workflows" / "schema-check.yml"
PAGES_WORKFLOW = ROOT / ".github" / "workflows" / "deploy-pages.yml"

DOMAIN_FILES = (
    "actions.json",
    "patterns.json",
    "sessions.json",
    "templates.json",
    "body.json",
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


def write_json(path: Path, value) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")


def load_builder_module():
    assert BUILDER.is_file(), "tools/build_system_data.py missing"
    spec = importlib.util.spec_from_file_location("build_system_data", BUILDER)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def make_source_contract(tmp_path: Path, *, owners, fragments, order=None) -> Path:
    src = tmp_path / "src"
    src.mkdir()
    for name in DOMAIN_FILES:
        value = fragments.get(name, {})
        write_json(src / name, value)
    manifest = {
        "formatVersion": 1,
        "sourceFiles": list(DOMAIN_FILES),
        "owners": owners,
        "topLevelOrder": order if order is not None else list(owners),
        "baselinePayloadSha256": "0" * 64,
    }
    write_json(src / "manifest.json", manifest)
    return src


def test_domain_source_contract_exists():
    runtime = load_runtime_data()
    assert SRC.is_dir(), f"data/src missing; current V14_DATA top-level keys={sorted(runtime)}"
    assert (SRC / "manifest.json").is_file(), "data/src/manifest.json missing"
    for name in DOMAIN_FILES:
        assert (SRC / name).is_file(), f"missing domain source: {name}"


def test_manifest_owns_exact_runtime_top_level_inventory_and_order():
    runtime = load_runtime_data()
    assert (SRC / "manifest.json").is_file(), "manifest missing"
    manifest = load_json(SRC / "manifest.json")
    owners = manifest["owners"]
    assert set(owners) == set(runtime), (
        f"manifest/runtime key mismatch: missing={sorted(set(runtime) - set(owners))}; "
        f"extra={sorted(set(owners) - set(runtime))}"
    )
    assert manifest["topLevelOrder"] == list(runtime), "top-level runtime key order changed"
    assert manifest["sourceFiles"] == list(DOMAIN_FILES)
    assert set(owners.values()).issubset(set(DOMAIN_FILES))
    assert re.fullmatch(r"[0-9a-f]{64}", manifest["baselinePayloadSha256"]), (
        "baselinePayloadSha256 must remain a migration provenance hash"
    )


def test_fragments_have_unique_declared_ownership_and_assemble_runtime():
    runtime = load_runtime_data()
    manifest = load_json(SRC / "manifest.json")
    owners = manifest["owners"]
    values = {}
    seen = {}

    for filename in manifest["sourceFiles"]:
        fragment = load_json(SRC / filename)
        assert isinstance(fragment, dict), f"{filename} must contain a JSON object"
        for key, value in fragment.items():
            assert key not in seen, f"duplicate top-level key {key}: {seen.get(key)} and {filename}"
            seen[key] = filename
            assert owners.get(key) == filename, f"{key} owner mismatch: {owners.get(key)} != {filename}"
            values[key] = value

    assert set(seen) == set(owners), (
        f"fragment/manifest mismatch: missing={sorted(set(owners) - set(seen))}; "
        f"extra={sorted(set(seen) - set(owners))}"
    )
    assembled = {key: values[key] for key in manifest["topLevelOrder"]}
    assert list(assembled) == list(runtime)
    assert assembled == runtime


def test_builder_api_and_check_mode_contract():
    builder = load_builder_module()
    payload = builder.build_payload(SRC)
    assert builder.render_bundle(payload) == builder.render_bundle(builder.build_payload(SRC))
    assert builder.check_bundle(SRC, DATA) is True


def test_builder_rejects_duplicate_physical_top_level_key(tmp_path):
    builder = load_builder_module()
    src = make_source_contract(
        tmp_path,
        owners={"x": "actions.json"},
        fragments={"actions.json": {"x": 1}, "patterns.json": {"x": 1}},
    )
    with pytest.raises(builder.SourceContractError, match="Duplicate top-level key"):
        builder.build_payload(src)


def test_builder_rejects_undeclared_top_level_key(tmp_path):
    builder = load_builder_module()
    src = make_source_contract(
        tmp_path,
        owners={"x": "actions.json"},
        fragments={"actions.json": {"x": 1, "y": 2}},
    )
    with pytest.raises(builder.SourceContractError, match="undeclared top-level key: y"):
        builder.build_payload(src)


def test_builder_rejects_declared_but_missing_top_level_key(tmp_path):
    builder = load_builder_module()
    src = make_source_contract(
        tmp_path,
        owners={"x": "actions.json", "y": "patterns.json"},
        fragments={"actions.json": {"x": 1}},
    )
    with pytest.raises(builder.SourceContractError, match="declared top-level keys missing"):
        builder.build_payload(src)


def test_builder_rejects_non_object_fragment(tmp_path):
    builder = load_builder_module()
    src = make_source_contract(
        tmp_path,
        owners={"x": "actions.json"},
        fragments={"actions.json": {"x": 1}},
    )
    write_json(src / "patterns.json", ["not", "an", "object"])
    with pytest.raises(builder.SourceContractError, match="patterns.json must contain a JSON object"):
        builder.build_payload(src)


def test_builder_preserves_manifest_top_level_order(tmp_path):
    builder = load_builder_module()
    src = make_source_contract(
        tmp_path,
        owners={"second": "patterns.json", "first": "actions.json"},
        fragments={"actions.json": {"first": 1}, "patterns.json": {"second": 2}},
        order=["first", "second"],
    )
    payload = builder.build_payload(src)
    assert list(payload) == ["first", "second"]


def test_builder_detects_stale_bundle(tmp_path):
    builder = load_builder_module()
    src = make_source_contract(
        tmp_path,
        owners={"x": "actions.json"},
        fragments={"actions.json": {"x": 1}},
    )
    bundle = tmp_path / "system-data.js"
    bundle.write_text("window.V14_DATA={\"x\":2};\n", encoding="utf-8")
    assert builder.check_bundle(src, bundle) is False


def test_builder_render_is_deterministic(tmp_path):
    builder = load_builder_module()
    src = make_source_contract(
        tmp_path,
        owners={"x": "actions.json", "y": "patterns.json"},
        fragments={"actions.json": {"x": {"中文": 1}}, "patterns.json": {"y": [1, 2, 3]}},
    )
    first = builder.render_bundle(builder.build_payload(src))
    second = builder.render_bundle(builder.build_payload(src))
    assert first == second


@pytest.mark.parametrize("workflow", [SCHEMA_WORKFLOW, PAGES_WORKFLOW])
def test_ci_runs_build_check_before_schema_validation(workflow):
    text = workflow.read_text(encoding="utf-8")
    build_check = "python tools/build_system_data.py --check"
    schema_check = "python tools/validate_v148_schema.py"
    assert build_check in text, f"{workflow.name} does not enforce generated bundle freshness"
    assert schema_check in text
    assert text.index(build_check) < text.index(schema_check), (
        f"{workflow.name} must run build --check before schema validation"
    )
