#!/usr/bin/env python3
"""V14.8 runtime data schema validator."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).parents[1]
SCHEMA_DIR = ROOT / "schemas" / "v14.8"


def load_runtime_data(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    if not match:
        raise ValueError("window.V14_DATA payload missing")
    return json.loads(match.group(1))


def load_schema(name: str) -> dict:
    return json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


def validate_payload(data: dict) -> list[str]:
    # Cross-record and JSON Schema checks are added in the next TDD step.
    return []


def validate_repository(root: Path = ROOT) -> list[str]:
    data = load_runtime_data(root / "data" / "system-data.js")
    return validate_payload(data)


def main() -> int:
    errors = validate_repository(ROOT)
    if errors:
        print("V14.8 schema validation: FAIL")
        for error in errors:
            print(f"- {error}")
        return 1
    print("V14.8 schema validation: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
