# Issue 74 Security and Boundary Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Issue #74's malicious-input, route-fallback, cross-template state, failure-recovery, and responsive-layout requirements into isolated automated gates without sending test payloads to external services.

**Architecture:** Keep all tests against the static app's existing Resolver, State, Saved Session, Router, and Library boundaries. Add only the smallest user-facing input contract needed to make 3000-character input safe: saved-session names fail with a clear local validation message, while search queries are bounded before indexing. Browser tests exercise real DOM, navigation, dialogs, local state, accessibility-relevant controls, page errors, console problems, and overflow at the required viewports.

**Tech Stack:** Vanilla JavaScript, sessionStorage-backed state, Python `vm` runtime tests, Playwright Chromium, static `_site` build.

**Spec:** GitHub Issue #74 — https://github.com/qinronghai/7fit-training-system-live/issues/74

## Global Constraints

- Test XSS strings as inert text; never submit them to a real external service.
- Use isolated browser storage and clean it between cases; do not perform destructive real-data operations.
- Preserve existing Resolver, template namespace, Save/Restore, and route contracts.
- Keep unknown routes, templates, levels, focus values, and malformed encodings in a safe fallback state with no uncaught page error.
- Require `scrollWidth === clientWidth` at 390×844, 1080×844, 1280×844, and 1440×844 for covered pages.
- Do not merge, deploy, publish, or close Issue #74 from this branch.

---

### Task 1: Define bounded-input and recovery red tests

**Files:**
- Create: `tests/issue74_security_runtime_test.js`
- Create: `tests/issue74_security_browser.spec.js`
- Modify: `playwright.config.js`

**Interfaces:**
- Runtime test loads `data/system-data.js` and `js/state.js` in the existing VM harness.
- Browser test uses existing `http://127.0.0.1:4173` static-site setup and Playwright's isolated page context.
- Browser assertions use the existing `data-saved-*`, `data-filter`, and route fallback selectors.

- [x] Add a runtime test that attempts to create and rename a saved session with a 3000-character name and expects a stable `INVALID_SAVED_SESSION_NAME` error with a user-readable length message.
- [x] Add browser cases for XSS search text, 3000-character saved-name input, malformed/encoded routes, unknown `focus`, unknown template, and illegal level; assert no injected DOM, no `pageerror`, and a visible safe fallback.
- [x] Add a browser case that saves Body, switches through Conditioning and F111, and verifies only the matching template/level gets a restore notice while the global saved card keeps explicit context.
- [x] Add browser cases that simulate restore/delete failures through the local service boundary and verify the saved card remains plus a clear failure status.
- [x] Add browser cases for covered Coach, Body, Conditioning, and Library pages at 390/1080/1280/1440 with no horizontal overflow.
- [x] Register the new spec in `playwright.config.js`, run the focused runtime/browser tests, and confirm failures are caused by the missing 3000-character contract or missing assertions rather than test setup.

### Task 2: Implement the minimal safe input contract

**Files:**
- Modify: `js/state.js`
- Modify: `js/coach/saved-sessions.js`
- Modify: `js/template-search.js`
- Modify: `js/views-library.js`
- Modify: `assets/app.css` only if the new validation copy needs a bounded layout rule

**Interfaces:**
- `V15State.createSavedSession` and `V15State.renameSavedSession` reject names longer than the defined local limit with `INVALID_SAVED_SESSION_NAME`.
- `V15TemplateSearch.search` bounds the query before matching; the Library input exposes the same bound in its HTML and keeps the visible value synchronized.
- Existing Saved Sessions UI keeps records on restore/delete failure and reports the local failure without claiming backend persistence.

- [x] Add the smallest named constants and validation path needed for a clear 3000-character failure; keep valid existing names unchanged.
- [x] Add a bounded search-query path and `maxlength` to the search control; ensure the XSS payload remains data and never becomes markup.
- [x] Preserve the existing delete confirmation and template-context copy; ensure validation/failure messages do not overflow at 390px.
- [x] Run the focused runtime test and browser tests to green before any refactor.

### Task 3: Harden the edge-case matrix and evidence

**Files:**
- Modify: `tests/issue74_security_runtime_test.js`
- Modify: `tests/issue74_security_browser.spec.js`
- Modify: `tests/test_issue39_v15_release_gate.py` only if the new spec must be included in the release matrix contract

**Interfaces:**
- The new regression tests remain deterministic and use stable selectors/route outcomes rather than implementation-only details.
- Test output records the case, viewport, expected fallback, actual visible status, and absence of page/console errors.

- [x] Cover unknown `focus`, unknown template, illegal level, and malformed percent encoding independently so one route parser regression cannot hide another.
- [x] Cover both cancelled and accepted delete confirmation, failed delete, failed restore, and preservation of the original saved record.
- [x] Cover template namespace isolation in runtime and browser layers, including Body, Conditioning, and F111 names/restore notices.
- [x] Run the full Node runtime suite, Python suite, schema/build/artifact gates, JS syntax check, and complete Chromium suite.
- [x] Use the in-app browser/computer-use surface for a final visual/AX check of the malicious-input fallback and 390px saved-session state; record screenshots/console scope in the PR.

### Task 4: Review, commit, and PR evidence

**Files:**
- Modify: `docs/superpowers/plans/2026-09-16-issue-74-security-regression.md`

- [x] Review the final diff for test-only isolation, no external payloads, no cross-template state leakage, and no direct master changes.
- [x] Mark completed plan steps with the actual verification results.
- [x] Commit the isolated implementation, push `feature/issue-74-security-regression`, open an unmerged PR referencing #74, and post evidence without closing the issue.

### Verification result

- Focused runtime and browser regression tests passed after the red phase.
- Full non-browser gates passed: Node runtime, JS syntax, Python 219 passed, V14.8 schema, system-data build check, artifact hygiene, and `git diff --check`.
- Full Chromium initially exposed the independent #73 PREP failures; those were reproduced on the master baseline, fixed in stacked PR #115, and the final stacked suite passed 47/47 after rebasing #74 onto #73.
- In-app browser visual/AX evidence covered the local static build at 390px and desktop widths; no external test payloads were submitted.
