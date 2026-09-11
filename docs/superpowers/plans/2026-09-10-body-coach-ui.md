# Body Coach UI / Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Body V1 Coach workflow on top of the existing multi-template platform without duplicating Body business rules in the UI or regressing F111.

**Architecture:** Keep F111 on its current modules and add a small template UI registry plus a Body-specific adapter. Body UI consumes `V15TemplateResolver.resolve('body', ...)`, `V15BodyResolver.candidates()`, `V15State`, shared PREP/Anatomy/Conflict services, and a Body-specific copy formatter; it never recalculates Body volume/conflict/candidate legality.

**Tech Stack:** Static HTML/CSS/vanilla JS, V15 ResolvedSession/TemplateResolver/State, V14 shared Coach modules, Node runtime tests, pytest structural tests, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-10-body-coach-ui-design.md`

## Global Constraints

- `ResolvedSession.schemaVersion === 1`.
- `conflictContext.status` remains exactly `PASS | WARN | FAIL`.
- Body Resolver frozen baseline remains `c06f4ddd03bebce65c8875dd66a03d99d897e54adec0190ea50a72e47e5f8005`.
- F111 Conflict frozen baseline remains `af7d84bc1a1c34793cd81ea776690dfb450f3d13ea1a926be33abda590358465`.
- Do not modify Body Data Contract or Body Resolver business rules.
- Do not implement Conditioning UI, Save/Restore history, weekly volume charts, or an automatic Recovery engine.
- UI must not parse prescription strings to derive sets/reps/RIR/rest/volume.
- Body Slot legality must come only from `V15BodyResolver.candidates()` / `isSelectionValid()`.
- Body State stores intent only; no `ResolvedSession`, volume, Anatomy, Conflict, or derived PREP output is persisted.
- F111 canonical URLs, Copy, PREP, swap/reset and browser behavior must remain unchanged.
- 390px release gate requires zero horizontal overflow and `pageerror = 0`.

---

## File Structure

**Create**
- `js/coach/template-ui.js` — template UI adapter registry only.
- `js/coach/body-home.js` — Body landing page and four Family cards.
- `js/coach/body-session.js` — shared Body Session/Composer editor render model and interaction adapter.
- `js/coach/body-prep.js` — one Body PREP resolve/render helper shared by screen and Copy.
- `js/coach/body-volume-view.js` — read-only `domainContext.volume` presentation.
- `js/coach/body-copy.js` — Body coach/member copy payload + formatters; delegates clipboard/date helpers to `V14SessionCopy`.
- `tests/body_coach_route_ui_test.js` — Router and Template UI registry runtime contract.
- `tests/body_coach_session_runtime_test.js` — 16 state rendering model, slot prescription/volume/anatomy/conflict source-of-truth tests.
- `tests/body_coach_state_prep_test.js` — formal/PREP manual intent, reconcile, reload/reset semantics.
- `tests/body_coach_copy_test.js` — coach/member Body copy and anti-leak assertions.
- `tests/body_coach_browser.spec.js` — BODY-02 L3 end-to-end mobile workflow.

**Modify**
- `js/router.js` — add Body `template-session` route while preserving F111 parsing/canonicalization.
- `js/views-coach.js` — delegate non-F111 supported routes to Template UI adapter; keep F111 bind path intact.
- `index.html` — load new Coach modules before `views-coach.js`.
- `assets/app.css` — Body Home/Editor/Volume responsive presentation only.
- Existing runtime/browser test loaders only where they must load newly required modules.

**Avoid unless a failing test proves a platform defect**
- `js/state.js`
- `js/resolvers/body.js`
- `js/body-volume.js`
- `js/conflict-plugins/body.js`
- `data/src/body.json`

---

### Task 1: Body Router + Template UI Registry Contract

**Files:**
- Create: `tests/body_coach_route_ui_test.js`
- Create: `js/coach/template-ui.js`
- Modify: `js/router.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `V14_DATA.templateRegistry`, `V14_DATA.bodyFamilyIds`, existing `V14Router`.
- Produces: `route.page === 'template-session'` for Body sessions; `V14CoachModules.TemplateUI.register/get`.

