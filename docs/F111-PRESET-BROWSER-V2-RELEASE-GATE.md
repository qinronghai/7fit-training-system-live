# F111 Preset Browser V2 — Release Gate

Issue: #132  
Parent Epic: #124  
Depends on: #125–#131

## Scope

This gate closes the Preset Browser V2 only when the browser experience is verified as one system:

```text
8 Recipe × 4 Level
→ Preset Browser ViewModel
→ Search / Filters / Recent Use
→ Desktop Matrix + Drawer
→ Mobile Grouped List + Bottom Sheet
→ Canonical F111 Session / Composer handoff
```

The gate does not introduce another training-data source or another Resolver.

## Automated matrix

### 32-state identity / preview

The release browser test verifies:

- 32 unique `recipeId + level` states.
- one canonical browser entry for every state.
- canonical route for every state.
- every state can resolve a Preview through the existing F111 Resolver.
- PREP, A, B, SUPPORT and CORE are present in every resolved Preview.

### Filter truth table

Frozen cases include:

- all = 32.
- one Level = 8.
- one Lower mode.
- one Upper mode.
- one Support mode.
- OR inside one group.
- AND across groups.
- Search only.
- Search + active filters.
- exact one-result case.
- zero-result case.

### Responsive gate

Required desktop widths:

- 1080
- 1280
- 1440

Required mobile widths:

- 360
- 390
- 430

Hard page-shell assertion at each width:

```text
document.documentElement.scrollWidth
===
document.documentElement.clientWidth
```

### Desktop / mobile Preview parity

For the same preset identity, Desktop Drawer and Mobile Bottom Sheet must render the same resolved formal slot names and prescriptions and must share the same canonical Start Course href.

Layout may differ; training truth may not.

### Accessibility / interaction

Desktop:

- selected Matrix cell exposes semantic selected state.
- Escape closes the Drawer.
- focus returns to the originating Matrix cell.

Mobile:

- Bottom Sheet exposes modal semantics.
- background app shell is inert.
- fixed CTA remains inside the viewport.
- close restores focus to the originating mobile preset control.

### Recent Use / stale recovery

Preset-level Recent Use must:

- key by `recipeId + level`.
- dedupe.
- preserve MRU order.
- reject invalid Recipe / Level entries.
- reject invalid timestamps.
- keep canonical Start / Replace / Composer handoff paths.

## Existing regression chain

Issue #132 is intentionally added to the existing V15 release chain instead of creating a parallel CI system:

```bash
python -m pytest -q
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
for f in tests/*_test.js; do node "$f"; done
find data js -type f -name '*.js' -print0 | xargs -0 -n1 node --check
npx playwright test
```

PR validation must pass `verify` and then `browser-smoke`.

After merge, the Pages workflow must pass `verify`, `browser-smoke`, and `deploy`.

## Live closure checklist

#132 is not closed until all of the following are confirmed on master / GitHub Pages:

- [ ] master verify = success
- [ ] master browser-smoke = success
- [ ] Pages deploy = success
- [ ] live build id matches the merged master SHA
- [ ] Desktop `#/coach/f111` loads the 8×4 Matrix
- [ ] Desktop preset click opens the right-side Drawer
- [ ] Search / Level / pattern filtering works
- [ ] 390px browser shows the grouped mobile list
- [ ] 390px preset click opens the Bottom Sheet
- [ ] no page-level horizontal overflow on the live critical path
- [ ] no browser pageerror on the live critical path

Only after this checklist is green should #132 and Epic #124 be closed.
