const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of ['data/system-data.js','js/conflict-core.js','js/conflict-service.js'])load(file);
assert(fs.existsSync(`${root}/js/conflict-plugins/body.js`),'Body conflict plugin file must exist');
load('js/conflict-plugins/body.js');

const D=window.V14_DATA,C=window.V15Conflict;
function slot(key,actionId){return {key,actionId};}
function baseSession({familyId='BODY-01',level='L1',items,volume}={}){
  const content=items||[
    slot('PRIMARY','tushen_shendun'),
    slot('SECONDARY','movement_supported_split_squat'),
    slot('ACCESSORY','tui_wanju'),
    slot('ISOLATION-1','tui_qushen'),
    slot('ISOLATION-2','kuangwai_zhan'),
  ];
  return {
    templateId:'body',familyId,level,
    main:{kind:'SLOT',content},
    domainContext:{kind:'BODY',slots:{},volume:volume||{
      totalWorkingSets:10,directSetsByTarget:{quadriceps:7},secondaryExposureByTarget:{},
      isolationWorkingSets:3,isolationRatio:0.3,highFatigueCompoundCount:0,estimatedMinutes:40
    }}
  };
}
function evaluate(session){
  return C.evaluate('body',session,{
    sharedPolicy:{allowedRoutes:['1F_ONLY','FLEX_1F_2F'],allowedStatuses:['可自动编排']}
  });
}
function codes(result){return result.issues.map(x=>x.code);}
function expectCode(result,code,severity){
  const issue=result.issues.find(x=>x.code===code);
  assert(issue,`expected ${code}: ${JSON.stringify(result)}`);
  assert.strictEqual(issue.severity,severity);
  return issue;
}

// Family deviation: a chest movement is not legal inside BODY-01 PRIMARY.
let result=evaluate(baseSession({items:[slot('PRIMARY','qixie_xiongtui'),slot('SECONDARY','movement_supported_split_squat')]}));
expectCode(result,'BODY_FAMILY_DEVIATION','hard');
assert.strictEqual(result.status,'FAIL');

// Primary target coverage is Direct Sets based, not Anatomy/secondary exposure.
result=evaluate(baseSession({volume:{totalWorkingSets:10,directSetsByTarget:{glute_max:10},secondaryExposureByTarget:{quadriceps:10},isolationWorkingSets:2,isolationRatio:0.2,highFatigueCompoundCount:0,estimatedMinutes:40}}));
expectCode(result,'BODY_PRIMARY_TARGET_MISSING','hard');

// Level working-set window is a hard contract.
result=evaluate(baseSession({volume:{totalWorkingSets:15,directSetsByTarget:{quadriceps:10},secondaryExposureByTarget:{},isolationWorkingSets:2,isolationRatio:2/15,highFatigueCompoundCount:0,estimatedMinutes:40}}));
expectCode(result,'BODY_VOLUME_OUT_OF_RANGE','hard');

// Domain quality warnings use the policy thresholds from body.json.
result=evaluate(baseSession({volume:{totalWorkingSets:10,directSetsByTarget:{quadriceps:10},secondaryExposureByTarget:{},isolationWorkingSets:2,isolationRatio:0.2,highFatigueCompoundCount:D.bodyConflictPolicy.maxHighFatigueCompounds+1,estimatedMinutes:40}}));
expectCode(result,'BODY_HIGH_FATIGUE_STACK','warn');
assert.strictEqual(result.status,'WARN');

result=evaluate(baseSession({items:[slot('PRIMARY','movement_bench_box_squat'),slot('SECONDARY','banjie_hake'),slot('ACCESSORY','hake_shendun')]}));
expectCode(result,'BODY_MOVEMENT_REDUNDANCY','warn');

result=evaluate(baseSession({volume:{totalWorkingSets:10,directSetsByTarget:{quadriceps:10},secondaryExposureByTarget:{},isolationWorkingSets:6,isolationRatio:0.6,highFatigueCompoundCount:0,estimatedMinutes:40}}));
expectCode(result,'BODY_ISOLATION_HEAVY','warn');

result=evaluate(baseSession({volume:{totalWorkingSets:10,directSetsByTarget:{quadriceps:10},secondaryExposureByTarget:{},isolationWorkingSets:2,isolationRatio:0.2,highFatigueCompoundCount:0,estimatedMinutes:55}}));
expectCode(result,'BODY_TIME_BUDGET','warn');

// Shared Core remains owner of generic integrity failures.
result=evaluate(baseSession({items:[slot('PRIMARY','tushen_shendun'),slot('SECONDARY','tushen_shendun')]}));
expectCode(result,'SHARED_DUPLICATE_ACTION','hard');

const originalRoute=D.actions.tushen_shendun.route;
D.actions.tushen_shendun.route='POST_CARDIO_ONLY';
result=evaluate(baseSession({items:[slot('PRIMARY','tushen_shendun'),slot('SECONDARY','movement_supported_split_squat')]}));
expectCode(result,'SHARED_ROUTE_ILLEGAL','hard');
D.actions.tushen_shendun.route=originalRoute;

const originalStatus=D.actions.tushen_shendun.status;
D.actions.tushen_shendun.status='禁止自动编排';
result=evaluate(baseSession({items:[slot('PRIMARY','tushen_shendun'),slot('SECONDARY','movement_supported_split_squat')]}));
expectCode(result,'SHARED_STATUS_UNAVAILABLE','hard');
D.actions.tushen_shendun.status=originalStatus;

console.log('body_conflict_plugin_test: PASS');
