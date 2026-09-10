# V15 ResolvedSession Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a strict ResolvedSession v1 contract, a registration-driven template resolver dispatcher, and a real F111 adapter without changing current user-visible F111 behavior.

**Architecture:** Keep domain algorithms independent. A dispatcher looks up registered resolver functions by `templateId`; each resolver returns the same public ResolvedSession envelope with a discriminated `main.kind`. F111 is adapted from existing preset/composer outputs; Body and Conditioning are tested with synthetic resolver outputs only.

**Tech Stack:** Static JavaScript, JSON Schema Draft 2020-12, pytest/jsonschema, Node `vm` runtime tests, Playwright Chromium.

**Spec:** `docs/superpowers/specs/2026-09-10-resolved-session-contract-design.md`

## Global Constraints

- Do not modify `js/state.js`.
- Do not implement Body or Conditioning business rules.
- Do not implement Posture.
- Do not change F111 training content or routes.
- Do not change Coach/Member Copy output in #29.
- ResolvedSession resolution must be deterministic for equal explicit inputs.
- Dispatcher must be registration-driven, not a template switch.

---

### Task 1: Freeze ResolvedSession Schema

**Files:**
- Create: `schemas/v14.8/resolved-session.schema.json`
- Create: `tests/test_issue29_resolved_session.py`

**Interfaces:**
- Produces the strict v1 public envelope.
- `main.kind='SLOT'` consumes an array of public slot items.
- `main.kind='PROTOCOL'` consumes a protocol object with blocks and metrics.

- [ ] Write RED schema tests covering valid SLOT and PROTOCOL, missing required fields, illegal kind, mismatched payload shape, and no F111-private required fields.
- [ ] Run `python -m pytest -q tests/test_issue29_resolved_session.py` and confirm RED because the schema is missing.
- [ ] Add the Draft 2020-12 schema with `schemaVersion: 1`, strict top-level required fields, and discriminated `main` payload.
- [ ] Run the focused pytest file and confirm GREEN.
- [ ] Commit the schema slice.

### Task 2: Add Runtime Contract Validator and Dispatcher

**Files:**
- Create: `js/resolved-session.js`
- Create: `js/template-resolver.js`
- Create: `tests/resolved_session_runtime_test.js`
- Modify: `index.html`

**Interfaces:**
- `V15ResolvedSession.validate(session)` returns `{ok, errors}`.
- `V15ResolvedSession.assert(session)` returns the session or throws `INVALID_RESOLVED_SESSION`.
- `V15TemplateResolver.register(templateId, resolver)`.
- `V15TemplateResolver.unregister(templateId)`.
- `V15TemplateResolver.has(templateId)`.
- `V15TemplateResolver.resolve(templateId, input)`.

- [ ] Write RED Node tests for registration, synthetic SLOT/PROTOCOL resolution, unknown template, unregistered resolver, invalid output, and template-ID mismatch.
- [ ] Run `node tests/resolved_session_runtime_test.js` and confirm RED because runtime modules are missing.
- [ ] Implement the smallest runtime validator matching the schema's public invariants.
- [ ] Implement a Map/object based dispatcher with stable error `code` values `UNKNOWN_TEMPLATE`, `RESOLVER_NOT_REGISTERED`, `INVALID_RESOLVED_SESSION`, and `TEMPLATE_ID_MISMATCH`.
- [ ] Load the modules after shared resolver services and before domain resolver adapters.
- [ ] Run the focused Node test and confirm GREEN.
- [ ] Commit dispatcher/validator slice.

### Task 3: Add Real F111 Adapter

**Files:**
- Create: `js/resolvers/f111.js`
- Modify: `tests/resolved_session_runtime_test.js`
- Modify: `index.html`

**Interfaces:**
- `V15F111Resolver(input)` accepts `mode:'preset'|'composer'`.
- Automatically registers itself as the `f111` resolver.
- Uses `V14Composer.resolve()` for composer domain resolution.
- Uses `V14PrepResolver.contextFromF111()` for PREP context.
- Uses `V14Anatomy.aggregate()` and `V14Conflict` for public shared contexts.
- Never reads/writes `V14State`.

- [ ] Add RED tests for preset baseline, explicit preset selections, composer sample, deterministic equality, public SLOT mapping, and absence of required `lowerMode/upperMode/windows` at top-level.
- [ ] Run Node test and confirm RED because F111 resolver is missing.
- [ ] Implement preset adaptation from `sessions/sessionViews` and explicit selections.
- [ ] Implement composer adaptation by delegating to `V14Composer.resolve()`.
- [ ] Normalize `prepContext`, `anatomyContext`, `conflictContext`, `copyContext`, `resolvedSelections`, `source`, and warnings.
- [ ] Register the F111 resolver and confirm all runtime tests GREEN.
- [ ] Commit F111 adapter slice.

### Task 4: Integration Regression and Browser Smoke

**Files:**
- Modify: `tests/browser_smoke.spec.js`
- Modify only if necessary: existing test discovery/config files.

**Interfaces:**
- Existing F111 page UI remains the compatibility oracle.
- New dispatcher is callable from browser runtime as `V15TemplateResolver.resolve('f111', input)`.

- [ ] Add a browser smoke test that opens a real F111 preset page, captures visible identity/slot count, resolves the same preset through the new dispatcher in `page.evaluate`, and asserts a valid SLOT contract while existing UI remains visible and `pageerror=0`.
- [ ] Run full Python tests, build freshness, schema validation, all Node runtime tests, JS syntax, and Playwright.
- [ ] Inspect PR diff for forbidden `js/state.js`, Body/Conditioning resolver, route/content/copy changes.
- [ ] Mark PR ready, squash merge, and verify master verify/browser/deploy.
- [ ] Confirm Issue #29 closes completed; only then start #31.
