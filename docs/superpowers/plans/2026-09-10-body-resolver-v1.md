# Body Resolver V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Body Resolver V1 for 4 Body Families × L1–L4 with deterministic candidate selection, structured prescriptions, Direct Work Sets, Body Conflict, and V15 State reconciliation while preserving F111 behavior.

**Architecture:** Keep the shared platform generic. Extend `ResolvedSession` additively with optional `domainContext`; isolate Body selection/session assembly in `js/resolvers/body.js`, Body volume/prescription math in `js/body-volume.js`, and Body-specific conflict rules in `js/conflict-plugins/body.js`. `V15State` remains the owner of user intent only; Body Resolver stays pure and receives selections explicitly.

**Tech Stack:** Vanilla browser JavaScript, Node 22 VM/assert runtime tests, Python pytest/schema validation, Playwright 1.63 Chromium, GitHub Pages static deployment.

**Spec:** `docs/superpowers/specs/2026-09-10-body-resolver-v1-design.md`

## Global Constraints

- `ResolvedSession.schemaVersion` remains exactly `1`.
- `conflictContext.status` remains exactly `PASS | WARN | FAIL`.
- F111 public output and frozen conflict parity must not change.
- Body main routes are exactly `1F_ONLY` and `FLEX_1F_2F`.
- Body Resolver must not read `V15State`, LocalStorage/sessionStorage, clock time, randomness, action-name heuristics, or JS object insertion order.
- Body volume derives only from `bodyActionMeta + bodyLevelPolicies + bodyPrescriptionProfiles`; never parse `main.content[].prescription`.
- L1/L2 emit 5 Body main slots; L3/L4 emit 6 including OPTIONAL.
- State stores user intent only; derived volume/anatomy/conflict/prescriptions are never persisted.
- #35 UI is out of scope.

---

### Task 1: Additive ResolvedSession domainContext + Body registration

**Files:**
- Modify: `js/resolved-session.js`
- Create: `js/resolvers/body.js`
- Modify: `index.html`
- Create: `tests/body_resolved_session_contract_test.js`

**Interfaces:**
- Consumes: `V15TemplateResolver.register(templateId, resolver)`, `V15ResolvedSession.validate(session)`.
- Produces: optional `ResolvedSession.domainContext`; `window.V15BodyResolver.resolve(input)`; dispatcher registration for `body`.

- [ ] **Step 1: Write the failing contract test**

```js
const session = syntheticBodySession();
session.domainContext = {kind:'BODY',slots:{},volume:{}};
assert.strictEqual(V15ResolvedSession.validate(session).ok,true);
assert.strictEqual(V15TemplateResolver.has('body'),true);
```

Before implementation the first assertion must fail because `domainContext` is an unknown top-level key and the registration assertion must fail because Body Resolver does not exist.

- [ ] **Step 2: Confirm RED**

Run:

```bash
node tests/body_resolved_session_contract_test.js
```

Expected: FAIL specifically on `domainContext` contract and/or missing Body Resolver registration, with all pre-existing tests untouched.

- [ ] **Step 3: Implement the minimal additive shared contract**

Add a `validateDomainContext` branch that requires an object with non-empty `kind`, allows template-specific fields beneath it, and requires Body sessions to carry `kind === 'BODY'`. Keep F111 sessions valid without `domainContext`.

Create `js/resolvers/body.js` initially with:

```js
window.V15BodyResolver = {resolve, candidates};
window.V15TemplateResolver.register('body', resolve);
```

`resolve` should validate `familyId` and `level` and may initially throw `BODY_RESOLVER_NOT_IMPLEMENTED` after registration; later tasks replace this stub before the task is considered release-complete.

- [ ] **Step 4: Load Body resolver after dispatcher dependencies**

Update `index.html` so the eventual order is:

```text
resolved-session
conflict-core
conflict-service
conflict-plugins/body
body-volume
template-resolver
resolvers/f111
resolvers/body
```

During Task 1, only files that exist should be loaded; later tasks add the other scripts in dependency order.

- [ ] **Step 5: Confirm GREEN + F111 compatibility**

Run:

