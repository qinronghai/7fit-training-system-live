# Conditioning Multi-Block Blueprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Conditioning single-MAIN session contract with a deterministic, saveable multi-block class blueprint and explicit A/B/C variants that are useful to members and teachable for coaches.

**Architecture:** Keep the existing Conditioning Protocol Engine as the execution primitive for one block, and add a data-backed Blueprint Engine that composes validated PREP, BUILD/MAIN/CHALLENGE blocks, and RECOVERY. The Resolver will resolve every block through the existing candidate rules, expose block-namespaced stations and aggregate timing/anatomy/conflict/copy contexts; State will persist blueprint, variant, and block-aware selections with an explicit safe fallback for old single-block records. The Coach UI will render a vertical timeline and both copy formats will describe goals and measurable completion without leaking internal enums.

**Tech Stack:** Browser-native ES modules/scripts, JSON data contracts, Node assertion tests, Python schema/data tests, Playwright browser smoke tests, GitHub Actions artifact and live-gate checks.

**Spec:** GitHub Issue #85, `[P0][EPIC][Conditioning] 将单 Block 体能课重构为多段式课程蓝图并加入 A/B/C 周期轮换`.

## Global Constraints

- Preserve `POST_CARDIO_ONLY`; never promote an unaudited route or invent equipment/actions to satisfy a count.
- Use deterministic variant selection; the same family, level, variant, and selections must resolve identically.
- Every block must retain legal Family × Level × Protocol × Route × Zone candidate validation.
- L3 must resolve three substantive training blocks with a real PREP and RECOVERY duration in the full-session total; L1/L2/L4 must follow the approved matrix and power/fatigue rules.
- Saved sessions must include `templateId`, `familyId`, `level`, `sessionBlueprintId`, `variantId`, `schemaVersion`, and block-namespaced selections.
- Old single-block records must not be silently reinterpreted; migration is explicit and failure is atomic with system-recommended fallback.
- Coach/member copy must use Chinese business meaning and never expose resolver keys, conflict codes, modality keys, or route enums.
- Do not merge, deploy, publish, or close Issue #85 in this branch; create a reviewable PR only after fresh automated and browser evidence.

---

### Task 1: Blueprint and Variant Data Contract

**Files:**
- Create: `data/src/conditioning-blueprints.json`
- Modify: `data/src/manifest.json`
- Modify: `schemas/v14.8/conditioning.schema.json`
- Modify: `tools/validate_v148_schema.py`
- Test: `tests/conditioning_blueprint_data_test.js`
- Test: `tests/test_issue85_conditioning_blueprints.py`

**Interfaces:**
- Produces `conditioningBlueprints[familyId][level][variantId]` records with `sessionBlueprintId`, `variantId`, `label`, `goal`, `blocks`, `prep`, `recovery`, and `version`.
- Each block produces `key`, `role`, `goal`, `protocolId`, `prescription`, `targetRpe`, `stations`, `coachingCues`, `scaleRules`, `stopCriteria`, `completionMetric`, `equipment`, `zone`, and `transitionAfterSeconds`.
- A station reference is `{actionId, taskLabel, setup, equipment, zone}` and is validated against `conditioningActionMeta`, action route/status, and the selected protocol.

- [ ] **Step 1: Write the failing data tests**

```javascript
const data = loadData();
for (const familyId of data.conditioningFamilyIds) {
  for (const level of ['L1', 'L2', 'L3', 'L4']) {
    const variants = data.conditioningBlueprints[familyId][level];
    assert.deepStrictEqual(Object.keys(variants).sort(), ['A', 'B', 'C']);
    for (const variant of Object.values(variants)) {
      assert(variant.sessionBlueprintId);
      assert.strictEqual(variant.blocks.length, level === 'L3' || level === 'L4' ? 3 : level === 'L2' ? 3 : 2);
      assert(variant.prep.durationMinutes >= 10 && variant.recovery.durationMinutes >= 5);
      assert(variant.blocks.every(block => block.key && block.goal && block.coachingCues.length));
    }
  }
}
```

