# Body Resolver V1 Design Spec

Issue: #34  
Status: Approved design / awaiting final spec review  
Target version: V15  
Template: `body`

## 1. Goal

Implement an independent Body Resolver V1 that consumes the Body Data Contract from #33 and produces deterministic, auditable `ResolvedSession(main.kind = SLOT)` outputs for 4 Body Families × L1–L4.

The resolver must be muscle/volume-driven. It must not reuse F111 `lowerMode / upperMode` semantics, must not infer Body business rules from action names or Anatomy, and must not parse human-readable prescription strings to derive training volume.

## 2. Scope

In scope:

- Body resolver registration through `V15TemplateResolver.register('body', resolver)`.
- 4 Body Families: `BODY-01`–`BODY-04`.
- L1–L4.
- Fixed Body slot contract with 5 or 6 active slots depending on Level.
- Candidate legality and deterministic ranking.
- Structured Body prescription.
- Direct Work Sets and secondary exposure calculations.
- Body Conflict plugin using #32 Shared Conflict infrastructure.
- Optional Body `domainContext` carried by `ResolvedSession`.
- V15 State selection/reconcile compatibility.
- Candidate API for future #35 UI.
- 16-state baseline/fingerprint and regression tests.

Out of scope:

- Body Coach UI, Copy UI, PREP UI, save/restore UX (#35/#11).
- Weekly volume history or periodization.
- Body-specific new exercises beyond #33 whitelist.
- Conditioning or Posture Resolver logic.
- Rewriting F111 algorithms.

## 3. Platform boundaries

Body Resolver must use the existing V15 platform boundaries:

```text
Template Registry
    ↓
V15TemplateResolver
    ↓
Body Resolver V1
    ↓
ResolvedSession
    ├─ Prep Context
    ├─ Anatomy Context
    ├─ Conflict Context
    ├─ Copy Context
    └─ optional domainContext(kind = BODY)
```

`V15State` stores user intent only. It must not persist Body-derived volume, Anatomy or Conflict results.

## 4. ResolvedSession V1 extension

`ResolvedSession.schemaVersion` remains `1`.

The shared contract gains one optional top-level property:

```js
domainContext?: {
  kind: string,
  ...templateSpecificFields
}
```

For F111, `domainContext` remains absent and existing output is still valid.

For Body, it is mandatory and must have `kind: 'BODY'` plus the complete Body contract below.

The shared SLOT item remains unchanged. Body-specific structured prescription does not get injected into the generic SLOT item, preventing Body fields from becoming mandatory for F111.

## 5. Body input contract

Body Resolver V1 accepts:

```js
{
  familyId: 'BODY-02',
  level: 'L3',
  selections?: {
    PRIMARY?: { actionId: '...', source: 'manual' },
    SECONDARY?: { actionId: '...', source: 'manual' },
    ACCESSORY?: { actionId: '...', source: 'manual' },
    'ISOLATION-1'?: { actionId: '...', source: 'manual' },
    'ISOLATION-2'?: { actionId: '...', source: 'manual' },
    OPTIONAL?: { actionId: '...', source: 'manual' }
  },
  prepSelections?: object
}
```

Required:

- `familyId` must exist in `bodyFamilyIds`.
- `level` must be `L1`–`L4`.

Resolver version: `body-v1`.

Canonical session key: `${familyId}-${level}`, e.g. `BODY-02-L3`.

## 6. Slot contract

All Body Families share the same semantic slot contract:

| Slot | Required Body Role | Purpose |
|---|---|---|
| PRIMARY | PRIMARY | Main stimulus for Family primary targets |
| SECONDARY | SECONDARY | Second main stimulus with useful variation |
| ACCESSORY | ACCESSORY | Fill target/structure gaps |
| ISOLATION-1 | ISOLATION | First local isolation slot |
| ISOLATION-2 | ISOLATION | Second local isolation slot |
| OPTIONAL | OPTIONAL | Extra work when Level policy enables it |

Active slots:

- L1/L2: 5 slots, OPTIONAL omitted from `main.content`.
- L3/L4: 6 slots, OPTIONAL included.

An omitted OPTIONAL is not represented as an empty placeholder.

## 7. Candidate legality

A Body candidate is legal only when all hard gates pass:

```text
Body family matches
+ Level matches
+ Slot role matches
+ Action exists in formal action library
+ Action status is allowed
+ Route is allowed
```

PRIMARY and SECONDARY have an additional hard gate:

```text
directTargets ∩ family.primaryTargets != ∅
```

Candidate legality is owned by Body Resolver. #35 UI must call the resolver candidate API and must not rebuild these filters independently.

## 8. Resolver order

Slots resolve sequentially:

```text
PRIMARY
→ SECONDARY
→ ACCESSORY
→ ISOLATION-1
→ ISOLATION-2
→ OPTIONAL (L3/L4 only)
```

Later slots receive the already-resolved session context, including direct target coverage, selected movement patterns and fatigue profile.

This prevents a global “top six” ranking from producing structurally redundant sessions.

## 9. Ranking policy

Ranking happens only after hard legality filtering.

Priority dimensions:

1. Family primary-target coverage.
2. Missing-target bonus.
3. Role and Level fit.
4. Stability suitability for current Level.
5. Fatigue cost control.
6. Movement diversity.
7. Target redundancy penalty.
8. Final deterministic tie-break by `actionId.localeCompare()`.

No candidate score may use `Math.random()`, clock time, LocalStorage insertion order, object insertion order or action-name heuristics.

L4 does not imply “most complex action”. Stable machines remain valid at L4 when metadata allows them.

### SECONDARY diversity rule

SECONDARY should prefer a candidate that differs from PRIMARY in at least one useful dimension:

- movement pattern,
- loading modality,
- bilateral/unilateral structure,
- direct-target combination.

This is a ranking preference, not an additional hard legality gate.

## 10. Structured prescription

Body structured prescription is built from two authoritative sources:

```text
Level Policy → working sets + RIR
Action repProfile → reps + rest + per-side behavior
```

For each active slot, Body `domainContext.slots[slotKey]` contains:

```js
{
  role,
  actionId,
  workingSets,
  repRange: [min, max],
  rirRange: [min, max],
  restSecondsRange: [min, max],
  directTargets: [],
  secondaryTargets: [],
  exerciseClass,
  fatigueCost,
  stabilityDemand,
  laterality,
  perSide
}
```

`main.content[].prescription` remains a human-readable compatibility string, but no Body logic may parse that string.

## 11. Level volume skeleton

Use #33 `bodyLevelPolicies` as the only source of default working sets and RIR.

Baseline working sets:

| Level | PRIMARY | SECONDARY | ACCESSORY | ISO-1 | ISO-2 | OPTIONAL | Total baseline |
|---|---:|---:|---:|---:|---:|---:|---:|
| L1 | 3 | 2 | 2 | 2 | 1 | — | 10 |
| L2 | 3 | 3 | 2 | 2 | 2 | — | 12 |
| L3 | 3 | 3 | 3 | 2 | 2 | 1 | 14 |
| L4 | 4 | 3 | 3 | 3 | 2 | 1 | 16 |

Legal session working-set windows remain:

- L1: 10–12
- L2: 12–14
- L3: 14–16
- L4: 16–18

## 12. Direct Work Sets contract

`totalWorkingSets` and per-target Direct Sets are separate measurements.

For a 3-set exercise with two direct targets:

```text
totalWorkingSets += 3
directTargetA += 3
directTargetB += 3
```

The per-target values are never summed back to calculate total session working sets.

### Unilateral rule

`3 sets / side` counts as:

```text
totalWorkingSets += 3
```

not 6.

### Secondary exposure rule

Secondary targets receive `secondaryExposureByTarget`, not Direct Sets.

No fractional or “effective set” conversion exists in V1.

### Exclusions

The following never contribute to Body Direct Work Sets:

- PREP,
- foam rolling,
- warm-up sets,
- ramp-up sets,
- activation/core preparation,
- recovery,
- post-cardio.

Only active Body main slots contribute.

## 13. Body domainContext contract

Body Resolver outputs:

```js
domainContext: {
  kind: 'BODY',
  slots: {
    PRIMARY: { /* structured slot prescription */ },
    SECONDARY: { /* ... */ },
    ACCESSORY: { /* ... */ },
    'ISOLATION-1': { /* ... */ },
    'ISOLATION-2': { /* ... */ },
    OPTIONAL?: { /* L3/L4 only */ }
  },
  volume: {
    totalWorkingSets,
    directSetsByTarget,
    secondaryExposureByTarget,
    isolationWorkingSets,
    isolationRatio,
    highFatigueCompoundCount,
    estimatedMinutes
  }
}
```

This is the Body structured business truth consumed by Conflict and future UI.

Anatomy exposure remains separate from Body Direct Work Sets.

## 14. Isolation ratio

```text
isolationRatio = isolationWorkingSets / totalWorkingSets
```

`isolationWorkingSets` sums working sets only for slots whose selected action has `exerciseClass === 'isolation'`.

Do not calculate isolation ratio from action count or target count.

## 15. Time estimate

V1 uses a deterministic heuristic based on:

- slot working sets,
- rep/rest profile,
- fixed transition cost.

The result is integer `estimatedMinutes` and is only a planning heuristic.

It must not claim exact workout duration.

Body main-time policy remains 35–50 minutes.

## 16. Body Conflict V1

Shared Conflict Core continues to own shared integrity checks such as missing actions, duplicate actions, route/status failures and explicit shared policies.

Body Conflict Plugin owns Body domain quality rules.

| Rule | Condition | Severity | Code |
|---|---|---|---|
| Family deviation | selected action violates Family / Level / Role | FAIL | `BODY_FAMILY_DEVIATION` |
| Primary target missing | a Family primary target has zero Direct Sets | FAIL | `BODY_PRIMARY_TARGET_MISSING` |
| Session volume | total working sets outside Level range | FAIL | `BODY_VOLUME_OUT_OF_RANGE` |
| High fatigue stack | high-fatigue compounds > policy max | WARN | `BODY_HIGH_FATIGUE_STACK` |
| Movement redundancy | same movement pattern count > policy max | WARN | `BODY_MOVEMENT_REDUNDANCY` |
| Isolation ratio | ratio > policy threshold | WARN | `BODY_ISOLATION_HEAVY` |
| Time budget | estimated minutes outside policy range | WARN | `BODY_TIME_BUDGET` |

Primary target coverage is determined from `directSetsByTarget`, never Anatomy.

V1 deliberately does not define absolute per-muscle minimum set targets beyond non-zero primary-target coverage because this resolver does not yet know weekly frequency/history.

Final public statuses remain `PASS / WARN / FAIL`.

## 17. State and reconcile

State owns only user intent:

```text
familyId
level
resolverVersion
input
selections
prepSelections
```

State must not persist:

```text
volume
anatomy
conflict
estimatedMinutes
resolved prescriptions
```

Manual selection priority:

```text
legal manual selection > automatic recommendation
```

If a stored manual selection becomes illegal because of action existence/status/route/Family/Level/Role/resolverVersion, it is dropped and the resolver safely falls back to auto recommendation.

A resolver-level warning such as `BODY_STALE_SELECTION_FALLBACK` is emitted. This warning is not a Body Conflict issue.

If a user manually chooses the same action as the current automatic baseline, `source` remains `manual` until Reset.

Reset restores `source = auto`.

## 18. Candidate API

Expose a pure Body candidate API for #35:

```js
V15BodyResolver.candidates({
  familyId,
  level,
  slotKey,
  currentSelections
})
```

Return at least:

```js
{
  recommended,
  candidates: [{
    actionId,
    name,
    role,
    directTargets,
    fatigueCost,
    stabilityDemand,
    repProfile
  }]
}
```

The UI must not reimplement candidate filtering or ordering.

## 19. PREP and Anatomy

After final main slots resolve:

- Anatomy receives formal Body action IDs and continues to describe muscular participation.
- Body Volume remains derived only from `bodyActionMeta` and Level policy.
- PREP receives Body context including Level, Family primary targets, main action IDs and formal action IDs.

PREP does not implement Body volume logic.

## 20. Determinism

For equal data + equal input + equal manual selections, repeated resolves must produce logically byte-equivalent outputs.

Determinism requirements:

- no randomness,
- no time dependence,
- no hidden LocalStorage reads by resolver,
- no object-order semantics,
- explicit stable candidate sort,
- stable warning/conflict order.

## 21. 16-state baseline

The release baseline covers:

```text
BODY-01 L1–L4
BODY-02 L1–L4
BODY-03 L1–L4
BODY-04 L1–L4
```

Each state freezes a signature containing:

- familyId / level,
- active slot keys,
- selected actionIds,
- slot roles,
- working sets,
- rep ranges,
- RIR ranges,
- rest ranges,
- directSetsByTarget,
- secondaryExposureByTarget,
- totalWorkingSets,
- isolationRatio,
- highFatigueCompoundCount,
- estimatedMinutes,
- Conflict status + issue codes.

A deterministic fingerprint is stored in tests so accidental baseline changes fail CI explicitly.

## 22. TDD implementation gates

### Gate 1 — Shared contract

RED first:

- optional `domainContext` rejected by current ResolvedSession validator,
- Body Resolver not registered.

GREEN:

- additive ResolvedSession V1 `domainContext` support,
- `body-v1` resolver registration,
- F111 outputs still validate unchanged.

### Gate 2 — Candidates

RED first:

- Family/Level/Role positive and negative cases,
- illegal route/status/action,
- PRIMARY/SECONDARY primary-target gate.

GREEN:

- deterministic candidate API and hard gates.

### Gate 3 — 16-state resolver

RED first:

- all 16 Body states expected but unavailable.

GREEN:

- L1/L2 = 5 slots,
- L3/L4 = 6 slots,
- all outputs pass public contract,
- deterministic baseline fingerprint.

### Gate 4 — Volume

RED first:

- multi-direct-target case,
- unilateral counting,
- secondary exposure,
- warm-up/ramp-up exclusion,
- isolation ratio.

GREEN:

- Body volume calculator uses only structured data.

### Gate 5 — Conflict

RED first:

- coverage FAIL,
- volume FAIL,
- Family deviation FAIL,
- fatigue/redundancy/isolation/time WARN cases.

GREEN:

- Body Conflict plugin registered through V15 Conflict service,
- public status remains PASS/WARN/FAIL.

### Gate 6 — State/reconcile

RED first:

- manual preservation,
- stale/illegal fallback,
- resolverVersion mismatch,
- reset,
- repeated rerender determinism.

GREEN:

- V15 State integration without storing derived data.

## 23. Regression gates

#34 must not alter F111 behavior.

Required regression coverage includes:

- F111 Resolver tests,
- F111 Conflict exact-parity fingerprint,
- F111 State migration/reconcile,
- F111 PREP,
- F111 Coach/Member Copy,
- existing Browser Smoke.

No F111 baseline change is accepted as part of #34.

## 24. Completion criteria

Issue #34 is complete only when:

- 16/16 Body states resolve successfully.
- L1/L2 have 5 active Body slots; L3/L4 have 6.
- Every automatic and manual selection passes Family × Level × Role × route/status legality.
- L1–L4 differences are explained by Level policy, not forced action complexity.
- Structured Sets/Reps/RIR/Rest exist in Body domainContext.
- Direct Work Sets never parse prescription strings.
- Multi-target, unilateral and secondary-exposure counting obey #33 policy.
- Session total working sets stay within Level policy.
- Body Conflict rules return the agreed FAIL/WARN outcomes.
- Manual selections persist when legal and safely fallback when stale.
- Same input resolves deterministically.
- F111 regression suite remains unchanged.
- #35 can build UI entirely from Resolver/State/Conflict/PREP public outputs without implementing Body business rules.

## 25. Architectural principle

The Body Resolver is the single source of truth for Body session composition and Body-derived metrics.

```text
Body Data Contract
→ Body Candidate Resolver
→ Structured Prescription
→ Direct Work Sets
→ Body Conflict
→ ResolvedSession + BODY domainContext
→ State / PREP / Anatomy / future UI consumers
```

No downstream consumer may independently recreate Body selection, volume or conflict logic.
