# F111 Preset Browser V2 — Information Architecture & Interaction Contract

## Status

Approved implementation baseline for Issue #125, under Epic #124.

This document freezes the information architecture and interaction contract for the F111 recommendation preset browser before #126–#132 begin implementation.

The contract is based on:

- current F111 architecture: 8 Recipe Family × L1–L4 = 32 preset states;
- current canonical browser route: `#/coach/f111`;
- current canonical preset session route: `#/coach/f111/f111-XX/lN`;
- current free composer route: `#/coach/f111/compose`;
- existing Multi-Template router and `ResolvedSession` architecture;
- the approved desktop Matrix + Drawer and mobile Level-first List + Bottom Sheet mockup direction.

The implementation must preserve current F111 domain behavior and route compatibility.

---

## 1. Product goal

The Preset Browser solves one job:

> Help a coach find the right F111 preset in seconds, understand enough of it to choose confidently, and then enter the existing formal session workflow.

The browser is not a second Composer and is not a second Session page.

The new design optimizes three measurable qualities:

1. **Low footprint** — 32 states must not become 32 large cards.
2. **Immediate legibility** — the 8 Recipe × 4 Level structure must be visible or mentally obvious.
3. **Fast retrieval** — Level, training pattern, search and recent use must reduce the candidate set rapidly.

---

## 2. Domain truth and ownership

### 2.1 The browser does not own 32 independent workouts

The formal model remains:

```text
8 Recipe Family
×
4 Session Level
→
F111 Resolver
→
32 resolvable preset states
```

The UI may expose 32 selectable states, but it must not create or maintain 32 duplicated session definitions.

### 2.2 Source-of-truth hierarchy

```text
Recipe / Level domain data
        ↓
F111 Resolver
        ↓
ResolvedSession
        ↓
Preset Browser ViewModel (#126)
        ↓
Desktop / Mobile Browser
        ↓
Preview Drawer / Bottom Sheet
```

The browser may derive display labels and filter facets, but it must not invent action legality, prescriptions, PREP, conflict outcomes or replacement candidates.

### 2.3 Internal IDs vs coach-facing language

The browser keeps internal identity visible for precision:

- `F111-01`
- `L2`

But primary recognition should come from coach-facing semantics:

- 下肢推｜水平拉｜支撑
- 髋铰链｜垂直推｜单侧支撑
- 单腿｜水平拉｜动态支撑

Recipe ID is an identifier; pattern semantics are the retrieval language.

---

## 3. Existing route compatibility

The current router already supports and must keep:

- Browser: `#/coach/f111`
- Free Composer: `#/coach/f111/compose`
- Formal Preset Session: `#/coach/f111/f111-01/l1` … `#/coach/f111/f111-08/l4`
- Legacy F111 routes already supported by the router

### 3.1 No new detail route in V2

Desktop Drawer and Mobile Bottom Sheet are browser-local presentation state.

They do **not** require a new canonical URL in this implementation.

Example:

```text
#/coach/f111
  selectedPreset = { recipeId: "F111-03", level: "L2" }
  surface = "drawer"
```

This choice avoids creating a second URL that competes with the formal preset session route.

### 3.2 Deep link rule

The existing formal preset session route remains the deep-linkable destination.

If a future requirement demands shareable preview links, that is a separate Router contract change and must not be introduced ad hoc inside UI code.

---

## 4. Page-level information architecture

The Preset Browser page contains five logical layers, in this order:

```text
1. Page Header
2. Recent Use
3. Retrieval Controls
4. Result Context
5. Preset Collection
```

### 4.1 Page Header

Required:

- Title: `7Fit 推荐预设`
- Context sentence: 8 Recipe Family × 4 Level = 32 preset states
- Search entry
- `进入自由组合编课 →`

The current F111 hero may remain above or be simplified by later UI implementation, but the Preset Browser itself must not repeat a second large promotional hero inside the collection area.

### 4.2 Recent Use

Recent Use is a shortcut layer, not a recommendation engine.

Each entry represents exactly:

```text
recipeId + level
```

Example:

```text
F111-03 · L2
髋铰链｜水平拉｜支撑
```

Desktop default visible count: 3.

Mobile default visible count: 3 in a horizontally scrollable compact strip.

The full persistence contract belongs to #129.

### 4.3 Retrieval Controls

Four filter dimensions are available:

- Level
- Lower pattern
- Upper pattern
- Support pattern

Search is a fifth independent retrieval input.

The browser must expose enough of these controls without turning the top of the page into a large filter form.

### 4.4 Result Context