```python
def test_blueprints_reference_only_legal_conditioning_actions(repo_data):
    data = repo_data("conditioning-blueprints.json")
    actions = repo_data("actions.json")
    conditioning = repo_data("conditioning.json")
    for family_id, levels in data["conditioningBlueprints"].items():
        for level, variants in levels.items():
            for variant in variants.values():
                for block in variant["blocks"]:
                    assert block["protocolId"] in conditioning["conditioningProtocols"]
                    for station in block["stations"]:
                        action = actions["actions"][station["actionId"]]
                        assert action["route"] == "CONDITIONING_2F"
                        assert action["status"] == "可自动编排"
```

- [ ] **Step 2: Run the focused tests and verify the expected missing-contract failure**

Run: `node tests/conditioning_blueprint_data_test.js && uv run --with pytest pytest -q tests/test_issue85_conditioning_blueprints.py`

Expected: FAIL because `conditioningBlueprints` is not present in the current generated data.

- [ ] **Step 3: Add the minimal explicit A/B/C blueprint records**

Use only existing audited Conditioning actions and the existing `CONDITIONING_2F` route. For CON-01, express value through technique, pacing, duration, and completion metrics rather than inventing a third machine. For CON-02–04, use existing legal actions and place power work before high fatigue work. Register `conditioning-blueprints.json` in the manifest and add schema/data cross-reference validation.

- [ ] **Step 4: Run focused data/schema tests and then the generated-data check**

Run: `node tests/conditioning_blueprint_data_test.js && uv run --with pytest pytest -q tests/test_issue85_conditioning_blueprints.py && python3 tools/build_system_data.py --check && uv run --with beautifulsoup4 --with jsonschema python tools/validate_v148_schema.py`

Expected: PASS with no generated-data drift.

- [ ] **Step 5: Commit**

```bash
git add data/src/conditioning-blueprints.json data/src/manifest.json schemas/v14.8/conditioning.schema.json tools/validate_v148_schema.py tests/conditioning_blueprint_data_test.js tests/test_issue85_conditioning_blueprints.py
git commit -m "feat(issue-85): add Conditioning blueprint variants"
```

### Task 2: Multi-Block Resolver and Conflict Contract

**Files:**
- Modify: `js/conditioning-protocol.js`
- Modify: `js/resolvers/conditioning.js`
- Modify: `js/conflict-plugins/conditioning.js`
- Modify: `js/template-resolver.js` only if the dispatcher contract needs the new session version
- Test: `tests/conditioning_multi_block_resolver_test.js`
- Test: `tests/conditioning_conflict_plugin_test.js`

**Interfaces:**
- `V15ConditioningProtocol.blueprint({familyId, level, variantId, selections})` returns the validated blueprint definition.
- `V15ConditioningResolver.resolve({familyId, level, variantId, selections})` returns `schemaVersion: 2`, `resolverVersion: conditioning-v2`, `sessionBlueprintId`, `variantId`, `blocks`, and backward-compatible `main.content.blocks` as the same block list.
- Each resolved station key is `BLOCK-A/STATION-1` (or its block key), and `domainContext.blocks` is the source of truth; legacy `domainContext.stations` is omitted or a documented compatibility projection only.

- [ ] **Step 1: Write failing Resolver tests**

```javascript
const session = resolve({familyId: 'CON-01', level: 'L3', variantId: 'A'});
assert.strictEqual(session.schemaVersion, 2);
assert.strictEqual(session.resolverVersion, 'conditioning-v2');
assert.strictEqual(session.blocks.length, 3);
assert.deepStrictEqual(session.blocks.map(block => block.key), ['BLOCK-A', 'BLOCK-B', 'BLOCK-C']);
assert(session.blocks.every(block => block.goal && block.coachingCues.length && block.completionMetric));
assert(session.blocks.every(block => Object.keys(block.stations).every(key => key.startsWith(`${block.key}/STATION-`))));
assert(session.timing.prepMinutes >= 10 && session.timing.recoveryMinutes >= 5);
assert(session.timing.fullSessionMinutes > session.timing.mainTrainingMinutes);
```

```javascript
const a = resolve({familyId: 'CON-03', level: 'L3', variantId: 'B'});
const b = resolve({familyId: 'CON-03', level: 'L3', variantId: 'B'});
assert.deepStrictEqual(a, b);
assert.strictEqual(a.conflictContext.status, 'PASS');
assert(!JSON.stringify(a).includes('POST_CARDIO_ONLY'));
```

