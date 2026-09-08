from pathlib import Path

ROOT=Path(__file__).parents[1]

def read(rel): return (ROOT/rel).read_text(encoding='utf-8')

def test_module_copy_script_loaded_before_views():
    html=read('index.html')
    assert 'js/module-copy.js' in html
    assert html.index('js/module-copy.js') < html.index('js/action-detail.js')
    assert html.index('js/module-copy.js') < html.index('js/views-coach.js')

def test_requested_modules_expose_copy_controls():
    system=read('js/views-system.js')
    detail=read('js/action-detail.js')
    assert '复制本模块' in system
    assert 'V14ModuleCopy' in system
    assert '复制本模块' in detail
    assert 'V14ModuleCopy' in detail

def test_coach_payload_uses_prescription_and_tier_not_equipment_meta():
    coach=read('js/views-coach.js')
    assert 'prescriptionForAction' in coach
    assert 'tierForAction' in coach
    assert 'prescription' in coach
    # the copy payload should no longer build meta from pattern/equipment
    payload=coach[coach.index('function buildCopyPayload'):coach.index('function copyToolbar')]
    assert "a.equipment" not in payload
    assert "meta=" not in payload

def test_global_module_copy_binding_runs_after_route_render():
    app=read('js/app.js')
    assert 'V14ModuleCopy' in app
    assert '.bind(main)' in app or '.bind(document)' in app

def test_f111_prep_submodules_have_generic_copy_buttons():
    coach=read('js/views-coach.js')
    assert 'coach-foam-' in coach
    assert 'coach-prep-' in coach
    assert '复制本模块' in coach

def test_rules_can_use_generic_module_copy_engine():
    rules=read('js/views-rules.js')
    assert 'V14ModuleCopy' in rules
    assert '复制本模块' in rules
