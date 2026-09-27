# Member Management V1 Release Gate

Status: **local implementation and regression gates pass; the release gate is not yet complete.** This record separates checks that ran in the isolated worktree from checks that require an isolated Supabase branch and a live deployment.

## Local Evidence

- Workspace: `/Users/ronny/.codex/worktrees/member-v1/7fitWebOS`
- Branch base: `0f373dbdd9babae5eef5a6dd1caad47f889daf96` (`origin/master` at start)
- Python 3.13 full suite after review fixes on 2026-09-28: **276 passed**.
- Node runtime suite: **97 `tests/*_test.js` files passed**.
- Node built-in ESM suite: **8 passed**.
- Playwright Chromium suite after review fixes: **130 passed**. The Member Center, Save-to-Member, and integrated Member V1 release-gate specs are included.
- System data build freshness: **PASS** (`python tools/build_system_data.py --check`).
- Existing V14.8 schema: **PASS** (`python tools/validate_v148_schema.py`, Python 3.13).
- JavaScript syntax gate: **PASS** (`rg --files -g '*.js' data js | xargs -r -n1 node --check`).
- Member and Case Edge Function bundle builds: **PASS**.
- `git diff --check`: **PASS**.
- Independent review regressions: delayed archive and restore responses do not replace a different active route; a delayed Member-first fallback lookup cannot override an explicit member choice. Both tests failed against the prior behavior and pass after the fix.
- Responsive screenshots were captured for Member detail, course detail, and Member-first F111 at the full viewport matrix below; Member list and Save-to-Member selector were captured at 390×844 and 1280×900. The 390×844 and 1440×960 Member-first F111 captures and the 390×844 execution and archive-pagination captures were visually inspected.

Screenshot directory: `/Users/ronny/.codex/visualizations/2026/09/27/01a0e289-3e47-7c31-8115-2df2010a9a44/member-v1/`.

Full-matrix viewport coverage: 360, 390×844, 430, 1080, 1280, and 1440 pixels wide. Screenshots are local review evidence and are not live deployment evidence.

The integrated Playwright release scenario uses an in-memory mock Member API. It verifies Member-first and Template-first flows, planned save, cancellation of the selector without a write, action replacement, completion, and refreshed context at the browser layer. It does **not** prove database persistence, server authentication, PostgreSQL authorization, or a live release.

## Supabase and Live Gates Still Required

- The Member migration `20260927115315_member_management_v1.sql` has **not** been applied to any database.
- No development branch has been created. The branch list contains only the default `main`. The project and organization are resolved, and the `$0.01344/hour` default Micro quote was refreshed and cost confirmation recorded on 2026-09-28. Branch creation was rejected with `PaymentRequiredException: Branching is supported only on the Pro plan or above`; Supabase documents preview branching as a Pro feature. The `$9.81` estimate for 730 hours covers base compute only: preview branches can also incur disk, egress, and storage usage, and branching usage is not covered by the Spend Cap. See [Supabase plan and branching requirements](https://supabase.com/docs/guides/deployment), [branching costs](https://supabase.com/docs/guides/platform/manage-your-usage/branching), and [compute usage](https://supabase.com/docs/guides/platform/manage-your-usage/compute).
- A local Supabase/PostgreSQL substitute is unavailable on this host: the Supabase CLI, Docker, and PostgreSQL executables are not installed. No migration has been executed against a database.
- The `tests/fixtures/member-v1/anon_access.sql` catalog assertions have **not** been executed against PostgreSQL.
- Security and Performance Advisors have **not** been run against a database containing the Member schema.
- `member-api` has **not** been deployed to a development branch, exercised against persisted Member records, or deployed to production.
- The live test-member lifecycle, migration version, Edge Function version, Pages build marker, live URL, and live console/page-error checks remain unverified.
- GitHub Actions has **not** run for this unpushed branch. The CI workflows include the Member contract gate and integrated browser gate for the eventual PR/release run.
- Production Supabase and GitHub Pages have not been changed by this worktree.

Therefore #167 is **pending**, and Epic #159 is not complete. Once the branch cost is confirmed, finish the isolated database/API tests and advisor checks, then run the live release gate only after all scoped checks pass. Preserve the existing Case Library tables and records, archive the non-sensitive release-test member after verification, and record actual build and deployment identifiers here before closing any Issue.

## Completion Record

| Evidence | Result | Reference |
| --- | --- | --- |
| Migration version applied | Pending | — |
| Development branch and project ref | Blocked: branch API requires Pro or above | — |
| Anonymous table/RPC access denial | Pending database execution | `tests/fixtures/member-v1/anon_access.sql` |
| Security Advisor | Pending | — |
| Performance Advisor | Pending | — |
| Member API persisted-flow E2E | Pending | — |
| GitHub verify/browser-smoke/deploy | Pending | — |
| Pages live build marker and URL | Pending | — |
| Live responsive screenshots and browser errors | Pending | — |
