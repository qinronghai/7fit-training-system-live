# Member Management V1 Release Gate

Status: **Member Management V1 is live on the existing Free Supabase organization. Production database, API, UI, security, browser, and release gates have passed.**

## Local Evidence

- Workspace: `/Users/ronny/.codex/worktrees/member-v1/7fitWebOS`
- Branch base: `0f373dbdd9babae5eef5a6dd1caad47f889daf96` (`origin/master` at start)
- Python 3.12 full suite on 2026-09-28: **276 passed**.
- Node runtime suite: **97 `tests/*_test.js` files passed**.
- Node built-in ESM suite: **8 passed**.
- Playwright Chromium suite on 2026-09-28 after the production-context visibility fix: **134 passed**. The Member Center, Save-to-Member, and integrated Member V1 release-gate specs are included.
- Standalone Member V1 integrated browser gate: **2 passed**, including the six-action performed-replacement case.
- System data build freshness: **PASS** (`python tools/build_system_data.py --check`).
- Existing V14.8 schema: **PASS** (`python tools/validate_v148_schema.py`, Python 3.12).
- JavaScript syntax gate: **PASS** (`rg --files -g '*.js' data js | xargs -r -n1 node --check`).
- Member and Case Edge Function bundle builds: **PASS**.
- `git diff --check`: **PASS**.
- Independent review regressions: delayed archive and restore responses do not replace a different active route; a delayed Member-first fallback lookup cannot override an explicit member choice. Both tests failed against the prior behavior and pass after the fix.
- Fresh whole-branch review fixes: a routed Member outside the first 100 now preselects and saves; closing a completed or cancelled session restores focus to its rebuilt timeline trigger. Both defects were reproduced before the fix; the new browser tests passed afterward.
- Review Focus automation: the API test composes the real shared Staff auth service with Member API login/revocation and checks rejected reads/writes never reach the repository; concurrent API updates share revision 1 and assert one winner plus an unchanged winner after the losing `stale_update`.
- Historical metadata regression: the release browser gate mutates current action names, levels, and primary muscles, reopens the stored course, and verifies planned/performed snapshots remain unchanged.
- Responsive screenshots were captured for Member detail, course detail, and Member-first F111 at the full viewport matrix below; Member list and Save-to-Member selector were captured at 390×844 and 1280×900. The 390×844 and 1440×960 Member-first F111 captures and the 390×844 execution and archive-pagination captures were visually inspected.

Screenshot directory: `/Users/ronny/.codex/visualizations/2026/09/27/01a0e289-3e47-7c31-8115-2df2010a9a44/member-v1/`.

Live production F111 Member-first screenshot (1280×720), captured after build `317a3bbd`: `/Users/ronny/.codex/visualizations/2026/09/27/01a0e289-3e47-7c31-8115-2df2010a9a44/member-v1/live-production-member-context-desktop.jpg`.

Additional live-staging Member-first F111 capture: `/Users/ronny/.codex/worktrees/member-v1/7fitWebOS/output/playwright/member-v1-f111-member-context-mobile.png` (390×844).

Full-matrix viewport coverage: 360, 390×844, 430, 1080, 1280, and 1440 pixels wide. Screenshots are local review evidence and are not live deployment evidence.

The CI Playwright tests use an in-memory Member API. The separate browser run below proves persistence and staff authentication against the real staging Edge Function and PostgreSQL database.

## Isolated Free Supabase Staging Evidence

- Organization plan: **Free**. Isolated staging project: `7fit-member-v1-staging`, ref `wxvyjfvhyoudoxjuwlcp`, region `ap-southeast-1`, PostgreSQL `17.6.1.166`, status `ACTIVE_HEALTHY`.
- Staging is a separate free project because Supabase preview branches require Pro; no paid branch was created. Production project `7fit-real-results` (`ynsodlyanpmixbbxblqh`) remained read-only during staging verification; its later release is recorded below.
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
- Before production rollout, a read-only check returned **7 cases** and **6 case assets**; those counts remained unchanged after the additive Member migration.
- The disposable staging Staff token was revoked after the browser flow, and its browser local-storage entry was cleared.

## Production Release Evidence