```bash
node tests/body_resolved_session_contract_test.js
node tests/resolved_session_runtime_test.js
node tests/f111_migration_parity_test.js
node tests/f111_conflict_parity_test.js
```

Expected: PASS; frozen F111 conflict fingerprint remains unchanged.

- [ ] **Step 6: Commit**

```bash
git add js/resolved-session.js js/resolvers/body.js index.html tests/body_resolved_session_contract_test.js
git commit -m "feat: add Body resolved-session contract"
```

---

### Task 2: Deterministic candidate legality and ranking

**Files:**
- Modify: `js/resolvers/body.js`
- Create: `tests/body_candidate_runtime_test.js`

**Interfaces:**
- Consumes: `V14_DATA.bodyFamilies`, `bodyActionMeta`, formal `actions`.
- Produces: `V15BodyResolver.candidates({familyId,level,slotKey,currentSelections}) -> {recommended,candidates}` and internal `isCandidateLegal(...)`.

- [ ] **Step 1: Write positive/negative RED tests**

Test every hard gate:

```js
assert(Body.candidates({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).candidates.length >= 2);
assert(!ids.includes('hake_shendun')); // L1 illegal
assert(!ids.includes('tun_tui'));      // wrong Family/role context
```

Mutate in-memory fixtures one at a time to prove unknown action, non-auto status, illegal route, wrong Family, wrong Level, wrong Role and PRIMARY/SECONDARY without Family primary-target overlap are excluded.

- [ ] **Step 2: Confirm RED**

```bash
node tests/body_candidate_runtime_test.js
```

Expected: FAIL because candidate API is not implemented.

- [ ] **Step 3: Implement hard gates**

Legal iff:

```text
meta.families includes familyId
meta.levels includes level
meta.roles includes family.slotPolicy[slotKey]
action exists
action.status === '可自动编排'
action.route in ['1F_ONLY','FLEX_1F_2F']
PRIMARY/SECONDARY => directTargets overlaps family.primaryTargets
```

- [ ] **Step 4: Implement sequential ranking inputs**

Ranking keys, in order: primary-target coverage, missing-target bonus, role/level fit, Level-appropriate stability, fatigue control, movement diversity, target-redundancy penalty, `actionId.localeCompare()`.

`currentSelections` must affect ranking but not legality. Do not use object insertion order as a tie-break.

- [ ] **Step 5: Prove deterministic ordering**

Resolve the same candidate request repeatedly and after reversing a copied metadata-entry array; logical candidate order must remain identical.

- [ ] **Step 6: Run GREEN**

```bash
node tests/body_candidate_runtime_test.js
node tests/body_data_runtime_test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/resolvers/body.js tests/body_candidate_runtime_test.js
git commit -m "feat: add Body candidate engine"
```

---

### Task 3: Structured prescription, volume calculator, and 16-state baseline

**Files:**
- Create: `js/body-volume.js`
- Modify: `js/resolvers/body.js`
- Modify: `index.html`
- Create: `tests/body_volume_runtime_test.js`
- Create: `tests/body_resolver_baseline_test.js`

**Interfaces:**
- Produces: `window.V15BodyVolume.buildSlot(...)`, `window.V15BodyVolume.summarize(slots)`, complete `domainContext`, and 16 deterministic Body sessions.

- [ ] **Step 1: Write Volume RED tests**

Cover:

```js
// multi-direct-target 3 sets count once in session total but 3 for each direct target
assert.strictEqual(volume.totalWorkingSets,3);
assert.strictEqual(volume.directSetsByTarget.glute_max,3);
assert.strictEqual(volume.directSetsByTarget.hamstrings,3);

// unilateral 3 sets/side still counts 3
assert.strictEqual(unilateral.totalWorkingSets,3);

// secondary exposure is separate
assert.strictEqual(volume.directSetsByTarget.front_delts||0,0);
assert.strictEqual(volume.secondaryExposureByTarget.front_delts,3);
```

Also corrupt the human-readable `prescription` string and assert structured volume remains unchanged.

- [ ] **Step 2: Confirm Volume RED**

```bash
node tests/body_volume_runtime_test.js
```

