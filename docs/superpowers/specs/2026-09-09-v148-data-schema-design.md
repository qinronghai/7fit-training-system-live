# V14.8 Data Schema Design

## Purpose

Issue #3 introduces a machine-checkable contract around the existing V14.7 runtime data without changing training semantics or restructuring `data/system-data.js`.

The schema layer is a release gate, not a migration layer.

## Non-goals

- Do not split `system-data.js` in this issue; that remains #4.
- Do not rename existing action/session IDs.
- Do not normalize historical optional fields merely to make schemas prettier.
- Do not change F111, Session L, Main T, SUPPORT S, CORE-L, route, PREP, Foam, anatomy, conflict, or prescription semantics.
- Do not add a frontend framework or runtime schema dependency to the browser application.

## Schema standard and version

- JSON Schema dialect: Draft 2020-12.
- Contract version: `14.8.0`.
- Schema files live under `schemas/v14.8/`.
- Python validation uses `jsonschema` only in tests/CI; the static browser runtime remains dependency-free.

## Stable contracts to enforce

### Action

Every record in `V14_DATA.actions` must have a stable identity and valid routing/programming metadata.

Required minimum fields:

- `id`: non-empty string and must equal the map key.
- `name`: non-empty string.
- `route`: one of the known venue routes.
- `status`: non-empty string.

Optional training metadata may remain optional because historical records are heterogeneous. When present, the following are constrained:

- `tier`: known Main / SUPPORT / CORE tier syntax.
- `isSupport`: boolean.
- `isCore`: boolean.
- `pattern`, `category`, `zone`, `equipmentId`: string or null only where current data genuinely permits null.

Route enum baseline:

- `1F_ONLY`
- `FLEX_1F_2F`
- `POST_CARDIO_ONLY`
- `CONDITIONING_2F`
- `RECOVERY_2F`

If the current V14.7 payload contains an additional real route value, inventory validation must surface it before the enum is expanded. The validator must not silently accept unknown routes.

### Session

Every record in `V14_DATA.sessions` must:

- use an ID matching `^F111-\d{2}-L[1-4]$`;
- contain exactly six formal slots;
- contain exactly one each of `A`, `B`, `C`, `D1`, `D2`, `CORE`;
- give every slot a known `baselineId`;
- never place `POST_CARDIO_ONLY`, `CONDITIONING_2F`, or `RECOVERY_2F` into formal strength slots.

Session schema validates structure; cross-record checks validate action references and route legality.

### Composer / Recipe

`V14_DATA.composer` must expose:

- `lowerModes`
- `upperModes`
- `levelMap`
- `supportMap`
- `coreMap`
- `coreDemands`
- `auxiliaryRules`
- `officialPresetMap`

Frozen cardinality/identity rules:

- 5 lower modes.
- 4 upper modes.
- 20 legal free combinations are derived from 5 × 4.
- 8 official presets remain `F111-01` through `F111-08`.
- Session levels are `L1`–`L4`.
- Main tiers are `T1`–`T4`.

Cross-record validation must ensure all mode IDs and auxiliary-rule action IDs exist.

### SUPPORT

- `supportIds` contains 30 unique action IDs.
- Every referenced action exists.
- SUPPORT tier, when present, matches `SUP-S1` through `SUP-S6`.
- SUPPORT identity must not be confused with the Chinese term “支持模式”; product copy remains “支撑模式”.

### CORE

- `coreIds` contains 20 unique action IDs.
- Every referenced action exists.
- CORE tier, when present, matches `CORE-L1` through `CORE-L4`.
- `composer.coreDemands` keys remain the six demand families currently used by Composer.

### PREP

- `warmupIds` contains 20 unique IDs.
- Every ID exists in `warmupDetails`.
- Every PREP detail has at minimum `name`.
- `warmupMatchByPattern` uses only the eight frozen movement-pattern match keys and references known PREP IDs.

### Foam

- `foamRollIds` contains 12 unique IDs.
- Every ID exists in `foamRollDetails`.
- Every Foam detail has at minimum `name`.
- `foamRollMatchByPattern` uses only the eight frozen movement-pattern match keys and references known Foam IDs.

## Cross-record invariants

JSON Schema cannot safely express all existing graph relationships, so `tools/validate_v148_schema.py` also enforces:

1. Action map key equals `action.id`.
2. All session slot `baselineId` values reference known actions.
3. Formal sessions never use post-cardio/conditioning/recovery-only actions.
4. `supportIds` / `coreIds` reference known actions and contain no duplicates.
5. Composer lower/upper mode IDs reference known actions.
6. Composer auxiliary-rule IDs reference known actions and satisfy the explicit D1/D2 route policy from #5 (`1F_ONLY`).
7. Official preset mode keys exist.
8. PREP/Foam match tables reference known detail IDs.
9. Frozen inventory remains 32 sessions / 8 recipes / 30 SUPPORT / 20 CORE / 20 PREP / 12 Foam.

## Validation API

`tools/validate_v148_schema.py` exposes:

```python
load_runtime_data(path: Path) -> dict
load_schema(name: str) -> dict
validate_payload(data: dict) -> list[str]
validate_repository(root: Path) -> list[str]
```

- Empty error list means valid.
- Errors are deterministic human-readable strings containing data path and reason.
- CLI exits `0` when valid and non-zero when invalid.

## CI integration

- `tests/test_v148_schema.py` covers current full payload plus mutation-based negative cases.
- `.github/workflows/deploy-pages.yml` installs `jsonschema` and runs the validator before static artifact upload.
- A lightweight `.github/workflows/schema-check.yml` runs the same schema tests/validator on pull requests so invalid schema/data is caught before merge.

## Compatibility gate

A valid #3 implementation must keep all existing Python tests, all Node runtime tests, and JS syntax checks passing. The browser runtime must not import or depend on the Python schema tooling.