# Issue #8 Coach View Module Split Design

## Goal

Split the current `js/views-coach.js` monolith into focused Coach view modules without changing user-visible behavior, routing, state semantics, Composer resolution, copy output, DOM hooks, or public compatibility globals.

## Compatibility contract

The following public interfaces remain stable:

- `window.V14Views.coach(route)`
- `window.V14Bind.coach(route)`
- `window.V14CoachAnatomy.selectedTrainingIds(sessionId, selectedIds)`
- `window.V14CoachAnatomy.buildCopyPayload(sessionId, recipeId, level)`
- `window.V14CoachAnatomy.buildComposerCopyPayload(ctx)`
- `window.V14CoachAnatomy.composerContext(route)`

Existing DOM class names and IDs used by CSS, Playwright, and event binding remain unchanged.

## Module boundaries

Use plain IIFE/browser globals, matching the existing static-site architecture. No framework or bundler is introduced.

- `js/coach/common.js` — escaping, data accessor, shared hero/mode switch/copy-toolbar helpers.
- `js/coach/home.js` — Coach home and preset cards only.
- `js/coach/slot.js` — preset and Composer slot-card rendering.
- `js/coach/prep.js` — warmup matching/rendering and Composer PREP helpers.
- `js/coach/foam.js` — foam matching/rendering and Composer foam helpers.
- `js/coach/summary.js` — Anatomy muscle-summary rendering.
- `js/coach/conflict-view.js` — conflict result rendering only.
- `js/coach/session.js` — preset Session render, selected-training grouping, preset copy payload.
- `js/coach/composer-view.js` — Composer context, route helpers, Composer render, Composer copy payload.
- `js/views-coach.js` — thin facade/router coordinator and DOM event binding; exports compatibility globals.

All internal modules register under `window.V14CoachModules`.

## Data flow

Preset route: facade → `Home.render()` or `Session.render(route)` → shared Slot/PREP/Foam/Summary/Conflict helpers.

Composer route: facade → `Composer.render(route)` → Composer resolver + shared PREP/Foam/Summary/Conflict/Slot helpers.

Event binding remains centralized in the facade so current rerender and copy behavior stays identical.

## Script loading

`index.html` loads `js/coach/*.js` after existing data/anatomy/composer/conflict/copy dependencies and before `js/views-coach.js`.

## Non-goals

- No PREP V2 behavior from #25.
- No visual redesign.
- No State schema change.
- No Router change.
- No new framework/bundler.
- No copy-format changes.

## Verification

1. Add a structural contract test that fails while the monolith still exists.
2. Existing Python regression/build/schema gates must remain green.
3. Existing Node tests, especially `composer_copy_test.js`, must remain green after loading the new module scripts.
4. Playwright Coach home / preset / Composer smoke must remain green.
5. `js/views-coach.js` becomes a thin facade rather than retaining rendering responsibilities.
