const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
  'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js'
])load(file);

const D=window.V14_DATA,C=window.V15Conflict,R=window.V15TemplateResolver;
function plain(v){return JSON.parse(JSON.stringify(v));}
function evalSession(session){
  return C.evaluate('conditioning',session,{
    sharedPolicy:{allowedRoutes:['CONDITIONING_2F'],allowedStatuses:['可自动编排']}
  });
}
function find(result,code){
  const hit=result.issues.find(x=>x.code===code);
  assert(hit,`expected ${code}: ${JSON.stringify(result)}`);
  return hit;
}

// Auto baselines must remain non-failing.
for(const familyId of D.conditioningFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const session=R.resolve('conditioning',{familyId,level,variantId:'A'});
    assert.notStrictEqual(session.conflictContext.status,'FAIL',`${familyId} ${level}`);
  }
}

let session=plain(R.resolve('conditioning',{familyId:'CON-04',level:'L3',variantId:'A'}));
session.blocks[0].protocolId='DENSITY';
let result=evalSession(session);
assert.strictEqual(find(result,'COND_PROTOCOL_ILLEGAL').severity,'hard');
assert.strictEqual(result.status,'FAIL');

session=plain(R.resolve('conditioning',{familyId:'CON-04',level:'L3',variantId:'A'}));
const firstBlock=session.blocks[0],firstKey=Object.keys(firstBlock.stations)[0];
firstBlock.stations[firstKey].actionId='huaxueji_wentai';
firstBlock.stations[firstKey].name=D.actions.huaxueji_wentai.name;
result=evalSession(session);
assert.strictEqual(find(result,'COND_STATION_ILLEGAL').severity,'hard');

session=plain(R.resolve('conditioning',{familyId:'CON-02',level:'L1',variantId:'A'}));
session.blocks[0].stations[Object.keys(session.blocks[0].stations)[0]].impact='high';
result=evalSession(session);
assert.strictEqual(find(result,'COND_IMPACT_CEILING').severity,'hard');

session=plain(R.resolve('conditioning',{familyId:'CON-02',level:'L2',variantId:'A'}));
session.blocks[0].metrics.workSeconds=999;
result=evalSession(session);
assert.strictEqual(find(result,'COND_WORK_REST_POLICY').severity,'hard');

session=plain(R.resolve('conditioning',{familyId:'CON-04',level:'L3',variantId:'A'}));
const con04=session.blocks.flatMap(block=>Object.values(block.stations));
assert(con04.length>=3);
con04[0].fatigueRisk='high';
con04[1].powerEligible=true;
con04[1].fatigueRisk='medium';
result=evalSession(session);
assert.strictEqual(find(result,'COND_POWER_AFTER_FATIGUE').severity,'warn');

session=plain(R.resolve('conditioning',{familyId:'CON-03',level:'L3',variantId:'A'}));
for(const station of session.blocks.flatMap(block=>Object.values(block.stations)))station.primaryModality='CYCLICAL';
const circuit=session.blocks.find(block=>block.protocolId==='CIRCUIT');
assert(circuit,'test blueprint must retain a Circuit block');
for(const station of Object.values(circuit.stations))station.primaryModality='CYCLICAL';
result=evalSession(session);
assert.strictEqual(find(result,'COND_MODALITY_REDUNDANCY').severity,'warn');
assert.strictEqual(find(result,'COND_CIRCUIT_MODALITY_DIVERSITY').severity,'warn');

session=plain(R.resolve('conditioning',{familyId:'CON-03',level:'L3',variantId:'A'}));
session.domainContext.metrics.estimatedMinutes=99;
result=evalSession(session);
assert.strictEqual(find(result,'COND_TIME_BUDGET').severity,'warn');

// Shared core still owns generic duplicate-action integrity.
session=plain(R.resolve('conditioning',{familyId:'CON-03',level:'L3',variantId:'A'}));
const items=session.main.content.blocks.flatMap(block=>block.items);
assert(items.length>=2);
items[1].actionId=items[0].actionId;
result=evalSession(session);
assert.strictEqual(find(result,'SHARED_DUPLICATE_ACTION').severity,'hard');

console.log('conditioning_conflict_plugin_test: PASS');
