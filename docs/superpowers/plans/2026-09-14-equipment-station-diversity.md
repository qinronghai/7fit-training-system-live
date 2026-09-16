# Body Equipment Station Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Body sessions from silently assigning multiple formal actions to one confirmed physical equipment station while preserving safe, explicit exceptions and unknown-station auditability.

**Architecture:** Keep `stationId` in the existing action/venue data contract and expose one Body Resolver helper that derives exact station and optional station-group metadata. Resolver candidate eligibility and manual selection use the same assessment; the Body Conflict plugin independently audits resolved sessions so fabricated or externally supplied sessions cannot bypass the rule. Exact station reuse is blocked by default, group concentration is a warning, and only the named explicit reuse policy can downgrade an exact duplicate to a warning.

**Tech Stack:** JSON source data, generated `data/system-data.js`, vanilla JavaScript Resolver/Conflict/UI, Node runtime tests, Python schema/build tests, Playwright Chromium tests.

**Spec:** GitHub Issue #95 — Equipment Station Diversity / Conflict.

## Global Constraints

- Do not compare Chinese action names to identify equipment; use explicit `stationId`/`stationGroup` metadata.
- Preserve the existing Body Family, Level, Slot Intent, venue minimum-load gate, action status, route, and shared Conflict Core rules.
- Unknown station metadata is not a permission to invent a station or block a legal action; surface `UNVERIFIED` audit state and continue.
- Default exact station reuse is `hard`/`FAIL`; an explicit `STATION_REUSE_ALLOWED` policy may produce a `warn` without removing the audit record. The venue-owned `stationDiversityPolicy` is the single source of truth for this boundary.
- Do not change F111, Conditioning, SUPPORT, CORE, or `POST_CARDIO_ONLY` eligibility.
- Verify the real in-app browser at 390×844 and desktop widths before claiming completion; do not merge, deploy, or close Issue #95.

### Task 1: Data contract and red tests

**Files:**
- Create: `tests/body_equipment_station_test.js`
- Create: `tests/test_issue95_equipment_station.py`
- Modify: `data/src/actions.json`
- Modify: `data/src/venue.json`
- Modify: `schemas/v14.8/action.schema.json`
- Modify: `schemas/v14.8/venue.schema.json`
- Modify: `tools/validate_v148_schema.py`
- Modify: `tests/body_data_runtime_test.js`

**Interfaces:**
- Produce `action.stationId` for confirmed combo-machine actions and a venue-owned Body station policy.
- Produce `V15BodyResolver.assessEquipmentStation({familyId, level, slotKey, actionId, currentSelections, stationReusePolicy})` as the shared eligibility/audit contract.

- [ ] Add tests that identify the leg-extension/curl pair and chest-press/shoulder-press pair as the same physical station, keep DB RDL as a different station, and return `UNVERIFIED` for an action without confirmed station metadata.
- [ ] Run `node tests/body_equipment_station_test.js` and the focused Python test; confirm failure is caused by missing station metadata/policy.
- [ ] Add only evidence-backed action `stationId` values plus `stationGroup` policy for multi-instance cable frames; define `STATION_REUSE_ALLOWED` as the only explicit reuse token.
- [ ] Extend action/Body schemas and the repository validator for field types, known action references, valid severity/mode enums, and deterministic policy shape.
- [ ] Rebuild `data/system-data.js`, then run the focused data/schema tests and confirm the new contract passes.

### Task 2: Resolver and Conflict integration

**Files:**
- Modify: `js/resolvers/body.js`
- Modify: `js/conflict-plugins/body.js`
- Modify: `js/conflict-core.js` only if the shared reference context needs a non-breaking metadata hook
- Modify: `tests/body_candidate_runtime_test.js`
- Modify: `tests/body_conflict_plugin_test.js`
- Modify: `tests/body_resolver_baseline_test.js`

**Interfaces:**
- `assessEquipmentStation` returns `{ok, status, stationId, stationGroup, reasons, conflicts, reusePolicy}`.
- Resolver `candidates`, `isSelectionValid`, and `resolve` consume the same assessment and carry `domainContext.equipmentStations` plus per-slot audit records.
- Body Conflict emits deterministic `BODY_EQUIPMENT_STATION_DUPLICATE` for blocked exact reuse and `BODY_EQUIPMENT_STATION_CONCENTRATION` for group concentration or explicit allowed reuse.

- [ ] Add red tests for automatic Body baseline uniqueness, manual leg-extension/curl rejection, DB RDL positive case, explicit reuse warning, unknown-station fallback, and deterministic issue order.
- [ ] Run the focused tests and confirm the red failures identify the missing resolver/plugin behavior.
- [ ] Implement exact station assessment before candidate scoring; exclude blocked candidates from default auto/manual pools without changing other gates.
- [ ] Implement independent Conflict auditing from resolved formal slots, with role filtering and explicit-policy handling.
- [ ] Re-run the focused suite and update the frozen Body baseline only after the new behavior is deterministic and justified.

### Task 3: Coach explanation and browser regression

**Files:**
- Modify: `js/coach/body-session.js`
- Modify: `js/coach/conflict-view.js` only if the existing issue renderer cannot expose the station name clearly
- Modify: `assets/app.css`
- Create: `tests/body_equipment_station_browser.spec.js`

**Interfaces:**
- Body session cards consume Resolver candidate/audit fields; UI does not recalculate station identity.
- Conflict copy must say the repeated resource is the same physical equipment station and distinguish a block from an explicit-policy warning.

- [ ] Add browser tests for Body-01/L2 and Body-04/L2 showing no exact station duplicate in the default plan, a manual blocked candidate explanation, and no horizontal overflow at 390/1080/1280/1440.
- [ ] Run the new browser test red before UI changes.
- [ ] Render a concise station warning/block in the existing Coach swap surface and keep unknown station metadata as an audit note rather than a fabricated label.
- [ ] Capture in-app browser screenshots at 390×844 and desktop width after testing; verify AX names and no page errors.

### Task 4: Full verification and review

**Files:**
- Modify: `tests/body_*` only where frozen expectations legitimately change
- Modify: `.github/workflows/schema-check.yml` only if a new required command is necessary; preserve existing gates

- [ ] Run all Node runtime tests, Python tests, schema validation, build freshness, artifact hygiene, JS syntax, and `git diff --check`.
- [ ] Run the complete Chromium suite with 390px and desktop coverage.
- [ ] Review the final diff for data truth, no duplicated UI rules, and no cross-template changes.
- [ ] Push the isolated branch, open a PR referencing #95, and post verification evidence to Issue #95 without merging or closing it.