Expected: FAIL because `V15BodyVolume` does not exist.

- [ ] **Step 3: Implement structured prescription**

For each slot:

```text
workingSets = bodyLevelPolicies[level].defaultWorkingSets[slotKey]
rirRange = bodyLevelPolicies[level].rirRange
repRange/rest/perSide = bodyPrescriptionProfiles[meta.repProfile]
```

Human-readable `main.content[].prescription` is formatted from structured fields only.

- [ ] **Step 4: Implement volume summary and deterministic time heuristic**

Use the approved formula:

```text
midReps = midpoint(repRange)
midRest = midpoint(restSecondsRange)
setExecutionSeconds = midReps * 4
perSetCoachingSetupSeconds = 45
slotSeconds = workingSets*(setExecutionSeconds+45) + max(workingSets-1,0)*midRest
+ 60 seconds between adjacent active slots
estimatedMinutes = ceil(totalSeconds/60)
```

Compute total sets once per slot; direct and secondary target maps independently; isolation ratio from isolation working sets; high-fatigue compound count from metadata.

- [ ] **Step 5: Write 16-state RED test**

Loop `BODY-01..04 × L1..L4` through `V15TemplateResolver.resolve('body', {familyId,level})`. Assert 5 slots for L1/L2, 6 for L3/L4, correct roles, source `GENERATED`, resolverVersion `body-v1`, valid domain context and deterministic deep equality.

- [ ] **Step 6: Complete Body session assembly**

Build `prepContext` via `V14PrepResolver.contextFromBody`, Anatomy via `V14Anatomy.aggregate`, Copy context from final action IDs, `resolvedSelections`, warnings, `source:{type:'GENERATED',id:'BODY-xx-Ln'}`. Conflict may still be PASS placeholder only until Task 4 test explicitly replaces it; do not ship the task as final release before Task 4.

- [ ] **Step 7: Freeze baseline fingerprint**

Create a normalized signature from the approved fields and compute SHA256 in test. The first capture commit may log the SHA; the next commit freezes it. Never update the frozen hash merely to make a later implementation change green.

- [ ] **Step 8: Run GREEN**

```bash
node tests/body_volume_runtime_test.js
node tests/body_resolver_baseline_test.js
node tests/resolved_session_runtime_test.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add js/body-volume.js js/resolvers/body.js index.html tests/body_volume_runtime_test.js tests/body_resolver_baseline_test.js
git commit -m "feat: resolve Body baseline sessions and volume"
```

---

### Task 4: Body Conflict plugin

**Files:**
- Create: `js/conflict-plugins/body.js`
- Modify: `js/resolvers/body.js`
- Modify: `index.html`
- Create: `tests/body_conflict_plugin_test.js`

**Interfaces:**
- Consumes: `V15Conflict`, `V15ConflictCore`, Body `domainContext`.
- Produces: registered `body` conflict plugin and final Body `conflictContext`.

- [ ] **Step 1: Write RED cases**

Construct controlled Body drafts for:

```text
BODY_FAMILY_DEVIATION          hard
BODY_PRIMARY_TARGET_MISSING    hard
BODY_VOLUME_OUT_OF_RANGE       hard
BODY_HIGH_FATIGUE_STACK        warn
BODY_MOVEMENT_REDUNDANCY       warn
BODY_ISOLATION_HEAVY           warn
BODY_TIME_BUDGET               warn
```

Also assert Shared Core still catches duplicate/missing/route/status.

- [ ] **Step 2: Confirm RED**

```bash
node tests/body_conflict_plugin_test.js
```

Expected: FAIL because Body conflict plugin is not registered.

- [ ] **Step 3: Implement Body plugin**

Plugin reads final selected action metadata and `domainContext.volume`; it must not recalculate volume from prescription strings. Use `bodyConflictPolicy` thresholds. Produce stable `_order` values and public issue objects through `V15Conflict`.

- [ ] **Step 4: Wire Resolver conflict flow**

Body Resolver builds a conflict-evaluable draft, calls:

```js
V15Conflict.evaluate('body', draft, {
  sharedPolicy:{allowedRoutes:['1F_ONLY','FLEX_1F_2F'],allowedStatuses:['可自动编排']},
  pluginContext:{family,levelPolicy}
});
```

