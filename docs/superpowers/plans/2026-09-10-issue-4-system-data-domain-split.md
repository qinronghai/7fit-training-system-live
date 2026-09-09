# Issue #4 system-data.js Domain Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hand-maintained `data/system-data.js` with deterministic domain JSON sources under `data/src/` while preserving the exact `window.V14_DATA` runtime contract and current training semantics.

**Architecture:** Keep a build-time split / runtime monolith. Domain JSON files plus `manifest.json` become the source of truth; `tools/build_system_data.py` deterministically assembles them into the committed `data/system-data.js`. CI verifies ownership, staleness, V14.8 Schema, runtime tests, and static Pages compatibility.

**Tech Stack:** Python 3.13 standard library, JSON Schema validator from Issue #3, vanilla JavaScript runtime, pytest, Node.js runtime tests, GitHub Actions, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-09-10-issue-4-system-data-domain-split-design.md`

## Global Constraints

- Preserve `window.V14_DATA` and the existing synchronous `<script src="data/system-data.js">` browser contract.
- Preserve all current training content and V14.8 Schema semantics.
- Preserve 243 Actions, 32 F111 Sessions, 8 Recipe Families, 30 SUPPORT, 20 CORE, 20 PREP, 12 Foam, 5 lower × 4 upper Composer modes, and 8 official presets.
- Preserve Issue #5 D1/D2 `1F_ONLY` policy.
- Do not modify `data/anatomy-data.js`.
- Do not introduce Node build dependencies, bundlers, frameworks, runtime fetch JSON, or ES Modules.
- `data/system-data.js` remains committed and deployable as a static artifact, but is generated-only after this issue.
- Every `V14_DATA` top-level key has exactly one owner declared in `data/src/manifest.json`.
- Mechanical migration only: no content fixes, renames, tier changes, route changes, ordering changes, or new exercises.

---

### Task 1: Freeze the current runtime and establish RED tests

**Files:**
- Create: `tests/test_v148_data_build.py`
- Read: `data/system-data.js`
- Read: `tools/validate_v148_schema.py`

**Interfaces:**
- Consumes: existing `window.V14_DATA` bundle.
- Produces: failing tests that define the source directory, ownership manifest, build parity, and deterministic build contract.

- [ ] **Step 1: Add a runtime loader and failing source-contract tests**

Create `tests/test_v148_data_build.py` with helpers that parse the current `window.V14_DATA` payload and require:

```python
DOMAIN_FILES = (
    "actions.json",
    "patterns.json",
    "sessions.json",
    "support.json",
    "core.json",
    "prep.json",
    "foam.json",
    "composer.json",
    "venue.json",
    "system.json",
)


def test_domain_source_contract_exists():
    assert (SRC / "manifest.json").is_file()
    for name in DOMAIN_FILES:
        assert (SRC / name).is_file(), name
```

The failure message for the first RED run must also include `sorted(load_runtime_data().keys())` so the exact current top-level inventory is visible in CI logs.

- [ ] **Step 2: Add tests for manifest ownership and parity**

Require:

```python
owners = manifest["owners"]
assert set(owners) == set(runtime)
assert len(set(owners.values())) <= len(DOMAIN_FILES)
assert assembled_payload == runtime
```

Also assert each declared key appears in exactly one source fragment and no undeclared key exists.

- [ ] **Step 3: Add deterministic/stale contract tests**

Tests must import the future builder API and require:

```python
payload = build_payload(SRC)
assert render_bundle(payload) == render_bundle(build_payload(SRC))
assert check_bundle(SRC, DATA) is True
```

At this point the test must fail because `tools/build_system_data.py` does not exist and `data/src/` does not exist.

- [ ] **Step 4: Push the test-only commit and verify RED in GitHub Actions**

Run through the existing `V14.8 Schema Check` workflow.

Expected: existing regression tests remain green; `tests/test_v148_data_build.py` fails specifically because the new source/build layer is missing. Record the exact top-level keys printed by the failure.

---

### Task 2: Implement the deterministic builder and ownership manifest contract

**Files:**
- Create: `tools/build_system_data.py`
- Modify: `tests/test_v148_data_build.py`

**Interfaces:**
- Produces:
  - `load_manifest(src_dir: Path) -> dict`
  - `load_fragments(src_dir: Path, manifest: dict) -> dict[str, dict]`
  - `build_payload(src_dir: Path) -> dict`
  - `render_bundle(payload: dict) -> str`
  - `check_bundle(src_dir: Path, bundle_path: Path) -> bool`
  - CLI: `python tools/build_system_data.py [--check]`

- [ ] **Step 1: Implement manifest validation only**

`manifest.json` schema expected by the builder:

```json
{
  "formatVersion": 1,
  "sourceFiles": ["actions.json", "patterns.json", "sessions.json", "support.json", "core.json", "prep.json", "foam.json", "composer.json", "venue.json", "system.json"],
  "owners": {"actions": "actions.json"},
  "baselinePayloadSha256": "<64 lowercase hex>"
}
```

Fail on missing files, unknown owner files, duplicate source file names, malformed SHA-256, non-object fragments, duplicate top-level keys, undeclared keys, or declared-but-missing keys.

- [ ] **Step 2: Verify focused tests move from import failure to source-missing failure**

Expected: builder imports successfully; tests still RED because migration sources are not present.

