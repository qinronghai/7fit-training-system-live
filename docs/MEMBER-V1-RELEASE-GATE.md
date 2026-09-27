# Member Management V1 Release Gate

Status: **local implementation, regression gates, and the free isolated Supabase staging gate pass; production release is still pending.**

## Local Evidence

- Workspace: `/Users/ronny/.codex/worktrees/member-v1/7fitWebOS`
- Branch base: `0f373dbdd9babae5eef5a6dd1caad47f889daf96` (`origin/master` at start)
- Python 3.13 full suite on 2026-09-28: **276 passed**.
- Node runtime suite: **97 `tests/*_test.js` files passed**.
- Node built-in ESM suite: **8 passed**.
- Playwright Chromium suite on 2026-09-28 after fresh-review fixes: **133 passed**. The Member Center, Save-to-Member, and integrated Member V1 release-gate specs are included.
- Standalone Member V1 integrated browser gate: **1 passed**.
- System data build freshness: **PASS** (`python tools/build_system_data.py --check`).
- Existing V14.8 schema: **PASS** (`python tools/validate_v148_schema.py`, Python 3.13).
- JavaScript syntax gate: **PASS** (`rg --files -g '*.js' data js | xargs -r -n1 node --check`).
- Member and Case Edge Function bundle builds: **PASS**.
- `git diff --check`: **PASS**.
- Independent review regressions: delayed archive and restore responses do not replace a different active route; a delayed Member-first fallback lookup cannot override an explicit member choice. Both tests failed against the prior behavior and pass after the fix.
- Fresh whole-branch review fixes: a routed Member outside the first 100 now preselects and saves; closing a completed or cancelled session restores focus to its rebuilt timeline trigger. Both defects were reproduced before the fix; the new browser tests passed afterward.
- Review Focus automation: the API test composes the real shared Staff auth service with Member API login/revocation and checks rejected reads/writes never reach the repository; concurrent API updates share revision 1 and assert one winner plus an unchanged winner after the losing `stale_update`.
- Historical metadata regression: the release browser gate mutates current action names, levels, and primary muscles, reopens the stored course, and verifies planned/performed snapshots remain unchanged.
- Responsive screenshots were captured for Member detail, course detail, and Member-first F111 at the full viewport matrix below; Member list and Save-to-Member selector were captured at 390×844 and 1280×900. The 390×844 and 1440×960 Member-first F111 captures and the 390×844 execution and archive-pagination captures were visually inspected.

Screenshot directory: `/Users/ronny/.codex/visualizations/2026/09/27/01a0e289-3e47-7c31-8115-2df2010a9a44/member-v1/`.

Additional live-staging Member-first F111 capture: `/Users/ronny/.codex/worktrees/member-v1/7fitWebOS/output/playwright/member-v1-f111-member-context-mobile.png` (390×844).

Full-matrix viewport coverage: 360, 390×844, 430, 1080, 1280, and 1440 pixels wide. Screenshots are local review evidence and are not live deployment evidence.

The CI Playwright tests use an in-memory Member API. The separate browser run below proves persistence and staff authentication against the real staging Edge Function and PostgreSQL database.

## Isolated Free Supabase Staging Evidence

