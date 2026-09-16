# Issue 79 Auxiliary Action Modules Implementation Plan

> Scope: deliver the two system-mode modules requested by Issue #79 without creating a second action source of truth.

## Contract

- Module 11 derives a deduplicated D2 upper-assistance catalog from `composer.auxiliaryRules.upper`.
- Module 12 derives a D1 lower-assistance catalog from `composer.auxiliaryRules.lower` and separates `fixed_machine` from `cable_station` explicitly.
- `equipmentClass` is a validated action-data field; missing or incomplete detail remains visibly marked instead of fabricated.
- Coach mode hides audit IDs; system mode exposes the source pool and `equipmentClass`.
- Detail links return to the existing Library/action-detail route.

## Verification checklist

- [x] Runtime catalog tests cover deduplication, source-pool references, explicit equipment classes, fixture additions, and fixture removal.
- [x] Python schema/data tests cover 10 formal modes, route/status legality, detail references, and equipment-class validation.
- [x] Browser tests cover the index, both modules, source-pool/class filters, mode visibility, detail deep link, and 390/1080/1280/1440 overflow.
- [x] Run full Node/Python/schema/build/artifact/syntax gates: Node runtime 16/16, Python 222 passed, JS syntax 138/138, V14.8 schema PASS, `system-data.js` build check PASS, artifact hygiene 3 passed, and `git diff --check` PASS.
- [x] Run full Chromium suite and record the result: 47 passed, including the stacked #71/#73 PREP regressions and the four Issue #79 browser checks.
- [x] Use the in-app browser/computer-use surface for a visual/AX check of both modules: index and upper-module screenshots, upper pool filter to 4 entries, lower module at 390px with `scrollWidth === clientWidth === 390`, and action-detail drawer deep link; browser viewport restored afterward.
- [ ] Push the isolated branch and open an unmerged PR referencing #79.

## Constraints

- No direct master edits, merge, deployment, publication, or Issue close.
- No static duplicate action list; all visible counts and pools must derive from current runtime data.