- Supabase organization plan: **Free**. Production project: `7fit-real-results`, ref `ynsodlyanpmixbbxblqh`, region `ap-southeast-1`, PostgreSQL 17, status `ACTIVE_HEALTHY`.
- Applied production migration: `20260927182659` (`member_management_v1`). The migration adds the three Member tables and does not alter Case tables.
- Production `member-api`: version **1**, `ACTIVE`, `verify_jwt=false`; the function validates the existing Staff bearer session. A request without Staff authentication returned **401 `unauthorized`**.
- Production Security Advisor: **6 INFO only**, all intentional RLS-enabled/no-policy findings for the three Member tables and three existing Case tables. Performance Advisor: **1 INFO only**, the new `members_archived_at_idx` is unused at current traffic. No higher-severity findings.
- Production rows after release: **7 cases**, **6 case assets**, and one archived non-sensitive release-test member with one completed session. The test member was archived through the recoverable UI flow; its completed history remains available.
- Live Member-first E2E: create the test member, enter F111, save a `PLANNED` session, verify it does not enter completed context, replace the planned `徒手深蹲` with `壶铃高脚杯深蹲`, record 3×12 at 12 kg, RIR 2, RPE 8 and a note, complete the session, and reopen F111. The next-context list now shows all six completed actions, including the performed replacement.
- UI visibility correction: PR [#169](https://github.com/qinronghai/7fit-training-system-live/pull/169) removes the four-action display cap that hid alphabetically late actions. Its browser regression uses six completed actions and asserts that the performed snapshot is shown instead of the original planned name.
- Feature PR [#168](https://github.com/qinronghai/7fit-training-system-live/pull/168) merged as `470f592e6779c502eaa0cac9fc5dd1ad4686de13`; master workflow run `36340633579` passed `verify`, `browser-smoke`, and `deploy`.
- Follow-up PR [#169](https://github.com/qinronghai/7fit-training-system-live/pull/169) merged as `317a3bbd7335117f27fe3d3b7a07f03ff87de1b9`; master workflow run `36342696929` passed `verify`, `browser-smoke`, and `deploy`.
- Live Pages URL: [7fit-training-system-live](https://qinronghai.github.io/7fit-training-system-live/). The performed-action visibility release used build marker **`317a3bbd`**; the live F111 Member-first route displayed the completed session and all six recent actions.

## Planned Session Deletion (2026-09-28)

- Member detail timeline: only `PLANNED` sessions show **删除**. The action asks for confirmation, submits the displayed revision, and refreshes the timeline. The database rejects stale revisions and every status except `PLANNED`; the parent session and its items are removed together. Completed and cancelled history stays intact.
- Local Python suite: **276 passed**. Node runtime suite: **97 `tests/*_test.js` files passed**; built-in ESM suite: **8 passed**. Full Chromium suite: **140 passed**; integrated Member V1 browser gate: **2 passed**; focused deletion flow: **1 passed**. System data, schema, JavaScript syntax, and static artifact hygiene checks passed.
- Desktop and mobile screenshots were captured and visually inspected: `/Users/ronny/.codex/worktrees/member-v1/7fitWebOS/output/playwright/member-planned-delete-desktop-2026-09-28.png`, `member-planned-delete-mobile-2026-09-28.png`, and `member-planned-delete-after-2026-09-28.png`.
- Staging project `wxvyjfvhyoudoxjuwlcp`: migration `20260928071813`; `member-api` version **2**; unauthenticated request returned **401**. Database release gate passed; anon access fixture passed; anon cannot execute the deletion RPC, while `service_role` can execute it and delete sessions. Security Advisor: 4 intentional INFO notices; Performance Advisor: 1 INFO unused-index notice.
- Production project `ynsodlyanpmixbbxblqh`: migration `20260928072525`; `member-api` version **2**; unauthenticated request returned **401**. Database release gate passed; anon access fixture passed; catalog check confirmed the function and service-role grants while anon execute remains false. Security Advisor: 6 intentional INFO notices; Performance Advisor: 1 INFO unused-index notice.
- Database release-gate runs used generated fixture members/sessions and cleaned them up; no real member record was deleted.
- PR [#175](https://github.com/qinronghai/7fit-training-system-live/pull/175) merged as `a9a69159fbb4e87d59c9d52f88d5e58615a01c6e`. Master workflow run `36392308688` passed `verify`, `browser-smoke`, and `deploy`.
- The planned-session deletion UI first shipped with Pages build marker **`a9a69159`**. A live fetch verified that marker and confirmed the published stylesheet contains the delete-button styling and `js/member/center.js` contains the deletion action.

## Current Production Audit and Member UI Follow-up (2026-09-29)

- Epic #159 and Issues #160–#167 are closed. Each has an evidence comment; the implementation plan's two stale #167 release/update checkboxes are now checked against current GitHub state.
- PR [#177](https://github.com/qinronghai/7fit-training-system-live/pull/177) merged at **`51a48dfdc4afbafd81827632d2d5c2ed1888cf6a`**. Master workflow **`36400784093`** completed `verify`, `browser-smoke`, and `deploy` successfully. The live Pages `7fit-build` marker is **`51a48dfd`**; the served `js/member/session.js`, `js/member/center.js`, and `js/session-copy.js` assets were fetched and checked for the warm-up/recovery and copy-to-member changes.
- Current Supabase organization plan is **Free**. Production and isolated staging projects are `ACTIVE_HEALTHY`; both have the Member migrations through planned-session deletion and `member-api` version 2 deployed.
- Read-only catalog checks on both projects confirmed RLS enabled and `anon` table `SELECT` denied for `members`, `training_sessions`, and `training_session_items`. Member RPC execution is denied to `anon` and granted to `service_role`. Current Security Advisors report only the intentional INFO-level RLS-enabled/no-policy findings; Performance Advisors report only the INFO unused `members_archived_at_idx`. An unauthenticated production Member API request returned **401**. No database writes were made during this audit.
- The separate member-training UI polish is still local on `codex/member-training-ui` at the `51a48df` base. It updates member-flow CSS, keeps the planned-session cancel confirmation ahead of the sticky footer, and adds `tests/member_ui_polish_test.js`. Local verification: Python **276 passed**, Node runtime **98 passed**, ESM **8 passed**, JS syntax, schema, system-data freshness, static artifact hygiene, Impeccable layout scan (`[]` from the prior source audit), and `git diff --check` all passed. The cancel-confirmation regression now also passes; browser visual acceptance of the local changes is still pending.
- No commit or deployment has been made for the local follow-up. This does not change the already verified production status above.

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
| Production migration | PASS: `20260927182659` | `7fit-real-results`, additive Member schema |
| Production `member-api` | PASS: version 1; unauthenticated request returned 401 | Staff bearer validation enforced in function |
| Production Security Advisor | PASS: 6 intentional INFO notices only | RLS-enabled/no-policy tables |
| Production Performance Advisor | PASS: 1 INFO unused index only | `members_archived_at_idx` |
| Production Case Library preservation | PASS: 7 cases, 6 case assets | Counts unchanged after migration |
| Production Member-first closure | PASS: planned → replacement → completed → next F111 context | Test member archived; 1 completed session retained |
| Performed-action context visibility | PASS: all 6 latest actions shown, including `壶铃高脚杯深蹲` | PR #169; integrated browser gate 2 passed |
| GitHub verify/browser-smoke/deploy | PASS | PR #168 run `36340633579`; PR #169 run `36342696929` |
| Pages live build marker and URL | PASS: `317a3bbd` | `https://qinronghai.github.io/7fit-training-system-live/` |
| Production live screenshot | PASS: captured and visually inspected at 1280×720 | `live-production-member-context-desktop.jpg` |
| Planned-session deletion local suites | PASS: 276 Python, 97 Node runtime, 8 ESM, 140 Chromium, 2 integrated gate, 1 focused browser test | 2026-09-28; screenshots under `output/playwright/` |
| Planned-session deletion staging release | PASS: migration `20260928071813`; `member-api` v2; database/access gates; unauthenticated request 401 | Free staging project `wxvyjfvhyoudoxjuwlcp` |
| Planned-session deletion production release | PASS: migration `20260928072525`; `member-api` v2; database/access gates; unauthenticated request 401 | Production project `ynsodlyanpmixbbxblqh` |
| Planned-session deletion PR and Actions release | PASS: PR #175 merged; `verify`, `browser-smoke`, and `deploy` succeeded | Master workflow run `36392308688` |
| Planned-session deletion Pages publication | PASS: live marker `a9a69159`; published CSS and JS checked | [Live site](https://qinronghai.github.io/7fit-training-system-live/) |
