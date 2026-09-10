# Shared Conflict Core + Template Plugin Design

## Context

Issue #32 follows the completed F111 migration gate (#30). The current runtime has a single `window.V14Conflict` implementation containing both cross-template checks and F111-specific rules. V15 needs a shared conflict service before Body and Conditioning resolvers can be implemented.

## Decision

Adopt incremental extraction with F111 parity. Keep the already-published `ResolvedSession.conflictContext.status` enum unchanged as `PASS | WARN | FAIL`.

Internally, rules may conceptually represent block/warning/info, but the public V15 contract continues to use:

- `FAIL` when one or more hard/blocking issues exist;
- `WARN` when there are no hard issues but one or more warnings exist;
- `PASS` otherwise.

## Architecture

```text
Resolved training draft
        |
        v
V15ConflictCore --------- common legality checks
        |
        +---- template private policy context
                         |
                         v
                 Template Conflict Plugin
                         |
                         v
                 V15Conflict Aggregator
                         |
                         v
              ResolvedSession.conflictContext
```

### V15ConflictCore

Pure shared checks only. It must not know F111 lower/upper modes, Body direct work sets, or Conditioning protocol/work-rest semantics.

Initial shared checks:

- missing action/reference;
- duplicate action;
- route legality for the declared block route;
- action status/availability;
- resolved session/main structural validity;
- optional equipment availability when an explicit venue/equipment policy is supplied;
- optional time budget when an explicit duration policy is supplied.

`venue.json` is currently empty, so equipment availability must be policy-driven and must not invent venue inventory.

### V15Conflict Registry / Aggregator

API:

- `register(templateId, plugin)`
- `evaluate(templateId, resolvedSession, pluginContext?)`

Responsibilities:

- run Shared Core first;
- run the registered template plugin;
- merge issues deterministically;
- normalize issue shape;
- produce `PASS | WARN | FAIL`, `hardCount`, `warnCount`, `issues`;
- reject unknown/unregistered plugins deterministically.

### F111ConflictPlugin

Moves all F111-only rules out of the shared core. It may receive explicit F111 policy context from the F111 resolver/adapter.

Rules retained with before/after parity:

- SUPPORT/CORE grade-window checks;
- auxiliary pattern duplication;
- support/core progression/retrogression information;
- movement pattern changes;
- tier changes;
- pattern/load/equipment concentration;
- F111 space warnings;
- anatomy concentration relative to F111 baseline.

The plugin must not read stale cached session state. It receives the currently resolved actions and explicit F111 context.

### Legacy compatibility

`window.V14Conflict.evaluate()` and `evaluateComposer()` remain available as compatibility facades during V15 migration. They delegate to the new V15 conflict service and preserve the existing public F111 result shape and ordering.

## Deterministic issue ordering

Issue order is part of the compatibility contract. Shared-core and plugin rules get stable rule order; aggregation does not sort by translated message text or object iteration order.

## Public issue shape

For compatibility with `ResolvedSession v1` and Coach UI:

```js
{
  severity: 'hard' | 'warn' | 'info',
  title: string,
  text: string,
  code: string
}
```

Public summary:

```js
{
  status: 'PASS' | 'WARN' | 'FAIL',
  hardCount: number,
  warnCount: number,
  issues: ConflictIssue[]
}
```

No `WARNING` or `BLOCK` public status is introduced in #32 because it would break the already-frozen #29/#30 contract.

## Body / Conditioning contract

#32 only proves that `body` and `conditioning` plugins can register and receive their own private context. Their domain rules are not implemented here.

## Non-goals

- no Body direct-work-set rules;
- no Conditioning protocol rules;
- no automatic session rewriting;
- no F111 training-content changes;
- no UI redesign;
- no invented venue equipment inventory.

## Acceptance gates

- Shared Core positive/negative tests;
- duplicate, missing action, route, status, optional equipment/time policy tests;
- plugin registration / duplicate registration / unknown plugin tests;
- deterministic warning order;
- exhaustive F111 conflict before/after parity fixtures for preset and composer paths;
- existing ResolvedSession, Copy, PREP and Coach tests remain green;
- browser smoke and Pages deploy remain green.
