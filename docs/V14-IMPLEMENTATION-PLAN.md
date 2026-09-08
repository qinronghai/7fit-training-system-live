# 7Fit Training System V14 Information Architecture Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the current V13.2 single-page training system into a V14 hash-routed static SPA where coach-facing work, training knowledge, programming rules, action-library lookup, and system maintenance are isolated views sharing the same existing data and conflict-checking behavior.

**Architecture:** Keep V14 as a dependency-free static web app that can be opened locally or hosted on GitHub Pages/Vercel. Extract the V13.2 runtime data into a shared data layer, render only the active hash route into one main content region, and keep coach mode as the default surface while hiding source/audit metadata behind system mode and maintenance routes. Preserve all V13.2 training data and conflict logic; V14 is an information-architecture migration, not a training-content rewrite.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, hash routing, Python/BeautifulSoup migration scripts, Node.js syntax checks, Python static DOM regression tests.

**Spec:** `/mnt/data/7Fit_Training_System_V14_信息架构重构设计规范.md`

## Global Constraints

- Preserve all 32 F111 sessions, 8 Recipe Families, and the existing A/B/C + D1/D2/CORE course structure.
- Preserve all 30 SUPPORT canonical nodes and all 20 CORE canonical nodes.
- Preserve the eight movement-pattern V1.1 progression chains exactly.
- Preserve the V13 venue-overlay nodes and keep Source Tier separate from V1.1 Standard Tier.
- Preserve the hard route `2F PREP → 1F STRENGTH → 2F RECOVERY → POST CARDIO`.
- `POST_CARDIO_ONLY` actions must never appear inside formal F111 training blocks.
- Preserve all current action-detail records and replacement/conflict behavior.
- Default UI is Coach Mode; V8/V10/V11/V12/V13 development labels, Source IDs, Audit, Overlay, and Data Gap must not dominate coach-facing screens.
- No backend, login, cloud sync, member profile, or AI auto-programming in V14.
- The build must work as static files without a package manager or web server dependency.
- Primary V14 routes:
  - `#/coach`
  - `#/coach/f111-01/l1` through `#/coach/f111-08/l4`
  - `#/system/patterns`
  - `#/system/support`
  - `#/system/core`
  - `#/rules/venue`
  - `#/rules/replacement`
  - `#/rules/conflicts`
  - `#/library`
  - `#/maintenance`
  - `#/maintenance/audit`
  - `#/maintenance/venue`

---

## File Structure

Create a focused static application rather than another monolithic HTML document:

```text
/mnt/data/7fit-training-system-v14/
├── index.html                     # App shell only: header, sidebar, main outlet, mobile nav
├── assets/
│   └── app.css                    # All V14 layout/components/responsive styles
├── data/
│   └── system-data.js             # V13.2 migrated ACTIONS, SESSIONS, CORE/SUPPORT and metadata
├── js/
│   ├── router.js                  # Hash parsing, route table, active-nav state
│   ├── state.js                   # Coach/System UI mode, current replacements, reset helpers
│   ├── conflict.js                # Reusable V13 conflict evaluator
│   ├── action-detail.js           # Action-detail drawer rendering and source/system metadata toggle
│   ├── views-coach.js             # F111 recipe dashboard + single session detail
│   ├── views-system.js            # Patterns / SUPPORT / CORE knowledge views
│   ├── views-rules.js             # Venue / replacement / conflict rule views
│   ├── views-library.js           # Search/filter/result list + detail drawer
│   ├── views-maintenance.js       # Data health, source diff, Venue Truth, version/audit views
│   └── app.js                     # Bootstraps state, router, global interactions
├── tests/
│   ├── test_v14_structure.py      # Static HTML/data invariants
│   ├── test_v14_training_data.py  # 32/30/20/8 preservation checks
│   └── test_v14_routes.py         # Route and deep-link inventory
├── README.md                      # How to open/deploy; scope and current baseline
└── V14-VALIDATION.md              # Final validation evidence
```

Also create a portable distributable:

```text
/mnt/data/7fit-training-system-v14.zip
```

---

### Task 1: Freeze and Extract the V13.2 Baseline

