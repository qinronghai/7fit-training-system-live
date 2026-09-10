# V15 Training Template Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data-driven Training Template Registry and turn `#/coach` into a four-template Coach Center without breaking existing F111 routes.

**Architecture:** Add one formal split-data domain (`templates.json`) to the existing synchronous `window.V14_DATA` build. Route registered template IDs generically, keep F111-specific landing content isolated, and let the Coach Center render only from Registry records.

**Tech Stack:** Static HTML/CSS/JavaScript, Python build/validator scripts, JSON Schema Draft 2020-12, pytest, Node runtime tests, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-10-template-registry-design.md`

## Global Constraints

- Keep `window.V14_DATA` synchronous; no async API or fetch boot path.
- Preserve `#/coach/compose` and existing `#/coach/f111-XX/lN` URLs.
- Do not implement Body, Conditioning, or Posture domain resolvers in #27.
- Coach Center card identity/status/capabilities/route must come from Registry data.
- Posture is `FUTURE` and must never invoke a resolver.
- Tests are written and observed failing before implementation changes for each behavior group.

---

### Task 1: Freeze Registry Data and Schema Contract

**Files:**
- Create: `data/src/templates.json`
- Create: `schemas/v14.8/template-registry.schema.json`
- Modify: `data/src/manifest.json`
- Modify: `tools/build_system_data.py`
- Modify: `tools/validate_v148_schema.py`
- Test: `tests/test_issue27_template_registry.py`

**Interfaces:**
- Produces: `V14_DATA.templateIds: string[]` and `V14_DATA.templateRegistry: Record<string, TemplateRecord>`.
- `TemplateRecord.capabilities` contains exactly `preset/composer/prep/anatomy/copy/save/volume/conditioningMetrics` booleans.

- [ ] **Step 1: Write failing contract tests**

Add tests that assert four ordered IDs, required record fields, exact capability keys, schema rejection of illegal engine/status/extra capability, ID/key mismatch rejection, and formal manifest ownership.

- [ ] **Step 2: Run the focused pytest file and observe RED**

Run: `python -m pytest -q tests/test_issue27_template_registry.py`

Expected initial failure: missing `templates.json` / missing template-registry schema or runtime keys.

- [ ] **Step 3: Add the minimal Registry source and schema**

Use this runtime shape:

```json
{
  "templateIds": ["f111", "body", "conditioning", "posture"],
  "templateRegistry": {
    "f111": {
      "templateId": "f111",
      "name": "女性综合 1+1+1",
      "shortName": "F111",
      "engine": "f111",
      "status": "ACTIVE",
      "levelSystem": "L1-L4",
      "capabilities": {
        "preset": true,
        "composer": true,
        "prep": true,
        "anatomy": true,
        "copy": true,
        "save": false,
        "volume": false,
        "conditioningMetrics": false
      },
      "routeBase": "#/coach/f111",
      "description": "女性长期塑形的一下肢 + 一上肢 + 一支撑训练体系。"
    }
  }
}
```

Add Body, Conditioning, and Posture records using the same exact field contract. Body/Conditioning are `ACTIVE`; Posture is `FUTURE` with all capability flags false.

- [ ] **Step 4: Add build ownership and cross-record validation**

Add `templates.json` to `REQUIRED_SOURCE_FILES`, manifest `sourceFiles`, owners, and top-level order. Extend `validate_payload()` to schema-check `{ids: templateIds, registry: templateRegistry}` and reject set mismatch, duplicate IDs, record-key mismatch, or non-`#/coach/` route bases.

- [ ] **Step 5: Generate the runtime bundle and rerun focused tests**

Run:

```bash
python tools/build_system_data.py
python -m pytest -q tests/test_issue27_template_registry.py
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
```

Expected: all PASS.

- [ ] **Step 6: Commit the data/schema slice**

```bash
git add data/src/templates.json data/src/manifest.json data/system-data.js schemas/v14.8/template-registry.schema.json tools/build_system_data.py tools/validate_v148_schema.py tests/test_issue27_template_registry.py
git commit -m "feat: add training template registry data contract"
```

---

### Task 2: Add Registry-Aware Coach Routing

**Files:**
- Modify: `js/router.js`
- Test: `tests/template_registry_runtime_test.js`

**Interfaces:**
- Consumes: `V14_DATA.templateRegistry`.
- Produces route shape `{area:'coach', page:'template', templateId, ...}` for registered template IDs.
- Preserves legacy `{page:'preset', recipeId, level}` and `{page:'compose'}` shapes.

- [ ] **Step 1: Write RED router tests**

Cover `#/coach/f111`, `#/coach/body`, `#/coach/conditioning`, `#/coach/posture`, unknown `#/coach/not-a-template`, legacy `#/coach/f111-06/l3`, and `#/coach/compose`.

