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
MAIN_TIERS = {"T1", "T2", "T3", "T4"}
SESSION_ID_RE = re.compile(r"^F111-\d{2}-L[1-4]$")
AUXILIARY_EQUIPMENT_CLASSES = {
    "fixed_machine",
    "cable_station",
    "free_weight",
    "bodyweight",
    "other",
}
CONTENT_REVIEW_FIELDS = ["source", "evidenceLevel", "reviewStatus", "reviewedAt", "reviewerNote"]
CONTENT_REVIEW_STATUSES = {"reviewed", "pending", "experimental"}
CONTENT_REVIEW_EVIDENCE_LEVELS = {"internal_curated", "source_referenced", "not_assessed"}
CONTENT_REVIEW_DOMAINS = {
    "actions": "actions",
    "actionDetails": "actionDetails",
    "sessions": "sessions",
    "bodyFamilies": "bodyFamilies",
    "conditioningFamilies": "conditioningFamilies",
    "conditioningProtocols": "conditioningProtocols",
    "hyroxSessionTypes": "hyroxSessionTypes",
    "hyroxStations": "hyroxStations",
    "hyroxBenchmarkProtocols": "hyroxBenchmarkProtocols",
    "support": "supportDetails",
    "core": "coreDetails",
    "prep": "warmupDetails",
    "foam": "foamRollDetails",
    "templates": "templateRegistry",
    "anatomy": "records",
}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def load_runtime_data(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    if not match:
        raise ValueError("window.V14_DATA payload missing")
    return json.loads(match.group(1))


def load_anatomy_data(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.V14_ANATOMY\s*=\s*(\{.*\});\s*$", text, re.S)
    if not match:
        raise ValueError("window.V14_ANATOMY payload missing")
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


def _content_review_sources(data: dict, anatomy: dict | None = None) -> dict[str, dict]:
    sources = {domain: data.get(key, {}) for domain, key in CONTENT_REVIEW_DOMAINS.items()}
    if anatomy is not None:
        sources["anatomy"] = anatomy.get("records", {})
    return {domain: source if isinstance(source, dict) else {} for domain, source in sources.items()}


def _validate_review_metadata(errors: list[str], metadata, prefix: str, statuses, evidence_levels) -> None:
    if not isinstance(metadata, dict):
        errors.append(f"{prefix}: metadata must be an object")
        return
    for field in CONTENT_REVIEW_FIELDS:
        if field not in metadata:
            errors.append(f"{prefix}: missing required field {field}")
    source = metadata.get("source")
    if not isinstance(source, str) or not source.strip():
        errors.append(f"{prefix}.source: must be a non-empty string")
    if metadata.get("evidenceLevel") not in evidence_levels:
        errors.append(f"{prefix}.evidenceLevel: unknown level {metadata.get('evidenceLevel')!r}")
    status = metadata.get("reviewStatus")
    if status not in statuses:
        errors.append(f"{prefix}.reviewStatus: unknown status {status!r}")
    reviewed_at = metadata.get("reviewedAt")
    if reviewed_at is not None and (not isinstance(reviewed_at, str) or not DATE_RE.fullmatch(reviewed_at)):
        errors.append(f"{prefix}.reviewedAt: must be null or YYYY-MM-DD")
    if status == "reviewed" and reviewed_at is None:
        errors.append(f"{prefix}.reviewedAt: reviewed content must have a review date")
    note = metadata.get("reviewerNote")
    if not isinstance(note, str) or not note.strip():
        errors.append(f"{prefix}.reviewerNote: must be a non-empty string")


def validate_content_review(data: dict, anatomy: dict | None = None) -> list[str]:
    errors: list[str] = []
    contract = data.get("contentReview")
    if not isinstance(contract, dict):
        return ["contentReview: required metadata contract is missing"]
    if contract.get("schemaVersion") != 1:
        errors.append("contentReview.schemaVersion: must be 1")

    statuses = contract.get("statusValues")
    if not isinstance(statuses, list) or set(statuses) != CONTENT_REVIEW_STATUSES:
        errors.append("contentReview.statusValues: must contain reviewed, pending, experimental")
        statuses = list(CONTENT_REVIEW_STATUSES)
    evidence_levels = contract.get("evidenceLevels")
    if not isinstance(evidence_levels, list) or set(evidence_levels) != CONTENT_REVIEW_EVIDENCE_LEVELS:
        errors.append("contentReview.evidenceLevels: must contain internal_curated, source_referenced, not_assessed")
        evidence_levels = list(CONTENT_REVIEW_EVIDENCE_LEVELS)
    if contract.get("requiredFields") != CONTENT_REVIEW_FIELDS:
        errors.append("contentReview.requiredFields: must declare the minimum five metadata fields in order")

    domains = contract.get("requiredDomains")
    if not isinstance(domains, list) or len(domains) != len(set(domains)) or not domains:
        errors.append("contentReview.requiredDomains: must be a non-empty unique list")
        domains = []
    unknown_domains = sorted(set(domains) - set(CONTENT_REVIEW_DOMAINS))
    if unknown_domains:
        errors.append(f"contentReview.requiredDomains: unknown domains {unknown_domains}")

    defaults = contract.get("domainDefaults")
    if not isinstance(defaults, dict):
        errors.append("contentReview.domainDefaults: must be an object")
        defaults = {}
    overrides = contract.get("overrides")
    if not isinstance(overrides, dict):
        errors.append("contentReview.overrides: must be an object")
        overrides = {}
    sources = _content_review_sources(data, anatomy)
    for domain in domains:
        default = defaults.get(domain)
        _validate_review_metadata(errors, default, f"contentReview.domainDefaults.{domain}", set(statuses), set(evidence_levels))
        domain_overrides = overrides.get(domain, {})
        if domain_overrides is None:
            domain_overrides = {}
        if not isinstance(domain_overrides, dict):
            errors.append(f"contentReview.overrides.{domain}: must be an object")
            continue
        if domain not in sources:
            continue
        known_ids = set(sources[domain])
        for item_id, metadata in domain_overrides.items():
            if domain != "anatomy" or anatomy is not None:
                if item_id not in known_ids:
                    errors.append(f"contentReview.overrides.{domain}.{item_id}: unknown content id")
            _validate_review_metadata(errors, metadata, f"contentReview.overrides.{domain}.{item_id}", set(statuses), set(evidence_levels))
    extra_defaults = sorted(set(defaults) - set(domains))
    if extra_defaults:
        errors.append(f"contentReview.domainDefaults: undeclared domains {extra_defaults}")
    extra_overrides = sorted(set(overrides) - set(domains))
    if extra_overrides:
        errors.append(f"contentReview.overrides: undeclared domains {extra_overrides}")
    return sorted(set(errors))


def validate_payload(data: dict, anatomy: dict | None = None) -> list[str]:
    errors: list[str] = []
    actions = data.get("actions", {})
    sessions = data.get("sessions", {})
    composer = data.get("composer", {})
    template_ids = data.get("templateIds", [])
    template_registry = data.get("templateRegistry", {})

    errors.extend(validate_content_review(data, anatomy))

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
            {"ids": template_ids, "registry": template_registry},
            "template-registry",
            "templateRegistry",
        )
    )
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

    # Body aggregate schema. Keep the 11 real runtime keys visible in error paths.
    body_keys = (
        "bodyTargetIds",
        "bodyTargetCatalog",
        "bodyRoleIds",
        "bodyRoles",
        "bodyTrainingModeIds",
        "bodyTrainingModes",
        "bodyFamilyIds",
        "bodyFamilies",
        "bodyLevelPolicies",
        "bodyPrescriptionProfiles",
        "bodyActionMeta",
        "bodyVolumePolicy",
        "bodyConflictPolicy",
    )
    body = {key: data.get(key) for key in body_keys}
    errors.extend(_schema_errors(body, "body", "body"))

    # Body training modes must resolve to real Body action inventory.
    mode_ids = data.get("bodyTrainingModeIds", [])
    modes = data.get("bodyTrainingModes", {})
    if list(modes) != mode_ids:
        errors.append("bodyTrainingModes: key order must match bodyTrainingModeIds")
    for mode_id in mode_ids:
        record = modes.get(mode_id, {})
        if record.get("modeId") != mode_id:
            errors.append(f"bodyTrainingModes.{mode_id}.modeId: must equal map key")
        matches = []
        for action_id, meta in data.get("bodyActionMeta", {}).items():
            action = actions.get(action_id, {})
            if action.get("pattern") not in set(record.get("patterns", [])):
                continue
            if not set(meta.get("families", [])) & set(record.get("familyIds", [])):
                continue
            if not set(meta.get("roles", [])) & set(record.get("roles", [])):
                continue
            if not set(meta.get("directTargets", [])) & set(record.get("primaryTargets", [])):
                continue
            matches.append(action_id)
        if not matches:
            errors.append(f"bodyTrainingModes.{mode_id}: no real Body action matches patterns/families/roles/targets")

    # Conditioning aggregate schema. Keep the real runtime keys visible in error paths.
    conditioning_keys = (
        "conditioningFamilyIds",
        "conditioningFamilies",
        "conditioningProtocolIds",
        "conditioningProtocols",
        "conditioningModalityIds",
        "conditioningModalities",
        "conditioningLevelPolicies",
        "conditioningProtocolPolicies",
        "conditioningActionMeta",
        "conditioningTransitionPolicy",
        "conditioningConflictPolicy",
        "conditioningBlueprints",
    )
    conditioning = {key: data.get(key) for key in conditioning_keys}
    errors.extend(_schema_errors(conditioning, "conditioning", "conditioning"))

    # HYROX aggregate schema. Keep real runtime keys visible in error paths.
    hyrox_keys = (
        "hyroxSessionTypeIds",
        "hyroxSessionTypes",
        "hyroxStationIds",
        "hyroxStations",
        "hyroxVenuePolicy",
        "hyroxCapacityGroupIds",
        "hyroxCapacityGroups",
        "hyroxLevelPolicies",
        "hyroxLoadPolicies",
        "hyroxSledCalibrationPolicy",
        "hyroxBenchmarkProtocolIds",
        "hyroxBenchmarkProtocols",
        "hyroxBenchmarkResultContract",
        "hyroxScalingPolicy",
    )
    hyrox = {key: data.get(key) for key in hyrox_keys}
    errors.extend(_schema_errors(hyrox, "hyrox", "hyrox"))

    # Training Template Registry identity and routing contract.
    if len(template_ids) != len(set(template_ids)):
        errors.append("templateIds: duplicate template IDs are not allowed")
    if set(template_ids) != set(template_registry):
        missing = sorted(set(template_ids) - set(template_registry))
        extra = sorted(set(template_registry) - set(template_ids))
        errors.append(
            f"templateIds/templateRegistry mismatch: missing={missing}; extra={extra}"
        )
    for template_id, record in sorted(template_registry.items()):
        if not isinstance(record, dict):
            continue
        if record.get("templateId") != template_id:
            errors.append(
                f"templateRegistry.{template_id}.templateId: must equal map key {template_id}"
            )
        route_base = record.get("routeBase")
        if not isinstance(route_base, str) or not route_base.startswith("#/coach/"):
            errors.append(
                f"templateRegistry.{template_id}.routeBase: must start with #/coach/"
            )

    # Frozen inventory that defines the V14.8 contract surface.
    expected_counts = {
        "sessions": (sessions, 32),
        "recipeIds": (data.get("recipeIds", []), 8),
        "supportIds": (data.get("supportIds", []), 31),
        "coreIds": (data.get("coreIds", []), 20),
        "foamRollIds": (data.get("foamRollIds", []), 12),
    }
    for name, (collection, expected) in expected_counts.items():
        if len(collection) != expected:
            errors.append(f"{name}: expected {expected}, got {len(collection)}")

    if len(data.get("warmupIds", [])) < 52:
        errors.append(f"warmupIds: expected at least 52, got {len(data.get('warmupIds', []))}")

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

    # Composer explicit main-candidate references/Tiers and frozen D1/D2 route policy.
    lower_modes = composer.get("lowerModes", {})
    upper_modes = composer.get("upperModes", {})
    for group_name, modes in (("lowerModes", lower_modes), ("upperModes", upper_modes)):
        for mode_key, mode in modes.items():
            prefix = f"composer.{group_name}.{mode_key}"
            if not isinstance(mode, dict):
                continue
            if "ids" in mode:
                errors.append(f"{prefix}.ids: legacy positional ids[] is not allowed")
            candidates = mode.get("candidates", [])
            candidate_ids = []
            candidate_tiers = []
            for candidate in candidates if isinstance(candidates, list) else []:
                if not isinstance(candidate, dict):
                    continue
                action_id = candidate.get("id")
                tier = candidate.get("tier")
                if isinstance(action_id, str) and action_id:
                    candidate_ids.append(action_id)
                if isinstance(tier, str) and tier:
                    candidate_tiers.append(tier)
            _check_action_refs(errors, actions, candidate_ids, f"{prefix}.candidates")
            if len(candidate_tiers) != 4 or set(candidate_tiers) != MAIN_TIERS:
                errors.append(f"{prefix}.candidates: must define exactly one T1/T2/T3/T4")

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
                if action_id in actions:
                    equipment_class = actions[action_id].get("equipmentClass")
                    if equipment_class not in AUXILIARY_EQUIPMENT_CLASSES:
                        errors.append(
                            f"composer auxiliary {action_id}: equipmentClass must be explicit and supported, got {equipment_class!r}"
                        )

    preset_map = composer.get("officialPresetMap", {})
    for preset_id, preset in preset_map.items():
        if not isinstance(preset, list) or len(preset) != 2:
            errors.append(
                f"composer.officialPresetMap.{preset_id}: preset must be [lowerMode, upperMode]"
            )
            continue
        lower, upper = preset
        if lower not in lower_modes:
            errors.append(
                f"composer.officialPresetMap.{preset_id}.0: unknown lower mode {lower}"
            )
        if upper not in upper_modes:
            errors.append(
                f"composer.officialPresetMap.{preset_id}.1: unknown upper mode {upper}"
            )

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

    # Body cross-record identity, candidate references, and venue legality.
    body_target_ids = data.get("bodyTargetIds", [])
    body_role_ids = data.get("bodyRoleIds", [])
    body_family_ids = data.get("bodyFamilyIds", [])
    body_level_ids = {"L1", "L2", "L3", "L4"}
    body_profile_ids = set(data.get("bodyPrescriptionProfiles", {}))
    body_action_meta = data.get("bodyActionMeta", {})

    for map_name, id_field, ids in (
        ("bodyTargetCatalog", "id", body_target_ids),
        ("bodyRoles", "id", body_role_ids),
        ("bodyFamilies", "familyId", body_family_ids),
        ("bodyLevelPolicies", "level", ["L1", "L2", "L3", "L4"]),
        ("bodyPrescriptionProfiles", "id", list(body_profile_ids)),
    ):
        records = data.get(map_name, {})
        if set(records) != set(ids):
            errors.append(
                f"{map_name}: keys must match declared IDs; declared={sorted(ids)}; actual={sorted(records)}"
            )
        for record_id, record in records.items():
            if isinstance(record, dict) and record.get(id_field) != record_id:
                errors.append(
                    f"{map_name}.{record_id}.{id_field}: must equal map key {record_id}"
                )

    if not 40 <= len(body_action_meta) <= 72:
        errors.append(
            f"bodyActionMeta: expected 40-72 curated candidates, got {len(body_action_meta)}"
        )

    valid_targets = set(body_target_ids)
    valid_roles = set(body_role_ids)
    valid_families = set(body_family_ids)
    body_slot_keys = ("PRIMARY", "SECONDARY", "ACCESSORY", "ISOLATION-1", "ISOLATION-2", "OPTIONAL")
    valid_exercise_classes = {"compound", "accessory", "isolation"}
    valid_patterns = {
        action.get("pattern")
        for action in actions.values()
        if isinstance(action, dict) and isinstance(action.get("pattern"), str) and action.get("pattern")
    }

    # Body V2 Slot Intent Contract: identity, references, and per-level static resolvability.
    for family_id in body_family_ids:
        family = data.get("bodyFamilies", {}).get(family_id, {})
        if not isinstance(family, dict):
            continue
        intents = family.get("slotIntents", {})
        if set(intents) != set(body_slot_keys):
            errors.append(
                f"bodyFamilies.{family_id}.slotIntents: must define exactly {list(body_slot_keys)}"
            )
            continue
        intent_ids = []
        for slot_key in body_slot_keys:
            intent = intents.get(slot_key, {})
            prefix = f"bodyFamilies.{family_id}.slotIntents.{slot_key}"
            if not isinstance(intent, dict):
                continue
            if intent.get("slotKey") != slot_key:
                errors.append(f"{prefix}.slotKey: must equal map key {slot_key}")
            expected_role = family.get("slotPolicy", {}).get(slot_key)
            if intent.get("role") != expected_role:
                errors.append(
                    f"{prefix}.role: {intent.get('role')} must match slotPolicy role {expected_role}"
                )
            intent_id = intent.get("intentId")
            if isinstance(intent_id, str):
                intent_ids.append(intent_id)
            for exercise_class in intent.get("allowedExerciseClasses", []):
                if exercise_class not in valid_exercise_classes:
                    errors.append(f"{prefix}.allowedExerciseClasses: unknown class {exercise_class}")
            for field in ("requiredPatterns", "preferredPatterns"):
                for pattern in intent.get(field, []):
                    if pattern not in valid_patterns:
                        errors.append(f"{prefix}.{field}: unknown action pattern {pattern}")
            for field in ("requiredDirectTargets", "preferredDirectTargets"):
                for target in intent.get(field, []):
                    if target not in valid_targets:
                        errors.append(f"{prefix}.{field}: unknown target {target}")
            pair = intent.get("pairRelationship")
            if isinstance(pair, dict):
                for against in pair.get("against", []):
                    if against not in body_slot_keys:
                        errors.append(f"{prefix}.pairRelationship.against: unknown slot {against}")
                    if against == slot_key:
                        errors.append(f"{prefix}.pairRelationship.against: cannot reference itself")
        if len(intent_ids) != len(set(intent_ids)):
            errors.append(f"bodyFamilies.{family_id}.slotIntents: intentId values must be unique")

        # #93 Family × Level pools and explicit progression / regression chains.
        level_pools = family.get("levelPools", {})
        if set(level_pools) != body_level_ids:
            errors.append(
                f"bodyFamilies.{family_id}.levelPools: must define exactly L1-L4"
            )
        progression_chains = family.get("progressionChains", {})
        if not isinstance(progression_chains, dict) or len(progression_chains) < 2:
            errors.append(
                f"bodyFamilies.{family_id}.progressionChains: expected at least two formal chains"
            )
            progression_chains = {}

        for chain_id, chain in progression_chains.items():
            prefix = f"bodyFamilies.{family_id}.progressionChains.{chain_id}"
            if not isinstance(chain, dict):
                continue
            if chain.get("chainId") != chain_id:
                errors.append(f"{prefix}.chainId: must equal map key {chain_id}")
            nodes = chain.get("nodes", [])
            node_levels = [node.get("level") for node in nodes if isinstance(node, dict)]
            if node_levels != ["L1", "L2", "L3", "L4"]:
                errors.append(f"{prefix}.nodes: must be ordered exactly L1,L2,L3,L4")
            for index, node in enumerate(nodes):
                if not isinstance(node, dict):
                    continue
                action_id = node.get("actionId")
                fallback_id = node.get("fallbackActionId")
                if action_id not in body_action_meta:
                    errors.append(f"{prefix}.nodes.{index}.actionId: unknown Body action {action_id}")
                elif family_id not in body_action_meta[action_id].get("families", []):
                    errors.append(f"{prefix}.nodes.{index}.actionId: {action_id} is not in {family_id}")
                if fallback_id is not None:
                    if fallback_id not in body_action_meta:
                        errors.append(f"{prefix}.nodes.{index}.fallbackActionId: unknown Body action {fallback_id}")
                    elif family_id not in body_action_meta[fallback_id].get("families", []):
                        errors.append(f"{prefix}.nodes.{index}.fallbackActionId: {fallback_id} is not in {family_id}")

        level_policies = data.get("bodyLevelPolicies", {})
        level_order = ["L1", "L2", "L3", "L4"]
        for level in level_order:
            pool = level_pools.get(level, {})
            prefix = f"bodyFamilies.{family_id}.levelPools.{level}"
            if not isinstance(pool, dict):
                continue
            if pool.get("level") != level:
                errors.append(f"{prefix}.level: must equal map key {level}")
            replacement_ids = pool.get("replacementActionIds", [])
            replacement_set = set(replacement_ids)
            introduced = set(pool.get("introducedActionIds", []))
            retained = set(pool.get("retainedActionIds", []))
            if introduced & retained:
                errors.append(f"{prefix}: introducedActionIds and retainedActionIds must be disjoint")
            if introduced | retained != replacement_set:
                errors.append(f"{prefix}: introduced + retained must exactly partition replacementActionIds")
            expected_downward = level_policies.get(level, {}).get("eligibleEntryLevels", [])
            if pool.get("downwardCompatibleLevels") != expected_downward:
                errors.append(
                    f"{prefix}.downwardCompatibleLevels: must match Body Level Contract {expected_downward}"
                )
            if pool.get("fallbackLevel") != level_policies.get(level, {}).get("fallbackLevel"):
                errors.append(f"{prefix}.fallbackLevel: must match Body Level Contract")
            for chain_id in pool.get("progressionChainIds", []):
                if chain_id not in progression_chains:
                    errors.append(f"{prefix}.progressionChainIds: unknown chain {chain_id}")
            for action_id in replacement_ids:
                meta = body_action_meta.get(action_id)
                if not isinstance(meta, dict):
                    errors.append(f"{prefix}.replacementActionIds: unknown Body action {action_id}")
                    continue
                if family_id not in meta.get("families", []):
                    errors.append(f"{prefix}.replacementActionIds: {action_id} not in family {family_id}")
                if level not in meta.get("levels", []):
                    errors.append(f"{prefix}.replacementActionIds: {action_id} not listed for {level}")
                entry_level = next((x for x in level_order if x in meta.get("levels", [])), None)
                if action_id in introduced and entry_level != level:
                    errors.append(
                        f"{prefix}.introducedActionIds: {action_id} entry level is {entry_level}, not {level}"
                    )
                if action_id in retained and entry_level == level:
                    errors.append(
                        f"{prefix}.retainedActionIds: {action_id} is newly introduced at {level}"
                    )

            preferred = pool.get("preferredBySlot", {})
            for slot_key in body_slot_keys:
                preferred_ids = preferred.get(slot_key, [])
                active = level_policies.get(level, {}).get("defaultWorkingSets", {}).get(slot_key, 0) > 0
                if active and not preferred_ids:
                    errors.append(f"{prefix}.preferredBySlot.{slot_key}: active slot requires preferred actions")
                role = family.get("slotPolicy", {}).get(slot_key)
                for action_id in preferred_ids:
                    if action_id not in replacement_set:
                        errors.append(
                            f"{prefix}.preferredBySlot.{slot_key}: {action_id} missing from replacementActionIds"
                        )
                        continue
                    meta = body_action_meta.get(action_id, {})
                    if role not in meta.get("roles", []):
                        errors.append(
                            f"{prefix}.preferredBySlot.{slot_key}: {action_id} does not support role {role}"
                        )

        for level in sorted(body_level_ids):
            policy = level_policies.get(level, {})
            default_sets = policy.get("defaultWorkingSets", {}) if isinstance(policy, dict) else {}
            for slot_key in body_slot_keys:
                if not isinstance(default_sets.get(slot_key), int) or default_sets.get(slot_key, 0) <= 0:
                    continue
                role = family.get("slotPolicy", {}).get(slot_key)
                intent = intents.get(slot_key, {})
                legal = []
                level_pool_ids = set(
                    family.get("levelPools", {}).get(level, {}).get("replacementActionIds", [])
                )
                for action_id, meta in body_action_meta.items():
                    action = actions.get(action_id, {})
                    if action_id not in level_pool_ids:
                        continue
                    if not isinstance(meta, dict) or not isinstance(action, dict):
                        continue
                    if family_id not in meta.get("families", []) or level not in meta.get("levels", []):
                        continue
                    if role not in meta.get("roles", []):
                        continue
                    if action.get("status") != "可自动编排" or action.get("route") not in FORMAL_ROUTES:
                        continue
                    if meta.get("exerciseClass") not in intent.get("allowedExerciseClasses", []):
                        continue
                    required_patterns = intent.get("requiredPatterns", [])
                    if required_patterns and action.get("pattern") not in required_patterns:
                        continue
                    required_targets = set(intent.get("requiredDirectTargets", []))
                    if required_targets and not (required_targets & set(meta.get("directTargets", []))):
                        continue
                    disallowed = intent.get("disallowedCharacteristics", {})
                    if meta.get("fatigueCost") in disallowed.get("fatigueCost", []):
                        continue
                    if meta.get("stabilityDemand") in disallowed.get("stabilityDemand", []):
                        continue
                    legal.append(action_id)
                if not legal:
                    errors.append(
                        f"bodyFamilies.{family_id}.slotIntents.{slot_key}: {level} has no statically legal candidates"
                    )

    for action_id, meta in sorted(body_action_meta.items()):
        prefix = f"bodyActionMeta.{action_id}"
        action = actions.get(action_id)
        if action is None:
            errors.append(f"{prefix}: unknown action {action_id}")
        else:
            route = action.get("route")
            if route not in FORMAL_ROUTES:
                errors.append(
                    f"{prefix}.route: action {action_id} route {route} is not a formal Body strength route"
                )
            status = action.get("status")
            if status != "可自动编排":
                errors.append(
                    f"{prefix}.status: action {action_id} status {status} is not 可自动编排"
                )

        if not isinstance(meta, dict):
            continue
        for family_id in meta.get("families", []):
            if family_id not in valid_families:
                errors.append(f"{prefix}.families: unknown family {family_id}")
        for level in meta.get("levels", []):
            if level not in body_level_ids:
                errors.append(f"{prefix}.levels: unknown level {level}")
        for role in meta.get("roles", []):
            if role not in valid_roles:
                errors.append(f"{prefix}.roles: unknown role {role}")
        for field in ("directTargets", "secondaryTargets"):
            for target in meta.get(field, []):
                if target not in valid_targets:
                    errors.append(f"{prefix}.{field}: unknown target {target}")
        rep_profile = meta.get("repProfile")
        if rep_profile not in body_profile_ids:
            errors.append(f"{prefix}.repProfile: unknown repProfile {rep_profile}")
        overlap = set(meta.get("directTargets", [])) & set(meta.get("secondaryTargets", []))
        if overlap:
            errors.append(
                f"{prefix}: directTargets/secondaryTargets overlap: {sorted(overlap)}"
            )

        # Body main-role candidates must directly train the Family primary target.
        main_roles = {"PRIMARY", "SECONDARY"} & set(meta.get("roles", []))
        if main_roles:
            direct_targets = set(meta.get("directTargets", []))
            family_records = data.get("bodyFamilies", {})
            for family_id in meta.get("families", []):
                family = family_records.get(family_id)
                if not isinstance(family, dict):
                    continue
                primary_targets = set(family.get("primaryTargets", []))
                if primary_targets and not (direct_targets & primary_targets):
                    errors.append(
                        f"{prefix}.families: {family_id} cannot use roles {sorted(main_roles)} because "
                        f"directTargets {sorted(direct_targets)} do not hit family primaryTargets "
                        f"{sorted(primary_targets)}"
                    )

    # Venue Capability / Minimum Load contract and Body action cross-record references.
    venue = data.get("venueCapabilityPolicy", {})
    errors.extend(_schema_errors(venue, "venue", "venueCapabilityPolicy"))
    if isinstance(venue, dict):
        station_policy = venue.get("stationDiversityPolicy", {})
        station_groups = station_policy.get("stationGroups", {}) if isinstance(station_policy, dict) else {}
        if isinstance(station_groups, dict):
            for group_id, group in sorted(station_groups.items()):
                if isinstance(group, dict) and group.get("stationGroupId") != group_id:
                    errors.append(
                        f"venueCapabilityPolicy.stationDiversityPolicy.stationGroups.{group_id}.stationGroupId: "
                        f"must equal map key {group_id}"
                    )
        # Action-level station groups are references into the venue-owned policy;
        # an unknown group would make the Resolver silently lose its audit limit.
        for action_id, action in sorted(actions.items()):
            if not isinstance(action, dict):
                continue
            station_group = action.get("stationGroup")
            if station_group is not None and station_group not in station_groups:
                errors.append(
                    f"actions.{action_id}.stationGroup: unknown station group {station_group}"
                )
        equipment_ids = set(venue.get("equipmentIds", []))
        equipment = venue.get("equipment", {})
        if set(equipment) != equipment_ids:
            errors.append(
                "venueCapabilityPolicy.equipment: keys must match equipmentIds"
            )
        action_ids = venue.get("actionIds", [])
        if len(action_ids) != len(set(action_ids)):
            errors.append("venueCapabilityPolicy.actionIds: duplicate action IDs are not allowed")
        for action_id in action_ids:
            action = actions.get(action_id)
            if not isinstance(action, dict):
                errors.append(f"venueCapabilityPolicy.actionIds: unknown action {action_id}")
                continue
            required_equipment = action.get("requiresEquipmentId", [])
            if not required_equipment:
                errors.append(
                    f"actions.{action_id}.requiresEquipmentId: required for a venue-gated action"
                )
            for equipment_id in required_equipment:
                if equipment_id not in equipment_ids:
                    errors.append(
                        f"actions.{action_id}.requiresEquipmentId: unknown equipment {equipment_id}"
                    )
            gate = action.get("beginnerLoadGate")
            if not isinstance(gate, dict) or gate.get("type") != "minimum_system_load":
                errors.append(
                    f"actions.{action_id}.beginnerLoadGate: minimum_system_load gate is required"
                )
            if not isinstance(action.get("fallbackActionGroup"), str) or not action.get("fallbackActionGroup"):
                errors.append(
                    f"actions.{action_id}.fallbackActionGroup: explicit fallback group is required"
                )
        ceilings = venue.get("bodyLevelMinimumSystemLoadCeilingKg", {})
        if all(isinstance(ceilings.get(level), (int, float)) for level in ("L1", "L2", "L3", "L4")):
            if not all(ceilings[level] <= ceilings[next_level] for level, next_level in zip(("L1", "L2", "L3"), ("L2", "L3", "L4"))):
                errors.append(
                    "venueCapabilityPolicy.bodyLevelMinimumSystemLoadCeilingKg: must be non-decreasing L1 to L4"
                )

    # Conditioning cross-record identity, candidate references, and V1 venue legality.
    conditioning_family_ids = data.get("conditioningFamilyIds", [])
    conditioning_protocol_ids = data.get("conditioningProtocolIds", [])
    conditioning_modality_ids = data.get("conditioningModalityIds", [])
    conditioning_level_ids = {"L1", "L2", "L3", "L4"}
    conditioning_action_meta = data.get("conditioningActionMeta", {})
    conditioning_families = data.get("conditioningFamilies", {})
    conditioning_protocols = data.get("conditioningProtocols", {})
    conditioning_modalities = data.get("conditioningModalities", {})
    conditioning_level_policies = data.get("conditioningLevelPolicies", {})
    conditioning_protocol_policies = data.get("conditioningProtocolPolicies", {})
    conditioning_blueprints = data.get("conditioningBlueprints", {})

    for map_name, id_field, ids in (
        ("conditioningFamilies", "familyId", conditioning_family_ids),
        ("conditioningProtocols", "protocolId", conditioning_protocol_ids),
        ("conditioningModalities", "modalityId", conditioning_modality_ids),
        ("conditioningLevelPolicies", "level", ["L1", "L2", "L3", "L4"]),
        ("conditioningProtocolPolicies", "protocolId", conditioning_protocol_ids),
    ):
        records = data.get(map_name, {})
        if set(records) != set(ids):
            errors.append(
                f"{map_name}: keys must match declared IDs; declared={sorted(ids)}; actual={sorted(records)}"
            )
        for record_id, record in records.items():
            if isinstance(record, dict) and record.get(id_field) != record_id:
                errors.append(
                    f"{map_name}.{record_id}.{id_field}: must equal map key {record_id}"
                )

    valid_conditioning_families = set(conditioning_family_ids)
    valid_conditioning_protocols = set(conditioning_protocol_ids)
    valid_conditioning_modalities = set(conditioning_modality_ids)
    valid_work_metrics = {"time", "distance", "reps", "calories"}

    for family_id, family in sorted(conditioning_families.items()):
        if not isinstance(family, dict):
            continue
        for protocol_id in family.get("protocolEligibility", []):
            if protocol_id not in valid_conditioning_protocols:
                errors.append(
                    f"conditioningFamilies.{family_id}.protocolEligibility: unknown protocol {protocol_id}"
                )
        for modality_id in family.get("preferredModalities", []):
            if modality_id not in valid_conditioning_modalities:
                errors.append(
                    f"conditioningFamilies.{family_id}.preferredModalities: unknown modality {modality_id}"
                )

    if len(conditioning_action_meta) != 18:
        errors.append(
            f"conditioningActionMeta: expected 18 curated V1 candidates, got {len(conditioning_action_meta)}"
        )

    risk_order = {"low": 0, "medium": 1, "high": 2}
    post_cardio_only_ids = {"venue_treadmill_zone2", "venue_stair_zone2"}

    for action_id, meta in sorted(conditioning_action_meta.items()):
        prefix = f"conditioningActionMeta.{action_id}"
        action = actions.get(action_id)
        if action is None:
            errors.append(f"{prefix}: unknown action {action_id}")
        else:
            route = action.get("route")
            if route != "CONDITIONING_2F":
                errors.append(
                    f"{prefix}.route: action {action_id} route {route} is not formal CONDITIONING_2F"
                )
            status = action.get("status")
            if status != "可自动编排":
                errors.append(
                    f"{prefix}.status: action {action_id} status {status} is not 可自动编排"
                )
            if isinstance(meta, dict) and meta.get("route") != route:
                errors.append(
                    f"{prefix}.route: metadata route {meta.get('route')} must match Action route {route}"
                )

        if action_id in post_cardio_only_ids:
            errors.append(
                f"{prefix}: POST_CARDIO_ONLY action cannot become a formal Conditioning candidate"
            )

        if not isinstance(meta, dict):
            continue

        families = meta.get("families", [])
        modalities = meta.get("modalities", [])
        protocols = meta.get("protocolEligibility", [])
        work_metrics = meta.get("workMetrics", [])
        levels = meta.get("levels", [])

        for family_id in families:
            if family_id not in valid_conditioning_families:
                errors.append(f"{prefix}.families: unknown family {family_id}")
        for modality_id in modalities:
            if modality_id not in valid_conditioning_modalities:
                errors.append(f"{prefix}.modalities: unknown modality {modality_id}")
        for protocol_id in protocols:
            if protocol_id not in valid_conditioning_protocols:
                errors.append(f"{prefix}.protocolEligibility: unknown protocol {protocol_id}")
        for metric in work_metrics:
            if metric not in valid_work_metrics:
                errors.append(f"{prefix}.workMetrics: unknown work metric {metric}")
        for level in levels:
            if level not in conditioning_level_ids:
                errors.append(f"{prefix}.levels: unknown level {level}")

        for family_id in families:
            family = conditioning_families.get(family_id, {})
            allowed = set(family.get("protocolEligibility", [])) if isinstance(family, dict) else set()
            if allowed and not (allowed & set(protocols)):
                errors.append(
                    f"{prefix}.families: {family_id} has no legal protocol overlap with {sorted(protocols)}"
                )

        for protocol_id in protocols:
            protocol = conditioning_protocols.get(protocol_id, {})
            allowed_metrics = set(protocol.get("allowedWorkMetrics", [])) if isinstance(protocol, dict) else set()
            if allowed_metrics and not (allowed_metrics & set(work_metrics)):
                errors.append(
                    f"{prefix}.workMetrics: no metric compatible with protocol {protocol_id}"
                )

        if meta.get("powerEligible"):
            if "POWER" not in modalities:
                errors.append(f"{prefix}.modalities: powerEligible candidate must include POWER")
            if not any(
                isinstance(conditioning_protocols.get(protocol_id), dict)
                and conditioning_protocols[protocol_id].get("allowsPower") is True
                for protocol_id in protocols
            ):
                errors.append(
                    f"{prefix}.protocolEligibility: powerEligible candidate needs a protocol that allows power"
                )

        for level in levels:
            level_policy = conditioning_level_policies.get(level, {})
            if not isinstance(level_policy, dict):
                continue
            for meta_field, ceiling_field in (
                ("impact", "impactCeiling"),
                ("coordinationDemand", "coordinationCeiling"),
                ("fatigueRisk", "fatigueCeiling"),
            ):
                demand = meta.get(meta_field)
                ceiling = level_policy.get(ceiling_field)
                if demand in risk_order and ceiling in risk_order and risk_order[demand] > risk_order[ceiling]:
                    errors.append(
                        f"{prefix}.{meta_field}: {demand} exceeds {level} {ceiling_field} {ceiling}"
                    )

    for modality_id, modality in sorted(conditioning_modalities.items()):
        if not isinstance(modality, dict):
            continue
        candidates = [
            action_id
            for action_id, meta in conditioning_action_meta.items()
            if isinstance(meta, dict) and modality_id in meta.get("modalities", [])
        ]
        if modality.get("v1Status") == "ACTIVE" and not candidates:
            errors.append(
                f"conditioningModalities.{modality_id}: ACTIVE modality needs at least one formal candidate"
            )
        if modality.get("v1Status") == "RESERVED" and candidates:
            errors.append(
                f"conditioningModalities.{modality_id}: RESERVED modality must not have formal V1 candidates"
            )

    # Conditioning Class Blueprint identity, block references, and teaching fields.
    expected_block_counts = {"L1": 2, "L2": 3, "L3": 3, "L4": 3}
    expected_variants = {"A", "B", "C"}
    expected_roles = ["BUILD", "MAIN", "CHALLENGE"]
    for family_id in conditioning_family_ids:
        family_blueprints = conditioning_blueprints.get(family_id, {})
        if set(family_blueprints) != conditioning_level_ids:
            errors.append(
                f"conditioningBlueprints.{family_id}: keys must be exactly L1/L2/L3/L4"
            )
            continue
        for level in ("L1", "L2", "L3", "L4"):
            variants = family_blueprints.get(level, {})
            if set(variants) != expected_variants:
                errors.append(
                    f"conditioningBlueprints.{family_id}.{level}: variants must be exactly A/B/C"
                )
                continue
            for variant_id, blueprint in sorted(variants.items()):
                prefix = f"conditioningBlueprints.{family_id}.{level}.{variant_id}"
                if not isinstance(blueprint, dict):
                    errors.append(f"{prefix}: must be an object")
                    continue
                if blueprint.get("sessionBlueprintId") != f"{family_id}-{level}-{variant_id}":
                    errors.append(f"{prefix}.sessionBlueprintId: identity does not match map path")
                if blueprint.get("familyId") != family_id or blueprint.get("level") != level:
                    errors.append(f"{prefix}: familyId/level does not match map path")
                if blueprint.get("variantId") != variant_id:
                    errors.append(f"{prefix}.variantId: must equal map key {variant_id}")
                blocks = blueprint.get("blocks", [])
                if len(blocks) != expected_block_counts[level]:
                    errors.append(
                        f"{prefix}.blocks: expected {expected_block_counts[level]}, got {len(blocks)}"
                    )
                seen_keys = []
                flattened_actions = []
                for index, block in enumerate(blocks if isinstance(blocks, list) else []):
                    block_prefix = f"{prefix}.blocks.{index}"
                    if not isinstance(block, dict):
                        errors.append(f"{block_prefix}: must be an object")
                        continue
                    if block.get("key") != f"BLOCK-{chr(65 + index)}":
                        errors.append(f"{block_prefix}.key: must follow BLOCK-A/B/C order")
                    seen_keys.append(block.get("key"))
                    if index >= len(expected_roles) or block.get("role") != expected_roles[index]:
                        errors.append(f"{block_prefix}.role: invalid role for block position")
                    protocol_id = block.get("protocolId")
                    if protocol_id not in valid_conditioning_protocols:
                        errors.append(f"{block_prefix}.protocolId: unknown protocol {protocol_id}")
                    elif protocol_id not in conditioning_families.get(family_id, {}).get("protocolEligibility", []):
                        errors.append(f"{block_prefix}.protocolId: {protocol_id} is not legal for {family_id}")
                    for field in (
                        "goal", "prescription", "completionMetric", "zone", "setup",
                    ):
                        if not isinstance(block.get(field), str) or not block[field].strip():
                            errors.append(f"{block_prefix}.{field}: must be non-empty")
                    for field in ("coachingCues", "scaleRules", "stopCriteria", "equipment"):
                        values = block.get(field)
                        if not isinstance(values, list) or not values or not all(isinstance(item, str) and item.strip() for item in values):
                            errors.append(f"{block_prefix}.{field}: must be a non-empty string array")
                    stations = block.get("stations", [])
                    if not isinstance(stations, list) or not stations:
                        errors.append(f"{block_prefix}.stations: must be a non-empty array")
                        continue
                    protocol = conditioning_protocols.get(protocol_id, {})
                    station_range = protocol.get("stationCountRange", []) if isinstance(protocol, dict) else []
                    if isinstance(station_range, list) and len(station_range) == 2 and not (station_range[0] <= len(stations) <= station_range[1]):
                        errors.append(
                            f"{block_prefix}.stations: count {len(stations)} outside {protocol_id} range {station_range}"
                        )
                    for station_index, station in enumerate(stations):
                        station_prefix = f"{block_prefix}.stations.{station_index}"
                        if not isinstance(station, dict):
                            errors.append(f"{station_prefix}: must be an object")
                            continue
                        action_id = station.get("actionId")
                        action = actions.get(action_id, {})
                        action_meta = conditioning_action_meta.get(action_id, {})
                        flattened_actions.append(action_id)
                        for field in ("actionId", "taskLabel", "setup", "equipment", "zone"):
                            if not isinstance(station.get(field), str) or not station[field].strip():
                                errors.append(f"{station_prefix}.{field}: must be non-empty")
                        if action_id not in actions or action_id not in conditioning_action_meta:
                            errors.append(f"{station_prefix}.actionId: unknown Conditioning action {action_id}")
                            continue
                        if action.get("route") != "CONDITIONING_2F" or action.get("status") != "可自动编排":
                            errors.append(f"{station_prefix}.actionId: action must be formal CONDITIONING_2F and 可自动编排")
                        if family_id not in action_meta.get("families", []) or level not in action_meta.get("levels", []):
                            errors.append(f"{station_prefix}.actionId: action is not legal for {family_id}/{level}")
                        if protocol_id not in action_meta.get("protocolEligibility", []):
                            errors.append(f"{station_prefix}.actionId: action is not legal for protocol {protocol_id}")
                if seen_keys != [f"BLOCK-{chr(65 + index)}" for index in range(expected_block_counts[level])]:
                    errors.append(f"{prefix}.blocks: keys must be ordered and contiguous")
                if blueprint.get("repeatPolicy") == "UNIQUE_ACTIONS" and len(flattened_actions) != len(set(flattened_actions)):
                    errors.append(f"{prefix}.repeatPolicy: UNIQUE_ACTIONS cannot repeat an action")
                transitions = sum(
                    block.get("transitionAfterSeconds", 0)
                    for block in blocks
                    if isinstance(block, dict) and isinstance(block.get("transitionAfterSeconds", 0), (int, float))
                )
                if blueprint.get("totalTransitionSeconds") != transitions:
                    errors.append(f"{prefix}.totalTransitionSeconds: must equal block transition sum")

    # Every Family × Level must be resolvable later by #37 without inventing candidates.
    for family_id in conditioning_family_ids:
        for level in ("L1", "L2", "L3", "L4"):
            legal = [
                action_id
                for action_id, meta in conditioning_action_meta.items()
                if isinstance(meta, dict)
                and family_id in meta.get("families", [])
                and level in meta.get("levels", [])
            ]
            if len(legal) < 2:
                errors.append(
                    f"conditioningActionMeta: {family_id} {level} needs >=2 formal candidates; got {legal}"
                )

    # Every declared Family/Protocol pair needs at least two candidates.
    for family_id, family in sorted(conditioning_families.items()):
        if not isinstance(family, dict):
            continue
        for protocol_id in family.get("protocolEligibility", []):
            legal = [
                action_id
                for action_id, meta in conditioning_action_meta.items()
                if isinstance(meta, dict)
                and family_id in meta.get("families", [])
                and protocol_id in meta.get("protocolEligibility", [])
            ]
            if len(legal) < 2:
                errors.append(
                    f"conditioningActionMeta: {family_id} {protocol_id} needs >=2 formal candidates; got {legal}"
                )

    # CON-04 must have at least two true power-capable candidates at every level.
    for level in ("L1", "L2", "L3", "L4"):
        legal_power = [
            action_id
            for action_id, meta in conditioning_action_meta.items()
            if isinstance(meta, dict)
            and "CON-04" in meta.get("families", [])
            and level in meta.get("levels", [])
            and meta.get("powerEligible") is True
        ]
        if len(legal_power) < 2:
            errors.append(
                f"conditioningActionMeta: CON-04 {level} needs >=2 powerEligible candidates; got {legal_power}"
            )

    transition_policy = data.get("conditioningTransitionPolicy", {})
    if isinstance(transition_policy, dict):
        if transition_policy.get("formalRoutes") != ["CONDITIONING_2F"]:
            errors.append(
                "conditioningTransitionPolicy.formalRoutes: V1 formal route must be CONDITIONING_2F only"
            )
        if "POST_CARDIO_ONLY" not in transition_policy.get("excludedRoutes", []):
            errors.append(
                "conditioningTransitionPolicy.excludedRoutes: POST_CARDIO_ONLY must remain excluded"
            )
        if transition_policy.get("floorChangeAllowed") is not False:
            errors.append(
                "conditioningTransitionPolicy.floorChangeAllowed: V1 Conditioning must remain on the 2F route"
            )

    return sorted(set(errors))


def validate_repository(root: Path = ROOT) -> list[str]:
    data = load_runtime_data(root / "data" / "system-data.js")
    anatomy = load_anatomy_data(root / "data" / "anatomy-data.js")
    return validate_payload(data, anatomy)


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