**Files:**
- Read: `/mnt/data/7fit-f111-v13_2-compact-reference-index.html`
- Create: `/mnt/data/7fit-training-system-v14/data/system-data.js`
- Create: `/mnt/data/7fit-training-system-v14/tests/test_v14_training_data.py`
- Create: `/mnt/data/7fit-training-system-v14/README.md`

**Interfaces:**
- Consumes: `window.V13_ACTIONS`, `window.V13_SESSIONS`, existing SUPPORT/CORE action metadata embedded in V13.2.
- Produces:
  - `window.V14_DATA.actions: Record<string, Action>`
  - `window.V14_DATA.sessions: Record<string, Session>`
  - `window.V14_DATA.supportIds: string[]`
  - `window.V14_DATA.coreIds: string[]`
  - `window.V14_DATA.recipeIds: string[]`
  - `window.V14_DATA.meta: { version: string, eightPatternBaseline: string }`

- [ ] **Step 1: Write the failing data-preservation test**

Create `tests/test_v14_training_data.py`:

```python
import json
import re
from pathlib import Path

DATA = Path(__file__).parents[1] / "data" / "system-data.js"

def load_payload():
    text = DATA.read_text(encoding="utf-8")
    m = re.search(r"window\.V14_DATA\s*=\s*(\{.*\});\s*$", text, re.S)
    assert m, "window.V14_DATA payload missing"
    return json.loads(m.group(1))

def test_training_inventory_is_preserved():
    data = load_payload()
    assert len(data["sessions"]) == 32
    assert len(data["supportIds"]) == 30
    assert len(data["coreIds"]) == 20
    assert data["recipeIds"] == [f"F111-{i:02d}" for i in range(1, 9)]

def test_v11_baseline_marker_is_explicit():
    data = load_payload()
    assert data["meta"]["eightPatternBaseline"] == "V1.1"
```

- [ ] **Step 2: Run the test and verify it fails because V14 data does not exist**

Run:

```bash
python -m pytest /mnt/data/7fit-training-system-v14/tests/test_v14_training_data.py -q
```

Expected: FAIL because `data/system-data.js` is missing.

- [ ] **Step 3: Extract V13.2 data without changing values**

Write a one-time Python extraction script or direct generator that parses the V13.2 `window.V13_ACTIONS` and `window.V13_SESSIONS` payloads and emits:

```javascript
window.V14_DATA = {
  "actions": { /* exact migrated V13 action metadata */ },
  "sessions": { /* exact migrated V13 session metadata */ },
  "supportIds": [/* 30 canonical SUPPORT IDs */],
  "coreIds": [/* 20 canonical CORE IDs */],
  "recipeIds": ["F111-01","F111-02","F111-03","F111-04","F111-05","F111-06","F111-07","F111-08"],
  "meta": {
    "version": "V14",
    "sourceVersion": "V13.2",
    "eightPatternBaseline": "V1.1"
  }
};
```

Do not normalize, rename, or silently correct source values during extraction.

- [ ] **Step 4: Run the preservation test**

Run:

```bash
python -m pytest /mnt/data/7fit-training-system-v14/tests/test_v14_training_data.py -q
```

Expected: PASS.

- [ ] **Step 5: Record the baseline in README**

Include the exact inventory discovered from V13.2:

```text
V13.2 baseline:
- 32 F111 sessions
- 8 recipe families
- 30 SUPPORT nodes
- 20 CORE nodes
- 168 action-detail cards in the rendered V13.2 artifact
- 192 swap controls
- 32 conflict panels
- Eight-pattern baseline: V1.1
```

- [ ] **Step 6: Commit checkpoint**

If executing in a git workspace:

```bash
git add data/system-data.js tests/test_v14_training_data.py README.md
git commit -m "refactor: freeze v13 training data for v14"
```

---

### Task 2: Build the V14 App Shell and Hash Router

**Files:**
- Create: `index.html`
- Create: `assets/app.css`
- Create: `js/router.js`
- Create: `js/app.js`
- Create: `tests/test_v14_routes.py`
- Create: `tests/test_v14_structure.py`

