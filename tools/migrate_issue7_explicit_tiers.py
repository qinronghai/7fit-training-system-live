#!/usr/bin/env python3
"""One-time Issue #7 migration: positional ids[] -> explicit candidates[{id,tier}]."""

import json
from pathlib import Path

ROOT = Path(__file__).parents[1]
PATH = ROOT / "data" / "src" / "composer.json"
TIERS = ["T1", "T2", "T3", "T4"]


def migrate_mode(group_name: str, mode_key: str, mode: dict) -> None:
    if "candidates" in mode:
        candidates = mode["candidates"]
        if len(candidates) != 4:
            raise ValueError(f"{group_name}.{mode_key}: expected 4 candidates")
        return
    ids = mode.get("ids")
    if not isinstance(ids, list) or len(ids) != 4:
        raise ValueError(f"{group_name}.{mode_key}: expected exactly 4 legacy ids")
    mode["candidates"] = [
        {"id": action_id, "tier": tier}
        for action_id, tier in zip(ids, TIERS, strict=True)
    ]
    del mode["ids"]


def main() -> int:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    composer = data["composer"]
    for group_name in ("lowerModes", "upperModes"):
        modes = composer[group_name]
        for mode_key, mode in modes.items():
            migrate_mode(group_name, mode_key, mode)
    PATH.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("Issue #7 composer candidate migration: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
