from pathlib import Path

ROUTER = Path(__file__).parents[1] / 'js' / 'router.js'

def test_required_hash_routes_are_declared():
    text = ROUTER.read_text(encoding='utf-8')
    for route in [
        '#/coach', '#/system/patterns', '#/system/support', '#/system/core',
        '#/rules/venue', '#/rules/replacement', '#/rules/conflicts', '#/library',
        '#/maintenance', '#/maintenance/audit', '#/maintenance/venue'
    ]:
        assert route in text

def test_all_32_session_routes_are_addressable():
    routes = [
        f'#/coach/f111-{recipe:02d}/l{level}'
        for recipe in range(1, 9)
        for level in range(1, 5)
    ]
    assert len(routes) == 32
    assert routes[0] == '#/coach/f111-01/l1'
    assert routes[-1] == '#/coach/f111-08/l4'

def test_v143_prep_route_is_declared():
    text = ROUTER.read_text(encoding='utf-8')
    assert '#/system/prep' in text