- [ ] **Step 2: Run the focused resolver test and verify it fails on the old single-block output**

Run: `node tests/conditioning_multi_block_resolver_test.js`

Expected: FAIL with schema/resolver version or `blocks.length` mismatch.

- [ ] **Step 3: Implement blueprint resolution and aggregate timing**

Resolve every block in blueprint order through the existing candidate validator, namespace selections and station keys, preserve manual selections only when legal, and attach `block.protocol` plus the coach-facing metadata. Aggregate prep, block execution, transitions, inter-block recovery, and recovery into `timing`. Derive anatomy and modalities from all resolved stations.

- [ ] **Step 4: Extend Conflict to inspect all blocks**

Evaluate protocol, station legality, duplicate stress, fatigue adjacency, power placement, route/zone, station-switch budget, and full-session timing across the flattened block list. Keep existing single-block tests green through a normalization adapter for legacy fixtures.

- [ ] **Step 5: Run focused and baseline Resolver/Conflict tests**

Run: `node tests/conditioning_multi_block_resolver_test.js && node tests/conditioning_conflict_plugin_test.js && node tests/conditioning_resolver_baseline_test.js`

Expected: new multi-block assertions pass and frozen V1 baseline remains green through its compatibility path.

- [ ] **Step 6: Commit**

```bash
git add js/conditioning-protocol.js js/resolvers/conditioning.js js/conflict-plugins/conditioning.js js/template-resolver.js tests/conditioning_multi_block_resolver_test.js tests/conditioning_conflict_plugin_test.js
git commit -m "feat(issue-85): resolve deterministic multi-block sessions"
```

### Task 3: Block-Aware State, Rotation, and Safe Migration

**Files:**
- Modify: `js/state.js`
- Modify: `js/coach/conditioning-session.js`
- Modify: `js/saved-sessions.js` if the shared save record requires blueprint fields
- Test: `tests/conditioning_blueprint_state_test.js`
- Test: `tests/saved_sessions_restore_test.js`

**Interfaces:**
- Saved Conditioning input is `{familyId, level, sessionBlueprintId, variantId, selections}` where `selections` keys are block namespaced.
- `V15State.reconcileSession` returns an explicit `status` for `CURRENT`, `MIGRATED`, or `INCOMPATIBLE_FALLBACK` and never mutates the stored record on a failed restore.
- Variant cycling is `nextVariantId({familyId, level, currentVariantId, previousVariantId})`, deterministic and never random.

- [ ] **Step 1: Write failing save/restore tests**

```javascript
const saved = ensure('CON-01-L3', {familyId: 'CON-01', level: 'L3', sessionBlueprintId: 'CON-01-L3-A', variantId: 'A', selections: {'BLOCK-A/STATION-1': {actionId: '划船机'}}});
assert.strictEqual(saved.schemaVersion, 2);
assert(saved.input.selections['BLOCK-A/STATION-1']);
const restored = reconcile(saved);
assert.strictEqual(restored.status, 'CURRENT');
```

```javascript
const old = {templateId: 'conditioning', familyId: 'CON-01', level: 'L3', resolverVersion: 'conditioning-v1', input: {familyId: 'CON-01', level: 'L3', protocolId: 'INTERVAL', selections: {'STATION-1': {actionId: 'row'}}};
const before = JSON.stringify(old);
const result = reconcile(old);
assert.strictEqual(result.status, 'INCOMPATIBLE_FALLBACK');
assert.strictEqual(JSON.stringify(old), before);
assert(result.fallbackHash.includes('/coach/conditioning/'));
```

- [ ] **Step 2: Run focused state tests and verify they fail against the v1-only State contract**

Run: `node tests/conditioning_blueprint_state_test.js && node tests/saved_sessions_restore_test.js`

Expected: FAIL because Blueprint/Variant fields and block-aware migration are absent.

- [ ] **Step 3: Persist current blueprint fields and namespace selections**

Upgrade Conditioning State schema, preserve `schemaVersion`, carry `sessionBlueprintId`/`variantId`, and write only the normalized selection map. On failed migration/reconcile, keep the old record unchanged and return a system-recommendation fallback with a user-visible compatibility reason.

