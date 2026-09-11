# Conditioning Data Contract V1｜#36 Implementation Plan

**Goal:** Build the Conditioning V1 data domain consumed by #37 without implementing any Resolver/UI behavior.

**Architecture:** Add `data/src/conditioning.json` as an independent manifest-owned sidecar. General action facts stay in `actions.json`; all Conditioning eligibility, protocol, modality, level and station semantics live in the sidecar. Browser runtime remains synchronous `window.V14_DATA`.

**Spec:** `docs/superpowers/specs/2026-09-11-conditioning-data-contract-design.md`

## Frozen constraints

- No #37 Resolver / Protocol Engine.
- No #38 UI / Copy / PREP adapter.
- No F111/Body data or behavior changes.
- No action-name regex inference.
- `conditioningActionMeta` membership is the only Conditioning Station whitelist.
- POST_CARDIO_ONLY / RECOVERY_2F / 1F_ONLY are illegal Station routes.
- CARRY remains RESERVED until a real 2F Carry Action exists.
- Every ACTIVE Modality must have candidate coverage.
- Each behavior slice must be observed RED before production/data changes make it GREEN.

## Task 1｜Domain ownership + schema surface

Files:
- create `tests/test_issue36_conditioning_data_contract.py`
- create `schemas/v14.8/conditioning.schema.json`
- create `data/src/conditioning.json`
- modify `data/src/manifest.json`
- modify `tools/build_system_data.py`
- modify build ownership tests

Steps:
1. RED: assert sidecar/schema/11 runtime keys/manifest ownership.
2. Add empty formal skeleton with exact 11 keys.
3. Wire strict ordered source ownership immediately after `body.json`.
4. Add Draft 2020-12 aggregate schema.
5. Focused source/build tests GREEN.

## Task 2｜Freeze Family / Protocol / Modality / Level / protocol defaults

1. RED exact IDs:
   - CON-01..04
   - STEADY / INTERVAL / CIRCUIT / DENSITY
   - CYCLICAL / SLED / CARRY / LOCOMOTION / BALL / SIMPLE_STRENGTH / POWER / CORE_INTEGRATION
   - L1..L4
2. Freeze Family protocol matrix and defaults.
3. Freeze CARRY = RESERVED and prevent it from primary modality lists.
4. Freeze quantitative Level ranges.
5. Freeze Protocol ranges + levelDefaults.
6. Validate all defaults lie within intersecting Protocol + Level boundaries.
7. Focused tests GREEN.

## Task 3｜Audit Station candidate whitelist

1. RED candidate/ref/route/status metadata tests.
2. Add all 18 existing CONDITIONING_2F actions with explicit metadata.
3. Manually admit only necessary 2F/FLEX simple-strength/core actions.
4. Require every ACTIVE Modality to have coverage; RESERVED CARRY exempt.
5. Require:
   - no POST_CARDIO_ONLY
   - no 1F_ONLY
   - powerEligible ↔ POWER semantic consistency
   - valid levelRange ordering
6. Create `docs/V15-CONDITIONING-CANDIDATE-AUDIT.md` with one row per candidate and a separate known-gap section for CARRY.
7. GREEN focused tests.

## Task 4｜Validator + generated runtime

1. RED mutation tests for unknown refs, illegal route, POST_CARDIO leak, level ordering, reserved modality misuse, power inconsistency and default-range violations.
2. Integrate Conditioning aggregate schema in `validate_payload()`.
3. Add explicit cross-record validator checks.
4. Add `tests/conditioning_data_runtime_test.js`.
5. Generate `data/system-data.js` only through builder.
6. Build/schema/runtime GREEN.

## Task 5｜Full regression + PR + master release

Run:
- `python -m pytest -q`
- `python tools/build_system_data.py --check`
- `python tools/validate_v148_schema.py`
- all `tests/*_test.js`
- JS syntax
- Playwright

Final audit:
- only Conditioning data/schema/validator/build/tests/docs changes
- no Resolver registration
- no UI
- no State
- no F111/Body behavior changes

Then:
- PR with `Closes #36`
- require PR verify + browser-smoke GREEN
- lock head SHA and squash merge
- require master verify + browser-smoke + Pages deploy GREEN
- only then confirm #36 closed/completed and begin #37 from released master SHA.
