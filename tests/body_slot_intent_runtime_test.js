const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
]) load(file);

const D=window.V14_DATA,Body=window.V15BodyResolver,R=window.V15TemplateResolver;
const slots=['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2','OPTIONAL'];

assert(Body&&typeof Body.assessSlotIntent==='function','Body V2 must expose assessSlotIntent');
assert(typeof Body.pairSimilarity==='function','Body V2 must expose pairSimilarity');

// Every Family declares a complete, identity-safe Slot Intent contract.
for(const familyId of D.bodyFamilyIds){
  const family=D.bodyFamilies[familyId];
  assert.deepStrictEqual(Object.keys(family.slotIntents),slots,`${familyId} must declare all six slot intents`);
  const intentIds=new Set();
  for(const slotKey of slots){
    const intent=family.slotIntents[slotKey];
    assert.strictEqual(intent.slotKey,slotKey);
    assert.strictEqual(intent.role,family.slotPolicy[slotKey]);
    assert(intent.intentId);
    assert(!intentIds.has(intent.intentId),`duplicate intentId ${intent.intentId}`);
    intentIds.add(intent.intentId);
    assert(intent.allowedExerciseClasses.length>0);
  }
}

// BODY-04 PRIMARY is a main press, not "anything that trains a primary target".
assert.strictEqual(Body.isSelectionValid({
  familyId:'BODY-04',level:'L2',slotKey:'PRIMARY',actionId:'shengsuo_santou_xiaya'
}),false,'triceps isolation must never become BODY-04 PRIMARY');
const primaryAssessment=Body.assessSlotIntent({
  familyId:'BODY-04',level:'L2',slotKey:'PRIMARY',actionId:'shengsuo_santou_xiaya'
});
assert(primaryAssessment.reasons.includes('BODY_SLOT_INTENT_EXERCISE_CLASS'));
assert(primaryAssessment.reasons.includes('BODY_SLOT_INTENT_TARGET'));

// BODY-04 SECONDARY blocks a near-duplicate flat press but preserves a meaningful angle/direction option.
const body04Secondary=Body.candidates({
  familyId:'BODY-04',level:'L2',slotKey:'SECONDARY',
  currentSelections:{PRIMARY:'qixie_xiongtui'}
});
const body04SecondaryIds=body04Secondary.candidates.map(x=>x.actionId);
assert(!body04SecondaryIds.includes('wotu_xiong_tui'),'same-direction flat press must be blocked beside machine chest press');
assert(body04SecondaryIds.includes('shangxie_yaling_wotu'),'incline press should remain a legitimate changed-angle option');
assert(body04SecondaryIds.includes('yaling_jiantui'),'vertical press should remain a legitimate changed-direction option on a different station');

// BODY-03 intentionally forms horizontal + vertical pulling directions.
const body03Secondary=Body.candidates({
  familyId:'BODY-03',level:'L3',slotKey:'SECONDARY',
  currentSelections:{PRIMARY:'feiji_labei_zhongba'}
});
assert(body03Secondary.candidates.length>=2);
assert(body03Secondary.candidates.every(x=>x.pattern==='垂直拉'),'BODY-03 SECONDARY must change pull direction when PRIMARY is horizontal');

// BODY-02 L1 remains resolvable after the diversity gate by using the audited back-extension secondary role.
const body02L1=R.resolve('body',{familyId:'BODY-02',level:'L1'});
const body02Selections=Object.fromEntries(body02L1.main.content.map(x=>[x.key,x.actionId]));
assert(body02Selections.PRIMARY&&body02Selections.SECONDARY);
assert.notStrictEqual(D.actions[body02Selections.PRIMARY].pattern,D.actions[body02Selections.SECONDARY].pattern,
  'BODY-02 L1 main pair must provide an effective posterior-chain direction difference');

// BODY-04 ACCESSORY has a low-fatigue shoulder option instead of falling back to a third main press.
const body04Accessory=Body.candidates({
  familyId:'BODY-04',level:'L2',slotKey:'ACCESSORY',
  currentSelections:{PRIMARY:'qixie_xiongtui',SECONDARY:'qixie_jian_tui'}
});
assert(body04Accessory.candidates.some(x=>x.actionId==='V13_VP_SEATED_LIGHT_DB'));
assert(!body04Accessory.candidates.some(x=>x.actionId==='movement_incline_pushup'),
  'compound horizontal press must not collapse ACCESSORY into another main press');

// Manual near-duplicate SECONDARY goes through the same contextual gate and falls back safely.
const manual=R.resolve('body',{
  familyId:'BODY-04',level:'L2',
  selections:{
    PRIMARY:{source:'manual',actionId:'qixie_xiongtui'},
    SECONDARY:{source:'manual',actionId:'wotu_xiong_tui'}
  }
});
assert.strictEqual(manual.main.content.find(x=>x.key==='PRIMARY').actionId,'qixie_xiongtui');
assert.notStrictEqual(manual.main.content.find(x=>x.key==='SECONDARY').actionId,'wotu_xiong_tui');
assert(manual.warnings.includes('BODY_STALE_SELECTION_FALLBACK:SECONDARY'));

// All 16 generated states satisfy Slot Intent progressively and resolve deterministically.
for(const familyId of D.bodyFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const first=R.resolve('body',{familyId,level});
    const second=R.resolve('body',{familyId,level});
    assert.deepStrictEqual(second,first,`${familyId} ${level} must remain deterministic`);
    const current={};
    for(const item of first.main.content){
      const assessment=Body.assessSlotIntent({
        familyId,level,slotKey:item.key,actionId:item.actionId,currentSelections:current
      });
      assert.strictEqual(assessment.ok,true,
        `${familyId} ${level} ${item.key} violates ${assessment.reasons.join(',')}`);
      current[item.key]=item.actionId;
    }
    assert.notStrictEqual(first.conflictContext.status,'FAIL',
      `${familyId} ${level} auto session must not produce hard conflict`);
  }
}

console.log('body_slot_intent_runtime_test: 16-state Slot Intent GREEN');
