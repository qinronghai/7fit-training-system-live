# V15 ResolvedSession Contract & Template Resolver Dispatcher Design

## Context

Issue #29 establishes the platform boundary between template-specific training algorithms and shared Coach/UI services. F111 is pattern-driven, Body is muscle/volume-driven, and Conditioning is goal/protocol-driven. Their domain logic must remain independent while producing one renderable public session contract.

This design builds on #27 Training Template Registry and #8 Coach View Split. It does not introduce Multi-Template State (#31), Body rules, Conditioning rules, or Posture.

## Decision

Use four isolated layers:

```text
Template input
    ↓
TemplateResolverDispatcher.resolve(templateId, input)
    ↓
Domain resolver / adapter
    ↓
ResolvedSession public contract
    ↓
Shared UI / PREP / Anatomy / Conflict / Copy consumers
```

The dispatcher is registration-driven rather than a growing template switch. F111 gets the first real adapter. Body and Conditioning are exercised in contract tests with synthetic resolvers only; their production resolvers belong to later issues.

## ResolvedSession v1

Every resolved session has these public fields:

```js
{
  schemaVersion: 1,
  resolverVersion: '...',
  templateId: 'f111',
  familyId: 'F111-06',
  level: 'L3',
  title: '...',
  summary: '...',
  main: { kind: 'SLOT' | 'PROTOCOL', content: ... },
  prepContext: {...},
  anatomyContext: {...},
  conflictContext: {...},
  copyContext: {...},
  warnings: [],
  resolvedSelections: [],
  source: { type: 'PRESET' | 'COMPOSER' | 'GENERATED', id: '...' }
}
```

### SLOT main payload

F111 and Body use a common slot representation without requiring common slot names:

```js
{
  kind: 'SLOT',
  content: [
    {
      key: 'A',
      label: 'A｜下肢主项',
      actionId: '...',
      name: '...',
      tier: 'T3',
      grade: '',
      prescription: '...',
      source: 'baseline' | 'auto' | 'manual'
    }
  ]
}
```

The contract does not require F111 private fields such as `lowerMode`, `upperMode`, `windows`, or `coreDemand`.

### PROTOCOL main payload

Conditioning uses a different discriminant:

```js
{
  kind: 'PROTOCOL',
  content: {
    protocolId: '...',
    name: '...',
    blocks: [
      {
        key: 'B1',
        label: '主训练',
        items: [
          { actionId: '...', name: '...', prescription: '...' }
        ]
      }
    ],
    metrics: {}
  }
}
```

The schema is strict for the platform shape but allows protocol `metrics` to evolve with Conditioning without forcing those fields onto SLOT templates.

## Shared contexts

`prepContext` uses the normalized PREP V2 context contract already frozen in #25 Phase A.

`anatomyContext` contains `actionIds` plus normalized aggregate lists (`primary`, `secondary`, `stabilizers`). It is ready for public UI consumption and does not expose template internals.

`conflictContext` contains normalized `status`, `hardCount`, `warnCount`, and public issue records. A shared UI can render it without knowing which domain resolver created the session.

`copyContext` is deliberately minimal in #29: title, summary, and action IDs. It establishes a stable public handoff without replacing the current F111 Coach/Member Copy implementation yet.

`resolvedSelections` is an ordered array of `{key, actionId, source}` records. It records the resolved result but does not define persistence; persistence belongs to #31.

## Dispatcher

Expose `window.V15TemplateResolver` with:

```js
register(templateId, resolver)
unregister(templateId)
has(templateId)
resolve(templateId, input)
```

Rules:

1. `templateId` must exist in `V14_DATA.templateRegistry`.
2. `resolver` must be a function returning a valid ResolvedSession.
3. Resolving an unknown template is a deterministic `UNKNOWN_TEMPLATE` error.
4. Resolving a registered template without a resolver is a deterministic `RESOLVER_NOT_REGISTERED` error.
5. Output whose `templateId` does not match the requested template is rejected.
6. The dispatcher contains no F111/Body/Conditioning switch statement.

This registration model means a future template can be added without editing a central UI switch or dispatcher branch table.

## F111 adapter

Expose `window.V15F111Resolver` and register it for `f111`.

It accepts two explicit input modes:

### Preset

```js
{
  mode: 'preset',
  recipeId: 'F111-06',
  level: 'L3',
  selections: ['actionA', ...]
}
```

If `selections` is omitted, the adapter uses the preset baseline IDs. It must not read or mutate `V14State`; #31 will own persisted state integration.

### Composer

```js
{
  mode: 'composer',
  level: 'L3',
  lowerMode: 'single_leg_hinge',
  upperMode: 'horizontal_push',
  coreDemand: 'anti_extension',
  selections: {...},
  includeExpandedMain: false,
  includeExpandedSupport: false,
  includeExpandedCore: false
}
```

The adapter delegates domain resolution to the existing `V14Composer.resolve()`. It does not duplicate the F111 algorithm.

For both modes, the adapter normalizes PREP context, Anatomy aggregate, Conflict output, selection source, title/summary, and main slot content into ResolvedSession v1.

## Determinism

Given the same runtime data and explicit input, the adapter/dispatcher must return structurally equal JSON output. No current time, random ID, DOM state, or LocalStorage state may enter #29 resolution.

## Runtime integration

Load order in `index.html`:

```text
state / prep-grade / anatomy / prep-resolver / composer / conflict
→ resolved-session
→ template-resolver
→ resolvers/f111
→ existing copy/coach views
```

The existing UI continues using its current F111 code path in #29. A browser smoke test calls the new dispatcher for one F111 sample and verifies that existing user-visible F111 page output remains unchanged.

## Schema and validation

Add `schemas/v14.8/resolved-session.schema.json` using Draft 2020-12. Tests cover:

- valid SLOT session
- valid PROTOCOL session
- missing public field
- invalid `main.kind`
- SLOT/PROTOCOL payload mismatch
- F111-private fields are not public required fields
- template ID mismatch
- unknown/unregistered resolver errors
- deterministic F111 result

The schema is for dynamic runtime objects, not a new `data/src` domain, so it does not alter `manifest.json` or `system-data.js`.

## Compatibility

- No existing route changes.
- No `js/state.js` changes.
- No existing F111 training data changes.
- No Body/Conditioning production resolver.
- No Posture implementation.
- No visible Coach/Member Copy change.

## Acceptance mapping

- Dispatcher per templateId: registration API + runtime tests.
- SLOT/PROTOCOL unified schema: discriminated `main` schema + positive/negative tests.
- Shared UI can read public fields: normalized contexts contain no mandatory F111 private mode fields.
- Deterministic unknown resolver behavior: stable error codes.
- Future template extensibility: registry lookup + resolver map, no giant switch.
- F111 first sample: real adapter + runtime/browser regression with unchanged visible result.