- [ ] **Step 1: Write failing route tests**

Assert exactly:

```js
const route=R.parseHash('#/coach/body/body-02/l3');
assert.deepStrictEqual(pick(route),{
  area:'coach',page:'template-session',templateId:'body',
  familyId:'BODY-02',level:'L3',query:{}
});
assert(R.isValid(route));
assert.strictEqual(R.canonicalHash(route),'#/coach/body/body-02/l3');
assert.strictEqual(R.isValid(R.parseHash('#/coach/body/body-99/l3')),false);
assert.strictEqual(R.isValid(R.parseHash('#/coach/body/body-02/l5')),false);
assert.strictEqual(R.isValid(R.parseHash('#/coach/conditioning/c01/l1')),false);
```

Also reassert current F111 parse/canonical cases byte-for-byte from `tests/multi_template_router_test.js`.

- [ ] **Step 2: Write failing Template UI registry tests**

Load `js/coach/template-ui.js` and assert:

```js
const UI=window.V14CoachModules.TemplateUI;
assert.strictEqual(typeof UI.register,'function');
assert.strictEqual(typeof UI.get,'function');
const adapter={canHandle:()=>true,render:()=>'<p>body</p>',bind:()=>{}};
UI.register('body',adapter);
assert.strictEqual(UI.get('body'),adapter);
assert.throws(()=>UI.register('body',adapter),/already registered/i);
```

- [ ] **Step 3: Run Node test and confirm RED**

Run: `node tests/body_coach_route_ui_test.js`
Expected first RED: Body session route is invalid and/or `TemplateUI` does not exist.

- [ ] **Step 4: Implement minimal router + registry**

`router.js` must recognize `#/coach/body/<family>/<level>` only when Body is ACTIVE and family exists in `bodyFamilyIds`; do not generalize Conditioning session legality. `canonicalHash()` lowercases Body family and level in the URL while parsed values stay uppercase.

`template-ui.js` only owns registration/lookup and duplicate/invalid adapter errors; no Body business logic.

- [ ] **Step 5: Load registry in `index.html`**

Place `js/coach/template-ui.js` after `js/coach/common.js` and before Body adapters / `views-coach.js`.

- [ ] **Step 6: Run focused + router regressions**

Run:

```bash
node tests/body_coach_route_ui_test.js
node tests/multi_template_router_test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: add Body coach route and template UI registry`.

---

### Task 2: Body Home + Read-only Session Editor

**Files:**
- Create: `js/coach/body-home.js`
- Create: `js/coach/body-session.js`
- Create: `js/coach/body-volume-view.js`
- Create: `tests/body_coach_session_runtime_test.js`
- Modify: `js/views-coach.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `V15TemplateResolver.resolve('body', {familyId,level,selections})`, `ResolvedSession.main.content`, `domainContext.slots`, `domainContext.volume`, `anatomyContext`, `conflictContext`, Body catalogs.
- Produces: Body adapter `canHandle/render/bind`; read-only 16-state screen model.

- [ ] **Step 1: Write failing Body Home tests**

Assert four Body Family cards exist from `bodyFamilyIds`, each card renders primary/secondary target names from `bodyTargetCatalog`, has L1-L4 links, and exposes `#/coach/body/compose?family=BODY-01&level=L1`.

- [ ] **Step 2: Write failing 16-state editor tests**

For all 4 Families × 4 levels, call Body editor context/render and assert:

```js
ctx.session.templateId === 'body'
ctx.session.familyId === familyId
ctx.session.level === level
slotCount === (level==='L1'||level==='L2' ? 5 : 6)
```

Each rendered slot must obtain `workingSets`, `repRange`, `rirRange`, `restSecondsRange` from `session.domainContext.slots[slot.key]`, not by parsing `slot.prescription`.

- [ ] **Step 3: Lock Anatomy / Volume semantic separation**

Assert rendered HTML contains distinct labels:

```text
ANATOMY｜动作涉及肌群
Direct Work Sets｜有效工作组
协同暴露（不计入 Direct Work Sets）
```