- [ ] **Step 4: Add deterministic A/B/C rotation**

Use the previous saved variant when available, otherwise start at A; selecting “next” advances A→B→C→A without random state. Include a display label and prior-change summary source in the resolved session.

- [ ] **Step 5: Run state and full Node regression tests**

Run: `node tests/conditioning_blueprint_state_test.js && node tests/saved_sessions_restore_test.js && for file in tests/*_test.js; do node "$file" || exit 1; done`

Expected: PASS; existing body/F111/HYROX/Conditioning state tests remain green.

- [ ] **Step 6: Commit**

```bash
git add js/state.js js/coach/conditioning-session.js js/saved-sessions.js tests/conditioning_blueprint_state_test.js tests/saved_sessions_restore_test.js
git commit -m "feat(issue-85): persist Conditioning blueprints and variants"
```

### Task 4: Coach Timeline and Member/Coach Copy

**Files:**
- Modify: `js/coach/conditioning-session.js`
- Modify: `js/conditioning-copy.js` or the existing Conditioning copy module
- Modify: `assets/app.css`
- Test: `tests/conditioning_coach_copy_test.js`
- Test: `tests/conditioning_coach_browser.spec.js`

**Interfaces:**
- The rendered editor contains `.conditioning-timeline`, `.conditioning-block[data-block-key]`, `.conditioning-block-goal`, `.conditioning-block-coaching`, `.conditioning-block-scale`, `.conditioning-block-stop`, and `.conditioning-block-completion`.
- Every block has a visible Chinese goal, duration/RPE, protocol description, station order, teaching cue, scale path, stop condition, completion metric, and legal replacement control.
- Coach copy includes block goals/cues/scales; member copy includes ability, stage count, completed-result placeholders, and progress wording without internal enum tokens.

- [ ] **Step 1: Write failing copy/UI assertions**

```javascript
const payload = buildPayload(resolve({familyId: 'CON-01', level: 'L3', variantId: 'A'}));
const member = formatMember(payload);
const coach = formatCoach(payload);
assert(member.includes('今天训练能力'));
assert(member.includes('第 1 段') && member.includes('完成标准'));
assert(!/BLOCK-[A-Z]|POST_CARDIO_ONLY|COND_[A-Z_]+/.test(member + coach));
assert(coach.includes('教练观察') && coach.includes('降阶路径') && coach.includes('停止条件'));
```

- [ ] **Step 2: Run focused browser/copy tests to verify current single-grid failure**

Run: `node tests/conditioning_coach_copy_test.js && npx playwright test tests/conditioning_coach_browser.spec.js`

Expected: FAIL because the current editor renders one station grid and single-block copy.

- [ ] **Step 3: Render the vertical timeline and block controls**

Replace the one-level station grid with ordered block sections, keep every select wired to block-namespaced State, show variant controls and the “与上一节的变化” summary, and retain the visible no-POST-cardio boundary.

- [ ] **Step 4: Implement copy from the block contract**

Generate coach and member text from resolved blocks, translating role/protocol/route meaning into Chinese labels. Include real prescription and completion fields; do not synthesize action names or results that are not in the resolved session.

- [ ] **Step 5: Add responsive styling and run focused tests**

Run: `node tests/conditioning_coach_copy_test.js && npx playwright test tests/conditioning_coach_browser.spec.js --project=chromium`

Expected: PASS for timeline structure, variant switching, block swap, copy privacy, and no page errors.

- [ ] **Step 6: Commit**

```bash
git add js/coach/conditioning-session.js js/conditioning-copy.js assets/app.css tests/conditioning_coach_copy_test.js tests/conditioning_coach_browser.spec.js
git commit -m "feat(issue-85): add Conditioning coach timeline and copy"
```

### Task 5: Responsive, Malicious-State, and Full Live Gate

**Files:**
- Modify: `tests/conditioning_coach_browser.spec.js`
- Create: `tests/conditioning_blueprint_browser.spec.js`
- Create: `tests/test_issue85_conditioning_gate.py`
- Modify: `.github/workflows/verify.yml` if the existing workflow does not run the new checks
- Modify: `data/change-log.js`