After any filter/search state change, the UI communicates what is currently shown.

Examples:

- `当前显示全部 · 共 32 套预设`
- `当前显示 L2 · 共 8 套预设`
- `L2 + 髋铰链 · 共 2 套预设`

The count is derived from the same selector used to render results.

### 4.5 Preset Collection

Desktop and mobile use different layouts over the same collection data:

- Desktop: 8 × 4 Matrix
- Mobile: Level-first grouped list

The data semantics must stay identical.

---

## 5. Filter interaction contract

### 5.1 Level

Level is single-select:

- 全部
- L1
- L2
- L3
- L4

`全部` means no Level constraint.

### 5.2 Pattern filters

Lower:

- 下肢推
- 髋铰链
- 髋伸
- 单腿

Upper:

- 水平拉
- 垂直拉
- 水平推
- 垂直推

Support:

- 支撑
- 单侧支撑
- 动态支撑

### 5.3 Boolean semantics

Within one filter group:

```text
OR
```

Across filter groups:

```text
AND
```

Search is also combined by AND with active filters.

Example:

```text
Level = L2
Lower = 髋铰链 OR 单腿
Upper = 垂直推
```

means:

```text
L2
AND
(髋铰链 OR 单腿)
AND
垂直推
```

### 5.4 No-result behavior

The browser must never silently relax a filter in order to show something.

No-result state includes:

- current filter/search summary;
- result count = 0;
- clear-filter action.

No “closest match” is returned in V2.

---

## 6. Search contract

Search is an explicit browser lookup, not semantic AI search.

Minimum searchable tokens:

- Recipe ID: `F111-01` … `F111-08`
- Level: `L1` … `L4`
- lower pattern labels
- upper pattern labels
- support pattern labels
- composed coach-facing pattern labels

V1 matching:

- Chinese substring match;
- Latin case-insensitive match;
- whitespace-trimmed input.

Not in V1:

- pinyin;
- typo correction;
- fuzzy edit-distance ranking;
- vector/semantic search.

---

## 7. Desktop browser contract

### 7.1 Primary layout

Desktop uses a compact 8 × 4 Matrix.

```text
Recipe Family                         L1   L2   L3   L4
-------------------------------------------------------
F111-01 下肢推｜水平拉｜支撑          ○    ○    ○    ○
F111-02 下肢推｜垂直拉｜支撑          ○    ○    ○    ○
F111-03 髋铰链｜水平拉｜支撑          ○    ○    ○    ○
F111-04 髋伸｜垂直拉｜单侧支撑        ○    ○    ○    ○
F111-05 单腿｜水平拉｜动态支撑        ○    ○    ○    ○
F111-06 下肢推｜水平推｜支撑          ○    ○    ○    ○
F111-07 髋铰链｜垂直推｜单侧支撑      ○    ○    ○    ○
F111-08 单腿｜垂直拉｜支撑            ○    ○    ○    ○
```

### 7.2 Matrix cell meaning

One Matrix Cell = one preset identity:

```text
recipeId + level
```

A Cell must not duplicate Recipe tags or action details.

Its only job is selection.

### 7.3 Desktop selected state

When a Cell is selected:

- the Cell receives visible selected styling;
- `aria-selected` or equivalent semantic state is exposed;
- the Detail Drawer opens;
- the browser keeps active filters and scroll context.

Selection must not be represented by color alone.

### 7.4 Desktop filtered states

When Level = L2, the implementation may either:

1. show only L2 as the active Level column; or
2. keep all columns but visually suppress non-matching cells.

The chosen presentation must preserve the mental model and pass #127 responsive tests.

The data selector itself must return the same matching set either way.

### 7.5 Desktop width targets

Required review widths:

- 1080
- 1280
- 1440

No page-level horizontal overflow.

---

## 8. Desktop Detail Drawer contract

### 8.1 Purpose

The Drawer answers:

> “Is this the session I want to use?”

It does not answer every question available on the formal Session page.

### 8.2 Required Drawer information

Header:

- Recipe ID + Level
- coach-facing pattern semantics
- concise applicability / intent summary
- Level / pattern chips

Training Preview:

- PREP summary
- core activation where applicable
- primary work
- secondary / accessory work
- support/core work
- post-cardio summary where applicable

Session summary:

- goals
- expected duration
- key equipment

Replacement preview:

- only legal replacement entry points / candidates from existing systems

Actions:

- Start Course
- Replace Action
- Add to / open Free Composer

### 8.3 Preview data rule

Mockup example actions are illustrative only.

Production Drawer content must come from the currently resolved session.