- Organization plan: **Free**. Isolated staging project: `7fit-member-v1-staging`, ref `wxvyjfvhyoudoxjuwlcp`, region `ap-southeast-1`, PostgreSQL `17.6.1.166`, status `ACTIVE_HEALTHY`.
- Staging is a separate free project because Supabase preview branches require Pro; no paid branch was created. Production project `7fit-real-results` (`ynsodlyanpmixbbxblqh`) was not migrated or otherwise written to.
- Applied staging migrations: remote version `20260927165952` (`member_management_v1`) and `20260927170340` (`case_admin_sessions`). The Member schema is the additive migration in `supabase/migrations/20260927115315_member_management_v1.sql`.
- Deployed staging Edge Function: `member-api` version **1**, `verify_jwt=false` with the existing custom Staff session authentication enforced by the function.
- Real API/browser flow: list/create member, save a planned F111 session, replace a planned action with the performed action, complete the session, refresh the Member detail and F111 context, and cancel a separate template-first session. Browser requests carried the Staff bearer token only; no Supabase API key was sent by the browser.
- Persisted staging data after the run: 2 non-sensitive test members, 5 sessions (3 `COMPLETED`, 2 `CANCELLED`, 0 `PLANNED`), and 30 session items. The UI-created release-gate member was archived after verification; its completed history and replacement action remain visible.
- The real completed-session detail showed planned `哑铃高脚杯深蹲` and performed `壶铃高脚杯深蹲`, 3×10 at 20 kg, RIR 2, RPE 8, with its note. The next F111 route showed that completed session and performed action as recent context.
- The live-staging browser had **0 console errors, 0 warnings, and 0 recorded page errors**. Width checks at 360, 390×844, 430, 1080, 1280, and 1440 showed document/body width equal to viewport width.
- PostgreSQL catalog fixture `tests/fixtures/member-v1/anon_access.sql`: **PASS**. Anonymous direct table/RPC access is denied; RLS is enabled and no direct-access policies exist for the Member tables.
- Additional persisted boundary checks passed: invalid training level/profile values are rejected; member deletion with history is restricted; invalid second-item insertion rolls the parent session and first item back atomically; deleting a test session cascades its items.
- `supabase/tests/member_management_v1_release_gate.sql` ran against this Free staging database: identical planned-session replay returned the original session and left one item; a completion at revision 1 advanced to revision 2; a stale second writer at revision 1 was rejected with the winning completed session, performed snapshot, and actuals intact. A follow-up query confirmed the temporary database-gate member was removed (0 leftovers).
- Security Advisor returned four INFO findings, all intentional “RLS enabled, no policy” notices on `case_admin_sessions`, `members`, `training_sessions`, and `training_session_items`; no higher-severity finding. Performance Advisor returned two INFO unused-index notices (`members_archived_at_idx` on the small staging table and the existing `case_admin_sessions_active_lookup_idx`); no higher-severity finding.
- Read-only production check still returned **7 cases** and **6 case assets**. The Member migration has not been applied to production.
- The disposable staging Staff token was revoked after the browser flow, and its browser local-storage entry was cleared.

## Production Release Gates Still Required

- Push the reviewed branch and open the PR; complete GitHub `verify` and `browser-smoke` checks.
- After merge, apply the additive Member migration to production, deploy `member-api`, and verify the production function version and protected API behavior.
- Confirm the master `verify`, `browser-smoke`, and `deploy` jobs pass; record the Pages URL and build marker, then verify live routes, browser errors, and Member flows.
- Recheck production Case Library counts/data and run the production Security/Performance Advisors after the migration. Record the final migration/function/build identifiers before updating and closing Issues #160–#167 and Epic #159.

Therefore #167 remains **pending production release**, and Epic #159 is not complete yet.

## Completion Record

| Evidence | Result | Reference |
| --- | --- | --- |
| Staging migration version | PASS: `20260927165952`, `20260927170340` | Free project `wxvyjfvhyoudoxjuwlcp` |
| Isolated staging database | PASS: standalone free project | `7fit-member-v1-staging` |
| Anonymous table/RPC access denial | PASS | `tests/fixtures/member-v1/anon_access.sql` |
| Staging Security Advisor | PASS: 4 intentional INFO notices | RLS default-deny tables |
| Staging Performance Advisor | PASS: 2 INFO unused-index notices | Small staging dataset |
| Member API persisted-flow E2E | PASS | 2 members, 5 sessions, 30 items |
| Staging planned-save idempotency and persisted revision gate | PASS | `supabase/tests/member_management_v1_release_gate.sql`; 0 fixture rows left |
| Staff auth/API revoke and concurrent revision regressions | PASS | `tests/member_api_test.js` |
| Historical action metadata snapshot regression | PASS | `tests/member-v1-release-gate_browser.spec.js` |
| Staging responsive browser and errors | PASS: six widths; zero errors | Member-first F111 route |
| Production migration/function | Pending | Production project unchanged |
| GitHub verify/browser-smoke/deploy | Pending | PR/merge not yet run |
| Pages live build marker and URL | Pending | — |
| Production live screenshots and browser errors | Pending | — |