Volume values must equal `session.domainContext.volume` exactly.

- [ ] **Step 4: Confirm RED**

Run: `node tests/body_coach_session_runtime_test.js`
Expected: Body Home/Session/Volume modules are missing.

- [ ] **Step 5: Implement modules and adapter delegation**

`BodySession.context(route)` must derive `{familyId,level,sessionKey}` from route, resolve current State selections only through the Body state helper added in Task 3, and return the resolved session. Until Task 3, allow empty selections for read-only rendering.

`views-coach.js` behavior:

```js
if(route.templateId!=='f111'){
  const adapter=M.TemplateUI?.get(route.templateId);
  if(adapter?.canHandle(route)) return adapter.render(route);
}
```

Its bind path delegates to `adapter.bind(route, root, rerender)` before entering legacy F111 bind code.

- [ ] **Step 6: Register Body adapter**

The Body adapter handles `template`, `template-session`, and `template-compose` for `templateId==='body'`; it must not claim Conditioning/Posture routes.

- [ ] **Step 7: Run focused + frozen resolver tests**

```bash
node tests/body_coach_session_runtime_test.js
node tests/body_resolver_baseline_test.js
node tests/f111_conflict_parity_test.js
```

Expected: PASS; frozen hashes unchanged.

- [ ] **Step 8: Commit**

Commit message: `feat: render Body home and resolved session editor`.

---

### Task 3: Body Formal Swap / State / Reset

**Files:**
- Modify: `js/coach/body-session.js`
- Create: `tests/body_coach_state_prep_test.js`

**Interfaces:**
- Consumes: `V15State.ensureSession/getSelections/setSelection/reconcileSession/resetSession`, `V15BodyResolver.isSelectionValid/candidates`.
- Produces: intent-only Body state lifecycle and rerender behavior.

- [ ] **Step 1: Write failing formal-State tests**

For `BODY-02-L3`, ensure/reconcile session with:

```js
{
  familyId:'BODY-02',level:'L3',resolverVersion:'body-v1',
  input:{familyId:'BODY-02',level:'L3'}
}
```

Pick a non-baseline legal PRIMARY via `V15BodyResolver.candidates()`, save with source `manual`, resolve again, and assert selected action/source persist. Assert state snapshot contains no `domainContext`, `conflictContext`, `anatomyContext`, `ResolvedSession`, or volume fields.

- [ ] **Step 2: Lock reconcile behavior**

`reconcileSession('body', sessionKey, {resolverVersion:'body-v1', isSelectionValid:(slotKey,entry)=>V15BodyResolver.isSelectionValid({familyId,level,slotKey,actionId:entry.actionId})})` must drop an illegal/stale action.

- [ ] **Step 3: Lock reset**

After `V15State.resetSession('body','BODY-02-L3')`, recreate metadata and resolve; every slot must return source `auto`.

- [ ] **Step 4: Confirm RED on UI adapter behavior**

Run: `node tests/body_coach_state_prep_test.js`.
Expected: Body session interaction helpers are missing.

- [ ] **Step 5: Implement Body session state helpers and bind**

Expose internal-testable helpers on `M.BodySession`:

```js
ensureState(familyId,level)
resolveState(familyId,level)
setFormalSelection(familyId,level,slotKey,actionId)
reset(familyId,level)
```

UI `<select>` options come only from `V15BodyResolver.candidates({familyId,level,slotKey,currentSelections})`; on change save `manual` then rerender.

- [ ] **Step 6: Run focused regressions**

