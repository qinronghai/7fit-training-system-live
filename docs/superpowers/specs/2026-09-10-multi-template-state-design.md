# V15 Multi-Template State Namespace Design

## Context

Issue #31 establishes the persistence boundary required by the V15 multi-template system before F111 migration (#30), PREP Phase B1 (#25), Body/Conditioning resolvers, and Save/Restore (#11).

The current `js/state.js` persists only:

```js
{
  selections: {},
  composerSelections: {}
}
```

under `7fit-v14-state`. This structure has no schema version, no template namespace, no resolver version, no PREP state, and implicitly treats every saved value as F111.

## Decision

Introduce a V15 core state store while preserving the current `window.V14State` API as a compatibility facade.

```text
sessionStorage
├─ 7fit-v15-state          ← formal state
└─ 7fit-v14-state          ← legacy migration source only

window.V15State            ← new template-aware API
window.V14State            ← compatibility facade backed by V15State
```

No existing Coach view must be rewritten in #31 merely to keep current F111 selections working. #30 can later migrate F111 UI code to the V15 API deliberately.

## Store contract

Formal store schema version is `1`:

```js
{
  schemaVersion: 1,
  templates: {
    f111: { sessions: {} },
    body: { sessions: {} },
    conditioning: { sessions: {} }
  },
  savedSessions: {},
  recentActions: [],
  favorites: {}
}
```

Template namespaces are created from the active `V14_DATA.templateIds` registry except FUTURE-only templates that have no current state need. The initial required namespaces are `f111`, `body`, and `conditioning`.

## Session state contract

Each stored session is keyed inside exactly one template namespace and has:

```js
{
  templateId: 'f111',
  familyId: 'F111-06',
  level: 'L3',
  resolverVersion: 'f111-adapter-v1',
  input: {},
  selections: {
    A: { actionId: '...', source: 'manual' }
  },
  prepSelections: {
    'MOB-L': { actionId: '...', source: 'manual' }
  }
}
```

`input` is domain-private. F111 may store `lowerMode`, `upperMode`, or `coreDemand` inside `input`; those fields never become global state requirements.

Formal selection `source` values are `baseline | auto | manual`. PREP selection source follows #25 Phase A and is `auto | manual`.

The state store persists explicit decisions, not a full ResolvedSession snapshot. Resolver output remains derived data.

## Public V15 API

Expose `window.V15State` with:

```js
getSchemaVersion()
getLoadStatus()
snapshot()
serialize()
getSession(templateId, sessionKey)
ensureSession(templateId, sessionKey, metadata)
patchSession(templateId, sessionKey, patch)
setSelection(templateId, sessionKey, key, actionId, source='manual')
getSelections(templateId, sessionKey)
setPrepSelection(templateId, sessionKey, slotKey, actionId, source='manual')
getPrepSelections(templateId, sessionKey)
resetSession(templateId, sessionKey)
reconcileSession(templateId, sessionKey, options)
clear()
```

All returned state objects are cloned so callers cannot mutate the store without an API call.

## Namespace isolation

Every session read/write requires an explicit registered `templateId`. A session key named `demo-L2` may exist independently under F111, Body, and Conditioning without collision.

Unknown template IDs are rejected with deterministic error code `UNKNOWN_TEMPLATE`.

## Legacy V14 migration

When no valid `7fit-v15-state` exists, the loader checks `7fit-v14-state`.

### Preset selections

For each legacy `selections[sessionId]` entry:

- parse known `F111-XX-LN` session identity from runtime data;
- create `templates.f111.sessions[sessionId]`;
- `familyId` = recipe ID;
- `level` = L1–L4 suffix;
- `resolverVersion` = `f111-adapter-v1`;
- `input` = `{mode:'preset', recipeId, level}`;
- each legacy override becomes `{actionId, source:'manual'}` when the action still exists.

### Composer selections

For each legacy `composerSelections[compositionKey]` entry:

- create an F111 session using the same key;
- derive the L1–L4 suffix when available;
- preserve the legacy key in `input` with `mode:'composer'` and `legacyCompositionKey`;
- do not invent missing `coreDemand` or other private fields that were not encoded by V14;
- each valid legacy override becomes a manual selection.

When the Composer view is next opened, it can patch exact F111 input metadata through the V15 API.

The legacy key is not required for subsequent reads once V15 has been persisted. `clear()` removes both state keys to prevent legacy data from being migrated again after an explicit reset.

## Invalid persisted data

### Invalid JSON

Reset to a clean V15 store and expose load status `RESET_INVALID_JSON`.

### Unsupported schemaVersion

Do not attempt heuristic migration. Reset to a clean V15 store and expose `RESET_UNSUPPORTED_SCHEMA_VERSION` with the observed version.

### Resolver version mismatch

`reconcileSession(templateId, sessionKey, {resolverVersion,...})` treats the previous selections as stale:

- keep session identity/input;
- update to the requested resolverVersion;
- clear `selections` and `prepSelections`;
- persist;
- return a fallback record with reason `RESOLVER_VERSION_MISMATCH`.

This is intentionally conservative: a new resolver may change candidate legality.

### Stale selections

`reconcileSession` always removes saved action IDs no longer present in `V14_DATA.actions`. It additionally accepts optional caller validators:

```js
isSelectionValid(key, entry, session)
isPrepSelectionValid(slotKey, entry, session)
```

Invalid entries are removed and reported with reason `STALE_SELECTION` or `STALE_PREP_SELECTION`. The domain resolver then supplies its current baseline/auto fallback; State does not duplicate domain legality rules.

## V14 compatibility facade

Keep all existing methods and behavior used by current UI:

- `getSelection / getSessionSelections / setSelection / resetSession`
- `getComposerSelection / getComposerSelections / setComposerSelection / resetComposer`
- `getMode / setMode / clear`

The facade stores values inside `templates.f111.sessions`.

For preset reads, a missing/stale manual value falls back to the current session baseline exactly as V14 did.

For Composer reads, stale action IDs are filtered, leaving `V14Composer.resolve()` to choose current auto candidates.

A new optional compatibility helper `setComposerContext(compositionKey, metadata)` may be used by the current Composer view to attach exact private F111 input metadata without changing visible behavior.

## Refresh behavior

The formal V15 store remains in `sessionStorage`, matching current product persistence semantics. `sessionStorage` survives page refresh in the same browser tab. Tests reload `state.js` against the same storage instance to prove manual formal/PREP selections survive rerender/reload.

## Serialization boundary for #11

`serialize()` returns the complete canonical V15 store JSON. `snapshot()` returns the same logical object as a deep clone. #11 can build Save/Restore on this boundary without depending on the legacy `selections/composerSelections` structure.

#31 does not implement saved-session UI or cloud persistence.

## Compatibility / exclusions

- No changes to training data.
- No changes to ResolvedSession contract.
- No Body/Conditioning business resolver implementation.
- No Save/Restore UI.
- No PREP replacement UI; only PREP state persistence contract.
- No cloud sync.
