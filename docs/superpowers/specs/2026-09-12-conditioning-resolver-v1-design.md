# Conditioning Resolver V1 Design

Issue: #37  
Parent: #26  
Depends on: #36, #29, #31, #32, #30

## Goal

Implement an independent, deterministic Conditioning Resolver that consumes the frozen #36 Conditioning data contract and emits `ResolvedSession(main.kind = PROTOCOL)` for all CON-01..04 × L1–L4 states.

## Architecture

```text
Conditioning Data Contract (#36)
        |
        v
V15ConditioningProtocol
  - default/legal Protocol
  - work/rest/round/station prescription
  - duration estimator
        |
        v
V15ConditioningResolver
  - station candidate legality
  - deterministic station selection
  - manual station intent
  - reusable Protocol block
        |
        +--> V14PrepResolver.contextFromConditioning
        +--> V14Anatomy.aggregate
        +--> V15ConditioningConflictPlugin
        |
        v
ResolvedSession(main.kind = PROTOCOL)
```

Shared platform remains generic. No F111/Body Resolver logic is moved into Conditioning and `js/state.js` remains unchanged.

## Protocol default matrix

Explicit legal `protocolId` input always wins. An explicit illegal Protocol throws `CONDITIONING_PROTOCOL_ILLEGAL`; it is never silently rewritten.

When no Protocol is requested:

| Family | L1 | L2 | L3 | L4 |
| --- | --- | --- | --- | --- |
| CON-01 | STEADY | STEADY | INTERVAL | INTERVAL |
| CON-02 | INTERVAL | INTERVAL | INTERVAL | CIRCUIT |
| CON-03 | CIRCUIT | CIRCUIT | CIRCUIT | DENSITY |
| CON-04 | INTERVAL | INTERVAL | CIRCUIT | CIRCUIT |

## Prescription semantics

- STEADY: one station, one continuous block.
- INTERVAL: explicit work/rest repeated by round.
- CIRCUIT: station-based work/rest with transition time.
- DENSITY: fixed density window; it does not inherit INTERVAL work/rest semantics.
- `conditioningLevelPolicies.totalWorkMinutesRange` is used as the Protocol main-block duration target. `estimatedSessionMinutes` adds a fixed V1 setup/recovery allowance.
- L1–L4 progression comes from duration, work/rest, station/round count, RPE, impact, coordination and power policy—not trick complexity.

## Station selection

A legal station must:

- exist in `conditioningActionMeta`;
- match Family, Level and Protocol;
- remain `status=可自动编排`;
- remain on `CONDITIONING_2F`;
- expose at least one work metric supported by the Protocol;
- be `powerEligible` when Family is CON-04.

Default selection is deterministic and avoids duplicates. Ranking prioritizes lower fatigue / impact / coordination demand, then avoids consecutive Modality repetition and prefers Family modalities.

Manual State intent is honored only when `source=manual`. Invalid/stale manual selections fall back to the current auto recommendation with a warning.

## Reusable block

`V15ConditioningResolver.resolveBlock()` returns a JSON-serializable, State-independent protocol block containing:

- Protocol + plan;
- station records;
- public `PROTOCOL` block;
- metrics;
- resolved selections;
- warnings.

`serializeBlock()` returns a detached copy for future F111/Body Finisher reuse. #37 does not embed the block into other templates.

## Conflict

The Conditioning plugin runs on #32 Shared Conflict Core.

Hard failures:
- illegal Family/Level/Protocol;
- illegal station;
- impact/coordination/fatigue ceiling breach;
- invalid work/rest/round/station/RPE policy;
- shared duplicate/route/status errors.

Warnings:
- too many high-impact/high-coordination/high-fatigue/power stations;
- Modality redundancy;
- Circuit modality diversity below policy;
- Power placement after high-fatigue work;
- duration/block-budget deviation.

## State

No `js/state.js` changes.

State stores only:
- Family/Level/Protocol input;
- manual station selections;
- future PREP selections.

Resolved metrics, duration, conflict, anatomy and protocol blocks are derived on every resolve.

## Release gate

- 16 Family × Level states resolve deterministically.
- No default state returns FAIL.
- explicit legal/illegal Protocol tests.
- station swap/reconcile persistence tests.
- duration / power placement / duplicate / modality / ceiling tests.
- reusable block serialization test.
- existing Body/F111 frozen regression remains green.