```bash
node tests/body_coach_state_prep_test.js
node tests/body_state_reconcile_test.js
node tests/multi_template_state_test.js
node tests/body_resolver_baseline_test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message: `feat: connect Body coach swaps to V15 state`.

---

### Task 4: Body PREP V2 Adapter

**Files:**
- Create: `js/coach/body-prep.js`
- Modify: `js/coach/body-session.js`
- Modify: `index.html`
- Extend: `tests/body_coach_state_prep_test.js`

**Interfaces:**
- Consumes: `resolvedSession.prepContext`, `V14PrepResolver.resolve`, `V15State.getPrepSelections/setPrepSelection/reconcileSession`.
- Produces: one `resolveBodyPrep(session, sessionKey)` source used by both screen and Copy.

- [ ] **Step 1: Write failing PREP parity test**

Resolve BODY-02/L3, call Body PREP helper, assert five functional PREP slots and compare action IDs with direct `V14PrepResolver.resolve(session.prepContext,{selections})`.

- [ ] **Step 2: Write manual PREP persistence/reconcile test**

Select a legal alternate in one PREP slot, save source `manual`, resolve helper again and assert it is preserved. Mutate context/family in the test so the choice is no longer eligible; reconcile must remove it and return automatic fallback plus one UI warning token.

- [ ] **Step 3: Confirm RED**

Run: `node tests/body_coach_state_prep_test.js`.
Expected: Body PREP helper missing.

- [ ] **Step 4: Implement `BodyPrep.resolve(session,sessionKey)` and bind**

Never call `contextFromBody()` again in the UI. The only context is `session.prepContext` from #34. The render and Copy adapter receive the exact same resolved PREP object.

- [ ] **Step 5: Run PREP regressions**

```bash
node tests/body_coach_state_prep_test.js
node tests/prep_resolver_v2_test.js
node tests/prep_phase_b1_state_copy_test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: connect Body coach to shared PREP V2`.

---

### Task 5: Body Composer Uses the Same Editor

**Files:**
- Modify: `js/coach/body-session.js`
- Extend: `tests/body_coach_session_runtime_test.js`
- Modify: `js/router.js` only if tests expose query canonicalization defect.

**Interfaces:**
- Consumes: same Body Session editor and state key `BODY-xx-Ln`.
- Produces: `#/coach/body/compose?family=BODY-02&level=L3` controls without duplicate slot implementation.

- [ ] **Step 1: Write failing Composer tests**

Assert missing/invalid query values normalize to BODY-01/L1; valid BODY-02/L3 produces the same resolved logical session and same state key as `#/coach/body/body-02/l3`.

- [ ] **Step 2: Lock selector navigation**

Family/Level selectors update only the URL query via `canonicalHash`; changing Family or Level does not copy old session selections into the new session key.

- [ ] **Step 3: Confirm RED and implement composer controls**

The composer wrapper renders Family and Level selectors above the same editor renderer. No F111 5×4 matrix, lowerMode, upperMode, coreDemand, T/S/CORE-L language is permitted.

- [ ] **Step 4: Run focused tests**

```bash
node tests/body_coach_session_runtime_test.js
node tests/multi_template_router_test.js
node tests/body_state_reconcile_test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: add Body composer controls`.

---

### Task 6: Body Coach / Member Copy Adapter

**Files:**
- Create: `js/coach/body-copy.js`
- Create: `tests/body_coach_copy_test.js`
- Modify: `js/coach/body-session.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: one Body resolved session + exact resolved Body PREP object; `V14SessionCopy.copyText` and `formatDate` only as shared utility.
- Produces: `BodyCopy.buildPayload`, `formatCoach`, `formatMember`.

- [ ] **Step 1: Write failing Coach Copy tests**

BODY-02/L3 coach copy must include Family/Level, Role labels, action name, Sets/Reps/RIR/Rest, Direct Work Sets, target names, Cue/Observation when present in `actionDetails.fields['教练口令']` / `['常见错误']`, PREP, conflict summary, fixed Recovery note.

- [ ] **Step 2: Write failing Member Copy anti-leak tests**

Member copy must include date, human-readable family/focus, action names/purpose, PREP and recovery, but must not contain:

```text
PRIMARY
SECONDARY
ACCESSORY
ISOLATION
OPTIONAL
BODY_
resolverVersion
body-v1
directSetsByTarget
secondaryExposureByTarget
hardCount
warnCount
```

- [ ] **Step 3: Write refresh-after-swap assertion**

Build payload, make a legal manual swap, resolve again, build payload again; changed action and derived Volume/Conflict/PREP values must come from the new resolved objects without stale cached fields.

- [ ] **Step 4: Confirm RED and implement Body Copy**

Do not call current F111 `formatCoach/formatMember` for Body. Reuse only clipboard/date helpers.

- [ ] **Step 5: Run Copy regressions**

```bash
node tests/body_coach_copy_test.js
node tests/session_copy_coach_v2_test.js
node tests/session_copy_member_v2_test.js
node tests/composer_copy_test.js
```

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add Body coach and member copy adapters`.

