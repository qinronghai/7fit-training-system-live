const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
])load(file);

const D=window.V14_DATA,Body=window.V15BodyResolver,R=window.V15TemplateResolver;
assert(Body&&typeof Body.assessLevelEligibility==='function','Body Level eligibility API missing');

for(const level of ['L1','L2','L3','L4']){
  const p=D.bodyLevelPolicies[level];
  assert(p.name&&p.abilityIntent);
  assert(Array.isArray(p.eligibleEntryLevels)&&p.eligibleEntryLevels.length);
  assert(Array.isArray(p.allowedLoadingStyles)&&p.allowedLoadingStyles.includes('stable_machine'),
    level+' must keep stable machine work eligible');
  assert(p.maxStabilityDemand);
  assert(p.maxCompoundFatigue);
  assert(p.unilateralReadiness);
  assert(p.romExpectation);
  assert(Array.isArray(p.tempoPauseEligibility)&&p.tempoPauseEligibility.length);
  assert(Array.isArray(p.intensityTechniqueEligibility)&&p.intensityTechniqueEligibility.length);
  assert(/^L[1-4]$/.test(p.fallbackLevel));
}

// Known venue-sensitive squat is no longer an L1-qualified action.
const partialHackL1=Body.assessLevelEligibility({level:'L1',actionId:'banjie_hake'});
assert.strictEqual(partialHackL1.ok,false);
assert(partialHackL1.reasons.includes('BODY_LEVEL_NOT_LISTED'));

// Level Contract adds a real gate beyond the old levels[] whitelist.
const smithL1=Body.assessLevelEligibility({level:'L1',actionId:'smith_wotu'});
assert.strictEqual(smithL1.ok,false);
assert(smithL1.reasons.includes('BODY_LEVEL_FATIGUE'),'L1 must reject high-fatigue compound work');
const smithL2=Body.assessLevelEligibility({level:'L2',actionId:'smith_wotu'});
assert.strictEqual(smithL2.ok,true,'L2 can admit the same stable high-fatigue compound if its action whitelist allows it');

// L1 still allows appropriate stable machines; "beginner" does not mean "no machine".
const machinePressL1=Body.assessLevelEligibility({level:'L1',actionId:'qixie_xiongtui'});
assert.strictEqual(machinePressL1.ok,true);
assert.strictEqual(machinePressL1.loadingStyle,'stable_machine');

// L4 keeps stable effective machines legal instead of forcing complexity.
const hackL4=Body.assessLevelEligibility({level:'L4',actionId:'hake_shendun'});
assert.strictEqual(hackL4.ok,true,'L4 must keep hack squat legal');
assert.strictEqual(hackL4.actionEntryLevel,'L2');

// Candidate API explains Level fit.
const l4Primary=Body.candidates({familyId:'BODY-01',level:'L4',slotKey:'PRIMARY'});
const l4Hack=l4Primary.candidates.find(x=>x.actionId==='hake_shendun');
assert(l4Hack,'L4 BODY-01 should still expose hack squat');
assert(l4Hack.levelEligibility?.qualifiedBy?.length,'candidate must explain level qualification');
assert(l4Hack.levelReason);

// Auto programming must use Level as an action-qualification/ranking input, not only a volume input.
const l1=R.resolve('body',{familyId:'BODY-01',level:'L1'});
const l3=R.resolve('body',{familyId:'BODY-01',level:'L3'});
const l4=R.resolve('body',{familyId:'BODY-01',level:'L4'});
const pair=s=>s.main.content.filter(x=>x.key==='PRIMARY'||x.key==='SECONDARY').map(x=>x.actionId).join('|');
assert.notStrictEqual(pair(l1),pair(l3),'BODY-01 L1 and L3 must not reuse the exact same default main pair');
assert.notStrictEqual(pair(l1),pair(l4),'BODY-01 L1 and L4 must not reuse the exact same default main pair');
assert.notStrictEqual(l1.domainContext.levelContract.name,l4.domainContext.levelContract.name);

// Manual swaps go through the same Level gate and fall back safely.
const rejectedManual=R.resolve('body',{
  familyId:'BODY-04',level:'L1',
  selections:{PRIMARY:{source:'manual',actionId:'smith_wotu'}}
});
assert.notStrictEqual(rejectedManual.main.content.find(x=>x.key==='PRIMARY').actionId,'smith_wotu');
assert(rejectedManual.warnings.includes('BODY_STALE_SELECTION_FALLBACK:PRIMARY'));

const acceptedManual=R.resolve('body',{
  familyId:'BODY-01',level:'L4',
  selections:{PRIMARY:{source:'manual',actionId:'hake_shendun'}}
});
assert.strictEqual(acceptedManual.main.content.find(x=>x.key==='PRIMARY').actionId,'hake_shendun');

console.log('body_level_contract_runtime_test: L1-L4 capability eligibility GREEN');
