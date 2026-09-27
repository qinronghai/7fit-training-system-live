### Task 3 — #162 Member API and Staff Auth Boundary

**Files:** Create `supabase/functions/_shared/staff-auth.mjs`, `supabase/functions/member-api/{index.ts,service.mjs}`, `tests/member_api_test.js`, `tests/member_auth_test.js`; update `supabase/functions/case-api/{index.ts,auth.mjs}` and existing auth tests only as needed.

**Interfaces:** Actions cover member list/get/save/archive/restore, session list/get/save-planned/update/complete/cancel, and `get-member-training-context`. Errors use stable codes and HTTP statuses. Session writes call Task 2 atomic RPCs; updates require expected revision.

- [x] Add failing tests for auth, validation, CRUD, atomic RPC invocation, idempotency, stale revisions, allowed/forbidden transitions, and error redaction.
- [x] Verify RED before implementation.
- [x] Extract the existing token hashing/expiry/revocation service without changing PIN limits or Case behavior; retain the current auth module as a compatibility surface.
- [x] Implement the Member-only Edge Function and service with server-side validation, list payload limits, `401`/`404`/`409` semantics, and no direct browser database key.
- [x] Run focused auth/API tests and existing Case API auth tests to GREEN.
- [x] Commit the Issue-scoped API/auth changes.