---

### Task 7: Responsive Styling + Browser Release Gate

**Files:**
- Modify: `assets/app.css`
- Create: `tests/body_coach_browser.spec.js`
- Modify: `index.html` if a module load issue is exposed.

**Interfaces:**
- Consumes: complete Body UI.
- Produces: acceptance evidence at 390×844.

- [ ] **Step 1: Write Playwright RED for Body Home + 16 routes**

At 390×844, verify four Family cards, every Family has L1-L4 links, and at least one route per Family renders without pageerror.

- [ ] **Step 2: Write canonical BODY-02/L3 E2E**

Workflow:

```text
#/coach/body/body-02/l3
→ verify 6 Body slots
→ verify Anatomy + Direct Work Sets are separate
→ choose one legal alternate slot action
→ verify selection marked 手动选择
→ verify Volume / Conflict / PREP rerender
→ copy coach text
→ copy member text
→ reload and verify manual selection persists
→ Reset and verify system recommendation returns
```

Stub/observe clipboard in the browser test and assert coach/member outputs are distinct and member text passes anti-leak requirements.

- [ ] **Step 3: Add 390px overflow/pageerror assertions**

```js
expect(document.documentElement.scrollWidth)
  .toBe(document.documentElement.clientWidth);
expect(errors).toEqual([]);
```

- [ ] **Step 4: Implement CSS only to satisfy layout/interaction acceptance**

Do not change Body algorithms to make UI tests easier.

- [ ] **Step 5: Run browser suite**

```bash
npx playwright test tests/body_coach_browser.spec.js
npx playwright test
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

Commit message: `test: add Body coach browser release gate`.

---

### Task 8: Full Regression / Review / Release

**Files:**
- No production changes unless a verified regression requires a fix.
- Update Issue #35 completion evidence after merge.

**Interfaces:**
- Produces: merge-ready PR and master deployment evidence.

- [ ] **Step 1: Run frozen domain gates**

```bash
node tests/body_resolver_baseline_test.js
node tests/f111_conflict_parity_test.js
```

Expected hashes exactly:

```text
BODY_RESOLVER_BASELINE_SHA=c06f4ddd03bebce65c8875dd66a03d99d897e54adec0190ea50a72e47e5f8005
F111_CONFLICT_BASELINE_SHA=af7d84bc1a1c34793cd81ea776690dfb450f3d13ea1a926be33abda590358465
```

- [ ] **Step 2: Run full repository gates**

Run the same commands/jobs used by `.github/workflows/deploy-pages.yml`: pytest, system-data freshness, schema validation, all Node tests / JS syntax, then Playwright.

- [ ] **Step 3: Diff audit against master**

Allowed production change surface: Router, Coach UI modules, `views-coach.js`, `index.html`, presentation CSS. Reject unplanned Body Data/Resolver/Conflict/State changes unless separately justified by a failing platform test.

- [ ] **Step 4: Review against Issue #35 acceptance checklist**

Explicitly verify all Issue requirements: four Families, 16 states, 2–3 action swap flow, derived refresh, shared PREP for page/Copy, Anatomy vs Direct Work Sets separation, two Copy outputs, 390px no overflow/pageerror.

- [ ] **Step 5: Create PR with `Closes #35`**

Lock exact head SHA and require PR-triggered verify + browser-smoke success before merge.

- [ ] **Step 6: Squash merge and verify master**

After merge, require master `verify → browser-smoke → deploy` all success for the merge SHA. Confirm Issue #35 is closed/completed before declaring release complete.
