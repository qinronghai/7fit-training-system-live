# Member V1 Database Operations

Migration `20260927115315_member_management_v1.sql` adds the Member tables and server-only RPCs. It does not alter `cases`, `case_assets`, or their existing rows.

## Recovery

- If the Member UI or Edge Function must be rolled back, roll back that application release and leave the additive Member schema in place. This keeps member history available for a later compatible release.
- Do not delete `members`, `training_sessions`, or `training_session_items` after Member data has been saved. The member foreign key uses `ON DELETE RESTRICT`; member archive is the supported retention path.
- If a migration application fails, inspect the Supabase migration history and the three table definitions before retrying. Do not edit an already-applied migration or manually change Supabase's migration ledger; correct the schema with a new forward migration.
- A full schema removal is only safe before any Member records exist. It must remove the three RPCs first, then `training_session_items`, `training_sessions`, and `members`, in that order, through a reviewed migration. There is intentionally no automatic destructive down migration.

## Access Boundary

The tables have RLS enabled and no browser policies. `PUBLIC`, `anon`, and `authenticated` have no Member table or RPC grants. The Edge Function's `service_role` performs server-side reads and writes after Staff session validation; no server key belongs in the static browser bundle.

Run `tests/fixtures/member-v1/anon_access.sql` after applying the migration to verify the grants, policies, and RLS flags against the target database.
