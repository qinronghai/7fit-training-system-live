# Body Resolver V1 Design Spec

Issue: #34  
Status: Approved design / final spec review pending  
Target version: V15  
Template: `body`

## 1. Goal

Implement an independent Body Resolver V1 that consumes the Body Data Contract from #33 and produces deterministic, auditable `ResolvedSession(main.kind = SLOT)` outputs for 4 Body Families × L1–L4.

The resolver is muscle/volume-driven. It must not reuse F111 `lowerMode / upperMode` semantics, infer Body rules from action names or Anatomy, or parse human-readable prescription strings to derive volume.

## 2. Scope

In scope:

- `V15TemplateResolver.register('body', resolver)`.
- `BODY-01`–`BODY-04` × L1–L4.
- 5/6-slot Body contract.
- Candidate legality and deterministic ranking.
- Structured Sets / Reps / RIR / Rest.
- Direct Work Sets and secondary exposure.
- Body Conflict plugin on #32 Shared Conflict.
- Optional Body `domainContext` extension to `ResolvedSession v1`.
- V15 State selection/reconcile compatibility.
- Candidate API for #35 UI.
- 16-state deterministic baseline/fingerprint.

Out of scope:

- Body Coach/Copy/PREP UI (#35).
- Save/restore UX (#11).
- Weekly volume history or periodization.
- New Body actions beyond #33 whitelist.
- Conditioning/Posture Resolver logic.
- F111 algorithm changes.

## 3. Platform boundaries

```text
Template Registry
    ↓
V15TemplateResolver
    ↓
Body Resolver V1
    ↓
ResolvedSession
    ├─ main.kind = SLOT
    ├─ prepContext
    ├─ anatomyContext
    ├─ conflictContext
    ├─ copyContext
    └─ domainContext.kind = BODY
```

`V15State` stores user intent only. The Body Resolver is pure with respect to State: it receives selections explicitly and must not read LocalStorage/sessionStorage/V15State internally.

## 4. ResolvedSession V1 additive extension

`ResolvedSession.schemaVersion` remains `1`.

The shared contract gains one optional top-level property:

```js
domainContext?: {
  kind: string,
  ...templateSpecificFields
}
```

Shared `V15ResolvedSession` validation only requires that `domainContext`, when present, is an object with a non-empty `kind`. It does not learn Body-specific fields.

Body Resolver must separately assert the complete BODY domain contract before returning the final session.

For F111, `domainContext` remains absent and all existing F111 outputs continue to validate unchanged.

The generic SLOT item remains unchanged. Body structured prescription therefore does not become a mandatory cross-template field.

## 5. Body input contract

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
  }
}
```

Required:

- `familyId` exists in `bodyFamilyIds`.
- `level` is `L1`–`L4`.

Resolver version: `body-v1`.

Canonical session key: `${familyId}-${level}`, e.g. `BODY-02-L3`.

Body PREP selections are deliberately not part of the Body main-resolver input. They stay in V15 State and are consumed by the shared PREP integration in #35.

ResolvedSession source for Body V1:

```js
source: { type: 'GENERATED', id: `${familyId}-${level}` }
```

## 6. Slot contract

| Slot | Required Body Role | Purpose |
|---|---|---|
| PRIMARY | PRIMARY | Main Family stimulus |
| SECONDARY | SECONDARY | Second primary-target stimulus with useful variation |
| ACCESSORY | ACCESSORY | Fill target/structure gaps |
| ISOLATION-1 | ISOLATION | First local isolation slot |
| ISOLATION-2 | ISOLATION | Second local isolation slot |
| OPTIONAL | OPTIONAL | Extra work when Level policy enables it |

Active slots:

- L1/L2: exactly 5 slots; OPTIONAL omitted.
- L3/L4: exactly 6 slots; OPTIONAL included.

No empty OPTIONAL placeholder is emitted.

## 7. Candidate legality

A candidate is legal only when all hard gates pass:

```text
Family matches
+ Level matches
+ Slot role matches
+ formal Action exists
+ Action status is allowed
+ route is 1F_ONLY or FLEX_1F_2F
```

Routes such as `POST_CARDIO_ONLY`, `CONDITIONING_2F`, `RECOVERY_2F` and PREP-only routes are illegal for Body main slots.

PRIMARY and SECONDARY add:

```text
directTargets ∩ family.primaryTargets != ∅
```

Candidate legality belongs to Body Resolver. #35 UI must consume the candidate API instead of rebuilding filters.

## 8. Resolver order

```text
PRIMARY
→ SECONDARY
→ ACCESSORY
→ ISOLATION-1
→ ISOLATION-2
→ OPTIONAL (L3/L4 only)
```

Each later slot sees current direct-target coverage, selected action patterns, laterality and fatigue profile.

## 9. Ranking policy

Ranking is applied only after hard legality filtering.

Priority:

1. Family primary-target coverage.
2. Missing-target bonus.
3. Role/Level fit.
4. Stability suitability for current Level.
5. Fatigue control.
6. Movement diversity.
7. Target redundancy penalty.
8. `actionId.localeCompare()` as final deterministic tie-break.

No score may depend on randomness, time, LocalStorage, JS object insertion order or action-name heuristics.

L4 never means “choose the most complex action”. Stable machine actions remain valid when metadata allows them.

SECONDARY prefers a candidate differing from PRIMARY by at least one useful dimension: movement pattern, loading modality, bilateral/unilateral structure or direct-target combination. This is a ranking preference, not a hard gate.

## 10. Structured prescription

Authoritative sources:

```text
Level Policy → workingSets + rirRange
Action repProfile → repRange + restSecondsRange + perSide
```

Each active Body domain slot contains:

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

`main.content[].prescription` remains a human-readable compatibility string. Body Volume/Conflict/UI logic must never parse it.

## 11. Level volume skeleton

Use #33 `bodyLevelPolicies` as the only source of working sets and RIR.

| Level | PRIMARY | SECONDARY | ACCESSORY | ISO-1 | ISO-2 | OPTIONAL | Baseline total |
|---|---:|---:|---:|---:|---:|---:|---:|
| L1 | 3 | 2 | 2 | 2 | 1 | — | 10 |
| L2 | 3 | 3 | 2 | 2 | 2 | — | 12 |
| L3 | 3 | 3 | 3 | 2 | 2 | 1 | 14 |
| L4 | 4 | 3 | 3 | 3 | 2 | 1 | 16 |

Legal session windows:

- L1: 10–12
- L2: 12–14
- L3: 14–16
- L4: 16–18

## 12. Direct Work Sets contract

`totalWorkingSets` and per-target Direct Sets are separate measurements.

For a 3-set action with two direct targets:

```text
totalWorkingSets += 3
directTargetA += 3
directTargetB += 3
```

Per-target values are never summed back into session total.

### Unilateral

`3 sets / side` contributes 3, not 6, to `totalWorkingSets` and to each direct target.

### Secondary exposure

Secondary targets accumulate in `secondaryExposureByTarget`. They do not receive Direct Sets and are not converted to fractional/effective sets.

### Exclusions

PREP, foam, warm-up/ramp-up sets, activation, recovery and post-cardio never contribute. Only active Body main slots count.

## 13. BODY domainContext

```js
domainContext: {
  kind: 'BODY',
  slots: {
    PRIMARY: BodySlot,
    SECONDARY: BodySlot,
    ACCESSORY: BodySlot,
    'ISOLATION-1': BodySlot,
    'ISOLATION-2': BodySlot,
    OPTIONAL?: BodySlot
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

Body Resolver must validate this complete structure before returning.

Anatomy exposure remains independent and must never be substituted for Direct Work Sets.

## 14. Isolation ratio

```text
isolationRatio = isolationWorkingSets / totalWorkingSets
```

The numerator sums working sets only when selected action `exerciseClass === 'isolation'`.

## 15. Deterministic time estimate

Body main-time estimation is a heuristic used for Conflict only.

For each active slot:

```text
midReps = midpoint(repRange)
midRest = midpoint(restSecondsRange)
setExecutionSeconds = midReps × 4
perSetCoachingSetupSeconds = 45
slotSeconds =
  workingSets × (setExecutionSeconds + perSetCoachingSetupSeconds)
  + max(workingSets - 1, 0) × midRest
```

Between adjacent active slots add `60 seconds` transition time.

Final value:

```text
estimatedMinutes = ceil(totalEstimatedSeconds / 60)
```

The constants are V1 heuristics, not claims about exact member duration. If later evidence justifies calibration, that is a deliberate policy change and baseline fingerprint update.

Body main-time policy remains 35–50 minutes.

## 16. Body Conflict V1

Shared Conflict Core owns shared structure, duplicate Action, missing Action, route/status and explicit shared-policy checks.

Body Resolver passes Shared Core:

```js
allowedRoutes: ['1F_ONLY', 'FLEX_1F_2F']
```

Body Plugin owns domain rules:

| Rule | Condition | Public outcome | Code |
|---|---|---|---|
| Family deviation | Action violates Family/Level/Role | FAIL | `BODY_FAMILY_DEVIATION` |
| Primary target missing | Family primary target has zero Direct Sets | FAIL | `BODY_PRIMARY_TARGET_MISSING` |
| Session volume | totalWorkingSets outside Level range | FAIL | `BODY_VOLUME_OUT_OF_RANGE` |
| High-fatigue stack | high-fatigue compounds > policy max | WARN | `BODY_HIGH_FATIGUE_STACK` |
| Movement redundancy | canonical movement pattern count > policy max | WARN | `BODY_MOVEMENT_REDUNDANCY` |
| Isolation ratio | isolationRatio > policy threshold | WARN | `BODY_ISOLATION_HEAVY` |
| Time budget | estimatedMinutes outside policy range | WARN | `BODY_TIME_BUDGET` |

Movement redundancy uses canonical Action movement-pattern metadata, never name matching.

Primary-target coverage uses `directSetsByTarget`, never Anatomy.

V1 does not define per-muscle absolute minimum-set thresholds beyond non-zero primary-target coverage because weekly frequency/history is out of scope.

Final public status remains `PASS / WARN / FAIL`.

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

It must not persist derived volume, Anatomy, Conflict, estimated time or resolved prescriptions.

Resolver is pure: caller reads V15 State and passes explicit selections.

Priority:

```text
legal manual selection > auto recommendation
```

If a manual selection becomes illegal because of Action existence/status/route/Family/Level/Role or resolver-version change, State reconcile drops it and the next resolver call falls back to auto.

Resolver warning: `BODY_STALE_SELECTION_FALLBACK`.

Resolver warnings and Conflict issues are separate concepts.

If the user manually chooses the current baseline Action, source remains `manual` until Reset. Reset restores auto behavior.

## 18. Candidate API

```js
V15BodyResolver.candidates({
  familyId,
  level,
  slotKey,
  currentSelections
})
```

Return:

```js
{
  recommended: 'actionId',
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

Candidate order is deterministic. UI does not re-filter/re-rank this result.

## 19. PREP and Anatomy

After main slots resolve:

- Anatomy receives formal Body action IDs and describes muscular participation.
- Body Volume remains based exclusively on Body metadata + Level policy.
- PREP receives Body context: template, Level, Family primary targets, main action IDs and formal action IDs.

PREP selections themselves remain downstream State/PREP concerns for #35.

## 20. Conflict data flow

```text
Selected Body Slots
→ Structured Prescription
→ Body Volume
→ conflict-evaluable Body draft
→ Shared Conflict Core + Body Plugin
→ V15 Conflict Aggregator
→ final conflictContext
→ final ResolvedSession validation
```

No downstream consumer recalculates Body Conflict independently.

## 21. Determinism

Equal data + equal input + equal selections must produce logically byte-equivalent output.

Required:

- no randomness,
- no clock dependency,
- no hidden State/storage reads,
- no object-order business meaning,
- explicit stable candidate ordering,
- stable warnings and Conflict order.

## 22. 16-state baseline

Release baseline:

```text
BODY-01 L1–L4
BODY-02 L1–L4
BODY-03 L1–L4
BODY-04 L1–L4
```

Each signature freezes:

- familyId / level,
- active slot keys,
- action IDs,
- roles,
- working sets,
- rep / RIR / rest ranges,
- Direct Sets,
- secondary exposure,
- totalWorkingSets,
- isolationRatio,
- highFatigueCompoundCount,
- estimatedMinutes,
- Conflict status and ordered issue codes.

Tests store a deterministic fingerprint. Accidental baseline changes fail CI explicitly.

## 23. TDD gates

### Gate 1 — Shared contract

RED:
- current ResolvedSession rejects optional `domainContext`;
- Body resolver is not registered.

GREEN:
- additive generic `domainContext.kind` support;
- BODY-specific domain assertion;
- `body-v1` registration;
- unchanged F111 outputs still validate.

### Gate 2 — Candidates

RED:
- Family/Level/Role positive/negative cases;
- illegal Action/status/route;
- PRIMARY/SECONDARY primary-target gate;
- deterministic order.

GREEN:
- pure candidate API with one legality source.

### Gate 3 — 16 states

RED:
- all 16 states expected but unavailable.

GREEN:
- 16/16 resolve;
- L1/L2 exactly 5 slots;
- L3/L4 exactly 6 slots;
- deterministic baseline fingerprint.

### Gate 4 — Volume

RED:
- multi-direct-target;
- unilateral;
- secondary exposure;
- non-main exclusion;
- isolation ratio;
- human prescription anti-parse.

GREEN:
- structured Body volume calculator only.

### Gate 5 — Conflict

RED:
- coverage FAIL;
- volume FAIL;
- Family deviation FAIL;
- fatigue/redundancy/isolation/time WARN.

GREEN:
- Body Conflict plugin registered through V15 service;
- PASS/WARN/FAIL contract preserved.

### Gate 6 — State/reconcile

RED:
- legal manual preserve;
- stale/illegal drop + auto fallback;
- resolverVersion mismatch;
- reset;
- repeated resolve determinism.

GREEN:
- V15 State integration without persisting derived data.

## 24. Regression gates

#34 must preserve:

- F111 Resolver tests,
- F111 Conflict exact-parity fingerprint,
- F111 State migration/reconcile,
- F111 PREP,
- F111 Coach/Member Copy,
- existing Browser Smoke.

No F111 baseline change is accepted in #34.

## 25. Completion criteria

#34 closes only when:

- 16/16 Body states resolve.
- L1/L2 have 5 active slots; L3/L4 have 6.
- Every baseline/manual selection passes Family × Level × Role × route/status legality.
- L1–L4 progression is explained by Level policy, not forced complexity.
- Structured Sets/Reps/RIR/Rest exist in BODY domainContext.
- Direct Work Sets never parse prescription strings.
- Multi-target, unilateral and secondary-exposure rules obey #33.
- totalWorkingSets stays inside Level policy.
- Body Conflict returns agreed FAIL/WARN outcomes.
- legal manual selections persist and stale selections safely fallback.
- repeated equal input resolves deterministically.
- F111 regression remains unchanged.
- #35 can build UI entirely from Resolver/State/Conflict/PREP outputs without recreating Body business rules.

## 26. Architectural principle

```text
Body Data Contract
→ Body Candidate Resolver
→ Structured Prescription
→ Direct Work Sets
→ Body Conflict
→ ResolvedSession + BODY domainContext
→ State / PREP / Anatomy / future UI
```

Body Resolver is the single source of truth for Body session composition and Body-derived metrics.