**Interfaces:**
- Consumes: `window.V14_DATA`.
- Produces:
  - `window.V14Router.parseHash(hash): Route`
  - `window.V14Router.navigate(hash): void`
  - `window.V14Router.start(renderRoute): void`
  - DOM anchors: `#app-sidebar`, `#app-main`, `#mobile-nav`, `#mode-toggle`.

- [ ] **Step 1: Write the failing app-shell structure test**

```python
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).parents[1]

def soup():
    return BeautifulSoup((ROOT / "index.html").read_text(encoding="utf-8"), "html.parser")

def test_app_shell_has_single_main_outlet():
    s = soup()
    assert s.select_one("#app-sidebar")
    assert s.select_one("#app-main")
    assert s.select_one("#mobile-nav")
    assert len(s.select("#app-main")) == 1

def test_primary_navigation_is_role_oriented_not_version_oriented():
    labels = [a.get_text(" ", strip=True) for a in soup().select("[data-primary-nav]")]
    assert labels == ["编课中心", "训练体系", "编排规则", "动作库", "系统维护"]
```

- [ ] **Step 2: Write the failing route-inventory test**

```python
from pathlib import Path

ROUTER = Path(__file__).parents[1] / "js" / "router.js"

def test_required_hash_routes_are_declared():
    text = ROUTER.read_text(encoding="utf-8")
    for route in [
        "#/coach",
        "#/system/patterns",
        "#/system/support",
        "#/system/core",
        "#/rules/venue",
        "#/rules/replacement",
        "#/rules/conflicts",
        "#/library",
        "#/maintenance",
        "#/maintenance/audit",
        "#/maintenance/venue",
    ]:
        assert route in text
```

- [ ] **Step 3: Run both tests to verify failure**

```bash
python -m pytest tests/test_v14_structure.py tests/test_v14_routes.py -q
```

Expected: FAIL because V14 shell/router do not exist.

- [ ] **Step 4: Implement the static shell**

`index.html` must contain only persistent chrome and script includes:

```html
<body>
  <div class="app-shell">
    <aside id="app-sidebar"></aside>
    <section class="app-column">
      <header id="app-header"></header>
      <main id="app-main" tabindex="-1"></main>
    </section>
  </div>
  <nav id="mobile-nav"></nav>

  <script src="data/system-data.js"></script>
  <script src="js/router.js"></script>
  <script src="js/state.js"></script>
  <script src="js/conflict.js"></script>
  <script src="js/action-detail.js"></script>
  <script src="js/views-coach.js"></script>
  <script src="js/views-system.js"></script>
  <script src="js/views-rules.js"></script>
  <script src="js/views-library.js"></script>
  <script src="js/views-maintenance.js"></script>
  <script src="js/app.js"></script>
</body>
```

- [ ] **Step 5: Implement hash parsing**

`js/router.js` must parse:
- `#/coach`
- `#/coach/f111-03/l2`
- `#/system/support`
- `#/library`
- `#/maintenance/audit`

Example contract:

```javascript
window.V14Router = {
  parseHash(hash) {
    const path = (hash || "#/coach").replace(/^#\/?/, "").split("/");
    if (path[0] === "coach" && path[1]) {
      return { area: "coach", recipeId: path[1].toUpperCase(), level: (path[2] || "l1").toUpperCase() };
    }
    return { area: path[0] || "coach", page: path[1] || "home" };
  },
  navigate(hash) { location.hash = hash; },
  start(renderRoute) {
    const run = () => renderRoute(this.parseHash(location.hash));
    window.addEventListener("hashchange", run);
    if (!location.hash) location.hash = "#/coach";
    else run();
  }
};
```

- [ ] **Step 6: Implement desktop sidebar and mobile navigation styles**

Desktop ≥ 980 px:
- fixed/anchored left sidebar
- main content fills remaining width

Mobile < 980 px:
- sidebar collapses
- bottom navigation exposes 编课 / 体系 / 规则 / 动作库 / 更多

- [ ] **Step 7: Run shell and route tests**

```bash
python -m pytest tests/test_v14_structure.py tests/test_v14_routes.py -q
node --check js/router.js
node --check js/app.js
```

