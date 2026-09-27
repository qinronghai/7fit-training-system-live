# Member Management V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Epic #159 and Issues #160–#167, shipping a secure, snapshot-based Member-to-F111 training history loop with verified live evidence.

**Architecture:** Freeze one versioned contract and one pure domain module before touching DB or UI. Store immutable planned/performed snapshots in separate Member tables; expose them only through an authenticated `member-api` backed by the existing Staff PIN session; keep recent-context derivation outside the F111 resolver and share it with the UI. Use separate Issue-sized implementation gates, then perform the integrated Release Gate.

**Tech Stack:** Existing static HTML/CSS and vanilla JavaScript, shared ES module, Supabase PostgreSQL 17 / Edge Functions, Node runtime tests, Python 3.13 + pytest/jsonschema, Playwright Chromium 1.63, GitHub Pages.

**Spec:** [Epic #159](https://github.com/qinronghai/7fit-training-system-live/issues/159), [#160](https://github.com/qinronghai/7fit-training-system-live/issues/160), [#161](https://github.com/qinronghai/7fit-training-system-live/issues/161), [#162](https://github.com/qinronghai/7fit-training-system-live/issues/162), [#163](https://github.com/qinronghai/7fit-training-system-live/issues/163), [#164](https://github.com/qinronghai/7fit-training-system-live/issues/164), [#165](https://github.com/qinronghai/7fit-training-system-live/issues/165), [#166](https://github.com/qinronghai/7fit-training-system-live/issues/166), [#167](https://github.com/qinronghai/7fit-training-system-live/issues/167).

## Global Constraints

- `PLANNED` and `CANCELLED` never enter Recent Training Context; only `COMPLETED` sessions do.
- Preserve both `plannedActionSnapshot` and `performedActionSnapshot`; the latter wins in completed context.
- Freeze action, level, muscle, equipment/station, and prescription metadata when the session is saved or replaced.
- Canonical load phases are `PRIMARY`, `SECONDARY`, `ACCESSORY`, `CORE`, and `CONDITIONING`; `FOAM`, `PREP`, `MOBILITY`, and unknown phases do not count as primary repetition signals.
- Member tables stay separate from `cases` / `case_assets`; archive members instead of deleting training history.
- All Member tables enable RLS; `anon` and `authenticated` receive no Member-data grants or policies; server keys stay in Edge Function secrets.
- Staff authentication rejects missing, expired, or revoked sessions and preserves the current Case Admin login protections.
- Member context is advisory only; do not change F111 Resolver behavior, presets, or ordinary no-member F111 flow.
- Keep the static browser runtime dependency-free; do not add CRM, finance, scheduling, recovery scores, or automatic exercise selection.
- Desktop widths: 1080, 1280, 1440. Mobile widths: 360, 390×844, 430. No horizontal overflow or browser page errors.

## Review Focus

- Unknown or legacy phase names fail soft and are excluded from major-load repetition; pin in `member_domain_test.js` and the Recent Context matrix.
- Retries after a dropped response and retries after refresh return the same planned session; pin in API and Save-to-Member browser tests.
- Two staff devices updating the same session cannot silently overwrite one another; pin in API revision/conflict tests.
- Replaced actions retain the original plan and the performed snapshot remains unchanged after action-library metadata changes; pin in snapshot fixtures and Release Gate tests.
- Missing, expired, or revoked Staff sessions cannot read or partially write Member data; pin in auth/API tests and the live anonymous-access gate.

## File Structure

- `supabase/functions/_shared/member-domain.mjs`: canonical Member/Session contracts, phase mapping, snapshot builders, validation, and context derivation; safe to load in Node, Deno, and the browser.
- `supabase/functions/_shared/staff-auth.mjs`: reusable PIN-session primitives. `case-api/auth.mjs` remains a compatibility export for existing tests/callers.
- `supabase/migrations/<CLI-generated-version>_member_management_v1.sql`: tables, constraints, indexes, closed grants/RLS, and atomic RPCs.
- `supabase/functions/member-api/index.ts`: authenticated HTTP boundary; `service.mjs` contains injectable request/domain orchestration for Node tests.
- `js/member/`: Member API client, list/detail/history views, selector, execution controls, and member-context presentation.
- `js/coach/`: F111 Save-to-Member and member-context hooks; existing resolver modules remain untouched.
- `tests/member_*`: domain, API/auth, migration-contract, UI, and browser coverage; `tests/member-v1-release-gate_browser.spec.js` covers integrated flows.
- `tools/prepare_static_site.py`, `index.html`, `assets/app.css`, `.github/workflows/deploy-pages.yml`, and `data/change-log.js`: static asset delivery, routing, responsive UI, release checks, and user-visible change record.

---

### Task 1 — #160 Domain Contract

**Files:** Create `supabase/functions/_shared/member-domain.mjs`, `schemas/member-v1.schema.json`, `tests/fixtures/member-v1/` fixtures, `tests/member_domain_test.js`, and `tests/test_member_contract.py`.

**Interfaces:** Export versioned `validateMember`, `validateTrainingSession`, `validateTrainingSessionItem`, `buildTrainingSessionSnapshot`, `canonicalPhase`, and `deriveMemberTrainingContext`. Define nullable/empty behavior and the exact F111 slot mapping once.

- [x] Write failing tests for schema shape, status meanings, snapshots, planned/performed pairs, canonical phases, and unknown-phase exclusion.
- [x] Run the focused Node/Python tests and confirm expected RED failures.
- [x] Implement the schema and pure domain module; fixture one F111 ResolvedSession and one replaced-action session.
- [x] Run focused tests to GREEN; run the current Python, Node, schema, and syntax regression gates.
- [x] Commit the Issue-scoped contract and fixture changes.

### Task 2 — #161 Database and RLS

**Files:** Create a CLI-generated migration under `supabase/migrations/`, `tests/test_member_migration_contract.py`, and `tests/fixtures/member-v1/anon_access.sql` (or an equivalent executable SQL gate).

**Interfaces:** Tables are `public.members`, `public.training_sessions`, and `public.training_session_items`; atomic save/complete/cancel RPCs consume Task 1 field names and `schemaVersion=1`. Use `revision` for optimistic concurrency and `(member_id, idempotency_key)` for retry identity.

- [ ] Write failing migration-contract tests for the three tables, fields, FKs, indexes, status/phase checks, completed-at consistency, archive preservation, explicit role grants, and RLS.
- [ ] Run focused tests and verify RED.
- [ ] Generate the migration with `supabase migration new`; implement non-destructive DDL, `ON DELETE RESTRICT` for member history, cascading session items, and `SECURITY INVOKER` RPCs with execute grants limited to `service_role`.
- [ ] Verify the migration on an isolated database/branch before production; query FK/check/grant/RLS metadata and confirm `anon` cannot select any Member table.
- [ ] Confirm `cases`, `case_assets`, their six assets, and seven rows are unchanged; record rollback/recovery instructions.
- [ ] Run Security and Performance Advisors and compare with the captured baseline; fix any new high-risk finding.
- [ ] Commit the migration and DB tests.

### Task 3 — #162 Member API and Staff Auth Boundary

**Files:** Create `supabase/functions/_shared/staff-auth.mjs`, `supabase/functions/member-api/{index.ts,service.mjs}`, `tests/member_api_test.js`, `tests/member_auth_test.js`; update `supabase/functions/case-api/{index.ts,auth.mjs}` and existing auth tests only as needed.

**Interfaces:** Actions cover member list/get/save/archive/restore, session list/get/save-planned/update/complete/cancel, and `get-member-training-context`. Errors use stable codes and HTTP statuses. Session writes call Task 2 atomic RPCs; updates require expected revision.

- [ ] Add failing tests for auth, validation, CRUD, atomic RPC invocation, idempotency, stale revisions, allowed/forbidden transitions, and error redaction.
- [ ] Verify RED before implementation.
- [ ] Extract the existing token hashing/expiry/revocation service without changing PIN limits or Case behavior; retain the current auth module as a compatibility surface.
- [ ] Implement the Member-only Edge Function and service with server-side validation, list payload limits, `401`/`404`/`409` semantics, and no direct browser database key.
- [ ] Run focused auth/API tests and existing Case API auth tests to GREEN.
- [ ] Commit the Issue-scoped API/auth changes.

### Task 4 — #163 Member Center UI

**Files:** Create `js/member/api.js`, `js/member/center.js`, `js/member/session.js`, and Member styles in `assets/app.css`; update `js/router.js`, `js/views-coach.js`, `js/coach/home.js`, and `index.html`.

**Interfaces:** Routes are `#/coach/members` and `#/coach/members/:memberId`. UI consumes API/derived context and never recalculates repetition counts. Session Detail is a desktop drawer and mobile sheet with focus return.

- [ ] Add failing route/render/browser tests for search, active/archive filters, create/edit/archive/restore, empty/error/loading states, recent-context hierarchy, timeline, session detail, keyboard access, and focus behavior.
- [ ] Verify RED.
- [ ] Implement the Coach Center entry, list/detail/profile, recent 1/3 completed sessions, timeline, drawer/sheet, and accessible member forms.
- [ ] Run focused tests and capture 1080/1280/1440 and 360/390×844/430 screenshots; assess overflow, hierarchy, and page errors.
- [ ] Commit the Issue-scoped Member Center changes.

### Task 5 — #164 F111 Save-to-Member

**Files:** Create `js/member/snapshot-client.js` and `js/member/selector.js`; update `js/coach/composer-view.js`, `js/coach/session.js`, `js/views-coach.js`, `tools/prepare_static_site.py`, and `index.html` to load the shared domain module.

**Interfaces:** Preset and Composer ResolvedSessions create the same `TrainingSessionSnapshot`; the selector returns a saved session ID. Copy actions never call the Member API. Retry key and saved state survive refresh; explicit “另存给其他会员” starts a new save intent.

- [ ] Add failing snapshot/save/browser tests for both F111 modes, full frozen action metadata, planned status, cancel-without-write, copy-without-write, refresh retry, duplicate clicks, and save failure recovery.
- [ ] Verify RED.
- [ ] Add only the explicit “保存到会员” flow and selector; persist the planned snapshot and item rows through `member-api`.
- [ ] Run focused tests; assert F111 Resolver fingerprints/outputs are unchanged.
- [ ] Commit the Issue-scoped Save-to-Member changes.

### Task 6 — #165 Planned to Completed

**Files:** Update `js/member/session.js`, `js/member/center.js`, `supabase/functions/member-api/service.mjs`, and Task 2 RPCs; create `tests/member_execution_test.js`.

**Interfaces:** Only `PLANNED → COMPLETED` and `PLANNED → CANCELLED` are legal. Unchanged items inherit planned action/prescription on one-click completion; replacements keep both snapshots. Optional actual fields are sets, reps, loadKg, RIR, RPE, and note.

- [ ] Add failing tests for one-click completion, one/multiple replacements, optional actual values, cancellation, retries, and illegal transitions.
- [ ] Verify RED.
- [ ] Implement execution editing through legal replacement candidates and atomic completion/cancel RPCs.
- [ ] Run focused tests and verify the Member Detail shows the completed session immediately.
- [ ] Commit the Issue-scoped execution changes.

### Task 7 — #166 Recent Context and Member-first F111

**Files:** Update `supabase/functions/_shared/member-domain.mjs`, `supabase/functions/member-api/service.mjs`, `js/member/center.js`, `js/coach/composer-view.js`, `js/views-coach.js`, and create `tests/member_context_test.js` plus browser coverage.

**Interfaces:** Context is derived only by `deriveMemberTrainingContext` from the latest three completed sessions; performed actions take precedence. F111 receives `memberId` and fresh context as optional route state, with no resolver input changes.

- [ ] Add failing context tests for 0/1/3/5 sessions, repeats, cancelled/planned sessions, performed replacements, every canonical phase, PREP/FOAM, and unknown phases.
- [ ] Verify RED.
- [ ] Implement Member Detail → “为她编下一节” → F111 context header, compact recent summary, history return, and refresh-on-entry/completion.
- [ ] Run focused tests; compare no-member F111 and frozen Resolver behavior to baseline.
- [ ] Commit the Issue-scoped context/Member-first changes.

### Task 8 — #167 Release Gate and Live Evidence

**Files:** Create `tests/member-v1-release-gate_browser.spec.js` and `docs/MEMBER-V1-RELEASE-GATE.md`; update `.github/workflows/schema-check.yml`, `.github/workflows/deploy-pages.yml`, `data/change-log.js`, and this plan's checkboxes.

**Interfaces:** CI runs the domain/API/DB contract tests and complete responsive browser matrix. Live proof records commit/build ID, migration version, Edge Function version, Pages URL, viewport screenshots, console/page errors, advisor comparison, and Case regression counts.

- [ ] Add failing E2E tests for Member-first and Template-first flows, retry/copy boundaries, replacement completion, snapshot immutability, and fresh context; verify RED.
- [ ] Implement the final gate and preserve a unique non-sensitive release-test member; archive it after verification.
- [ ] Run all Python tests, schema/build checks, all Node tests, all JS syntax checks, all Playwright tests, Security/Performance Advisors, anon-denial checks, and Case/F111/Body/Conditioning/HYROX regressions.
- [ ] Merge only after the full gate; verify the master `verify`, `browser-smoke`, and `deploy` jobs, deployed build marker, Pages URL, and live Member workflows.
- [ ] Update Issues #160–#167 with evidence and close only verified issues; close Epic #159 only after every dependency and live gate is green.
- [ ] Commit the Release Gate, changelog, and evidence documentation.

## Plan Self-Review

- Spec coverage: #160 domain/snapshot; #161 schema/security; #162 API/auth; #163 Member Center; #164 explicit planned save; #165 execution/replacement; #166 unique context and Member-first F111; #167 responsive, security, regression, deployment, and live evidence.
- Interface consistency: API uses the Task 1 contract; DB/RPC consumes the same names; UI reads the API and does not derive context; #167 runs only after #163–#166.
- Review Focus tests cover unknown phase, idempotent retry, stale updates, immutable performed snapshots, and invalid/revoked auth.
- Scope: Case Library stays independent, F111 Resolver is not modified, and no CRM/AI/recovery-score work is introduced.
- Environment baseline: current repo is `origin/master` at `0f373db`; local Python default is 3.9.6 but CI-compatible Python 3.13 passes all 256 baseline tests. Production Supabase ref is `ynsodlyanpmixbbxblqh`, PostgreSQL 17.6.1.166, with no existing development branch; baseline Security Advisor has three existing INFO findings and Performance Advisor is empty.
