const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

load('data/system-data.js');
assert(fs.existsSync(`${root}/js/body-volume.js`),'Body volume module must exist');
load('js/body-volume.js');

const V=window.V15BodyVolume;
assert(V&&typeof V.buildSlot==='function'&&typeof V.summarize==='function');

// BODY-01 L3 SECONDARY is 3 sets; supported split squat is unilateral and directly trains quads + glute max.
const unilateral=V.buildSlot({level:'L3',slotKey:'SECONDARY',role:'SECONDARY',actionId:'movement_supported_split_squat'});
assert.strictEqual(unilateral.workingSets,3);
assert.strictEqual(unilateral.perSide,true);
assert.strictEqual(unilateral.laterality,'unilateral');
assert(unilateral.directTargets.includes('quadriceps'));
assert(unilateral.directTargets.includes('glute_max'));

const one=V.summarize({SECONDARY:unilateral});
assert.strictEqual(one.totalWorkingSets,3,'3 sets/side must count once, not 6');
assert.strictEqual(one.directSetsByTarget.quadriceps,3);
assert.strictEqual(one.directSetsByTarget.glute_max,3);
assert.strictEqual(one.secondaryExposureByTarget.adductors,3);

// Multi-label direct targets must never be summed back into totalWorkingSets.
assert.strictEqual(Object.values(one.directSetsByTarget).reduce((a,b)=>a+b,0),6);
assert.strictEqual(one.totalWorkingSets,3);

// Secondary exposure from machine chest press stays separate from Direct Sets.
const press=V.buildSlot({level:'L1',slotKey:'PRIMARY',role:'PRIMARY',actionId:'qixie_xiongtui'});
const pressSummary=V.summarize({PRIMARY:press});
assert.strictEqual(pressSummary.totalWorkingSets,3);
assert.strictEqual(pressSummary.directSetsByTarget.chest,3);
assert.strictEqual(pressSummary.directSetsByTarget.triceps,3);
assert.strictEqual(pressSummary.directSetsByTarget.front_delts||0,0);
assert.strictEqual(pressSummary.secondaryExposureByTarget.front_delts,3);

// Isolation ratio is based on working sets, not action count.
const iso1=V.buildSlot({level:'L3',slotKey:'ISOLATION-1',role:'ISOLATION',actionId:'shengsuo_cepingju'});
const iso2=V.buildSlot({level:'L3',slotKey:'ISOLATION-2',role:'ISOLATION',actionId:'shengsuo_ertou_wanju'});
const mixed=V.summarize({PRIMARY:press,'ISOLATION-1':iso1,'ISOLATION-2':iso2});
assert.strictEqual(mixed.totalWorkingSets,7);
assert.strictEqual(mixed.isolationWorkingSets,4);
assert.strictEqual(mixed.isolationRatio,4/7);

// Human prescription strings are presentation only and cannot affect structured volume.
const before=V.summarize({SECONDARY:{...unilateral,prescription:'3 × 8–12 / side'}});
const after=V.summarize({SECONDARY:{...unilateral,prescription:'CORRUPTED HUMAN TEXT 999 × 999'}});
assert.deepStrictEqual(after,before);

// Deterministic V1 time heuristic for a single slot.
const midReps=(unilateral.repRange[0]+unilateral.repRange[1])/2;
const midRest=(unilateral.restSecondsRange[0]+unilateral.restSecondsRange[1])/2;
const expectedSeconds=unilateral.workingSets*(midReps*4+45)+(unilateral.workingSets-1)*midRest;
assert.strictEqual(one.estimatedMinutes,Math.ceil(expectedSeconds/60));

console.log('body_volume_runtime_test: PASS');