Expected: PASS.

- [ ] **Step 8: Commit checkpoint**

```bash
git add index.html assets/app.css js/router.js js/app.js tests/
git commit -m "feat: add v14 app shell and hash router"
```

---

### Task 3: Migrate the Coach Center and Preserve Live Conflict Checking

**Files:**
- Create: `js/state.js`
- Create: `js/conflict.js`
- Create: `js/views-coach.js`
- Modify: `assets/app.css`
- Modify: `tests/test_v14_training_data.py`

**Interfaces:**
- Consumes: `V14_DATA.sessions`, `V14_DATA.actions`.
- Produces:
  - `V14State.getSelection(sessionId, slotKey): string`
  - `V14State.setSelection(sessionId, slotKey, actionId): void`
  - `V14State.resetSession(sessionId): void`
  - `V14Conflict.evaluate(sessionId, selectedIds): ConflictResult`
  - `V14Coach.renderHome(): HTMLElement|string`
  - `V14Coach.renderSession(recipeId, level): HTMLElement|string`

`ConflictResult`:

```javascript
{
  status: "PASS" | "WARN" | "FAIL",
  hardCount: 0,
  warnCount: 0,
  issues: [{ severity: "hard"|"warn"|"info", title: "...", text: "..." }]
}
```

- [ ] **Step 1: Extend the data test for every F111 session**

```python
def test_every_session_has_six_formal_slots_and_one_conflict_identity():
    data = load_payload()
    for session_id, session in data["sessions"].items():
        assert session_id.startswith("F111-")
        assert len(session["slots"]) == 6
        assert len({s["slotKey"] for s in session["slots"]}) == 6
```

- [ ] **Step 2: Run test and preserve any V13.2 truth discovered**

If V13.2 uses a different formal slot count, do not fake six. Update the assertion to the exact V13.2 baseline and record it in README before continuing.

- [ ] **Step 3: Port the V13 conflict evaluator as a pure function**

Move V13 logic out of DOM operations. The evaluator must retain:
- duplicate action = FAIL
- route outside `1F_ONLY`/`FLEX_1F_2F` = FAIL
- not auto-programmable = FAIL
- support/core progression warning
- main-pattern/tier change warning
- movement-pattern pile-up warning
- inferred load-family concentration warning
- equipment concentration warning/info

Do not add medical/member filters.

- [ ] **Step 4: Render the coach home as eight Recipe cards**

Each card shows:
- Recipe ID
- lower pattern
- upper pattern
- support type
- L1–L4 buttons

No 32-session continuous vertical list.

- [ ] **Step 5: Render only one selected session**

`#/coach/f111-03/l2` must show:
- route strip: `2F PREP → 1F STRENGTH → 2F RECOVERY`
- A / B / C same row on desktop
- D1 / D2 / CORE second row
- replacement control per formal slot
- one live PASS/WARN/FAIL panel
- reset current session button

- [ ] **Step 6: Wire replacement state to conflict evaluation**

On every selector change:

```javascript
V14State.setSelection(sessionId, slotKey, actionId);
const selectedIds = V14State.getSessionSelections(sessionId);
const result = V14Conflict.evaluate(sessionId, selectedIds);
renderConflictPanel(result);
```

- [ ] **Step 7: Validate JavaScript syntax and training inventory**