- [ ] **Step 3: Implement deterministic rendering and check mode**

Render exactly:

```python
"window.V14_DATA=" + json.dumps(
    payload,
    ensure_ascii=False,
    separators=(",", ":"),
    sort_keys=False,
) + ";\n"
```

`--check` compares bytes/text and exits non-zero with:

```text
system-data.js is stale; run: python tools/build_system_data.py
```

- [ ] **Step 4: Add negative unit tests**

Use temporary directories to prove:
- duplicate ownership is rejected;
- duplicate physical top-level key is rejected;
- undeclared key is rejected;
- declared-but-missing key is rejected;
- non-object fragment is rejected;
- stale bundle returns false/non-zero;
- two builds from identical sources are byte-identical.

---

### Task 3: Mechanically migrate the existing bundle into domain JSON sources

**Files:**
- Create: `tools/migrate_system_data_sources.py`
- Create: `data/src/manifest.json`
- Create: `data/src/actions.json`
- Create: `data/src/patterns.json`
- Create: `data/src/sessions.json`
- Create: `data/src/support.json`
- Create: `data/src/core.json`
- Create: `data/src/prep.json`
- Create: `data/src/foam.json`
- Create: `data/src/composer.json`
- Create: `data/src/venue.json`
- Create: `data/src/system.json`
- Regenerate: `data/system-data.js`

**Interfaces:**
- Migration input: current formal `data/system-data.js` at the Issue #4 baseline.
- Migration output: domain fragments + ownership manifest whose assembly is semantically equal to the baseline payload.

- [ ] **Step 1: Build explicit top-level ownership mapping from the RED inventory**

Do not classify by arbitrary size. Exact keys discovered from Task 1 must be assigned to one of the ten domain files. Prefix/family rules may assist migration, but the committed `manifest.json` must contain the complete explicit key→file map.

- [ ] **Step 2: Implement one-time migration script**

The script parses the existing bundle, computes a semantic baseline hash from canonical JSON, partitions complete top-level keys without deep merge, writes UTF-8 JSON fragments, writes `manifest.json`, then calls the builder.

The script must fail rather than silently assign an unclassified top-level key.

- [ ] **Step 3: Execute the migration in the feature branch**

Because the bundle is ~556 KB, run the migration inside GitHub Actions/branch workspace rather than manually copying records.

- [ ] **Step 4: Verify semantic parity before accepting generated output**

Require:

```python
assert build_payload(SRC) == baseline_payload
assert semantic_sha256(build_payload(SRC)) == manifest["baselinePayloadSha256"]
```

Also require the V14.8 frozen inventories to remain unchanged.

- [ ] **Step 5: Verify generated bundle compatibility**

Run:

```bash
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
python -m pytest -q
for f in tests/*_test.js; do node "$f"; done
find data js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
```

Expected: all green.

---

### Task 4: Make the split-source layer authoritative in CI and documentation

**Files:**
- Modify: `.github/workflows/schema-check.yml`
- Modify: `.github/workflows/deploy-pages.yml`
- Create: `docs/V14.8-DATA-SOURCES.md`
- Modify: `docs/V14.8-SCHEMA.md` only where source loading/build ownership needs cross-reference.

**Interfaces:**
- CI order: pytest → build `--check` → Schema validator → Node runtime → JS syntax → Pages.

- [ ] **Step 1: Add a failing CI-contract test**

Extend `tests/test_v148_data_build.py` to inspect both workflow files and require `python tools/build_system_data.py --check` before `python tools/validate_v148_schema.py`.

Expected: RED until workflows are updated.

- [ ] **Step 2: Update both workflows**

Insert:

```bash
python tools/build_system_data.py --check
```

before the Schema validator in PR and master deployment gates.

- [ ] **Step 3: Document maintainer workflow**

`docs/V14.8-DATA-SOURCES.md` must explain:
- edit `data/src/*.json`, never hand-edit generated `data/system-data.js`;
- run builder;
- run `--check`;
- manifest ownership rules;
- how to add/move a top-level key;
- rollback path;
- #3 Schema vs #4 build responsibilities.

- [ ] **Step 4: Run full branch Gate**

Expected: all Python, Schema, Node runtime, JS syntax and build-staleness checks pass.

---

### Task 5: Review and release gate

**Files:** no new feature files unless review finds defects.

- [ ] **Step 1: Open a PR against `master` with `Closes #4`**

PR body must record:
- exact source-file ownership architecture;
- baseline semantic hash;
- inventory counts;
- no training-content changes;
- test results;
- browser/static-load compatibility.

- [ ] **Step 2: Independently review the PR**

Review specifically for:
- silent data loss;
- duplicate ownership;
- source/bundle drift loopholes;
- non-deterministic serialization;
- changed ordering or training semantics;
- schema loader accidentally bypassing generated runtime;
- CI ordering mistakes.

Any Important/P2+ finding gets a RED mutation/unit test before the fix.

- [ ] **Step 3: Verify final PR merge-ref**

Require fresh evidence on the final head:

```text
pytest → PASS
build_system_data.py --check → PASS
V14.8 schema validation → PASS
Node runtime → PASS
JS syntax → PASS
all review threads resolved
PR mergeable=true
```

- [ ] **Step 4: Merge only after Review Gate**

After squash merge, verify master Pages workflow succeeds and the deployment points at the merged commit. Only then treat Issue #4 as Done.
