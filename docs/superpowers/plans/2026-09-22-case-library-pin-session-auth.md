# 7Fit Case Library PIN Session Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace repeated long-key prompts in the 7Fit real-results admin flow with a server-verified 6-digit PIN login and revocable 30-day device sessions.

**Architecture:** The static GitHub Pages client shows public cases without authentication. A Supabase Edge Function verifies a PIN hash stored in a secret, stores only a hash of a random session token in a locked `case_admin_sessions` table, and requires that token for all write/admin actions. The browser stores the opaque session token, never the PIN or legacy admin key.

**Tech Stack:** GitHub Pages static HTML payload, vanilla JavaScript, Supabase Edge Function on Deno, Supabase Postgres/Storage, Playwright browser tests, Node test runner for token helpers.

**Spec:** `docs/superpowers/specs/2026-09-22-case-library-pin-session-auth-design.md`

## Global Constraints

- Public `list` remains unauthenticated and returns only `status = published` cases.
- `save-case`, `upload`, `asset`, `case`, `admin-list`, and session endpoints require a valid non-expired, non-revoked admin session.
- The PIN and legacy admin key never appear in browser storage, URLs, logs, or responses.
- Supabase service-role credentials remain server-only.
- The legacy `x-admin-key` path is disabled in the final source; any migration fallback must be explicit and temporary.
- No direct edits to `master`, no deployment, and no production secret changes from this branch.

## Review Focus

- A wrong PIN must not create a session or reveal the correct PIN; test invalid input and the 401 response.
- A session must survive page reload but must not survive explicit logout; test both browser states.
- An expired or revoked session must be rejected by the Edge Function; test both server branches.
- Public visitors must still see cases without a session and must not see admin controls; test the public route.
- The migration must not retain the old browser key; test source and browser storage for `7fit_case_admin_key`.

### Task 1: Add session schema and token helpers

**Files:**
- Create: `supabase/migrations/20260922170000_create_case_admin_sessions.sql`
- Create: `supabase/functions/case-api/auth.mjs`
- Create: `tests/case_admin_session_auth_node.test.mjs`

**Interfaces:**
- `auth.mjs` exports `sha256Hex(value)`, `constantTimeEqual(left, right)`, `createOpaqueToken()`, `hashSessionToken(token)`, `pinMatches(pin, expectedHash)`, `createSessionRecord(tokenHash, now, ttlSeconds)`, and `isSessionActive(record, now)`.
- The migration creates `public.case_admin_sessions` with `token_hash`, `created_at`, `expires_at`, and nullable `revoked_at`; RLS is enabled and direct grants are revoked from `anon` and `authenticated`.

- [ ] Write failing Node tests for PIN hash matching, opaque token hashing, expiry, and revocation.
- [ ] Run `node --test tests/case_admin_session_auth_node.test.mjs` and verify it fails because `auth.mjs` does not exist.
- [ ] Add the minimal helper implementation using Web Crypto and no third-party dependency.
- [ ] Add the SQL migration with the unique token-hash index and locked table permissions.
- [ ] Run the focused Node tests and verify all pass.
- [ ] Run `git diff --check`.

### Task 2: Add PIN login/session endpoints to the Edge Function

**Files:**
- Modify: `supabase/functions/case-api/index.ts`
- Modify: `supabase/functions/case-api/auth.mjs`
- Create: `tests/case_api_pin_contract_node.test.mjs`

**Interfaces:**
- `POST ?action=admin-login` accepts `{ "pin": "123456" }` and returns `{ ok: true, session: { token, expiresAt } }` only when the server-side `CASE_ADMIN_PIN_SHA256` matches.
- `POST ?action=admin-logout` accepts the bearer session token and sets its `revoked_at`.
- `GET ?action=admin-session` returns `{ ok: true, expiresAt }` for an active session and 401 otherwise.
- Admin operations use `Authorization: Bearer <session-token>`; the old `x-admin-key` branch is removed.

- [ ] Write failing contract tests for successful login, invalid PIN, active session, revoked session, and missing bearer token using a fake Supabase adapter.
- [ ] Run the focused contract tests and verify they fail because the new actions are absent.
- [ ] Add CORS support for `authorization` and implement `admin-login`, `admin-session`, and `admin-logout`.
- [ ] Replace `isAdmin(req)` with session verification against the hashed token and expiry/revocation fields.
- [ ] Add best-effort per-instance login throttling: five failed attempts per IP in fifteen minutes, then a temporary 15-minute lock.
- [ ] Keep public `health` and `list` behavior unchanged; preserve existing save/upload/storage behavior behind the new guard.
- [ ] Run the focused contract tests and verify all pass.

### Task 3: Replace the browser key prompt with the PIN session UI

**Files:**
- Modify: `assets/real-results/patch.js`
- Create: `tests/real_results_pin_auth_browser.spec.js`
- Modify: `tests/real_results_edit_existing_images_browser.spec.js`
- Modify: `tests/real_results_mobile_save_browser.spec.js`

**Interfaces:**
- Browser storage key: `7fit_case_admin_session` containing only `{ token, expiresAt }`.
- Client functions: `adminLogin(pin)`, `restoreAdminSession()`, `adminLogout()`, and `api(action, options)`.
- The API helper sends `Authorization: Bearer <token>` and clears local session on 401.

- [ ] Write failing browser tests for public mode, login modal, successful login persistence, logout, and 401 session recovery.
- [ ] Run the new browser spec against the current page and verify it fails because the PIN UI and session actions do not exist.
- [ ] Remove `ADMIN_STORAGE_KEY`, `adminKey`, `verifyAdmin`, and all `x-admin-key` client headers.
- [ ] Add a compact PIN login modal with six numeric inputs or one six-digit input, error state, submit state, and logout control.
- [ ] Hide upload/edit controls until `restoreAdminSession()` succeeds; keep public case rendering available.
- [ ] Update upload/edit/save calls to use the bearer session helper.
- [ ] Run the focused browser specs at 390×844 and desktop viewport; verify all pass.

### Task 4: Regression verification and handoff

**Files:**
- Modify: `tests/real_results_cloud_health_browser.spec.js` only if the endpoint contract needs an assertion update.
- Modify: `docs/superpowers/specs/2026-09-22-case-library-pin-session-auth-design.md` only if implementation evidence changes a requirement.

- [ ] Run the complete real-results browser test subset, including responsive, cloud health, edit, mobile save, and PIN auth specs.
- [ ] Run the Node auth tests and `git diff --check`.
- [ ] Search the branch for `7fit_case_admin_key`, `x-admin-key`, and `ADMIN_KEY_SHA256`; allow no production-client references and record any migration-only reference explicitly.
- [ ] Verify the GitHub Pages build still serves the public case library without a session.
- [ ] Record the required Supabase deployment steps: apply migration, set `CASE_ADMIN_PIN_SHA256`, deploy Edge Function, then publish frontend after both sides pass.
- [ ] Do not deploy or change production secrets in this turn; hand off the branch and exact release commands for explicit publication approval.