```bash
node --check js/state.js
node --check js/conflict.js
node --check js/views-coach.js
python -m pytest tests/test_v14_training_data.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit checkpoint**

```bash
git add js/state.js js/conflict.js js/views-coach.js assets/app.css tests/test_v14_training_data.py
git commit -m "feat: migrate f111 coach center to v14"
```

---

### Task 4: Build the Training-System Knowledge Views

**Files:**
- Create: `js/views-system.js`
- Modify: `data/system-data.js`
- Modify: `assets/app.css`
- Modify: `tests/test_v14_training_data.py`

**Interfaces:**
- Consumes:
  - eight-pattern V1.1 chain metadata
  - SUPPORT canonical nodes
  - CORE canonical nodes
- Produces:
  - `V14System.renderPatterns()`
  - `V14System.renderSupport()`
  - `V14System.renderCore()`

- [ ] **Step 1: Add exact eight-pattern V1.1 baseline assertions**

Add:

```python
def test_eight_pattern_v11_chains_are_frozen():
    data = load_payload()
    chains = data["eightPatterns"]
    assert chains["水平推"] == [
        "movement_incline_pushup",
        "qixie_xiongtui",
        "wotu_xiong_tui",
        "gangling_wotu",
    ]
    assert chains["髋铰链"] == [
        "movement_dowel_hip_hinge",
        "yaling_luomaniya_yingla",
        "liujiao_gantui_yingla",
        "gangling_yingla",
    ]
    assert chains["垂直推"] == [
        "V13_VP_SEATED_LIGHT_DB",
        "qixie_jian_tui",
        "movement_halfkneeling_landmine_press",
        "movement_barbell_overhead_press",
    ]
```

Also assert the other five chains from V1.1.

- [ ] **Step 2: Run test to verify missing metadata fails**

```bash
python -m pytest tests/test_v14_training_data.py::test_eight_pattern_v11_chains_are_frozen -q
```

Expected: FAIL.

- [ ] **Step 3: Add eight-pattern metadata to `V14_DATA`**

Use the exact V1.1 IDs already used by V13.

- [ ] **Step 4: Render 八大动作模式 as eight compact cards**

Clicking a card expands/loads a single pattern detail with:
- T1–T4
- role/meaning
- same-tier pool
- regression
- progression
- venue note

Do not render all eight detailed chains at once by default.

- [ ] **Step 5: Render SUPPORT knowledge view**

Default list: six grade cards `SUP-S1`–`SUP-S6`.

Click grade → show only its five canonical movements.

Click movement → open action detail drawer or inline focused detail.

- [ ] **Step 6: Render CORE knowledge view**

Default list: `CORE-L1`–`CORE-L4`.

Expose Core Demand as a separate field.

Same-level same-demand replacements must be visually distinguished from same-level different-demand alternatives.

- [ ] **Step 7: Run validation**

```bash
node --check js/views-system.js
python -m pytest tests/test_v14_training_data.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit checkpoint**

```bash
git add js/views-system.js data/system-data.js assets/app.css tests/test_v14_training_data.py
git commit -m "feat: add v14 training knowledge views"
```

---

### Task 5: Build Programming Rules and Action Library Views

**Files:**
- Create: `js/views-rules.js`
- Create: `js/views-library.js`
- Create: `js/action-detail.js`
- Modify: `assets/app.css`
- Modify: `tests/test_v14_structure.py`

**Interfaces:**
- Consumes: shared action/session metadata.
- Produces:
  - `V14Rules.renderVenue()`
  - `V14Rules.renderReplacement()`
  - `V14Rules.renderConflicts()`
  - `V14Library.render()`
  - `V14Library.filterActions(filters): Action[]`
  - `V14ActionDetail.open(actionId, { systemMode })`

- [ ] **Step 1: Add static accessibility/search controls test**

```python
def test_library_has_search_and_filter_mount_points():
    text = (ROOT / "js" / "views-library.js").read_text(encoding="utf-8")
    assert 'id="action-search"' in text
    assert 'data-filter="pattern"' in text
    assert 'data-filter="tier"' in text
    assert 'data-filter="zone"' in text
    assert 'data-filter="equipment"' in text
```

- [ ] **Step 2: Run test and verify failure**

```bash
python -m pytest tests/test_v14_structure.py::test_library_has_search_and_filter_mount_points -q
```

Expected: FAIL.

- [ ] **Step 3: Implement rule pages**

`#/rules/venue`:
- hard route
- route enum meanings
- PREP/STRENGTH/RECOVERY/POST CARDIO boundary

`#/rules/replacement`:
- same pattern
- same V1.1 tier
- route eligible
- auto-programmable
- duplicate excluded
- source-declared vs system-derived alternatives remain distinct

`#/rules/conflicts`:
- hard / warn / info rule cards
- explain what the live checker enforces

- [ ] **Step 4: Implement action library search/filter**

Default shows a compact result list, not 168 open cards.

