# Issue #8 Coach View Module Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `js/views-coach.js` into focused Coach modules while preserving all current runtime behavior and compatibility globals.

**Architecture:** Keep the current plain-IIFE static-site model. New files register focused APIs under `window.V14CoachModules`; `js/views-coach.js` becomes a thin facade that routes render calls, binds DOM events, and re-exports the existing public compatibility surface.

**Tech Stack:** Vanilla JavaScript, static HTML, Node runtime tests, pytest structural/regression tests, Playwright Chromium smoke tests.

**Spec:** `docs/superpowers/specs/2026-09-10-issue-8-coach-view-modules-design.md`

## Global Constraints

- Preserve `window.V14Views.coach`, `window.V14Bind.coach`, and `window.V14CoachAnatomy` public behavior.
- Preserve existing DOM IDs/classes, Router/State contracts, Composer resolver behavior, PREP/Foam output, and Coach/Member copy output.
- Do not implement #25 PREP V2 in this Issue.
- Do not add a framework, bundler, or backend.

---

### Task 1: Establish the module-boundary contract test

**Files:**
- Create: `tests/test_coach_view_modules.py`
- Modify: `tests/composer_copy_test.js`

**Interfaces:**
- Consumes: current `index.html`, current `V14CoachAnatomy` compatibility API.
- Produces: an executable contract describing required module files and script order.

- [ ] **Step 1: Write the failing structural test**

Require these files: `common.js`, `home.js`, `slot.js`, `prep.js`, `foam.js`, `summary.js`, `conflict-view.js`, `session.js`, `composer-view.js`. Assert all are loaded before `js/views-coach.js`; assert the facade no longer contains the monolithic rendering functions.

- [ ] **Step 2: Update the Node copy test loader before production changes**

Load the new Coach module paths before `js/views-coach.js`, while retaining the same copy assertions.

- [ ] **Step 3: Run CI and verify RED**

Expected: structural test fails because the new module files do not yet exist.

---

### Task 2: Extract common, slot, summary, and conflict rendering

**Files:**
- Create: `js/coach/common.js`
- Create: `js/coach/slot.js`
- Create: `js/coach/summary.js`
- Create: `js/coach/conflict-view.js`

**Interfaces:**
- Produces `V14CoachModules.Common`, `.Slot`, `.Summary`, `.ConflictView`.
- No behavior changes; HTML strings and selectors stay byte-equivalent where practical.

- [ ] **Step 1: Move shared escaping/data/hero/mode-switch/copy-toolbar helpers into `Common`.**
- [ ] **Step 2: Move preset/Composer slot card rendering into `Slot`.**
- [ ] **Step 3: Move muscle summary rendering into `Summary`.**
- [ ] **Step 4: Move conflict box rendering into `ConflictView`.**
- [ ] **Step 5: Run syntax and regression checks.**

---

### Task 3: Extract PREP and Foam domains

**Files:**
- Create: `js/coach/prep.js`
- Create: `js/coach/foam.js`

**Interfaces:**
- `Prep.matchedWarmups`, `Prep.warmupCards`, `Prep.composerPrepItems`, `Prep.composerPrepHtml`.
- `Foam.matchedFoamRolls`, `Foam.foamRollCards`, `Foam.composerFoamItems`.

- [ ] **Step 1: Move warmup matcher/fallback/render helpers unchanged into `Prep`.**
- [ ] **Step 2: Move foam matcher/fallback/render helpers unchanged into `Foam`.**
- [ ] **Step 3: Keep current Anatomy ranking and fallback semantics unchanged.**
- [ ] **Step 4: Run Node regression and syntax checks.**

---

### Task 4: Extract preset Session domain

**Files:**
- Create: `js/coach/session.js`

**Interfaces:**
- Produces `Session.selectedTrainingIds`, `Session.buildCopyPayload`, `Session.render`.
- Consumes Common/Slot/PREP/Foam/Summary/Conflict modules.

- [ ] **Step 1: Move selected-training grouping.**
- [ ] **Step 2: Move preset copy-payload construction.**
- [ ] **Step 3: Move preset Session rendering.**
- [ ] **Step 4: Verify preset copy output remains unchanged.**

---

### Task 5: Extract Composer view domain

**Files:**
- Create: `js/coach/composer-view.js`

**Interfaces:**
- Produces `ComposerView.composeHref`, `composerContext`, `buildComposerCopyPayload`, `render`.
- Consumes existing `V14Composer`, State, PREP/Foam/Summary/Conflict/Slot modules.

- [ ] **Step 1: Move Composer URL/context/window/render helpers.**
- [ ] **Step 2: Move Composer copy-payload construction.**
- [ ] **Step 3: Preserve all query flags and rerender semantics.**
- [ ] **Step 4: Verify existing Composer copy/runtime tests.**

---

### Task 6: Replace the monolith with the thin facade and wire scripts

**Files:**
- Modify: `js/views-coach.js`
- Modify: `index.html`

**Interfaces:**
- Re-exports exactly the current `V14Views.coach`, `V14Bind.coach`, and `V14CoachAnatomy` compatibility API.

- [ ] **Step 1: Add Coach module scripts to `index.html` in dependency order.**
- [ ] **Step 2: Reduce `views-coach.js` to route delegation and event binding.**
- [ ] **Step 3: Re-export `V14CoachAnatomy` functions from Session/ComposerView.**
- [ ] **Step 4: Run the full verification suite.**

Run:

```bash
python -m pytest -q
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
for f in tests/*_test.js; do node "$f"; done
find data js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
npx playwright test
```

Expected: all checks pass; Coach home, preset Session, Composer, swaps, copy, and mobile smoke remain unchanged.
