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
- No external network dependency.
- Test local `_site`, not live GitHub Pages.
- Browser `pageerror` must fail smoke tests.
- `deploy` must depend on Browser Smoke success.

---

### Task 1: Freeze the browser-smoke contract

**Files:**
- Create: `tests/test_issue6_browser_smoke_contract.py`

**Produces:** Static assertions that the Playwright suite and both CI workflows preserve Issue #6 coverage and ordering.

- [ ] **Step 1: Write failing contract tests**

Assert that `playwright.config.js` and `tests/browser_smoke.spec.js` exist; assert route strings `#/coach`, `#/coach/compose`, `single_leg_hinge`, `horizontal_push`, `level=L3`, viewport width `390`, `scrollWidth`, `clientWidth`, and `pageerror` are represented; assert both workflows contain a `browser-smoke` job and exact `@playwright/test@1.63.0`; assert master `deploy` depends on browser-smoke.

- [ ] **Step 2: Push and confirm RED**

Expected: existing tests pass, new contract tests fail because Playwright files/job do not exist.

- [ ] **Step 3: Commit RED evidence**

Commit only the contract test.

---

### Task 2: Add minimal Playwright configuration and real-browser smoke

**Files:**
- Create: `playwright.config.js`
- Create: `tests/browser_smoke.spec.js`

**Produces:** Chromium smoke suite served from `_site`.

- [ ] **Step 1: Configure Playwright**

Use `testDir: './tests'`, `testMatch: 'browser_smoke.spec.js'`, one worker in CI, retries `1` in CI and `0` locally, Chromium only, `baseURL: 'http://127.0.0.1:4173'`, and webServer command `python3 -m http.server 4173 --bind 127.0.0.1 --directory _site`.

- [ ] **Step 2: Add route/runtime smoke cases**

Implement helper collection of `pageerror` messages before navigation. Verify `/` plus hash routes render expected Coach/Composer text. For the L3 single-leg-hinge × horizontal-push route, assert URL query state and six `.session-slot` elements. Trigger one existing `.session-swap` selection change when an alternate option exists and assert the page remains healthy.

- [ ] **Step 3: Add 390px layout case**

Set viewport to 390×844, navigate to Composer, and assert document `scrollWidth === clientWidth` and no `pageerror`.

- [ ] **Step 4: Keep assertions structural**

Do not assert pixels, animations, or exact card coordinates.

---

### Task 3: Wire feature/PR CI

**Files:**
- Modify: `.github/workflows/schema-check.yml`

**Produces:** `browser-smoke` job gated by `verify`.

- [ ] **Step 1: Add separate job**

Checkout, setup Python 3.13 and Node 22, prepare `_site` using the same copy commands as Pages, run `npm install --no-save --no-package-lock @playwright/test@1.63.0`, run `npx playwright install --with-deps chromium`, then `npx playwright test`.

- [ ] **Step 2: Push and confirm GREEN on branch CI**

Expected: pytest contract tests and Playwright job both pass.

---

### Task 4: Wire master deployment gate

**Files:**
- Modify: `.github/workflows/deploy-pages.yml`

**Produces:** browser failure blocks Pages deployment.

- [ ] **Step 1: Add browser-smoke job after verify**

Use the same pinned install, local `_site`, and Playwright command as PR CI.

- [ ] **Step 2: Change deploy dependency**

Set `deploy.needs` to `[verify, browser-smoke]`.

- [ ] **Step 3: Verify workflow contract tests**

Expected: master deployment cannot start if browser-smoke fails.

---

### Task 5: Full regression and PR Review Gate

**Files:**
- Update docs only if implementation materially differs from spec.

- [ ] **Step 1: Run feature-branch full gate**

Expected: all pytest, build freshness, Schema, Node runtime, JS syntax, and Playwright Chromium smoke pass.

- [ ] **Step 2: Open PR closing #6**

PR body records exact head SHA and CI evidence.

- [ ] **Step 3: Independently review the PR**

Focus on flaky selectors, accidental external network dependency, false-positive `pageerror` handling, incorrect `_site` preparation, Playwright version drift, and whether deploy truly depends on browser-smoke.

- [ ] **Step 4: Verify PR merge-ref**

Only mark merge-ready when the actual merge tree passes all gates.
