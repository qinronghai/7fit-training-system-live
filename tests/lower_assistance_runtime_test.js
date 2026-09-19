const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const root=process.cwd();
const context={window:{},console};
const load=file=>vm.runInNewContext(fs.readFileSync(root+'/'+file,'utf8'),context,{filename:file});

load('data/system-data.js');
load('js/lower-assistance.js');

const A=context.window.V15LowerAssistance;
assert(A,'V15LowerAssistance must be exposed');

const catalog=A.catalog();
assert.strictEqual(catalog.title,'12｜下肢辅助与容量动作');
assert(catalog.total>=20,'shared lower assistance catalog should expose the audited lower accessory domain');
assert(catalog.entries.some(x=>x.id==='shengsuo_kuan_neishou'),'catalog must not be restricted to legacy composer lower pools');
assert(!catalog.entries.some(x=>x.id==='hake_shendun'),'main-only hack squat must not become an assistance catalog entry');

const legCurl=catalog.entries.find(x=>x.id==='tui_wanju');
assert.strictEqual(legCurl.functionalFamily,'KNEE_FLEXION');
assert(legCurl.trainingRoles.includes('LOCAL_VOLUME'));
assert(legCurl.consumers.f111D1);

const adduction=catalog.entries.find(x=>x.id==='shengsuo_kuan_neishou');
assert.strictEqual(adduction.functionalFamily,'HIP_ADDUCTION');
assert(adduction.levels.includes('L1')&&adduction.levels.includes('L4'));

const squatL3=A.candidates({
  consumer:'F111_D1',
  level:'L3',
  lowerMode:'squat',
  currentActionIds:['hake_shendun','feiji_labei_zhongba'],
});
const ids=squatL3.candidates.map(x=>x.actionId);
assert.strictEqual(ids[0],'tui_qushen','legacy default should stay first while the replacement pool expands');
assert(ids.includes('tui_wanju'));
assert(ids.includes('shengsuo_kuan_neishou'),'new shared-domain candidate should reach F111 D1');
assert(!ids.includes('hake_shendun'),'current main must not appear as D1');
assert(!ids.includes('gangling_yingla'),'high-fatigue main lift must not leak into D1');
assert(squatL3.candidates.every(x=>Array.isArray(x.reasons)&&Array.isArray(x.tradeoffs)));
assert(squatL3.candidates.every(x=>x.functionalFamily&&x.trainingRoles.length));

assert(A.isF111SelectionValid({
  actionId:'shengsuo_kuan_neishou',
  level:'L3',
  lowerMode:'squat',
  currentActionIds:['hake_shendun','feiji_labei_zhongba'],
}));
assert(!A.isF111SelectionValid({
  actionId:'hake_shendun',
  level:'L3',
  lowerMode:'squat',
  currentActionIds:['feiji_labei_zhongba'],
}));

console.log('lower_assistance_runtime_test: PASS');
