# Issue #6 Playwright Browser Smoke Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight Chromium Playwright gate that blocks deployment when critical 7Fit browser routes, Composer rendering, mobile layout, or runtime execution regress.

**Architecture:** Existing Python/Node checks remain unchanged. A separate browser-smoke job prepares the same `_site` static artifact, installs pinned Playwright only in CI, serves it locally, and runs a minimal Chromium suite. Master deploy depends on both verify and browser-smoke.

**Tech Stack:** GitHub Actions, Node 22, `@playwright/test@1.63.0`, Chromium, Python `http.server`, existing static HTML/JS/CSS application.

**Spec:** `docs/superpowers/specs/2026-09-10-issue-6-playwright-browser-smoke-design.md`

## Global Constraints

- Chromium only.
- Playwright version is exactly `1.63.0`; never use `latest`.
- No application runtime dependency or frontend framework is introduced.
- No screenshot/visual-diff assertions.
- No application-under-test external network dependency.
- Test local `_site`, not live GitHub Pages.
- Browser `pageerror` must fail smoke tests.
- `deploy` must depend on Browser Smoke success.
- Browser download uses `npx playwright install chromium`; `--with-deps` is deliberately excluded after an external apt mirror hash mismatch produced a false-red during TDD.

---

### Task 1: Freeze the browser-smoke contract

**Files:**
- Create: `tests/test_issue6_browser_smoke_contract.py`

**Produces:** Static assertions that the Playwright suite and both CI workflows preserve Issue #6 coverage and ordering.

- [x] **Step 1: Write failing contract tests**

Contract freezes `#/coach`, `#/coach/compose`, `single_leg_hinge`, `horizontal_push`, `level=L3`, `L3｜单腿拉 + 水平推`, viewport width `390`, `scrollWidth`, `clientWidth`, `pageerror`, actual Composer selectors, pinned Playwright version, browser-smoke jobs, and deploy dependency.

- [x] **Step 2: Push and confirm RED**

The contract was introduced before Playwright files/workflow wiring, producing the expected RED while the pre-existing test suite remained healthy.

- [x] **Step 3: Commit RED evidence**

Contract-only commit recorded before GREEN implementation.

---

### Task 2: Add minimal Playwright configuration and real-browser smoke

**Files:**
- Create: `playwright.config.js`
- Create: `tests/browser_smoke.spec.js`

**Produces:** Chromium smoke suite served from `_site`.

- [x] **Step 1: Configure Playwright**

Uses `testDir: './tests'`, `testMatch: 'browser_smoke.spec.js'`, one worker, CI retry `1`, Chromium only, `baseURL: 'http://127.0.0.1:4173'`, and Python `http.server` serving `_site`.

- [x] **Step 2: Add route/runtime smoke cases**

Captures `pageerror` before navigation. Verifies `#/coach`, `#/coach/compose`, and `#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3`. The key route asserts `L3｜单腿拉 + 水平推`, six `.composer-slot-card` elements, and one real `.composer-slot-select` replacement that survives the Composer rerender cycle.

- [x] **Step 3: Add 390px layout case**

Uses 390×844 and asserts `document.documentElement.scrollWidth === document.documentElement.clientWidth`, with no `pageerror`.

- [x] **Step 4: Keep assertions structural**

No pixel, animation, screenshot, or visual-diff assertions were added.

---

### Task 3: Wire feature/PR CI

**Files:**
- Modify: `.github/workflows/schema-check.yml`

**Produces:** `browser-smoke` job gated by `verify`.

- [x] **Step 1: Add separate job**

Checkout, Python 3.13, Node 22, `_site` preparation, exact `@playwright/test@1.63.0`, `npx playwright install chromium`, then `npx playwright test`.

- [x] **Step 2: Push and confirm GREEN on branch CI**

Workflow `34384504452` on head `11cfe67bbfed197b5a662bb110898d58e3eba60c` verified **109 pytest passed**, build freshness PASS, V14.8 Schema PASS, Node runtime PASS, JS syntax PASS, and **4 Playwright Chromium tests passed**.

---

### Task 4: Wire master deployment gate

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`

**Produces:** browser failure blocks Pages deployment.

- [x] **Step 1: Add browser-smoke job after verify**

Uses the same pinned install, local `_site`, and Playwright command as PR CI.

- [x] **Step 2: Change deploy dependency**

`deploy.needs` is `[verify, browser-smoke]`.

- [x] **Step 3: Verify workflow contract tests**

The normal pytest suite statically verifies both workflow job/dependency contracts and fails if the browser gate is removed or weakened.

---

### Task 5: Full regression and PR Review Gate

**Files:**
- Update docs only if implementation materially differs from spec.

- [x] **Step 1: Run feature-branch full gate**

Feature branch evidence: 109 pytest passed; build freshness PASS; V14.8 Schema PASS; Node runtime/JS syntax PASS; Chromium Browser Smoke 4/4 PASS.

- [ ] **Step 2: Open PR closing #6**

PR body must record the final head SHA and CI evidence.

- [ ] **Step 3: Independently review the PR**

Focus on flaky selectors, accidental external network dependency, false-positive `pageerror` handling, incorrect `_site` preparation, Playwright version drift, and whether deploy truly depends on browser-smoke.

- [ ] **Step 4: Verify PR merge-ref**

Only mark merge-ready when the actual merge tree passes all gates.
