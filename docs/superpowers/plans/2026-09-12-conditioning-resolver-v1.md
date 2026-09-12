# Conditioning Resolver V1 Implementation Plan

## Task 1 — Protocol Engine
- Add `js/conditioning-protocol.js`.
- Resolve legal/default Protocol.
- Produce deterministic work/rest/round/station/RPE/duration plan.
- Add Protocol Engine tests.

## Task 2 — Conditioning Conflict Plugin
- Add `js/conflict-plugins/conditioning.js`.
- Reuse Shared Conflict Core for route/status/duplicate integrity.
- Add Conditioning legality, ceiling, placement, redundancy and duration rules.
- Add plugin mutation tests.

## Task 3 — Resolver + Reusable Protocol Block
- Add `js/resolvers/conditioning.js`.
- Implement candidates, selection validation, deterministic station selection and manual intent fallback.
- Expose `resolveBlock()` / `serializeBlock()`.
- Register `conditioning` with Template Resolver.

## Task 4 — Shared Context Adapters
- Build `prepContext` through existing `contextFromConditioning()`.
- Build Anatomy from current station Action IDs.
- Emit `ResolvedSession(main.kind = PROTOCOL)`.

## Task 5 — State Reconcile
- Reuse V15 State namespace without modifying `js/state.js`.
- Test manual station swap, stale selection cleanup, resolver-version mismatch and reset.

## Task 6 — 16-state Gate
- Test all CON-01..04 × L1–L4.
- Freeze deterministic fingerprint after CI returns first GREEN baseline.
- Ensure default Conflict status is PASS/WARN, never FAIL.
- Run complete Python / Schema / Node / Playwright suite.

## Scope exclusions
- Conditioning Coach UI (#38).
- PREP selection UI (#38).
- Copy formatters (#38).
- Save/Restore (#11).
- F111/Body Finisher integration.
