# Issue #6 Playwright Browser Smoke Gate Design

## Goal

Add a lightweight real-browser CI gate that catches route/render/runtime/CSS regressions before GitHub Pages deploys, without turning V14.8 into a broad E2E suite.

## Frozen scope

The gate MUST cover:

1. `#/coach` loads in a real Chromium browser.
2. `#/coach/compose` loads in a real Chromium browser.
3. `#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3` resolves the key L3 单腿拉 × 水平推 state and renders six formal training slots.
4. A representative Composer interaction can complete without browser errors.
5. A 390px-wide viewport has `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
6. Every smoke case records `pageerror`; any uncaught browser error fails the test.

## Architecture

Use Playwright Test with Chromium only. Keep the existing static architecture: CI prepares `_site`, then Playwright serves `_site` through Python's local HTTP server. Hash routing means no SPA fallback server is required.

Playwright is pinned to `@playwright/test@1.63.0`; CI must not use `latest`.

No permanent npm application dependency is introduced. CI installs the exact Playwright test package ephemerally and downloads Chromium explicitly. This repo remains a dependency-free static runtime; Playwright exists only in CI/testing.

## Test files

- `playwright.config.js`: Chromium-only configuration, local `_site` web server, conservative timeout/retry policy.
- `tests/browser_smoke.spec.js`: the small browser smoke suite.
- `tests/test_issue6_browser_smoke_contract.py`: static CI/test-contract checks so accidental removal or weakening is caught by normal pytest.

## CI topology

### Feature / PR workflow

`verify` continues to run Python, build freshness, Schema, Node runtime, and JS syntax.

New `browser-smoke` job:

- `needs: verify`
- checkout
- setup Python + Node 22
- prepare `_site`
- install `@playwright/test@1.63.0`
- install Chromium with dependencies
- run `npx playwright test`

### Master Pages workflow

Keep `verify` as the source/build/runtime gate.

Add `browser-smoke` with `needs: verify`.

Change `deploy` to `needs: [verify, browser-smoke]` so browser failures block Pages deployment.

## Stability rules

- Chromium only.
- No screenshot or visual-diff assertions.
- No external network requests.
- No animation timing assertions.
- Prefer semantic text, stable route state, and structural selectors already emitted by the app.
- Do not depend on GitHub Pages being live; test the local `_site` artifact.
- Capture `pageerror` from navigation start.

## Acceptance evidence

Before merge, the PR merge-ref must show:

- all existing pytest green;
- build freshness PASS;
- V14.8 Schema PASS;
- all Node runtime tests PASS;
- JS syntax PASS;
- Playwright Browser Smoke PASS on Chromium.

After merge, the master Pages workflow must complete both `verify` and `browser-smoke` before `deploy`, and `deploy` must succeed.
