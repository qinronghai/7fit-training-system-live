# V15 Multi-Template Release Gate

Issue: #39  
Parent: #26

## Release principle

V15 may ship only when the complete platform path is green:

```text
Data / Schema
→ Resolver
→ State / PREP
→ Conflict / Anatomy / Volume / Metrics
→ Copy
→ Save / Restore
→ Router / Legacy compatibility
→ 390px Browser
→ Pages deployment
```

A green domain unit test is not sufficient by itself.

## Automated release matrix

### F111

- 8 official Presets × L1–L4 = 32 states.
- 5 lower × 4 upper × L1–L4 = 80 Composer states.
- frozen conflict parity.
- formal + PREP manual State.
- Coach / Member Copy regressions.
- canonical and legacy preset URLs.
- canonical and legacy Composer URLs.
- refresh / back / forward.
- Save / Restore.

### Body

- BODY-01..04 × L1–L4 = 16 frozen Resolver states.
- formal slot replacement / reset.
- Direct Work Sets.
- Anatomy.
- Body Conflict.
- shared PREP.
- Coach / Member Copy.
- fixed Recovery.
- State and Save / Restore.
- 390px workflow.

Frozen Resolver fingerprint:

```text
c06f4ddd03bebce65c8875dd66a03d99d897e54adec0190ea50a72e47e5f8005
```

### Conditioning

- CON-01..04 × L1–L4 = 16 frozen Resolver states.
- STEADY / INTERVAL / CIRCUIT / DENSITY Protocol behavior.
- station replacement / reset.
- Duration / RPE / Impact / Coordination / Fatigue / Power.
- Conditioning Conflict.
- shared PREP / Primer.
- Coach / Member Copy.
- NO POST CARDIO + Recovery.
- State and Save / Restore.
- 390px workflow.

Frozen Resolver fingerprint:

```text
16a3234e77412aa9a2cd5364e430bdf1d620732a1cb169539e20ef11be07dd6f
```

## Router / compatibility gate

Browser release tests cover:

- `#/coach`
- `#/coach/f111`
- `#/coach/f111/compose`
- legacy `#/coach/compose`
- canonical and legacy F111 preset URLs
- `#/coach/body`
- `#/coach/body/compose`
- `#/coach/conditioning`
- `#/coach/conditioning/compose`
- `#/coach/posture` FUTURE landing
- direct refresh
- browser back / forward
- invalid Body / Conditioning / unknown template routes fail closed

## Persistence gate

- template namespaces remain isolated.
- formal manual selections survive refresh.
- PREP manual selections survive refresh.
- SavedSession stores user intent only.
- restore always re-runs the current Resolver and PREP legality.
- stale actions / PREP / Conditioning Protocols fall back safely.
- unsupported saved schema fails closed.
- rename / delete / list persist in the canonical V15 State store.

## Mobile gate

At 390 × 844 the browser suite covers:

- Coach Center.
- F111 Preset / Composer.
- Body Home / Session / Composer.
- Conditioning Home / Session / Composer.
- PREP replacement.
- SavedSession list / actions.
- Body Recovery.

Hard assertions:

```text
document.documentElement.scrollWidth ===
document.documentElement.clientWidth === 390

pageerror = 0
```

## CI release chain

Every PR/branch runs:

```bash
python -m pytest -q
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
for f in tests/*_test.js; do node "$f"; done
find data js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
npx playwright test
```

Master deployment is blocked by both `verify` and `browser-smoke`.

## Pages release closure

#39 is not complete merely because its PR is green. After merge to master:

1. Confirm master `verify` succeeds.
2. Confirm master `browser-smoke` succeeds.
3. Confirm `deploy` succeeds.
4. Confirm the actual GitHub Pages URL is reachable.
5. Smoke the live Coach Center, Body, Conditioning and one mobile-width critical route.
6. Only then close #39 and the V15 Epic #26.