**Interfaces:**
- Browser gate covers CON-01, CON-02, CON-03, and CON-04 at L3; A/B/C switch; cross-block replacement; save/restore; old-version incompatible fallback; coach/member copy; `pageerror=0`; console errors=0.
- Malicious inputs include XSS strings, 3000-character selection notes, unknown family/focus, illegal level/protocol, malformed percent encoding, and corrupted saved selections; rendered text must be escaped and state must remain atomic.

- [ ] **Step 1: Write failing browser/gate tests**

```javascript
for (const family of ['con-01', 'con-02', 'con-03', 'con-04']) {
  await page.goto(`/#/coach/conditioning/${family}/l3`);
  await expect(page.locator('.conditioning-timeline .conditioning-block')).toHaveCount(3);
  await expect(page.locator('body')).not.toContainText('POST_CARDIO_ONLY');
}
```

```javascript
await page.goto('/#/coach/conditioning/compose?family=CON-01&level=L3&variant=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
await expect(page.locator('script')).toHaveCount(0);
await expect(page).not.toHaveTitle(/error/i);
```

- [ ] **Step 2: Run the new gate before implementation and verify red coverage**

Run: `npx playwright test tests/conditioning_blueprint_browser.spec.js --project=chromium && uv run --with pytest pytest -q tests/test_issue85_conditioning_gate.py`

Expected: FAIL on missing timeline, variant, and malicious-input cases.

- [ ] **Step 3: Implement the smallest fixes required by each failing assertion**

Keep route canonicalization and HTML escaping at the existing boundaries; reject illegal variants/levels with safe fallback, clamp or reject oversized notes without writing partial state, and ensure malformed encoded routes do not throw uncaught errors.

- [ ] **Step 4: Run the full verification matrix**

Run: `for file in tests/*_test.js; do node "$file" || exit 1; done && uv run --with pytest pytest -q && python3 tools/build_system_data.py --check && uv run --with beautifulsoup4 --with jsonschema python tools/validate_v148_schema.py && git diff --check && npx playwright test --project=chromium`

Expected: all Node tests, Python tests, schema/build checks, and Chromium browser checks pass with zero page errors.

- [ ] **Step 5: Run a fresh 390×844 and 1080/1280/1440 responsive pass**

Capture screenshots and assert `document.documentElement.scrollWidth <= window.innerWidth` at each viewport. Confirm every block is readable and every station select has a complete clickable region on mobile.

- [ ] **Step 6: Commit the gate and changelog**

```bash
git add tests/conditioning_coach_browser.spec.js tests/conditioning_blueprint_browser.spec.js tests/test_issue85_conditioning_gate.py .github/workflows/verify.yml data/change-log.js
git commit -m "test(issue-85): add multi-block Conditioning release gate"
```

### Task 6: Review, PR, and Issue Evidence

- [ ] **Step 1: Re-read Issue #85 and run a requirement checklist against the final diff**
- [ ] **Step 2: Run `git diff --stat`, `git diff --check`, full Node/Python/schema/build/browser matrix, and inspect the generated artifact diff**
- [ ] **Step 3: Perform an independent self-review focused on deterministic rotation, no fake actions/equipment, state migration atomicity, and member/coach value**
- [ ] **Step 4: Push `feature/issue-85-conditioning-blueprint` and open a PR against `master` only after all checks are green**
- [ ] **Step 5: Post the implementation/evidence record on Issue #85 and leave the PR open for review; do not merge/deploy/close**

## Coverage Review

- Data/schema: Task 1 validates all 16 Family × Level states and all references.
- Resolver/Conflict: Task 2 validates deterministic three-block L3 output, full timing, cross-block rules, and compatibility.
- State/migration: Task 3 validates block-aware save/restore and atomic old-version fallback.
- UX/copy: Task 4 validates coach timeline, member value, teaching details, swaps, and copy privacy.
- Malicious/responsive/live: Task 5 validates XSS, oversized input, malformed routes, illegal state, 390×844, desktop widths, console/page errors, and real browser interactions.
- Governance: Task 6 keeps branch/PR/Issue evidence separate from merge, deployment, and publication.
