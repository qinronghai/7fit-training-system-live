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
- Task 2: in progress.
- Task 2 local implementation: migration `20260927115315_member_management_v1.sql` committed as `1c7af8f`; contract tests, SQL parse, and PL/pgSQL parse pass. Isolated Supabase execution is pending the requested organization and cost confirmation; no Supabase environment has been modified.

## Rulings

- Task 1: Ruling: map the actual F111 Resolver slots A/B/SUPPORT/2/3/CORE to PRIMARY/SECONDARY/ACCESSORY/ACCESSORY/ACCESSORY/CORE, while accepting the documented C/D1/D2 accessory aliases — the checked-in six-slot F111-06/L3 Resolver output uses SUPPORT/2/3, and unknown values still fail soft to UNKNOWN — a future slot-key change needs an explicit mapping update.
- Task 1: Ruling: retain the Resolver prescription text verbatim in `rawText` and use null for unavailable structured values — current ResolvedSession exposes natural-language prescription strings, not a structured prescription source — downstream structured entry can populate fields without pretending an uncertain parse is authoritative.
- Task 2: Ruling: constrain persisted Member/session/item identity fields to UUID and require one caller-supplied UUID per item in the pure snapshot builder — #161 explicitly requires UUID primary keys and retry identity must survive refresh without DB-side identity replacement — the save flow must generate and persist all IDs with its idempotency intent.
Task 1: complete (commits 0f373db..95ed10d, tests: sh .superpowers/sdd/2026-09-27-member-management-v1/task-1-regression.sh → ten pattern copy: PASS)
- Task 3: Ruling: require a stable 8–200 character idempotency key on every planned-session snapshot and enforce it in the builder, schema, API, migration, and RPC — Epic #159 explicitly requires double-click, network-retry, and refresh retries not to create duplicate sessions, which cannot be guaranteed when the key is nullable — the Save-to-Member client must persist and reuse the same key for one save intent.
- Task 3: Ruling: validate dates by ISO round-trip in both the domain validator and session update API — JavaScript date parsing normalizes impossible calendar dates such as 2026-02-31 — these paths now agree with the JSON Schema date format.
- Task 3: Ruling: preserve an explicit null performed prescription from a completion patch — null is a supported V1 value for actual prescription data — omission still inherits the saved plan on one-click completion.
