# SDD ledger — plan: docs/superpowers/plans/2026-09-27-member-management-v1.md

## Workspace

- Branch: `codex/member-management-v1`
- Worktree: `/Users/ronny/.codex/worktrees/member-v1/7fitWebOS`
- BASE: `0f373dbdd9babae5eef5a6dd1caad47f889daf96` (`origin/master`)
- Target repo: `qinronghai/7fit-training-system-live`
- Plan: `docs/superpowers/plans/2026-09-27-member-management-v1.md`

## Baseline

- Python 3.13 via `uv`: 256 tests passed; V14.8 schema passed.
- `python tools/build_system_data.py --check`: passed.
- All `tests/*_test.js`: passed.
- All `data/js/**/*.js` syntax checks: passed.
- System Python 3.9.6 cannot run this repo's PEP 604 annotations; use CI-compatible 3.13.
- Browser gate not run yet.

## Supabase Baseline (read-only)

- Project `ynsodlyanpmixbbxblqh` (`7fit-real-results`), PostgreSQL `17.6.1.166`, status `ACTIVE_HEALTHY`.
- Public tables: `cases` (7 rows), `case_assets` (6 rows), `case_admin_sessions` (3 rows); each has RLS enabled.
- Active Edge Function: `case-api` v5, `verify_jwt=false`, protected by the existing custom Staff PIN session.
- Security Advisor baseline: 3 INFO findings, all existing “RLS enabled, no policy” notices for the three tables above; no higher-level security finding returned.
- Performance Advisor baseline: no findings.
- No Supabase development branches exist. Before creating one, obtain the required branch cost quote and user cost confirmation; do not iterate DDL on production.
- Keep the new Member tables separate and use explicit `service_role` grants only; revoke/default-deny `anon`, `authenticated`, and `PUBLIC` paths. RLS alone is not the grant boundary.

## Pre-flight Shared Interfaces

- #160 → #161: #160 defines entity fields, enums, snapshots, compatibility, and phase mapping; #161 will map these names directly into SQL checks and JSONB columns. No mismatch found.
- #160 → #162: #162 will validate API payloads with the #160 contract and will not invent alternate field names. No mismatch found.
- #160 → #164: the browser Snapshot Builder will call the canonical #160 `buildTrainingSessionSnapshot`; no display-text parsing. No mismatch found.
- #160 → #166: API context will call canonical #160 `deriveMemberTrainingContext`; the UI will only render its output. No mismatch found.
- #161 → #162: #162 will write session + items through the #161 atomic RPCs and use the agreed revision/idempotency columns. No mismatch found.
- #162 → #163/#164/#165/#166: UI actions use one stable Member API/error contract; each dependent flow consumes only its relevant API operations. No mismatch found.
- #164 → #165: #164 creates `PLANNED`; #165 changes it only to `COMPLETED` or `CANCELLED` and preserves planned snapshots. No mismatch found.
- #163/#165 → #166: #163 supplies the Member detail entry; #165 supplies completed/performed truth; #166 derives context only from that truth. No mismatch found.
- #160–#166 → #167: release tests exercise the same contracts, route, DB policies, API, snapshots, and browser flows; no alternate test-only schema planned.

## Progress

- Task 1: complete (95ed10d; final task gate passed).
- Task 2: local implementation in progress; isolated database verification and advisor gates remain pending.
- Task 2 local implementation: migration `20260927115315_member_management_v1.sql` committed as `1c7af8f`; contract tests, SQL parse, and PL/pgSQL parse pass. Isolated Supabase execution is pending the requested organization and cost confirmation; no Supabase environment has been modified.
- Task 2 follow-up: domain/schema and SQL contract checks now bound profile arrays, focus arrays, and prescription set counts consistently. Full local Python suite passes; isolated database, anonymous privilege query, and advisors remain pending.
- Task 3/#162 local implementation: authenticated Member API and shared Staff-session boundary are committed as `c7f1693`; unit and Case-compatibility tests passed. Runtime integration against persisted Member rows remains pending Task 2's isolated branch.
- Task 4/#163 committed as `09c9de8`; Task 5/#164 as `9e4afc1`; Task 6/#165 regression coverage as `3adeb7b`; Task 7/#166 context regression coverage as `b41e6b8`. The #165 execution UI shares the #163 session-detail dialog module.
- Task 8/#167 local implementation: integrated browser gate, CI inclusion, changelog, and evidence documentation are staged for an Issue-scoped commit. The integrated Playwright scenario uses an in-memory Member API and is not live-database evidence.
- Local gate on 2026-09-27: Python 3.13 `pytest -q` → 275 passed; all 97 `tests/*_test.js` passed; Node ESM suite → 8 passed; Playwright Chromium → 122 passed; system-data freshness, V14.8 schema, JS syntax, and `git diff --check` passed.
- Responsive evidence: 22 local screenshots saved under `/Users/ronny/.codex/visualizations/2026/09/27/01a0e289-3e47-7c31-8115-2df2010a9a44/member-v1/`; Member detail/course/F111 include 360, 390×844, 430, 1080, 1280, and 1440 viewports. Member list and selector include 390×844 and 1280×900. 390×844 and 1440×960 F111 were visually inspected.
- Supabase branch check on 2026-09-27: project `ynsodlyanpmixbbxblqh` belongs to organization `tytnpenobigsqsctheaj`; no development branches exist. Cost quote was `0.01344` per hour. Do not create a branch until the user confirms the quote.
- Task 8 local evidence is documented in `docs/MEMBER-V1-RELEASE-GATE.md`. No migration has been applied, no Member Edge Function has been deployed, no GitHub Actions run has occurred for this unpushed branch, and production Supabase/Pages remain unchanged.

