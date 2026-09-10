# F111 Router + Migration Parity Design

## Goal

Complete Issue #28 first, then Issue #30, so F111 can move onto the V15 Multi-Template architecture without changing training semantics or user-visible behavior.

## Frozen behavior

- 8 official F111 presets × L1–L4 = 32 preset sessions.
- 5 lower patterns × 4 upper patterns × L1–L4 = 80 composer states.
- Formal slots remain A / B / C / D1 / D2 / CORE.
- Existing L / T / S / CORE semantics, prescriptions, routes, anatomy, conflicts, Coach Copy, Member Copy and PREP Phase B1 behavior remain unchanged.
- Body / Conditioning are out of scope.

## Phase 1 — Issue #28 Router

Canonical F111 routes:

- `#/coach/f111`
- `#/coach/f111/compose`
- `#/coach/f111/<recipe>/<level>` where recipe is `f111-01` … `f111-08` and level is `l1` … `l4`.

Legacy aliases remain supported:

- `#/coach/compose`
- `#/coach/f111-01/l1` … `#/coach/f111-08/l4`.

Router responsibilities are limited to parsing, normalization, validation and stable navigation. Router must not evaluate training legality.

The parsed route model remains compatible with the current Coach renderer:

- canonical/legacy composer → `{area:'coach', page:'compose', templateId:'f111', ...}`
- canonical/legacy preset → `{area:'coach', page:'preset', templateId:'f111', recipeId:'F111-XX', level:'LX', ...}`
- template home → `{area:'coach', page:'template', templateId:'f111', ...}`

Canonical URL serialization is added so parity tests can compare normalized addresses deterministically.

## Phase 2 — Issue #30 Parity Gate

The V15 path is `V15TemplateResolver.resolve('f111', input)` + `V15State`. Existing V14 resolver/state APIs remain compatibility facades during migration.

Parity is defined by a normalized signature, not raw object equality. For every case compare:

- template / family / level identity;
- six formal slot keys and actionIds;
- tier / grade / prescription where applicable;
- PREP resolved actionIds;
- anatomy primary / secondary / stabilizer sets;
- conflict status / hardCount / warnCount / issue codes;
- Coach Copy normalized text;
- Member Copy normalized text.

Preset matrix: all 32 sessions.
Composer matrix: all 80 base states with default selections.

Manual-state cases additionally verify one formal swap and one PREP swap survive rerender/reload and remain visible through the V15 namespace.

## Consumption migration

Coach Session and Composer should resolve their public session through the V15 F111 Dispatcher, while preserving existing rendering and copy presentation. Domain-private F111 fields remain private input/adapter data and are not promoted into `ResolvedSession` public requirements.

Existing V14 APIs may remain wrappers for compatibility, but the migrated page must have one source of truth for current selections and resolved PREP.

## Error handling

- Unknown template / recipe / level returns existing safe Not Found behavior, never pageerror.
- Invalid/stale manual state falls back through existing V15 State reconciliation / PREP resolver behavior.
- Legacy state migration never invents unavailable F111 inputs.

## Acceptance

#28 is complete only after canonical + legacy routing tests and browser navigation pass.
#30 is complete only after 32 preset + 80 composer signatures pass, state/copy/PREP regressions pass, 390px old/new URL browser interaction passes, and master verify/browser/deploy all succeed.
