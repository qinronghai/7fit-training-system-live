const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
]) load(file);

const D=window.V14_DATA,R=window.V15TemplateResolver,Plugin=window.V15BodyConflictPlugin;
const clone=v=>JSON.parse(JSON.stringify(v));
const codes=session=>Plugin.evaluate(session).map(x=>x.code);

function setAction(session,slotKey,actionId){
  const copy=clone(session);
  const slot=copy.main.content.find(x=>x.key===slotKey);
  assert(slot,`slot ${slotKey} missing`);
  slot.actionId=actionId;
  slot.name=D.actions[actionId]?.name||actionId;
  return copy;
}

const base04=R.resolve('body',{familyId:'BODY-04',level:'L2'});

// Ordinary triceps isolation in PRIMARY is a hard Slot Intent mismatch.
let invalid=setAction(base04,'PRIMARY','shengsuo_santou_xiaya');
assert(codes(invalid).includes('BODY_SLOT_INTENT_MISMATCH'));

// A machine chest press + dumbbell flat press pair is legal by old Role/Target rules but too similar in V2.
let similar=setAction(base04,'PRIMARY','qixie_xiongtui');
similar=setAction(similar,'SECONDARY','wotu_xiong_tui');
assert(codes(similar).includes('BODY_PRIMARY_SECONDARY_TOO_SIMILAR'));

// ACCESSORY cannot become a third compound press repeating the main pathway.
let collapsed=setAction(base04,'PRIMARY','qixie_xiongtui');
collapsed=setAction(collapsed,'SECONDARY','qixie_jian_tui');
collapsed=setAction(collapsed,'ACCESSORY','movement_incline_pushup');
assert(codes(collapsed).includes('BODY_ACCESSORY_ROLE_COLLAPSE'));

// Repeated direct-target exposure remains a warning, not an opaque score.
let redundant=clone(base04);
const replacements={
  PRIMARY:'qixie_xiongtui',
  SECONDARY:'wotu_xiong_tui',
  ACCESSORY:'movement_incline_pushup',
  'ISOLATION-1':'xiongjia_jiaxiong',
};
for(const [slotKey,actionId] of Object.entries(replacements)){
  const slot=redundant.main.content.find(x=>x.key===slotKey);
  slot.actionId=actionId;
  slot.name=D.actions[actionId]?.name||actionId;
}
const redundancy=Plugin.evaluate(redundant).find(x=>x.code==='BODY_SESSION_TARGET_REDUNDANCY');
assert(redundancy,'four direct chest slots must trigger target redundancy');
assert.strictEqual(redundancy.severity,'warn');

// Generated sessions must not contain any of the new hard semantic conflicts.
for(const familyId of D.bodyFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const session=R.resolve('body',{familyId,level});
    const issueCodes=new Set(session.conflictContext.issues.map(x=>x.code));
    for(const forbidden of [
      'BODY_SLOT_INTENT_MISMATCH',
      'BODY_PRIMARY_SECONDARY_TOO_SIMILAR',
      'BODY_ACCESSORY_ROLE_COLLAPSE',
    ]){
      assert(!issueCodes.has(forbidden),`${familyId} ${level} unexpectedly emitted ${forbidden}`);
    }
  }
}

console.log('body_slot_intent_conflict_test: conflict codes GREEN');