## Rulings

- Task 1: Ruling: map the actual F111 Resolver slots A/B/SUPPORT/2/3/CORE to PRIMARY/SECONDARY/ACCESSORY/ACCESSORY/ACCESSORY/CORE, while accepting the documented C/D1/D2 accessory aliases — the checked-in six-slot F111-06/L3 Resolver output uses SUPPORT/2/3, and unknown values still fail soft to UNKNOWN — a future slot-key change needs an explicit mapping update.
- Task 1: Ruling: retain the Resolver prescription text verbatim in `rawText` and use null for unavailable structured values — current ResolvedSession exposes natural-language prescription strings, not a structured prescription source — downstream structured entry can populate fields without pretending an uncertain parse is authoritative.
- Task 2: Ruling: constrain persisted Member/session/item identity fields to UUID and require one caller-supplied UUID per item in the pure snapshot builder — #161 explicitly requires UUID primary keys and retry identity must survive refresh without DB-side identity replacement — the save flow must generate and persist all IDs with its idempotency intent.
Task 1: complete (commits 0f373db..95ed10d, tests: sh .superpowers/sdd/2026-09-27-member-management-v1/task-1-regression.sh → ten pattern copy: PASS)
- Task 3: Ruling: require a stable 8–200 character idempotency key on every planned-session snapshot and enforce it in the builder, schema, API, migration, and RPC — Epic #159 explicitly requires double-click, network-retry, and refresh retries not to create duplicate sessions, which cannot be guaranteed when the key is nullable — the Save-to-Member client must persist and reuse the same key for one save intent.
- Task 3: Ruling: validate dates by ISO round-trip in both the domain validator and session update API — JavaScript date parsing normalizes impossible calendar dates such as 2026-02-31 — these paths now agree with the JSON Schema date format.
- Task 3: Ruling: preserve an explicit null performed prescription from a completion patch — null is a supported V1 value for actual prescription data — omission still inherits the saved plan on one-click completion.
- Task 5/#164 interface ruling: Task 5 created the single `window.V14MemberAPI` browser client as the first Member UI consumer — both the Member Center and F111 save flow need identical Staff session handling, error mapping, and API base configuration — Task 4/#163 must reuse this client instead of creating a parallel `js/member/api.js`.
- Task 5/#164 ruling: a pending save from an earlier date remains the safe default retry target; creating a new current-date session requires an explicit second action and duplicate-risk warning because the prior response may have been lost after a successful commit.
- Task 7/#166 ruling: leaving the F111 composer for another application area invalidates its cached member context, and the live region remains mounted while its text changes — context must be fresh on return and asynchronous updates must be announced without changing resolver inputs.
- Task 2/#161 ruling: validate each profile array entry in SQL as a nonblank bounded string and cap list lengths, matching the domain contract — type/count-only JSONB checks let invalid API data enter the database if another writer is introduced — the tradeoff is a small immutable validation helper in the schema.
- Task 6/#165 ruling: keep planned-session detail and execution controls in the same session dialog module; splitting the dialog would duplicate request, revision, focus, and retry state — execution-specific service contracts have their own regression commit, while the UI renderer landed with #163 — the cost if wrong is less isolated commit history, not a separate runtime source of truth.
Task 3: complete (commits 1c7af8f..c7f1693, tests: sh -c 'node tests/member_domain_test.js && node tests/member_api_test.js && node tests/member_auth_test.js && node --test tests/case_admin_session_auth_node.test.mjs tests/case_api_pin_contract_node.test.mjs && uv run --python 3.13 --with pytest --with jsonschema python -m pytest -q tests/test_member_contract.py tests/test_member_migration_contract.py && node --check supabase/functions/_shared/member-domain.mjs && node --check supabase/functions/_shared/staff-auth.mjs && node --check supabase/functions/member-api/service.mjs && node --check supabase/functions/case-api/auth.mjs && npx --yes esbuild supabase/functions/member-api/index.ts --bundle "--external:npm:*" "--external:jsr:*" --format=esm --platform=neutral --outfile=/tmp/7fit-member-api-index.js && npx --yes esbuild supabase/functions/case-api/index.ts --bundle "--external:npm:*" "--external:jsr:*" --format=esm --platform=neutral --outfile=/tmp/7fit-case-api-index.js && git diff --check' → ⚡ Done in 2ms)