No action name, set/rep prescription, duration or replacement may be hard-coded from the visual mockup.

### 8.4 Drawer navigation behavior

Open:

- triggered by Matrix Cell activation;
- focus moves into Drawer.

While open:

- background Matrix remains visually understandable;
- switching another visible Cell may update the Drawer directly;
- stale preview content must not flash after the selection changes.

Close:

- close button supported;
- `Escape` supported on desktop;
- focus returns to the originating Matrix Cell;
- filter/search/scroll context is preserved.

---

## 9. Mobile browser contract

### 9.1 Why mobile does not use the matrix

At ~390 px width, a 4-column Level matrix either becomes too compressed or forces horizontal scrolling.

Therefore mobile changes layout, not domain semantics.

### 9.2 Mobile retrieval order

```text
Search
→ Level
→ Recent Use
→ Pattern Filters
→ Result Context
→ Grouped Recipe List
```

### 9.3 Mobile Level-first behavior

Level is the primary narrowing control.

When a Level is selected, each Recipe needs only one relevant state in the main list.

This reduces the visible candidate set from 32 to at most 8 before any pattern filter is applied.

### 9.4 Grouping

With a specific Level selected, group by lower-body pattern.

Approved conceptual grouping:

```text
下肢推
  F111-01  水平拉 · 支撑
  F111-02  垂直拉 · 支撑

髋铰链
  F111-03  水平拉 · 支撑
  F111-07  垂直推 · 单侧支撑

单腿
  F111-05  水平拉 · 动态支撑
  F111-08  垂直拉 · 支撑

髋伸
  F111-04  垂直拉 · 单侧支撑
```

The actual grouping order must be metadata-driven, not string-parsed from labels.

### 9.5 Mobile row

Each row contains:

- Recipe ID
- remaining pattern semantics
- current Level badge
- open-detail affordance

The entire row should be a practical touch target.

### 9.6 “全部” Level on mobile

When Level = 全部, the UI must not render 32 giant cards.

Allowed patterns:

- each Recipe row exposes compact L1–L4 controls; or
- Recipe rows expand to Level choices.

The final choice is owned by #130, provided it preserves compactness and does not introduce horizontal page overflow.

---

## 10. Mobile Bottom Sheet contract

### 10.1 Purpose

The Bottom Sheet is the mobile equivalent of the Desktop Drawer.

It must use the same selected preset identity and the same Preview ViewModel.

### 10.2 Required content

- drag handle / sheet affordance
- Recipe ID + Level
- pattern semantics
- intent/applicability summary
- compact metadata chips
- training preview
- replacement entry
- goals

Fixed action zone:

- Replace Action
- Free Edit
- Start Course

### 10.3 Modal behavior

While open:

- background browsing surface is visually de-emphasized;
- background interactive elements are inert;
- body/page scrolling is controlled so the Sheet scrolls correctly;
- browser filter state remains intact.

On close:

- return to the same list position;
- focus returns to the triggering row.

### 10.4 Safe area

The fixed action zone must account for mobile safe-area inset.

It must not be obscured by the device bottom area.

---

## 11. Browser / Preview / Formal Session responsibility split

### Browser

Owns:

- discovery;
- retrieval;
- filters;
- recent preset shortcuts;
- selection.

Does not own:

- training resolution;
- replacement legality;
- session execution.

### Preview Surface

Owns:

- concise resolved-session inspection;
- handoff actions.

Does not own:

- full advanced session editor;
- duplicated resolver logic;
- persistent action selection logic independent of the formal session.

### Formal Session Page

Owns:

- execution details;
- full action replacement flow;
- PREP / Conflict / Copy / other existing session tools;
- canonical preset route.

This split is a hard architecture boundary.

---

## 12. CTA contract

### 12.1 Start Course

Input:

```text
recipeId + level
```

Destination:

```text
#/coach/f111/{recipeId-lowercase}/{level-lowercase}
```

The router remains the source of canonical route behavior.

### 12.2 Replace Action

The Preview may surface replacement affordances, but it must call the existing legal candidate / swap path.

The UI may not inject an arbitrary action ID into the session.

### 12.3 Free Edit

Destination baseline:

```text
#/coach/f111/compose
```

Only fields that have an explicit safe mapping may be carried into Composer state/query.

No implicit translation from arbitrary Preview state is allowed.

If safe handoff is not fully supported in the current architecture, V2 may initially enter Composer without pre-populating all selections rather than guessing.

---

## 13. Recent Use boundary

Preset-level Recent Use is separate from historical Issue #10.

### This Epic

Identity:

```text
recipeId + level
```

Use case:

> “Open the preset I recently viewed or started.”

### #10

Identity is action/template/domain-context oriented.

Use case:

> “Quickly reuse / replace an exercise.”

The two features must not share a loosely typed storage array.

---

## 14. Browser UI state

Ephemeral state:

- search query
- active Level
- active lower filters
- active upper filters
- active support filters
- selected preset
- drawer/sheet open state

Persistent browser state allowed in #129:

- preset-level Recent Use

Formal Session State is outside this browser-state object.

A Browser state reset must not reset F111 session selections.

---

## 15. Accessibility contract

### 15.1 Keyboard

Desktop must support keyboard reachability for:

- search;
- filters;
- recent entries;
- all visible Matrix Cells;
- Drawer close;
- Drawer actions.

### 15.2 Focus

Drawer:

- focus enters on open;
- focus stays within active modal interaction surface when appropriate;
- returns to trigger on close.

Bottom Sheet:

- same principle;
- background controls are not focusable while modal.

### 15.3 Semantics

Use semantic state for:

- selected Level;
- active filters;
- selected Matrix Cell;
- expanded Drawer/Sheet.

Do not rely on purple color alone.

### 15.4 Touch

Mobile rows, chips and CTAs must have practical touch targets and avoid dense tiny controls.

---

## 16. Responsive contract

Target widths:

- Mobile: 360, 390, 430
- Desktop: 1080, 1280, 1440

Required:

```text
document.documentElement.scrollWidth === document.documentElement.clientWidth
```

for the page shell at validation widths, excluding intentional inner horizontal scrolling such as compact Recent Use strips if #130 chooses that pattern.

No CTA may collapse to vertical text.

---

## 17. Empty, stale and error states

### Empty filter result

Show:

- 0 result context;
- active criteria;
- clear action.

### Invalid recent entry

Silently remove or ignore the invalid Recent Use record.

Do not navigate to an invalid preset route.

### Preview resolution failure

The browser must not fabricate a Preview.

Show a safe unavailable state and keep:

- preset identity;
- close action;
- retry / formal-route action only if route remains valid.

### Invalid Recipe/Level

Existing router validity rules continue to own formal route validation.

---

## 18. Visual hierarchy constraints

The approved mockups define direction, not pixel-perfect implementation.

Required visual principles:

- white / light neutral surfaces;
- existing 7Fit purple accent;
- compact bordered sections;
- restrained card use;
- high scan density;
- clear selected state;
- no decorative elements that compete with Recipe / Level identity.

The implementation should reuse the current 7Fit design language and existing CSS tokens/classes where sensible.

Do not introduce a parallel design system only for this page.

---

## 19. Explicit non-goals

Issue #125 does not implement:

- ViewModel code;
- Matrix code;
- Drawer code;
- filter engine;
- Recent Use storage;
- mobile list;
- Bottom Sheet;
- resolver changes;
- Recipe changes;
- new preset routes;
- new free-composer rules;
- action ranking;
- cloud sync;
- favorites.

Those belong to #126–#132 or existing platform issues.

---

## 20. Downstream implementation map

### #126 — Preset Browser ViewModel

Must implement the data boundary defined in Sections 2, 5, 6, 11 and 14.

### #127 — Desktop Matrix

Must implement Sections 7, 15, 16 and the relevant Page IA.

### #128 — Desktop Drawer

Must implement Sections 8, 11, 12, 15 and 17.

### #129 — Search / Filters / Recent Use

Must implement Sections 4.2–6, 13, 14 and Empty State behavior.

### #130 — Mobile Browser

Must implement Sections 9, 15 and 16.

### #131 — Mobile Bottom Sheet

Must implement Sections 10–12 and mobile accessibility.

### #132 — Release Gate

Must verify the complete contract, including 32-state identity coverage, filter truth-table, responsive overflow, focus behavior and Preview parity.

---

## 21. Definition of Done for #125

Issue #125 is complete when:

- Desktop and mobile IA are frozen in one repository spec.
- Browser / Preview / Formal Session responsibility boundaries are explicit.
- Existing route compatibility is explicitly preserved.
- No new preview route is introduced.
- Filter boolean semantics are unambiguous.
- Search V1 semantics are unambiguous.
- Desktop Matrix and Drawer behavior are unambiguous.
- Mobile Level-first list and Bottom Sheet behavior are unambiguous.
- Preset-level Recent Use is separated from action-level Recent Use.
- Focus, responsive and error-state contracts are recorded.
- #126–#132 can implement against this document without inventing missing product behavior.
