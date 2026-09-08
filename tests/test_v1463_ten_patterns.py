import json
import re
from pathlib import Path

ROOT = Path(__file__).parents[1]
DATA = ROOT / 'data' / 'system-data.js'


def load_payload():
    text = DATA.read_text(encoding='utf-8')
    m = re.search(r'window\.V14_DATA\s*=\s*(\{.*\});\s*$', text, re.S)
    assert m, 'window.V14_DATA payload missing'
    return json.loads(m.group(1))


def test_ten_pattern_catalog_has_exact_ten_entries_and_preserves_eight_patterns():
    data = load_payload()
    catalog = data['tenPatternCatalog']
    assert len(catalog) == 10
    assert len(data['eightPatterns']) == 8
    assert [x['id'] for x in catalog] == [f'PATTERN-{i:02d}' for i in range(1, 11)]
    assert [x['type'] for x in catalog[:8]] == ['main_pattern'] * 8
    assert catalog[8] == {
        'id': 'PATTERN-09',
        'type': 'support',
        'key': 'support',
        'name': '支撑模式',
        'levelSystem': 'SUP-S1-S6',
    }
    assert catalog[9] == {
        'id': 'PATTERN-10',
        'type': 'core',
        'key': 'core',
        'name': '核心模式',
        'levelSystem': 'CORE-L1-L4+DEMAND',
    }


def test_first_eight_catalog_entries_reference_existing_main_patterns():
    data = load_payload()
    expected = list(data['eightPatternDetails'].keys())
    assert [x['name'] for x in data['tenPatternCatalog'][:8]] == expected
    assert [x['key'] for x in data['tenPatternCatalog'][:8]] == expected
    assert all(x['levelSystem'] == 'T1-T4' for x in data['tenPatternCatalog'][:8])


def test_system_view_exposes_ten_pattern_information_architecture():
    text = (ROOT / 'js' / 'views-system.js').read_text(encoding='utf-8')
    assert '十大动作模式' in text
    assert 'tenPatternCatalog' in text
    assert '09｜支撑模式' in text
    assert '10｜核心模式' in text
    assert '← 返回十大模式' in text
    assert '>SUPPORT</a>' not in text
    assert '>CORE</a>' not in text


def test_app_subtitle_and_maintenance_promote_ten_pattern_catalog():
    app = (ROOT / 'js' / 'app.js').read_text(encoding='utf-8')
    maintenance = (ROOT / 'js' / 'views-maintenance.js').read_text(encoding='utf-8')
    assert "['训练体系','十大动作模式 · PREP 热身']" in app
    assert 'Ten Pattern Catalog' in maintenance
    assert '十大动作模式' in maintenance
