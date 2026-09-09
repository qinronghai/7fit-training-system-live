#!/usr/bin/env python3
"""V14.8 runtime data schema and cross-record validator."""

import json
import re
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).parents[1]
SCHEMA_DIR = ROOT / "schemas" / "v14.8"
FORMAL_SLOT_SUFFIXES = {"A", "B", "SUPPORT", "2", "3", "CORE"}
FORMAL_ROUTES = {"1F_ONLY", "FLEX_1F_2F"}
SESSION_ID_RE = re.compile(r"^F111-\d{2}-L[1-4]$")


def load_runtime_data(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    if not match:
        raise ValueError("window.V14_DATA payload missing")
    return json.loads(match.group(1))


def load_schema(name: str) -> dict:
    return json.loads((SCHEMA_DIR / f"{name}.schema.json").read_text(encoding="utf-8"))


def _path(parts) -> str:
    return ".".join(str(part) for part in parts)


def _schema_errors(instance, schema_name: str, prefix: str) -> list[str]:
    validator = Draft202012Validator(load_schema(schema_name))
    errors = []
    for error in sorted(validator.iter_errors(instance), key=lambda item: list(item.absolute_path)):
        suffix = _path(error.absolute_path)
        location = f"{prefix}.{suffix}" if suffix else prefix
        errors.append(f"{location}: {error.message}")
    return errors


def _check_action_refs(errors: list[str], actions: dict, ids, prefix: str) -> None:
    for action_id in ids or []:
        if action_id not in actions:
            errors.append(f"{prefix}: unknown action {action_id}")


def _flatten_match_ids(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]
    if isinstance(value, dict):
        out = []
        for nested in value.values():
            out.extend(_flatten_match_ids(nested))
        return out
    return []


def _session_slot_suffix(session_key: str, slot_key) -> str | None:
    if not isinstance(slot_key, str):
        return None
    prefix = f"{session_key}__"
    if not slot_key.startswith(prefix):
        return None
    return slot_key[len(prefix):]


def validate_payload(data: dict) -> list[str]:
    errors: list[str] = []
    actions = data.get("actions", {})
    sessions = data.get("sessions", {})
    composer = data.get("composer", {})

    # JSON Schema contracts.
    for action_key, action in sorted(actions.items()):
        errors.extend(_schema_errors(action, "action", f"actions.{action_key}"))
        if action.get("id") != action_key:
            errors.append(f"actions.{action_key}.id: map key must equal action id {action_key}")

    for session_key, session in sorted(sessions.items()):
        errors.extend(_schema_errors(session, "session", f"sessions.{session_key}"))

    errors.extend(_schema_errors(composer, "composer", "composer"))
    errors.extend(
        _schema_errors(
            {"ids": data.get("supportIds", []), "details": data.get("supportDetails", {})},
            "support",
            "support",
        )
    )
    errors.extend(
        _schema_errors(
            {"ids": data.get("coreIds", []), "details": data.get("coreDetails", {})},
            "core",
            "core",
        )
    )
    errors.extend(
        _schema_errors(
            {
                "ids": data.get("warmupIds", []),
                "details": data.get("warmupDetails", {}),
                "matchByPattern": data.get("warmupMatchByPattern", {}),
            },
            "prep",
            "prep",
        )
    )
    errors.extend(
        _schema_errors(
            {
                "ids": data.get("foamRollIds", []),
                "details": data.get("foamRollDetails", {}),
                "matchByPattern": data.get("foamRollMatchByPattern", {}),
            },
            "foam",
            "foam",
        )
    )

    # Frozen inventory that defines the V14.8 contract surface.
    expected_counts = {
        "sessions": (sessions, 32),
        "recipeIds": (data.get("recipeIds", []), 8),
        "supportIds": (data.get("supportIds", []), 30),
        "coreIds": (data.get("coreIds", []), 20),
        "warmupIds": (data.get("warmupIds", []), 20),
        "foamRollIds": (data.get("foamRollIds", []), 12),
    }
    for name, (collection, expected) in expected_counts.items():
        if len(collection) != expected:
            errors.append(f"{name}: expected {expected}, got {len(collection)}")

    # Session identity, exact slot set, references and venue route legality.
    for session_key, session in sorted(sessions.items()):
        if not SESSION_ID_RE.match(session_key):
            errors.append(f"sessions.{session_key}: invalid session id")
        if session.get("sessionId") != session_key:
            errors.append(f"sessions.{session_key}.sessionId: must equal map key {session_key}")
        slots = session.get("slots", [])
        slot_suffixes = []
        for index, slot in enumerate(slots):
            slot_key = slot.get("slotKey") if isinstance(slot, dict) else None
            suffix = _session_slot_suffix(session_key, slot_key)
            if suffix is None:
                errors.append(
                    f"sessions.{session_key}.slots.{index}.slotKey: must belong to {session_key}, got {slot_key}"
                )
            else:
                slot_suffixes.append(suffix)
                if suffix not in FORMAL_SLOT_SUFFIXES:
                    errors.append(
                        f"sessions.{session_key}.slots.{index}.slotKey: unknown formal slot suffix {suffix}"
                    )

            action_id = slot.get("baselineId") if isinstance(slot, dict) else None
            if not action_id or action_id not in actions:
                errors.append(
                    f"sessions.{session_key}.slots.{index}.baselineId: unknown action {action_id}"
                )
                continue
            route = actions[action_id].get("route")
            if route not in FORMAL_ROUTES:
                errors.append(
                    f"sessions.{session_key}.slots.{index}.baselineId: action {action_id} route {route} is not a formal F111 route"
                )

        if set(slot_suffixes) != FORMAL_SLOT_SUFFIXES or len(slot_suffixes) != len(FORMAL_SLOT_SUFFIXES):
            errors.append(
                f"sessions.{session_key}.slots: must contain exactly A/B/SUPPORT/2/3/CORE for this session"
            )

    # SUPPORT / CORE identity and detail coverage.
    for label, ids_key, details_key in (
        ("support", "supportIds", "supportDetails"),
        ("core", "coreIds", "coreDetails"),
    ):
        ids = data.get(ids_key, [])
        if len(ids) != len(set(ids)):
            errors.append(f"{ids_key}: duplicate IDs are not allowed")
        _check_action_refs(errors, actions, ids, ids_key)
        details = data.get(details_key, {})
        for action_id in ids:
            if action_id not in details:
                errors.append(f"{details_key}: missing details for {action_id}")

    # Composer action references and frozen D1/D2 auxiliary route policy from Issue #5.
    lower_modes = composer.get("lowerModes", {})
    upper_modes = composer.get("upperModes", {})
    for group_name, modes in (("lowerModes", lower_modes), ("upperModes", upper_modes)):
        for mode_key, mode in modes.items():
            ids = mode.get("ids", []) if isinstance(mode, dict) else []
            _check_action_refs(errors, actions, ids, f"composer.{group_name}.{mode_key}.ids")

    auxiliary_rules = composer.get("auxiliaryRules", {})
    for kind, pools in auxiliary_rules.items():
        if not isinstance(pools, dict):
            continue
        for mode_key, ids in pools.items():
            _check_action_refs(errors, actions, ids, f"composer.auxiliaryRules.{kind}.{mode_key}")
            for action_id in ids:
                if action_id in actions and actions[action_id].get("route") != "1F_ONLY":
                    errors.append(
                        f"composer auxiliary {action_id}: D1/D2 auxiliary route must be 1F_ONLY, got {actions[action_id].get('route')}"
                    )

    preset_map = composer.get("officialPresetMap", {})
    for preset_id, preset in preset_map.items():
        if not isinstance(preset, dict):
            errors.append(f"composer.officialPresetMap.{preset_id}: preset must be an object")
            continue
        lower = preset.get("lowerMode")
        upper = preset.get("upperMode")
        if lower not in lower_modes:
            errors.append(f"composer.officialPresetMap.{preset_id}.lowerMode: unknown mode {lower}")
        if upper not in upper_modes:
            errors.append(f"composer.officialPresetMap.{preset_id}.upperMode: unknown mode {upper}")

    # PREP / Foam identity, details, action references and pattern mapping references.
    for label, ids_key, details_key, match_key, id_field in (
        ("prep", "warmupIds", "warmupDetails", "warmupMatchByPattern", "prepId"),
        ("foam", "foamRollIds", "foamRollDetails", "foamRollMatchByPattern", "foamId"),
    ):
        ids = data.get(ids_key, [])
        details = data.get(details_key, {})
        if len(ids) != len(set(ids)):
            errors.append(f"{ids_key}: duplicate IDs are not allowed")
        for item_id in ids:
            detail = details.get(item_id)
            if detail is None:
                errors.append(f"{details_key}: missing details for {item_id}")
                continue
            if detail.get(id_field) != item_id:
                errors.append(f"{details_key}.{item_id}.{id_field}: must equal map key {item_id}")
            action_id = detail.get("actionId")
            if action_id and action_id not in actions:
                errors.append(f"{details_key}.{item_id}.actionId: unknown action {action_id}")
        known_ids = set(ids)
        for pattern, value in data.get(match_key, {}).items():
            for item_id in _flatten_match_ids(value):
                if item_id not in known_ids:
                    errors.append(f"{match_key}.{pattern}: unknown {label} id {item_id}")

    return sorted(set(errors))


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
