const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

load('data/system-data.js');
load('js/resolved-session.js');
load('js/template-resolver.js');
load('js/resolvers/body.js');

const D=window.V14_DATA;
const Body=window.V15BodyResolver;
assert(Body&&typeof Body.candidates==='function','Body candidate API must exist');

function ids(input){return Body.candidates(input).candidates.map(x=>x.actionId);}

const body01L1Primary=Body.candidates({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY',currentSelections:{}});
assert(body01L1Primary.candidates.length>=2,'BODY-01 L1 PRIMARY must expose at least two candidates');
assert(body01L1Primary.recommended,'BODY-01 L1 PRIMARY must recommend one action');
assert(body01L1Primary.candidates.every(x=>x.role==='PRIMARY'));
assert(ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('tushen_shendun'),'tushen_shendun should be legal BODY-01 L1 PRIMARY');
assert(!ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('hake_shendun'),'hake_shendun must be excluded from L1');
assert(!ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('qixie_xiongtui'),'wrong-family action must be excluded');
assert(!ids({familyId:'BODY-01',level:'L1',slotKey:'ISOLATION-1'}).includes('movement_bench_box_squat'),'wrong-role action must be excluded');

for(const candidate of body01L1Primary.candidates){
  const meta=D.bodyActionMeta[candidate.actionId],action=D.actions[candidate.actionId];
  assert(meta.families.includes('BODY-01'));
  assert(meta.levels.includes('L1'));
  assert(meta.roles.includes('PRIMARY'));
  assert(['1F_ONLY','FLEX_1F_2F'].includes(action.route));
  assert.strictEqual(action.status,'可自动编排');
  assert(meta.directTargets.some(target=>D.bodyFamilies['BODY-01'].primaryTargets.includes(target)),'PRIMARY must hit Family primary target');
}

const originalStatus=D.actions.tushen_shendun.status;
D.actions.tushen_shendun.status='禁止自动编排';
assert(!ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('tushen_shendun'),'non-auto status must be rejected');
D.actions.tushen_shendun.status=originalStatus;

const originalRoute=D.actions.tushen_shendun.route;
D.actions.tushen_shendun.route='POST_CARDIO_ONLY';
assert(!ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('tushen_shendun'),'illegal Body main route must be rejected');
D.actions.tushen_shendun.route=originalRoute;

const originalTargets=D.bodyActionMeta.tushen_shendun.directTargets.slice();
D.bodyActionMeta.tushen_shendun.directTargets=['glute_max'];
assert(!ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('tushen_shendun'),'PRIMARY without Family primary-target overlap must be rejected');
D.bodyActionMeta.tushen_shendun.directTargets=originalTargets;

const first=Body.candidates({familyId:'BODY-03',level:'L3',slotKey:'SECONDARY',currentSelections:{PRIMARY:'feiji_labei_zhongba'}});
const second=Body.candidates({familyId:'BODY-03',level:'L3',slotKey:'SECONDARY',currentSelections:{PRIMARY:'feiji_labei_zhongba'}});
assert.deepStrictEqual(second,first,'candidate ordering must be deterministic');
assert(first.candidates.length>=2);
for(let i=1;i<first.candidates.length;i++){
  assert.notStrictEqual(first.candidates[i-1].actionId,first.candidates[i].actionId,'candidate IDs must be unique');
}

for(const bad of [
  {familyId:'BODY-99',level:'L1',slotKey:'PRIMARY'},
  {familyId:'BODY-01',level:'L9',slotKey:'PRIMARY'},
  {familyId:'BODY-01',level:'L1',slotKey:'MAGIC'}
]){
  let thrown=null;
  try{Body.candidates(bad);}catch(error){thrown=error;}
  assert(thrown,'invalid Body candidate request must throw');
  assert.strictEqual(thrown.code,'BODY_INPUT_INVALID');
}

console.log('body_candidate_runtime_test: PASS');
