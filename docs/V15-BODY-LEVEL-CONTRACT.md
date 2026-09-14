# Body L1–L4 Capability Contract

Issue: #92  
Parent: #91

## Decision

Body uses three independent concepts:

- **Family** = what the session is trying to train.
- **Level** = what forms of exercise the member is currently qualified to use.
- **Prescription** = sets, reps, RIR, rest and density.

A Level is therefore not a volume alias.

## Level semantics

| Level | Meaning | Core qualification |
| --- | --- | --- |
| L1 | 动作学习 | controlled movement, stable path, low-entry loading; stable machines remain allowed |
| L2 | 基础负重 | basic external loading, medium stability, basic loaded unilateral work |
| L3 | 正式塑形 / 肌肥大 | formal free-weight and independent unilateral work; full hypertrophy training |
| L4 | 完整训练能力 / 高质量肌肥大 | complete exercise choice; stable machines remain valid and complexity is never mandatory |

Each `bodyLevelPolicies[level]` now carries:

- `eligibleEntryLevels`
- `allowedLoadingStyles`
- `maxStabilityDemand`
- `maxCompoundFatigue`
- `unilateralReadiness`
- `romExpectation`
- `tempoPauseEligibility`
- `intensityTechniqueEligibility`
- `rirRange`
- `sessionWorkingSetRange`
- `fallbackLevel`

## Action entry level

The action's earliest value in `bodyActionMeta[actionId].levels` is its **entry level**.

Example:

- `["L1","L2","L3","L4"]` → L1 entry action.
- `["L2","L3","L4"]` → L2 entry action.
- `["L3","L4"]` → L3 entry action.

Higher levels may keep lower-entry actions. This is intentional: L4 does not force a member away from a stable machine that remains effective.

## Resolver gate

Body candidate admission now follows:

```text
Family
→ Level Eligibility
→ Slot Intent
→ Venue Gate (#94)
→ Candidate Pool (#93)
→ Session Composition
→ Prescription
→ Conflict
```

Current Level Eligibility validates:

1. action explicitly lists the current Level;
2. action entry level is admitted by the Level contract;
3. loading style is admitted;
4. stability demand is within the Level ceiling;
5. compound fatigue is within the Level ceiling.

Manual swaps use the same gate.

## Loading-style mapping

The current contract derives loading style from existing Body prescription metadata:

- `accessory_compound` → `bodyweight_or_light`
- `compound_machine` → `stable_machine`
- `compound_freeweight` → `freeweight`
- `single_leg_compound` → `unilateral`
- `isolation_large / isolation_small` → `isolation`

This avoids adding ad-hoc action-name heuristics.

## Ranking

Among legal candidates, the resolver now includes **Level fit** in ranking. An action whose entry level matches the current Level receives a higher qualification fit than an L1 entry action carried upward.

This changes the old failure mode where L3/L4 could repeatedly choose the same L1 movements simply because they had lower fatigue.

It does **not** make lower-entry actions illegal at higher levels.

## Known correction included in #92

`banjie_hake｜半蹲哈克` no longer carries L1 qualification.

This only changes its Body Level eligibility. Actual venue minimum load / equipment capability data remains the responsibility of #94.

## Boundaries

#92 does not build the final 4 Family × 4 Level action pools. That is #93.

#92 establishes the contract and gate that #93 must populate and audit against.
