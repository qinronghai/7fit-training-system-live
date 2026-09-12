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
    const session=R.resolve('conditioning',{familyId,level});
    assert.notStrictEqual(session.conflictContext.status,'FAIL',`${familyId} ${level}`);
  }
}

let session=plain(R.resolve('conditioning',{familyId:'CON-04',level:'L3'}));
session.domainContext.protocolId='DENSITY';
let result=evalSession(session);
assert.strictEqual(find(result,'COND_PROTOCOL_ILLEGAL').severity,'hard');
assert.strictEqual(result.status,'FAIL');

session=plain(R.resolve('conditioning',{familyId:'CON-04',level:'L3'}));
const firstKey=Object.keys(session.domainContext.stations)[0];
session.domainContext.stations[firstKey].actionId='huaxueji_wentai';
session.domainContext.stations[firstKey].name=D.actions.huaxueji_wentai.name;
result=evalSession(session);
assert.strictEqual(find(result,'COND_STATION_ILLEGAL').severity,'hard');

session=plain(R.resolve('conditioning',{familyId:'CON-02',level:'L1'}));
session.domainContext.stations[Object.keys(session.domainContext.stations)[0]].impact='high';
result=evalSession(session);
assert.strictEqual(find(result,'COND_IMPACT_CEILING').severity,'hard');

session=plain(R.resolve('conditioning',{familyId:'CON-02',level:'L2'}));
session.domainContext.metrics.workSeconds=999;
result=evalSession(session);
assert.strictEqual(find(result,'COND_WORK_REST_POLICY').severity,'hard');

session=plain(R.resolve('conditioning',{familyId:'CON-04',level:'L3'}));
const con04=Object.values(session.domainContext.stations);
assert(con04.length>=3);
con04[0].fatigueRisk='high';
con04[1].powerEligible=true;
result=evalSession(session);
assert.strictEqual(find(result,'COND_POWER_AFTER_FATIGUE').severity,'warn');

session=plain(R.resolve('conditioning',{familyId:'CON-03',level:'L3'}));
for(const station of Object.values(session.domainContext.stations))station.primaryModality='CYCLICAL';
result=evalSession(session);
assert.strictEqual(find(result,'COND_MODALITY_REDUNDANCY').severity,'warn');
assert.strictEqual(find(result,'COND_CIRCUIT_MODALITY_DIVERSITY').severity,'warn');

session=plain(R.resolve('conditioning',{familyId:'CON-03',level:'L3'}));
session.domainContext.metrics.estimatedMinutes=99;
result=evalSession(session);
assert.strictEqual(find(result,'COND_TIME_BUDGET').severity,'warn');

// Shared core still owns generic duplicate-action integrity.
session=plain(R.resolve('conditioning',{familyId:'CON-03',level:'L3'}));
const items=session.main.content.blocks[0].items;
assert(items.length>=2);
items[1].actionId=items[0].actionId;
result=evalSession(session);
assert.strictEqual(find(result,'SHARED_DUPLICATE_ACTION').severity,'hard');

console.log('conditioning_conflict_plugin_test: PASS');