- [ ] **Step 2: Observe RED**

Run: `node tests/template_registry_runtime_test.js`

Expected: registered template URLs are still misclassified as legacy recipe routes.

- [ ] **Step 3: Implement generic registry route recognition**

Before legacy recipe parsing, read `window.V14_DATA?.templateRegistry` and classify only exact registered IDs as `page:'template'`. `isValid()` accepts a template page only if the current registry contains that ID.

- [ ] **Step 4: Verify GREEN and commit**

Run: `node tests/template_registry_runtime_test.js`

Expected: PASS.

```bash
git add js/router.js tests/template_registry_runtime_test.js
git commit -m "feat: route registered training templates"
```

---

### Task 3: Split F111 Landing from the Generic Coach Center

**Files:**
- Modify: `js/coach/home.js`
- Create: `js/coach/f111-home.js`
- Create: `js/coach/template-home.js`
- Modify: `js/views-coach.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Test: `tests/template_registry_runtime_test.js`

**Interfaces:**
- `M.Home.render()` → Registry-driven Coach Center.
- `M.F111Home.render()` → existing F111 landing content moved without semantic change.
- `M.TemplateHome.render(templateId)` → Registry-driven generic template landing for non-F111 ACTIVE/FUTURE entries.

- [ ] **Step 1: Extend runtime tests and observe RED**

Require four registry cards from Home, `M.F111Home`, generic Body/Conditioning landing output, FUTURE Posture output, and synthetic fifth Registry record rendering automatically on Center.

- [ ] **Step 2: Implement Registry-only Coach Center**

Iterate `templateIds`. Render name, description, status badge, capability summary, and route target from the record. ACTIVE cards link to `routeBase`; FUTURE cards display `即将开放` and may link only to their safe generic landing.

- [ ] **Step 3: Move current F111 landing unchanged into `f111-home.js`**

Preserve recipe cards, 8 preset wording, 20 combinations, 32-session compatibility, and `#/coach/compose` link.

- [ ] **Step 4: Add generic template landing and view dispatch**

`views-coach.js` dispatch order:

```text
compose → ComposerView
preset recipe → Session
registered template f111 → F111Home
registered non-f111 template → TemplateHome
no template/recipe → Home Coach Center
```

No Body/Conditioning resolver is called.

- [ ] **Step 5: Make app subtitle registry-aware**

At `#/coach`, subtitle is `Multi-Template Coach Center`. At a registered template route, subtitle uses the Registry record name. Legacy F111 session/composer subtitles remain compatible.

- [ ] **Step 6: Run Node/runtime regressions and commit**

Run:

```bash
node tests/template_registry_runtime_test.js
for f in tests/*_test.js; do node "$f"; done
find data js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: PASS.

```bash
git add index.html js/router.js js/app.js js/views-coach.js js/coach/home.js js/coach/f111-home.js js/coach/template-home.js tests/template_registry_runtime_test.js
git commit -m "feat: render multi-template coach center"
```

---

### Task 4: Browser Gate and Full Regression

**Files:**
- Modify: `tests/browser_smoke.spec.js`

**Interfaces:**
- Verifies public user-facing routes only; does not add production logic.

- [ ] **Step 1: Update browser smoke expectations**

Change the old `#/coach` assertion from the F111 hero to four template cards. Add navigation into F111 and assert the existing `女性综合 1+1+1` landing and free composer link still work. Assert Posture visibly reports `即将开放`/FUTURE.

- [ ] **Step 2: Add 390px Coach Center overflow gate**

At width 390, assert the four cards are visible, `scrollWidth === clientWidth`, and captured `pageerror` remains empty.

- [ ] **Step 3: Run the complete repository verification**

Run:

```bash
python -m pytest -q
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
for f in tests/*_test.js; do node "$f"; done
find data js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
npx playwright test tests/browser_smoke.spec.js
```

Expected: zero failures.

- [ ] **Step 4: Final diff audit**

Confirm no Body/Conditioning/Posture resolver, no State migration, no F111 training-content changes, and no unrelated global UI redesign entered the diff.

- [ ] **Step 5: Commit browser gate**

```bash
git add tests/browser_smoke.spec.js
git commit -m "test: gate multi-template coach center in browser"
```

---

### Task 5: PR / Master Verification and Issue Closure

**Files:** none beyond metadata.

- [ ] **Step 1:** Open PR referencing `Closes #27`.
- [ ] **Step 2:** Require PR verify + Browser Smoke success.
- [ ] **Step 3:** Review final changed-file list and patches for scope drift.
- [ ] **Step 4:** Squash merge only after all gates are green.
- [ ] **Step 5:** Require master `verify`, `browser-smoke`, and `deploy` to succeed.
- [ ] **Step 6:** Confirm #27 closed as Completed, then begin #29 from the new master SHA.