Filters:
- search text
- movement pattern
- V1.1 tier
- zone/route
- equipment
- category
- programming status

- [ ] **Step 5: Implement action-detail drawer**

Coach Mode shows:
- action name
- pattern
- standard tier
- equipment/zone
- purpose/prescription/cues if available
- same-tier replacement
- regression
- progression

System Mode additionally shows:
- standard ID
- source tier
- venue overlay/source mapping
- source/system difference notes

- [ ] **Step 6: Replace the giant replacement matrix UI with contextual alternatives**

Keep matrix data in `V14_DATA`, but the normal UI must show alternatives in the selected action detail.

Expose “查看完整矩阵” only under an advanced/system-mode action.

- [ ] **Step 7: Run tests and syntax checks**

```bash
python -m pytest tests/test_v14_structure.py -q
node --check js/views-rules.js
node --check js/views-library.js
node --check js/action-detail.js
```

Expected: PASS.

- [ ] **Step 8: Commit checkpoint**

```bash
git add js/views-rules.js js/views-library.js js/action-detail.js assets/app.css tests/test_v14_structure.py
git commit -m "feat: add rules and searchable action library"
```

---

### Task 6: Build System Maintenance and Coach/System Mode Separation

**Files:**
- Create: `js/views-maintenance.js`
- Modify: `js/state.js`
- Modify: `js/app.js`
- Modify: `assets/app.css`
- Modify: `tests/test_v14_structure.py`

**Interfaces:**
- Produces:
  - `V14State.getMode(): "coach"|"system"`
  - `V14State.setMode(mode): void`
  - `V14Maintenance.renderHome()`
  - `V14Maintenance.renderAudit()`
  - `V14Maintenance.renderVenueTruth()`

- [ ] **Step 1: Write failing maintenance/mode assertions**

```python
def test_system_maintenance_is_not_a_default_coach_primary_surface():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert 'id="mode-toggle"' in html
    assert 'data-mode="coach"' in html

def test_maintenance_view_contains_data_health_labels():
    text = (ROOT / "js" / "views-maintenance.js").read_text(encoding="utf-8")
    for label in ["动作库总数", "待回写", "层级差异", "Venue Overlay"]:
        assert label in text
```

- [ ] **Step 2: Run test to verify failure**

```bash
python -m pytest tests/test_v14_structure.py -q
```

Expected: FAIL.

- [ ] **Step 3: Implement Coach/System mode**

Default:

```javascript
const initialMode = "coach";
```

Coach mode:
- hides raw IDs and developer audit metadata
- maintenance nav appears under “更多/系统” but is visually secondary

System mode:
- reveals source tier / standard tier differences
- overlay metadata
- audit and data-gap cards

Store only in `sessionStorage`; do not add auth.

- [ ] **Step 4: Implement maintenance home**

Show KPI cards computed from V14 data:
- total actions
- auto-programmable count
- SUPPORT/CORE pending write-back count if metadata exists
- tier-difference count
- venue-overlay count
- unresolved/review count

- [ ] **Step 5: Implement audit and Venue Truth views**

Audit:
- Source Tier vs V1.1 Standard Tier
- venue-overlay nodes
- pending write-back notes

Venue Truth:
- grouped equipment counts by zone
- no coach-facing giant equipment list on the home page

- [ ] **Step 6: Run tests and syntax checks**

```bash
python -m pytest tests/test_v14_structure.py -q
node --check js/views-maintenance.js
node --check js/state.js
node --check js/app.js
```

Expected: PASS.

- [ ] **Step 7: Commit checkpoint**

```bash
git add js/views-maintenance.js js/state.js js/app.js assets/app.css tests/test_v14_structure.py
git commit -m "feat: add system maintenance and mode separation"
```

---

### Task 7: Responsive UX, Deep Links, and Full Non-Regression Audit

**Files:**
- Modify: `assets/app.css`
- Modify: `js/router.js`
- Modify: `js/app.js`
- Modify: all `tests/*.py`
- Create: `V14-VALIDATION.md`

**Interfaces:**
- No new public interface. This task freezes V14 behavior and packaging.

