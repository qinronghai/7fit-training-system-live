# F111 Router + Migration Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish #28 first, then #30, so F111 has canonical template-aware routes and full parity on the V15 Multi-Template architecture without changing training results.

**Architecture:** Keep Router limited to URL normalization and keep F111 business logic in the existing F111 Resolver. After #28 merges, create a fresh #30 branch and add signature-based parity tests that compare the existing V14 F111 outputs against `V15TemplateResolver.resolve('f111', ...)`; migrate Coach consumption only where required to make V15 the authoritative public resolved session while retaining V14 compatibility facades.

**Tech Stack:** Static JavaScript, hash router, Node 22 VM/runtime tests, Python pytest, Playwright Chromium 1.63, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-10-f111-migration-parity-design.md`

## Global Constraints

- Do not change F111 training content, recipes, L/T/S/CORE semantics, prescriptions or facility route rules.
- Do not implement Body or Conditioning domain logic.
- Preserve legacy F111 URLs and current visible page design.
- New public F111 routes normalize into the existing Coach renderer route shape.
- Every production behavior change requires a failing test first.
- #28 and #30 use separate branches/PRs; #30 starts from the deployed #28 master SHA.

---

### Task 1: #28 F111 route contract

**Files:**
- Modify: `js/router.js`
- Modify: `js/app.js` only if breadcrumbs need canonical route awareness
- Create: `tests/multi_template_router_test.js`
- Modify: `tests/browser_smoke.spec.js`
- Modify: `tests/test_v14_routes.py` only for declared-route coverage if needed

**Interfaces:**
- Consumes: `V14_DATA.templateRegistry`.
- Produces: `V14Router.parseHash(hash)`, `isValid(route)`, and `canonicalHash(route)` with stable F111 route normalization.

- [ ] **Step 1: Write failing Node route tests**

Cover canonical F111 home/composer/preset, legacy aliases, query preservation, invalid recipe/level/template, and `canonicalHash()` output.

- [ ] **Step 2: Verify RED**

Run through branch CI. Expected failure: canonical `#/coach/f111/compose` and `#/coach/f111/f111-06/l3` are not parsed as composer/preset and `canonicalHash` is missing.

- [ ] **Step 3: Implement minimal router normalization**

Add template-aware parsing before the generic template-home branch, preserve legacy parsing, and serialize F111 canonical hashes without adding training logic.

- [ ] **Step 4: Verify Node GREEN**

All existing Node tests plus `multi_template_router_test.js` pass.

- [ ] **Step 5: Add browser RED/GREEN**

Add Playwright coverage for canonical/legacy F111 preset and composer URLs, direct refresh, back/forward, invalid route safe fallback, 390px and `pageerror=0`.

- [ ] **Step 6: Merge #28 and verify master**

PR diff must contain only Router/UI-navigation/tests/docs. Squash merge, then require master verify + Browser Smoke + Pages deploy success and close #28.

---

### Task 2: #30 32 preset parity contract

**Files:**
- Create: `tests/f111_migration_parity_test.js`
- Modify production files only after RED is demonstrated.

**Interfaces:**
- Legacy source: existing session/state/composer helpers used by current Coach pages.
- V15 source: `V15TemplateResolver.resolve('f111', {mode:'preset', recipeId, level, selections})`.
- Produces: normalized parity signature helper inside the test only.

- [ ] **Step 1: Start fresh #30 branch from deployed #28 master**
- [ ] **Step 2: Write 32-preset signature test**

For F111-01…08 × L1…L4 compare six slot keys/actionIds, level/family identity, anatomy signature, conflict signature, and resolved PREP IDs. Freeze current visible result as the parity baseline through existing runtime APIs; do not copy a static fixture that can drift silently.

- [ ] **Step 3: Verify RED if V15/public consumption differs**

The test must prove the mismatch before any migration code is changed. If it passes immediately for resolver-level signatures, keep it as a regression gate and move the RED boundary to page consumption/copy parity.

- [ ] **Step 4: Implement minimal preset migration**

Make Session public consumption use V15 resolved session/state where needed while preserving renderer layout and old APIs as facades.

- [ ] **Step 5: Verify 32-preset GREEN**

---

### Task 3: #30 80 composer parity contract

**Files:**
- Modify: `tests/f111_migration_parity_test.js`
- Likely modify: `js/coach/composer-view.js`
- Likely modify: `js/coach/session.js`
- Modify: `js/views-coach.js` only if event binding must use canonical V15 state directly

**Interfaces:**
- V14 baseline: `V14Composer.resolve({level, lowerMode, upperMode, coreDemand, selections})`.
- V15: `V15TemplateResolver.resolve('f111', {mode:'composer', ...})`.

- [ ] **Step 1: Add 80-state RED/parity test**

Enumerate 5 lower modes × 4 upper modes × L1–L4 using each core demand's existing default path; compare six slot actionIds, tier/grade/prescription signature, anatomy, conflict, PREP and copy context.

- [ ] **Step 2: Verify failure point**
- [ ] **Step 3: Make Composer public resolved-session consumption authoritative through V15**
- [ ] **Step 4: Verify all 80 states GREEN**

---

### Task 4: State, Copy and browser parity

**Files:**
- Extend: `tests/f111_migration_parity_test.js`
- Modify: `tests/browser_smoke.spec.js`
- Production changes limited to Session/Composer/State integration if tests expose a real mismatch.

**Interfaces:**
- State: `V15State.templates.f111` / V14 facade.
- PREP: `V14CoachModules.Prep` shared Phase B1 engine.
- Copy: existing `V14SessionCopy.formatCoach/formatMember` presentation.

- [ ] **Step 1: Add legacy-state migration parity**

Seed V14 preset/composer overrides, boot V15, verify valid manual action decisions restore or safely fall back without invented inputs.

- [ ] **Step 2: Add Copy anti-regression**

For representative preset and composer cases compare Coach/Member formatted output before/after migration and ensure current PREP manual selection is the copied PREP.

- [ ] **Step 3: Add Playwright parity flow**

On 390×844 test legacy and canonical preset/composer URLs, strength swap, PREP swap, rerender, reload, back/forward, reset, no horizontal overflow, `pageerror=0`.

- [ ] **Step 4: Run complete branch gates**

Expected: pytest + build freshness + schema + all Node tests + Playwright all green.

---

### Task 5: #30 final audit and release

**Files:**
- Update Issue #30 checklist/evidence only after deployment succeeds.

- [ ] **Step 1: Audit PR diff**

Reject any changes to F111 data content, Body/Conditioning resolvers, unrelated UI redesign or route/business-rule coupling.

- [ ] **Step 2: Squash merge with locked HEAD**
- [ ] **Step 3: Verify master verify / Browser Smoke / Pages deploy**
- [ ] **Step 4: Close #30 completed and record PR, merge SHA, test matrix and deployment run**

# Self-review

- Coverage: #28 canonical/legacy routes and every #30 acceptance/test item are mapped to tasks.
- Placeholder scan: no TBD/TODO/"similar to" placeholders.
- Type consistency: route outputs remain compatible with current `V14Views.coach`; V15 resolver/state APIs match the existing #29/#31 contracts.
