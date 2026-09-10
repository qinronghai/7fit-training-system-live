# Body Data Contract V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the formal Body V1 data domain required by #34: stable targets, roles, four families, L1–L4 dose policy, prescription profiles, Direct Work Sets semantics, conflict-policy data, and a manually audited 40–60 action candidate whitelist.

**Architecture:** Add `data/src/body.json` as an independent split-data sidecar owned through the existing manifest/build pipeline. Body-specific eligibility and volume semantics live only in this domain; `actions.json` remains the source of general action identity/route/status and Anatomy remains separate from Body Direct Work Sets. No Body resolver, UI, swap logic, copy formatter, or conflict algorithm is implemented in #33.

**Tech Stack:** JSON split data, synchronous `window.V14_DATA` generated bundle, JSON Schema Draft 2020-12, Python validator/pytest, Node runtime tests, existing GitHub Actions verification and Pages deployment.

**Spec:** `docs/superpowers/specs/2026-09-10-body-data-contract-design.md`

## Global Constraints

- `body.json` is the only source of Body-specific eligibility/role/target/volume semantics.
- Do not add a second `bodyEligible` truth source to `actions.json`.
- Body action eligibility is membership in `bodyActionMeta`; Level legality is the explicit `levels` field.
- V1 Body candidate whitelist must contain 40–60 manually audited existing Action IDs.
- Anatomy exposure must never be converted automatically into Body Direct Work Sets.
- Secondary exposure never counts as direct sets in V1.
- For unilateral exercises, `N` working sets per side count as `N` session working sets and `N` direct sets per declared direct target, not `2N`.
- Session `totalWorkingSets` is the sum of slot working sets once; it is never the sum of `directSetsByTarget`.
- L1–L4 default slot skeletons are 10 / 12 / 14 / 16 working sets and must remain inside 10–12 / 12–14 / 14–16 / 16–18 session windows.
- `L4` must not be implemented as “highest-complexity action only.”
- Do not implement Body Resolver (#34), Body Coach UI (#35), Save/Restore (#11), or Body conflict algorithms in #33.
- Each behavior group must be observed RED before production/data changes make it GREEN.

---

### Task 1: Freeze the Body Domain, Ownership, and Schema Surface

**Files:**
- Create: `tests/test_issue33_body_data_contract.py`
- Create: `schemas/v14.8/body.schema.json`
- Create: `data/src/body.json`
- Modify: `data/src/manifest.json`
- Modify: `tools/build_system_data.py`
- Modify: `tests/test_v148_data_build.py`
- Modify: `tests/test_v148_data_duplicate_keys.py`

**Interfaces:**
- Produces these runtime keys owned only by `body.json`: `bodyTargetIds`, `bodyTargetCatalog`, `bodyRoleIds`, `bodyRoles`, `bodyFamilyIds`, `bodyFamilies`, `bodyLevelPolicies`, `bodyPrescriptionProfiles`, `bodyActionMeta`, `bodyVolumePolicy`, `bodyConflictPolicy`.
- `tools/build_system_data.py::REQUIRED_SOURCE_FILES` and both build-test `DOMAIN_FILES` tuples include `body.json` immediately after `templates.json`.

- [ ] **Step 1: Write RED source/ownership tests**

Create `tests/test_issue33_body_data_contract.py` with initial tests equivalent to:

```python
BODY_KEYS = [
    "bodyTargetIds", "bodyTargetCatalog", "bodyRoleIds", "bodyRoles",
    "bodyFamilyIds", "bodyFamilies", "bodyLevelPolicies",
    "bodyPrescriptionProfiles", "bodyActionMeta", "bodyVolumePolicy",
    "bodyConflictPolicy",
]

def test_body_source_schema_and_manifest_contract_exist():
    assert (SRC / "body.json").is_file()
    assert (SCHEMA_DIR / "body.schema.json").is_file()
    manifest = json.loads((SRC / "manifest.json").read_text(encoding="utf-8"))
    assert "body.json" in manifest["sourceFiles"]
    for key in BODY_KEYS:
        assert manifest["owners"].get(key) == "body.json"
        assert key in manifest["topLevelOrder"]
```

Also assert runtime `window.V14_DATA` exposes every Body key after generation.

- [ ] **Step 2: Run focused tests and observe RED**

Run:

```bash
python -m pytest -q tests/test_issue33_body_data_contract.py
```

Expected initial failure: `data/src/body.json` / `body.schema.json` and Body runtime keys are missing.

- [ ] **Step 3: Add the formal domain skeleton**

Create `body.json` with all 11 top-level keys. At this task the values may contain the final targets/roles/families/policies from Task 2 but `bodyActionMeta` may remain an empty object until Task 3; do not invent temporary alternate keys.

- [ ] **Step 4: Add strict Draft 2020-12 schema**

`body.schema.json` must validate an object containing exactly those 11 keys. Define reusable `$defs` for `targetId`, `familyId`, `level`, `roleId`, `repProfile`, action metadata, level policy, and numeric ranges. Use `additionalProperties:false` on Body-owned records where the contract is frozen.

- [ ] **Step 5: Wire the split-data build ownership**

Add `body.json` to `REQUIRED_SOURCE_FILES` immediately after `templates.json`; add the same ordering to `tests/test_v148_data_build.py` and `tests/test_v148_data_duplicate_keys.py`. Add the 11 owners/top-level-order entries to `manifest.json` in the same Body block.

- [ ] **Step 6: Run focused build tests**

Run:

```bash
python -m pytest -q tests/test_issue33_body_data_contract.py tests/test_v148_data_build.py tests/test_v148_data_duplicate_keys.py
```

Expected at this point: source/build ownership tests pass; runtime freshness may remain RED until the generated bundle is written in Task 4.

- [ ] **Step 7: Commit the domain/schema slice**

```bash
git add data/src/body.json data/src/manifest.json schemas/v14.8/body.schema.json tools/build_system_data.py tests/test_issue33_body_data_contract.py tests/test_v148_data_build.py tests/test_v148_data_duplicate_keys.py
git commit -m "feat: add Body data domain contract"
```

---

### Task 2: Freeze Targets, Roles, Families, Level Policy, Prescriptions, and Volume Semantics

**Files:**
- Modify: `data/src/body.json`
- Modify: `tests/test_issue33_body_data_contract.py`

**Interfaces:**
- `bodyTargetIds` exact ordered IDs: `quadriceps`, `hamstrings`, `glute_max`, `glute_med`, `adductors`, `calves`, `lats`, `upper_back`, `rear_delts`, `lateral_delts`, `front_delts`, `chest`, `biceps`, `triceps`.
- `bodyRoleIds` exact ordered IDs: `PRIMARY`, `SECONDARY`, `ACCESSORY`, `ISOLATION`, `OPTIONAL`.
- `bodyFamilyIds` exact ordered IDs: `BODY-01`, `BODY-02`, `BODY-03`, `BODY-04`.
- `bodyLevelPolicies` exact keys `L1`–`L4`.

- [ ] **Step 1: Extend tests for exact taxonomy and identity**

Assert IDs are unique, catalog map keys match each record `id`, target aliases are non-empty strings, Family `familyId` equals map key, all family targets exist in `bodyTargetIds`, and all allowed roles exist in `bodyRoleIds`.

- [ ] **Step 2: Add exact Family contracts**

Use these primary/secondary targets:

```text
BODY-01 primary: quadriceps
BODY-01 secondary: glute_max, glute_med, hamstrings, adductors
BODY-02 primary: glute_max, hamstrings
BODY-02 secondary: glute_med, adductors
BODY-03 primary: lats, upper_back, rear_delts, lateral_delts
BODY-03 secondary: biceps
BODY-04 primary: chest, lateral_delts, triceps
BODY-04 secondary: front_delts, biceps
```

Each Family exposes the six session slot keys `PRIMARY / SECONDARY / ACCESSORY / ISOLATION-1 / ISOLATION-2 / OPTIONAL`, with `ISOLATION-1/2` explicitly mapped to Role `ISOLATION` rather than inferred by position.

- [ ] **Step 3: Add RED level-policy invariants**

Tests must assert default skeletons exactly:

```python
EXPECTED_DEFAULT_SETS = {
    "L1": {"PRIMARY":3,"SECONDARY":2,"ACCESSORY":2,"ISOLATION-1":2,"ISOLATION-2":1,"OPTIONAL":0},
    "L2": {"PRIMARY":3,"SECONDARY":3,"ACCESSORY":2,"ISOLATION-1":2,"ISOLATION-2":2,"OPTIONAL":0},
    "L3": {"PRIMARY":3,"SECONDARY":3,"ACCESSORY":3,"ISOLATION-1":2,"ISOLATION-2":2,"OPTIONAL":1},
    "L4": {"PRIMARY":4,"SECONDARY":3,"ACCESSORY":3,"ISOLATION-1":3,"ISOLATION-2":2,"OPTIONAL":1},
}
```

Assert totals are `10/12/14/16` and each total is within the corresponding session range `10–12 / 12–14 / 14–16 / 16–18`.

- [ ] **Step 4: Add prescription profiles**

Freeze:

```text
compound_machine: 8–15 reps, 90–150s
compound_freeweight: 6–12 reps, 120–180s
single_leg_compound: 8–12/side, 90–150s
accessory_compound: 10–15 reps, 75–120s
isolation_large: 10–20 reps, 60–90s
isolation_small: 12–20 reps, 45–75s
```

RIR remains a Level policy, not duplicated as an action-specific truth source.

- [ ] **Step 5: Freeze volume/counting policy as data**

`bodyVolumePolicy` must explicitly encode that ramp-up/PREP/Foam/secondary exposure count as zero direct sets, unilateral sets count once per side prescription, total session sets sum each slot once, and direct target sets may multi-label the same slot without inflating `totalWorkingSets`.

- [ ] **Step 6: Freeze conflict thresholds only as data**

`bodyConflictPolicy` may contain Body V1 thresholds consumed later by #34 (e.g. high-fatigue compound count, movement redundancy, isolation-ratio and time/volume windows), but Task 2 must not implement evaluators or return `PASS/WARN/FAIL` itself.

- [ ] **Step 7: Run focused tests and commit**

```bash
python -m pytest -q tests/test_issue33_body_data_contract.py

git add data/src/body.json tests/test_issue33_body_data_contract.py
git commit -m "feat: freeze Body family and volume policies"
```

Expected: PASS.

---

### Task 3: Build and Audit the 40–60 Action Body Candidate Whitelist

**Files:**
- Modify: `data/src/body.json`
- Create: `docs/V15-BODY-CANDIDATE-AUDIT.md`
- Modify: `tests/test_issue33_body_data_contract.py`

**Interfaces:**
- `bodyActionMeta: Record<ActionId, BodyActionMeta>` is the only Body candidate whitelist.
- Every record contains exactly: `families`, `levels`, `roles`, `directTargets`, `secondaryTargets`, `exerciseClass`, `fatigueCost`, `stabilityDemand`, `repProfile`, `laterality`.

- [ ] **Step 1: Write RED whitelist integrity tests**

Assert:

```python
assert 40 <= len(data["bodyActionMeta"]) <= 60
```

For every candidate: Action ID exists in `actions`; route is a formal strength route (`1F_ONLY` or explicitly approved `FLEX_1F_2F`); status is `可自动编排`; every family/level/role/target/profile reference exists; `directTargets` is non-empty; direct and secondary target sets do not overlap; no duplicate array values exist.

- [ ] **Step 2: Add coverage tests by Family/Role/Level**

For every `BODY-01..04`, every non-OPTIONAL required slot role must have at least two legal candidates at each Level it needs. `PRIMARY` and `SECONDARY` must never depend on a single Action ID. L1 must have candidates explicitly declaring L1; L4 must retain at least one stable machine/low-stability-demand option where the venue inventory already has one, proving `L4 ≠ complexity escalation`.

- [ ] **Step 3: Manually audit candidates from current Action IDs**

Populate only existing formal Action IDs. Prefer the current venue-strength inventory already represented in `actions.json`: squat/hack/leg extension, RDL/hinge/leg curl/hip thrust, split/single-leg work, horizontal/vertical pulls, horizontal/vertical presses, chest-supported/seated rows, rear-delt/side-raise, cable/machine/dumbbell arm isolation, hip abduction/adduction and glute isolation. Do not auto-generate Body metadata from `pattern`, `loadFamily` or Anatomy.

- [ ] **Step 4: Record human audit rationale**

Create `docs/V15-BODY-CANDIDATE-AUDIT.md` with one table row per candidate:

```text
Action ID | 显示名 | Family | Level | Role | Direct Targets | Secondary Targets | Class | Fatigue | Stability | Profile | Laterality | 审计备注
```

The JSON remains machine source of truth; this document records why each action was admitted and flags any conservative/ambiguous classifications.

- [ ] **Step 5: Add negative mutation tests**

Mutate a deep-copied runtime payload and require `validate_payload()` to reject: unknown Action ID, unknown Body target, unknown family, unknown role, illegal `L5`, unknown `repProfile`, direct/secondary overlap, non-formal route candidate, and candidate count below 40.

- [ ] **Step 6: Run focused tests and commit**

```bash
python -m pytest -q tests/test_issue33_body_data_contract.py

git add data/src/body.json docs/V15-BODY-CANDIDATE-AUDIT.md tests/test_issue33_body_data_contract.py
git commit -m "content: audit Body V1 action candidates"
```

Expected: PASS.

---

### Task 4: Integrate Schema Validator and Generated Runtime Bundle

**Files:**
- Modify: `tools/validate_v148_schema.py`
- Modify: `data/system-data.js` (generated only)
- Create: `tests/body_data_runtime_test.js`
- Modify: `tests/test_issue33_body_data_contract.py`

**Interfaces:**
- `validate_payload(data)` schema-validates the complete Body aggregate and performs cross-record checks that JSON Schema cannot express.
- Browser runtime exposes the 11 Body keys synchronously through `window.V14_DATA`; no new async boot path.

- [ ] **Step 1: Add RED validator mutation tests**

Require error messages for Body ID/map mismatch, candidate Action missing, unknown references, direct/secondary overlap, invalid candidate route/status, whitelist count outside 40–60, incomplete Family/Level coverage, and default-set totals outside their declared Level windows.

- [ ] **Step 2: Integrate the Body schema into `validate_payload()`**

Assemble this exact schema instance from runtime keys:

```python
body = {
    "targetIds": data.get("bodyTargetIds", []),
    "targetCatalog": data.get("bodyTargetCatalog", {}),
    "roleIds": data.get("bodyRoleIds", []),
    "roles": data.get("bodyRoles", {}),
    "familyIds": data.get("bodyFamilyIds", []),
    "families": data.get("bodyFamilies", {}),
    "levelPolicies": data.get("bodyLevelPolicies", {}),
    "prescriptionProfiles": data.get("bodyPrescriptionProfiles", {}),
    "actionMeta": data.get("bodyActionMeta", {}),
    "volumePolicy": data.get("bodyVolumePolicy", {}),
    "conflictPolicy": data.get("bodyConflictPolicy", {}),
}
```

Run `_schema_errors(body, "body", "body")`, then explicit cross-record validation against `actions`.

- [ ] **Step 3: Add a browser-runtime data test**

`tests/body_data_runtime_test.js` loads `data/system-data.js` into a VM, asserts all 11 Body keys exist, exact 14/5/4 ID counts, candidate count 40–60, and verifies `BODY-01` plus one known candidate can be read synchronously. It must not load a Body resolver.

- [ ] **Step 4: Generate the committed compatibility bundle**

Run:

```bash
python tools/build_system_data.py
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
node tests/body_data_runtime_test.js
```

Expected: all PASS. Never hand-edit `data/system-data.js`.

- [ ] **Step 5: Run build-domain regression tests**

```bash
python -m pytest -q tests/test_v148_data_build.py tests/test_v148_data_duplicate_keys.py tests/test_issue33_body_data_contract.py
```

Expected: PASS.

- [ ] **Step 6: Commit validator/runtime slice**

```bash
git add tools/validate_v148_schema.py data/system-data.js tests/body_data_runtime_test.js tests/test_issue33_body_data_contract.py
git commit -m "test: gate Body data runtime contract"
```

---

### Task 5: Full Regression, PR, Master Deployment, and #33 Closure

**Files:**
- Modify only documentation/Issue metadata if verification finds no code defects.

**Interfaces:**
- Produces a released Body data foundation for #34 without registering a Body resolver.

- [ ] **Step 1: Run the complete repository verification**

```bash
python -m pytest -q
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
for f in tests/*_test.js; do node "$f"; done
find data js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
npx playwright test
```

Expected: zero failures, including existing F111 Conflict parity and all browser smoke tests.

- [ ] **Step 2: Final scope audit**

Confirm the diff contains only Body data/schema/validator/build fixtures/tests/audit docs. Reject any change to F111 training data, PREP rules, State behavior, Coach UI, `ResolvedSession` runtime contract, Body resolver registration, or Body Conflict implementation.

- [ ] **Step 3: Open PR**

Use a PR body that references `Closes #33`, summarizes the 14 targets / 5 roles / 4 families / 4 level policies / 40–60 candidate audit, and records focused/full test results.

- [ ] **Step 4: Require PR gates and squash merge**

Require PR `verify` and `browser-smoke` success. Lock the exact head SHA before squash merge.

- [ ] **Step 5: Require master release gates**

After merge, require the master workflow `verify`, `browser-smoke`, and Pages `deploy` to all succeed.

- [ ] **Step 6: Close #33 only after release evidence exists**

Confirm #33 is `closed/completed` and add a completion-evidence comment with PR number, merge SHA, candidate count, schema/validator status and master deployment result.

- [ ] **Step 7: Start #34 from the released master SHA**

Only after #33 has completed the master release gate may `Body Resolver V1` begin. #34 must consume `body.json`/runtime Body keys as its sole Body domain input rather than re-deriving the metadata.
