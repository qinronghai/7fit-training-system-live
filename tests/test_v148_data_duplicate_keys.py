import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[1]
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


def load_builder_module():
    spec = importlib.util.spec_from_file_location("build_system_data_duplicate_keys", BUILDER)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_builder_rejects_duplicate_json_key_inside_one_fragment(tmp_path):
    builder = load_builder_module()
    src = tmp_path / "src"
    src.mkdir()
    for name in DOMAIN_FILES:
        (src / name).write_text("{}", encoding="utf-8")

    # Python's default json.loads silently keeps the second value. The builder
    # must reject this instead of allowing last-write-wins inside one source file.
    (src / "actions.json").write_text('{"x":1,"x":2}', encoding="utf-8")
    manifest = {
        "formatVersion": 1,
        "sourceFiles": list(DOMAIN_FILES),
        "owners": {"x": "actions.json"},
        "topLevelOrder": ["x"],
        "baselinePayloadSha256": "0" * 64,
    }
    (src / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    with pytest.raises(builder.SourceContractError, match="duplicate JSON key: x"):
        builder.build_payload(src)