- [ ] **Step 1: Add a structural non-regression test**

```python
def test_v14_non_regression_inventory():
    data = load_payload()
    assert len(data["sessions"]) == 32
    assert len(data["supportIds"]) == 30
    assert len(data["coreIds"]) == 20
    assert len(data["eightPatterns"]) == 8

    for session in data["sessions"].values():
        ids = [slot["baselineId"] for slot in session["slots"]]
        for action_id in ids:
            assert action_id in data["actions"]
            assert data["actions"][action_id]["route"] in {"1F_ONLY", "FLEX_1F_2F"}
```

If the formal session contains any explicit non-1F nodes by design, replace the last assertion with the exact V13.2 formal-route invariant instead of weakening it.

- [ ] **Step 2: Add route deep-link assertions**

Assert all 32 coach deep links can be derived:

```python
def test_all_32_session_routes_are_addressable():
    routes = [
        f"#/coach/f111-{recipe:02d}/l{level}"
        for recipe in range(1, 9)
        for level in range(1, 5)
    ]
    assert len(routes) == 32
```

- [ ] **Step 3: Make mobile layouts usable at 390 px width**

At `< 980px`:
- hide fixed sidebar
- show bottom/mobile nav
- course A/B/C stack predictably
- selectors and action detail drawer use full width
- no horizontal page overflow

At `< 620px`:
- recipe cards single column
- session cards single column except compact paired metadata
- drawer becomes bottom sheet

- [ ] **Step 4: Add invalid-route fallback**

Unknown hashes must render a compact “页面不存在” view with a button to `#/coach`; never leave the main outlet blank.

- [ ] **Step 5: Run all static tests**

```bash
cd /mnt/data/7fit-training-system-v14
python -m pytest tests -q
```

Expected: all PASS.

- [ ] **Step 6: Run JavaScript syntax validation**

```bash
for f in js/*.js data/system-data.js; do
  node --check "$f"
done
```

Expected: every file PASS.

- [ ] **Step 7: Run link/asset validation**

Use Python to parse `index.html` and confirm every relative `<script src>` and `<link href>` exists.

Expected: 0 missing assets.

- [ ] **Step 8: Write `V14-VALIDATION.md` with actual evidence**

It must include measured results, not claims:

```markdown
# V14 Validation

- F111 sessions: 32/32
- Recipe families: 8/8
- SUPPORT: 30/30
- CORE: 20/20
- Eight-pattern chains: 8/8 V1.1
- Required routes: PASS
- JS syntax: PASS
- Static tests: <actual passed count>
- Missing local assets: 0
- POST_CARDIO inside formal F111 blocks: 0
```

- [ ] **Step 9: Build the distributable ZIP**

```bash
cd /mnt/data
zip -r 7fit-training-system-v14.zip 7fit-training-system-v14
```

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "feat: complete v14 information architecture rebuild"
```

---

## Self-Review

### Spec coverage
- Coach Center: Tasks 2–3.
- Training System: Task 4.
- Programming Rules: Task 5.
- Action Library: Task 5.
- System Maintenance: Task 6.
- Coach/System modes: Task 6.
- Desktop/mobile shell: Tasks 2 and 7.
- Hash deep links: Tasks 2 and 7.
- Existing data sharing: Tasks 1 and 3–6.
- Non-regression requirements: Tasks 1, 4, and 7.
- No backend/auth/member/AI scope creep: Global Constraints.

### Placeholder scan
No TBD/TODO/“similar to above” implementation placeholders are permitted. Any data count that may differ from assumptions must be measured from V13.2 and frozen before implementation continues.

### Interface consistency
- `V14_DATA` is defined once in Task 1 and consumed by all later tasks.
- `V14State` owns user selections and UI mode.
- `V14Conflict` is pure evaluation; views do not duplicate conflict rules.
- `V14Router` owns route parsing; views only render.
- `V14ActionDetail` is shared by coach/system/library views.

---

## Execution Handoff

Recommended execution is **Subagent-Driven Development**, because V14 has seven reviewable tasks with clear non-regression gates and independent view modules. Inline execution is also possible if all work must remain in this conversation.
