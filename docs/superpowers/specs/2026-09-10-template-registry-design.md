# V15 Training Template Registry Design

## Status

Approved implementation baseline for Issue #27. This document translates the already-approved Issue contract into repository-specific boundaries after auditing the current build, router, Coach Home, and app shell.

## Goal

Turn `#/coach` from an F111-specific landing page into a data-driven Multi-Template Coach Center while preserving all existing F111 preset/composer URLs and without implementing Body/Conditioning domain resolvers.

## Registry data contract

Add `data/src/templates.json` with two top-level keys:

- `templateIds`: ordered IDs used for Coach Center display.
- `templateRegistry`: records keyed by `templateId`.

Each record requires:

- `templateId`
- `name`
- `shortName`
- `engine`
- `status`
- `levelSystem`
- `capabilities`
- `routeBase`
- `description`

First registry order:

1. `f111` — 女性综合 1+1+1 — `ACTIVE`
2. `body` — 健美式塑形 — `ACTIVE`
3. `conditioning` — 体能训练 — `ACTIVE`
4. `posture` — 体态调整 — `FUTURE`

`engine` is one of `f111 | body | conditioning | posture` in this first contract. `status` is `ACTIVE | FUTURE`. `levelSystem` is `L1-L4`.

`capabilities` is an exact boolean object with these keys:

- `preset`
- `composer`
- `prep`
- `anatomy`
- `copy`
- `save`
- `volume`
- `conditioningMetrics`

Initial capability truth reflects implemented or formally available platform services, not future promises. F111 exposes its current capabilities. Body/Conditioning can be ACTIVE as selectable template domains while their not-yet-built composer/resolver capabilities remain false. Posture is FUTURE and all capabilities are false.

Route bases:

- `f111` → `#/coach/f111`
- `body` → `#/coach/body`
- `conditioning` → `#/coach/conditioning`
- `posture` → `#/coach/posture`

## Build ownership

`templates.json` becomes a formal split-data domain owned through `data/src/manifest.json` and `tools/build_system_data.py`.

New generated runtime keys:

- `window.V14_DATA.templateIds`
- `window.V14_DATA.templateRegistry`

The project keeps the existing synchronous `window.V14_DATA` runtime. No fetch/XHR or async boot path is introduced.

## Schema and validation

Add `schemas/v14.8/template-registry.schema.json` because the current committed runtime bundle and CI gate are still V14.8-compatible infrastructure even though the feature belongs to the V15 roadmap.

The schema validates record shape, engine/status enums, exact capability keys and types, `routeBase`, and required strings.

`tools/validate_v148_schema.py` additionally validates cross-record invariants:

- `templateIds` is unique.
- `set(templateIds) == set(templateRegistry.keys())`.
- every record's `templateId` equals its map key.
- every `routeBase` starts with `#/coach/`.

Adding a new registry record may require extending the engine enum when it introduces a genuinely new engine, but Coach Center rendering itself must not require a new hard-coded card branch.

## Coach routing and UI

### `#/coach`

Becomes the Multi-Template Coach Center. Cards are rendered by iterating `templateIds` and reading `templateRegistry`; names, descriptions, status, capabilities, and route target are never duplicated in the Coach Home source.

### `#/coach/f111`

Renders the existing F111 landing content: F111 hero, eight recipe families, 32 L1-L4 sessions, and free-composer entry.

### `#/coach/body` and `#/coach/conditioning`

Render a generic template landing shell driven by Registry data. They may state that domain infrastructure is active and show capability status, but they must not fabricate sessions or a resolver before #34/#37.

### `#/coach/posture`

Registry card is visibly FUTURE / 即将开放. Its template landing may be safely rendered as a future placeholder; it must never invoke a resolver.

### Backward compatibility

Keep these paths unchanged:

- `#/coach/compose`
- `#/coach/f111-01/l1` through existing F111 recipe routes

Router parsing gives explicit registered template IDs priority before legacy F111 recipe parsing. Unknown template-like paths must remain invalid and hit the existing safe 404 flow.

## Module boundaries

- `js/coach/home.js`: Coach Center registry cards only.
- `js/coach/f111-home.js`: existing F111-specific hero and recipe-family landing content moved out of generic Home.
- `js/coach/template-home.js`: generic Registry-driven template landing and capability display for active/future non-F111 templates.
- `js/views-coach.js`: route dispatch among Center, registered template landing, existing Composer, and existing F111 Session; it does not own template metadata.
- `js/app.js`: Coach subtitle becomes route/registry-aware instead of globally saying F111.
- `js/router.js`: recognizes registered template IDs without hard-coding their names.

## Error handling

- Missing/unknown registry records render the existing safe not-found path rather than throwing.
- FUTURE templates never call domain resolvers.
- Missing capability fields are rejected by Schema before deployment.
- Registry ID/key drift is rejected by validator.

## Testing

Required gates:

1. RED/GREEN schema tests for valid registry plus illegal engine/status/capability and ID/key drift.
2. Build-source tests proving `templates.json` is formally owned and the generated bundle is fresh.
3. Router/runtime tests for `#/coach`, `#/coach/f111`, Body/Conditioning template routes, unknown IDs, and legacy recipe/composer compatibility.
4. Coach Home test proving all four cards come from Registry and a synthetic extra record renders without adding UI branching.
5. Browser Smoke: four cards visible on `#/coach`, F111 remains reachable, FUTURE state visible, 390px no horizontal overflow, `pageerror = 0`.
6. Existing regression suite remains green.

## Explicit non-goals

- No Body or Conditioning domain resolver.
- No Posture resolver.
- No Multi-Template State migration; that is #31 after #29.
- No redesign of the global visual system.
- No async data API.