then attaches the returned `conflictContext` before final contract validation.

- [ ] **Step 5: Run GREEN and recheck baseline**

```bash
node tests/body_conflict_plugin_test.js
node tests/body_resolver_baseline_test.js
node tests/f111_conflict_parity_test.js
```

Expected: PASS; Body fingerprint is fixed to the post-conflict approved baseline; F111 fingerprint unchanged.

- [ ] **Step 6: Commit**

```bash
git add js/conflict-plugins/body.js js/resolvers/body.js index.html tests/body_conflict_plugin_test.js tests/body_resolver_baseline_test.js
git commit -m "feat: add Body conflict plugin"
```

---

### Task 5: V15 State reconcile for Body intent

**Files:**
- Prefer test-only: `tests/body_state_reconcile_test.js`
- Modify only if a real platform gap is proven: `js/state.js`

**Interfaces:**
- Consumes: `V15State.ensureSession/setSelection/reconcileSession/resetSession`, `V15BodyResolver.candidates/resolve`.
- Produces: proven Body manual-selection preserve/drop/reset behavior without derived state persistence.

- [ ] **Step 1: Write State RED/characterization tests**

Create `BODY-02-L3` with `resolverVersion:'body-v1'`; persist a legal manual PRIMARY. Reconcile with `isSelectionValid` delegating to Body candidate legality. Assert legal selection survives, an illegal role/level/action is dropped, resolver-version mismatch clears formal/PREP selections, reset returns auto baseline, and serialized State contains no `domainContext`, volume, Anatomy or Conflict.

- [ ] **Step 2: Run test**

```bash
node tests/body_state_reconcile_test.js
```

If current generic V15 State already passes, keep production `js/state.js` unchanged. If it fails, first confirm the failure is a generic platform defect rather than a Body-specific concern, then make the minimum generic fix.

- [ ] **Step 3: Assert manual source semantics**

A manual choice equal to baseline remains `source:'manual'`; after `resetSession` and fresh resolve, source is `auto`.

- [ ] **Step 4: Run GREEN**

```bash
node tests/body_state_reconcile_test.js
node tests/multi_template_state_test.js
node tests/state_version_guard_test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/body_state_reconcile_test.js js/state.js
git commit -m "test: verify Body state reconciliation"
```

If `js/state.js` is unchanged, omit it from `git add`.

---

### Task 6: Full regression, browser gate, PR review, merge and deploy

**Files:**
- Modify if required for script presence only: `index.html`
- No #35 Body UI files.

**Interfaces:**
- Produces: release-ready #34 branch merged to `master` with evidence.

- [ ] **Step 1: Run repository-wide verification**

```bash
python -m pytest -q
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
for f in tests/*_test.js; do node "$f"; done
find data js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: all green, including unchanged F111 parity.

- [ ] **Step 2: Run Playwright regression**

Use the repository CI path:

```bash
npm install --no-save --no-package-lock @playwright/test@1.63.0
npx playwright install chromium
npx playwright test
```

No Body UI-specific test is required in #34; existing browser tests must remain green and `pageerror=0` expectations unchanged.

- [ ] **Step 3: Diff audit**

Allowed production surface is limited to:

```text
js/resolved-session.js
js/body-volume.js
js/resolvers/body.js
js/conflict-plugins/body.js
index.html
```

plus #34 tests/docs. Reject accidental Body UI/Copy view changes, Body data-contract rewrites, or F111 behavior changes.

- [ ] **Step 4: Open PR with `Closes #34`**

PR body records the 16-state fingerprint, F111 conflict fingerprint, exact test counts and scope exclusions.

- [ ] **Step 5: Lock PR head and require independent PR CI**

Require both `verify` and `browser-smoke` success on the exact head SHA; review the PR diff before merge.

- [ ] **Step 6: Squash merge and verify master**

After merge, require master `verify`, `browser-smoke`, and Pages deploy success before treating #34 as complete. Confirm Issue #34 is closed/completed by `Closes #34` or close it only after those gates.
