import json
from pathlib import Path

schema_path = Path("schemas/v14.8/body.schema.json")
schema_text = schema_path.read_text(encoding="utf-8")
broken = '"allowedRoles":{"type":"array","minItems":5,"maxItems":5,"uniqueItems":true,"items":{"$ref":"#/$defs/roleId"}},"additionalProperties":false},"defaultWorkingSets"'
fixed = '"allowedRoles":{"type":"array","minItems":5,"maxItems":5,"uniqueItems":true,"items":{"$ref":"#/$defs/roleId"}}},"additionalProperties":false},"defaultWorkingSets"'
if broken in schema_text:
    schema_text = schema_text.replace(broken, fixed, 1)
# Fail closed: never let malformed schema be committed by the helper.
json.loads(schema_text)
schema_path.write_text(schema_text.rstrip() + "\n", encoding="utf-8")

path = Path("tools/validate_v148_schema.py")
text = path.read_text(encoding="utf-8")

schema_block = '''    # Body aggregate schema. Keep the 11 real runtime keys visible in error paths.\n    body_keys = (\n        "bodyTargetIds",\n        "bodyTargetCatalog",\n        "bodyRoleIds",\n        "bodyRoles",\n        "bodyFamilyIds",\n        "bodyFamilies",\n        "bodyLevelPolicies",\n        "bodyPrescriptionProfiles",\n        "bodyActionMeta",\n        "bodyVolumePolicy",\n        "bodyConflictPolicy",\n    )\n    body = {key: data.get(key) for key in body_keys}\n    errors.extend(_schema_errors(body, "body", "body"))\n\n'''

cross_block = '''    # Body cross-record identity, candidate references, and venue legality.\n    body_target_ids = data.get("bodyTargetIds", [])\n    body_role_ids = data.get("bodyRoleIds", [])\n    body_family_ids = data.get("bodyFamilyIds", [])\n    body_level_ids = {"L1", "L2", "L3", "L4"}\n    body_profile_ids = set(data.get("bodyPrescriptionProfiles", {}))\n    body_action_meta = data.get("bodyActionMeta", {})\n\n    for map_name, id_field, ids in (\n        ("bodyTargetCatalog", "id", body_target_ids),\n        ("bodyRoles", "id", body_role_ids),\n        ("bodyFamilies", "familyId", body_family_ids),\n        ("bodyLevelPolicies", "level", ["L1", "L2", "L3", "L4"]),\n        ("bodyPrescriptionProfiles", "id", list(body_profile_ids)),\n    ):\n        records = data.get(map_name, {})\n        if set(records) != set(ids):\n            errors.append(\n                f"{map_name}: keys must match declared IDs; declared={sorted(ids)}; actual={sorted(records)}"\n            )\n        for record_id, record in records.items():\n            if isinstance(record, dict) and record.get(id_field) != record_id:\n                errors.append(\n                    f"{map_name}.{record_id}.{id_field}: must equal map key {record_id}"\n                )\n\n    if not 40 <= len(body_action_meta) <= 60:\n        errors.append(\n            f"bodyActionMeta: expected 40-60 candidates, got {len(body_action_meta)}"\n        )\n\n    valid_targets = set(body_target_ids)\n    valid_roles = set(body_role_ids)\n    valid_families = set(body_family_ids)\n    for action_id, meta in sorted(body_action_meta.items()):\n        prefix = f"bodyActionMeta.{action_id}"\n        action = actions.get(action_id)\n        if action is None:\n            errors.append(f"{prefix}: unknown action {action_id}")\n        else:\n            route = action.get("route")\n            if route not in FORMAL_ROUTES:\n                errors.append(\n                    f"{prefix}.route: action {action_id} route {route} is not a formal Body strength route"\n                )\n            status = action.get("status")\n            if status != "可自动编排":\n                errors.append(\n                    f"{prefix}.status: action {action_id} status {status} is not 可自动编排"\n                )\n\n        if not isinstance(meta, dict):\n            continue\n        for family_id in meta.get("families", []):\n            if family_id not in valid_families:\n                errors.append(f"{prefix}.families: unknown family {family_id}")\n        for level in meta.get("levels", []):\n            if level not in body_level_ids:\n                errors.append(f"{prefix}.levels: unknown level {level}")\n        for role in meta.get("roles", []):\n            if role not in valid_roles:\n                errors.append(f"{prefix}.roles: unknown role {role}")\n        for field in ("directTargets", "secondaryTargets"):\n            for target in meta.get(field, []):\n                if target not in valid_targets:\n                    errors.append(f"{prefix}.{field}: unknown target {target}")\n        rep_profile = meta.get("repProfile")\n        if rep_profile not in body_profile_ids:\n            errors.append(f"{prefix}.repProfile: unknown repProfile {rep_profile}")\n        overlap = set(meta.get("directTargets", [])) & set(meta.get("secondaryTargets", []))\n        if overlap:\n            errors.append(\n                f"{prefix}: directTargets/secondaryTargets overlap: {sorted(overlap)}"\n            )\n\n'''

if "# Body aggregate schema. Keep the 11 real runtime keys visible in error paths." not in text:
    anchor = "    # Training Template Registry identity and routing contract.\n"
    if anchor not in text:
        raise SystemExit("Body schema insertion anchor missing")
    text = text.replace(anchor, schema_block + anchor, 1)

if "# Body cross-record identity, candidate references, and venue legality." not in text:
    anchor = "    return sorted(set(errors))\n"
    if anchor not in text:
        raise SystemExit("Body cross-record insertion anchor missing")
    text = text.replace(anchor, cross_block + anchor, 1)

path.write_text(text, encoding="utf-8")
