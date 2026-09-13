const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
])load(file);
const D=window.V14_DATA,Body=window.V15BodyResolver;

for(const id of ['backext_load_main','shanyan_tingshen','movement_supported_single_leg_hinge','movement_supported_db_single_leg_rdl','movement_db_single_leg_rdl','movement_advanced_db_single_leg_rdl']){
  assert(D.bodyActionMeta[id]?.variantGroup,`${id} must declare Body variantGroup`);
}
assert.strictEqual(D.bodyActionMeta.backext_load_main.variantGroup,D.bodyActionMeta.shanyan_tingshen.variantGroup);

for(const level of ['L2','L3','L4']){
  const session=Body.resolve({familyId:'BODY-02',level});
  const groups=session.main.content.map(slot=>D.bodyActionMeta[slot.actionId]?.variantGroup||slot.actionId);
  assert.strictEqual(new Set(groups).size,groups.length,`${level} auto Body session must not repeat an exercise variant family`);
  const ids=session.main.content.map(slot=>slot.actionId);
  assert(!(ids.includes('backext_load_main')&&ids.includes('shanyan_tingshen')),`${level} must not pair loaded and unloaded back extension`);
}

const isolation=Body.candidates({
  familyId:'BODY-02',level:'L3',slotKey:'ISOLATION-1',
  currentSelections:{PRIMARY:'backext_load_main'}
}).candidates.map(x=>x.actionId);
assert(!isolation.includes('shanyan_tingshen'),'candidate list must exclude same variant family already selected');

const manual=Body.resolve({
  familyId:'BODY-02',level:'L3',
  selections:{
    PRIMARY:{actionId:'backext_load_main',source:'manual'},
    'ISOLATION-1':{actionId:'shanyan_tingshen',source:'manual'}
  }
});
const iso=manual.main.content.find(x=>x.key==='ISOLATION-1');
assert.notStrictEqual(iso.actionId,'shanyan_tingshen','manual same-family duplicate must fallback safely');
assert(manual.warnings.some(x=>x.includes('BODY_VARIANT_FAMILY_FALLBACK:ISOLATION-1')));

console.log('body_variant_redundancy_test: PASS');
