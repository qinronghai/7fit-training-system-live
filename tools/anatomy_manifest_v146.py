#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SYSTEM = ROOT / 'data' / 'system-data.js'
ANATOMY = ROOT / 'data' / 'anatomy-data.js'
OUT = ROOT / 'docs' / 'V14.6-PHASE-BC-MANIFEST.json'


def load_js(path: Path, name: str):
    text = path.read_text(encoding='utf-8')
    m = re.search(rf'window\.{re.escape(name)}\s*=\s*(\{{.*\}});\s*$', text, re.S)
    if not m:
        raise RuntimeError(f'{name} payload not found in {path}')
    return json.loads(m.group(1))


def main():
    system = load_js(SYSTEM, 'V14_DATA')
    anatomy = load_js(ANATOMY, 'V14_ANATOMY')
    runtime_ids = list(system['actions'].keys())
    covered = set(anatomy['records'].keys())
    missing = [aid for aid in runtime_ids if aid not in covered]

    groups = {k: [] for k in ['主训练', '激活', '热身', '体能', '放松']}
    for aid in missing:
        cat = system['actions'][aid].get('category')
        if cat not in groups:
            raise AssertionError(f'Unexpected remaining category {cat!r}: {aid}')
        groups[cat].append(aid)

    payload = {
        'version': 'V14.6',
        'runtimeExpected': len(runtime_ids),
        'phaseA': len(covered),
        'remaining': len(missing),
        'phaseBExpected': len(groups['主训练']) + len(groups['激活']) + len(groups['热身']),
        'phaseCExpected': len(groups['体能']) + len(groups['放松']),
        'phaseB': {
            '主训练': groups['主训练'],
            '激活': groups['激活'],
            '热身': groups['热身'],
        },
        'phaseC': {
            '体能': groups['体能'],
            '放松': groups['放松'],
        },
    }

    assert payload['runtimeExpected'] == 239, payload['runtimeExpected']
    assert payload['phaseA'] == 120, payload['phaseA']
    assert payload['remaining'] == 119, payload['remaining']
    assert len(groups['主训练']) == 65
    assert len(groups['激活']) == 12
    assert len(groups['热身']) == 8
    assert len(groups['体能']) == 20
    assert len(groups['放松']) == 14
    assert payload['phaseBExpected'] == 85
    assert payload['phaseCExpected'] == 34

    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {OUT}')
    print('Phase B:', payload['phaseBExpected'])
    print('Phase C:', payload['phaseCExpected'])


if __name__ == '__main__':
    main()
