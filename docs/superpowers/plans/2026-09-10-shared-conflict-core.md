# Shared Conflict Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract a template-neutral V15 conflict core from the already-validated F111 behavior, move F111-only rules into a plugin, and preserve exact F111 conflict behavior through a V14 compatibility facade.

**Architecture:** Add a pure `V15ConflictCore`, a registration-driven `V15Conflict` aggregator, and a focused `V15F111ConflictPlugin`. `V14Conflict` becomes a facade over V15 so current F111 resolver/UI callers keep working without a second conflict implementation. Public `ResolvedSession` status stays `PASS | WARN | FAIL`.

**Tech Stack:** dependency-free browser JavaScript, Node runtime tests, Python regression/schema tests, Playwright Chromium, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-10-shared-conflict-core-design.md`

## Global Constraints

- Preserve `ResolvedSession.conflictContext.status` as `PASS | WARN | FAIL`.
- Preserve issue shape `{severity,title,text,code}` with `severity = hard | warn | info`.
- Do not change F111 training content, Resolver selection behavior, PREP, Copy text, or Coach layout.
- Shared Core must not read F111/Body/Conditioning private resolver fields.
- F111 plugin must consume explicit current-session/plugin context, not stale cached state.
- Body/Conditioning domain rules are out of scope; only registration contract is tested.
- Do not invent venue equipment inventory while `venue.json` is empty.
- Keep dependency-free static runtime and current script-loading model.

---

### Task 1: Freeze Shared Conflict API with RED tests

**Files:**
- Create: `tests/shared_conflict_core_test.js`
- Modify: `.github/workflows/v148-schema-check.yml` only if the Node test list is explicit.

**Interfaces:**
- Consumes: `window.V14_DATA`, `window.V15ResolvedSession`.
- Produces expected API contract for later tasks: `window.V15ConflictCore.evaluate(resolvedSession, policy?)` and `window.V15Conflict.register/evaluate`.

- [ ] **Step 1: Write failing tests** covering duplicate action, missing action, illegal route, invalid status, optional equipment policy, optional time budget, deterministic issue ordering, plugin registration, duplicate registration, and unknown plugin.
- [ ] **Step 2: Run the repository Node gate** and verify failure is caused by missing `V15ConflictCore` / `V15Conflict`, while existing tests remain green up to that point.
- [ ] **Step 3: Commit RED tests** without production implementation.

### Task 2: Implement V15ConflictCore and registry/aggregator

**Files:**
- Create: `js/conflict-core.js`
- Create: `js/conflict-service.js`
- Modify: `index.html` to load the two scripts before F111 resolver/plugin consumers.
- Test: `tests/shared_conflict_core_test.js`

**Interfaces:**
- `V15ConflictCore.evaluate(resolvedSession, policy={}) -> ConflictIssue[]`
- `V15Conflict.register(templateId, plugin)` where plugin exposes `evaluate(resolvedSession, context) -> ConflictIssue[]`
- `V15Conflict.evaluate(templateId, resolvedSession, context={}) -> {status,hardCount,warnCount,issues}`

- [ ] **Step 1: Implement minimal shared checks** required by Task 1, using fixed rule order.
- [ ] **Step 2: Implement plugin registry and deterministic aggregation** with stable error codes for invalid/unknown registration.
- [ ] **Step 3: Run focused Node test and full Node gate**; keep Python/schema/build gates green.
- [ ] **Step 4: Commit GREEN implementation.**

### Task 3: Freeze F111 before/after conflict parity

**Files:**
- Create: `tests/f111_conflict_parity_test.js`

**Interfaces:**
- Consumes current `V14Conflict.evaluate()` and `evaluateComposer()` as baseline snapshots from the branch before facade replacement.
- Produces normalized signatures of `{status,hardCount,warnCount,issues:[severity,title,text,code]}` across preset/composer fixtures.

- [ ] **Step 1: Add parity fixtures** covering all 32 official preset states and all 80 composer states, plus representative manual changes that trigger route/status/grade/pattern/tier/load/equipment/anatomy warnings.
- [ ] **Step 2: Run test against pre-migration implementation** to capture/verify deterministic baseline signatures.
- [ ] **Step 3: Add RED assertion requiring `V15F111ConflictPlugin` and V15-routed legacy facade**, then verify it fails for the missing plugin/facade migration.
- [ ] **Step 4: Commit parity RED tests.**

### Task 4: Extract F111 plugin and convert V14Conflict to facade

**Files:**
- Create: `js/conflict-plugins/f111.js`
- Modify: `js/conflict.js`
- Modify: `js/resolvers/f111.js` only as needed to pass explicit current F111 conflict context.
- Modify: `index.html` script order.
- Test: `tests/f111_conflict_parity_test.js`

**Interfaces:**
- `V15F111ConflictPlugin.evaluate(resolvedSession, context) -> ConflictIssue[]`
- `V14Conflict.evaluate(sessionId, selectedIds)` and `evaluateComposer(resolved)` retain current signatures but delegate to V15.

- [ ] **Step 1: Move F111-only rules into the plugin** without changing messages, severities, codes, or rule order.
- [ ] **Step 2: Make V14Conflict a compatibility facade** that constructs the minimum explicit F111 context and delegates to `V15Conflict.evaluate('f111', ...)`.
- [ ] **Step 3: Ensure F111 resolver conflictContext still validates against ResolvedSession v1.**
- [ ] **Step 4: Run 32+80 parity and existing Composer/Preset/Copy/PREP Node regressions.**
- [ ] **Step 5: Commit GREEN extraction.**

### Task 5: Browser and release regression gate

**Files:**
- Modify: `tests/browser/coach.spec.js` or create focused `tests/browser/conflict.spec.js` according to current test layout.

**Interfaces:**
- User-visible Coach Conflict view remains unchanged and consumes `{status,hardCount,warnCount,issues}`.

- [ ] **Step 1: Add Playwright coverage** for a canonical F111 preset and composer conflict path, including one swap that produces a warning and one reset back to baseline at 390×844.
- [ ] **Step 2: Verify `pageerror=0`, no horizontal overflow, and conflict text/status parity after reload.**
- [ ] **Step 3: Run full repository gate:** Python regression/build/schema, all Node/JS syntax tests, and all Playwright Chromium tests.
- [ ] **Step 4: Diff audit**: production changes restricted to conflict core/service/plugin/facade plus minimal resolver/script-order wiring.
- [ ] **Step 5: Create PR for #32, lock head SHA, rerun PR gates, squash merge, then verify master `verify / browser-smoke / deploy` before closing #32.**
