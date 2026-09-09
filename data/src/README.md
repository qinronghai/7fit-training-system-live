# V14.8 Runtime Data Sources

This directory is the maintenance Source of Truth for `window.V14_DATA`.

## Edit workflow

1. Edit the owning `*.json` domain file here.
2. If adding or moving a `V14_DATA` top-level key, update `manifest.json` ownership and `topLevelOrder` explicitly.
3. Regenerate the committed browser bundle:

```bash
python tools/build_system_data.py
```

4. Verify before committing:

```bash
python tools/build_system_data.py --check
python tools/validate_v148_schema.py
python -m pytest -q
```

## Do not

Do **not** hand-edit `../system-data.js`. It is a generated compatibility artifact for the dependency-free static browser runtime.

Do **not** use last-write-wins or duplicate JSON keys. The builder rejects duplicate keys, undeclared keys, missing owners, wrong owners, stale bundles, and invalid manifest ordering.

## Ownership

`manifest.json` is the machine-readable top-level ownership contract. Each `V14_DATA` top-level key belongs to exactly one domain source file.

Full maintenance documentation: `docs/V14.8-DATA-SOURCES.md`.
