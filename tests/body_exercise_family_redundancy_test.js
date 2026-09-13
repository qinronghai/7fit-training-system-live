const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js',
  'js/conflict-plugins/body.js','js/template-resolver.js','js/resolvers/body.js'
]) load(file);

const D=window.V14_DATA,Body=window.V15BodyResolver,Dispatcher=window.V15TemplateResolver;

function ids(input){return Body.candidates(input).candidates.map(x=>x.actionId);}

// Exact bug regression: loaded back extension as PRIMARY must remove unloaded back extension from later slots.
const accessoryIds=ids({
  familyId:'BODY-02',level:'L3',slotKey:'ACCESSORY',
  currentSelections:{PRIMARY:'backext_load_main'}
});
assert(!accessoryIds.includes('shanyan_tingshen'),
  'same exercise family must not stack: backext_load_main + shanyan_tingshen');

// Reverse direction must also be protected.
const primaryIds=ids({
  familyId:'BODY-02',level:'L3',slotKey:'PRIMARY',
  currentSelections:{ACCESSORY:'shanyan_tingshen'}
});
assert(!primaryIds.includes('backext_load_main'),
  'same exercise family must not stack in reverse order');

// Progression variants should be treated as one movement family, not separate legal volume sources.
const singleLegRdlIds=ids({
  familyId:'BODY-02',level:'L4',slotKey:'ACCESSORY',
  currentSelections:{SECONDARY:'movement_db_single_leg_rdl'}
});
for(const duplicate of [
  'movement_supported_single_leg_hinge',
  'movement_supported_db_single_leg_rdl',
  'movement_advanced_db_single_leg_rdl'
]){
  assert(!singleLegRdlIds.includes(duplicate),`single-leg RDL progression duplicate leaked: ${duplicate}`);
}

// Resolver must clean stale/manual same-family intent rather than accepting both.
const session=Dispatcher.resolve('body',{
  familyId:'BODY-02',level:'L3',
  selections:{
    PRIMARY:{actionId:'backext_load_main',source:'manual'},
    ACCESSORY:{actionId:'shanyan_tingshen',source:'manual'}
  }
});
const selected=session.main.content.map(x=>x.actionId);
assert(selected.includes('backext_load_main'),'PRIMARY manual intent should remain');
assert(!selected.includes('shanyan_tingshen'),'later stale same-family manual intent must fallback');
assert(session.warnings.some(x=>x.includes('BODY_STALE_SELECTION_FALLBACK:ACCESSORY')),
  'same-family stale manual fallback should be explicit');

// All auto baselines must contain no duplicate Body exercise family.
for(const familyId of D.bodyFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const resolved=Dispatcher.resolve('body',{familyId,level});
    const groups=resolved.main.content
      .map(slot=>D.bodyActionMeta[slot.actionId]?.redundancyGroup||'')
      .filter(Boolean);
    assert.strictEqual(new Set(groups).size,groups.length,`${familyId} ${level} duplicate redundancyGroup`);
  }
}
console.log('body_exercise_family_redundancy_test: PASS');
