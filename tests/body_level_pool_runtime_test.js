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
assert(Body&&typeof Body.assessLevelPoolEligibility==='function','#93 level-pool API missing');

function ids(input){return Body.candidates(input).candidates.map(x=>x.actionId);}
function selected(session,key){return session.main.content.find(x=>x.key===key)?.actionId||'';}

// BODY-01: learning -> basic external load -> formal hypertrophy -> full selection rights.
assert(ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('movement_bench_box_squat'));
assert(!ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('V13_SQ_DB_GOBLET'));
assert(!ids({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY'}).includes('hake_shendun'));
assert(ids({familyId:'BODY-01',level:'L2',slotKey:'PRIMARY'}).includes('V13_SQ_DB_GOBLET'));
assert(ids({familyId:'BODY-01',level:'L4',slotKey:'PRIMARY'}).includes('hake_shendun'));
assert(ids({familyId:'BODY-01',level:'L4',slotKey:'PRIMARY'}).includes('gangling_shendun'));
assert(!ids({familyId:'BODY-01',level:'L3',slotKey:'PRIMARY'}).includes('gangling_shendun'));

// BODY-02: L1 finally has hinge learning; DB RDL precedes trap-bar capability.
assert(ids({familyId:'BODY-02',level:'L1',slotKey:'PRIMARY'}).includes('movement_dowel_hip_hinge'));
assert(ids({familyId:'BODY-02',level:'L1',slotKey:'SECONDARY'}).includes('movement_supported_single_leg_hinge'));
assert(ids({familyId:'BODY-02',level:'L2',slotKey:'PRIMARY'}).includes('yaling_luomaniya_yingla'));
assert(!ids({familyId:'BODY-02',level:'L2',slotKey:'PRIMARY'}).includes('liujiao_gantui_yingla'));
assert(ids({familyId:'BODY-02',level:'L3',slotKey:'PRIMARY'}).includes('liujiao_gantui_yingla'));
assert(!ids({familyId:'BODY-02',level:'L3',slotKey:'PRIMARY'}).includes('gangling_yingla'));
assert(ids({familyId:'BODY-02',level:'L4',slotKey:'PRIMARY'}).includes('gangling_yingla'));

// BODY-03: actual learning entries and L4 endpoints are wired into Body.
assert(ids({familyId:'BODY-03',level:'L1',slotKey:'PRIMARY'}).includes('V13_HR_SCAP_ROW'));
assert(ids({familyId:'BODY-03',level:'L1',slotKey:'PRIMARY'}).includes('fuzhu_yinti_jianjia_xiachen'));
assert(!ids({familyId:'BODY-03',level:'L3',slotKey:'PRIMARY'}).includes('gangling_huachuan'));
assert(ids({familyId:'BODY-03',level:'L4',slotKey:'PRIMARY'}).includes('gangling_huachuan'));
assert(ids({familyId:'BODY-03',level:'L4',slotKey:'PRIMARY'}).includes('movement_bodyweight_pullup'));

// BODY-04: horizontal/vertical push chains now have real L3/L4 endpoints.
assert(ids({familyId:'BODY-04',level:'L3',slotKey:'SECONDARY'}).includes('movement_halfkneeling_landmine_press'));
assert(!ids({familyId:'BODY-04',level:'L3',slotKey:'PRIMARY'}).includes('gangling_wotu'));
assert(ids({familyId:'BODY-04',level:'L4',slotKey:'PRIMARY'}).includes('gangling_wotu'));
assert(ids({familyId:'BODY-04',level:'L4',slotKey:'SECONDARY'}).includes('movement_barbell_overhead_press'));

// #93 is layered under #68: a pool entry with the wrong Slot Intent still cannot leak through.
assert(!ids({familyId:'BODY-04',level:'L4',slotKey:'PRIMARY'}).includes('movement_barbell_overhead_press'));
assert(!ids({familyId:'BODY-01',level:'L4',slotKey:'ISOLATION-1'}).includes('gangling_shendun'));

// Pool explanation must distinguish preferred / introduced / retained and expose regression chain context.
const preferred=Body.assessLevelPoolEligibility({familyId:'BODY-01',level:'L2',slotKey:'PRIMARY',actionId:'V13_SQ_DB_GOBLET'});
assert.strictEqual(preferred.ok,true);
assert.strictEqual(preferred.preference,'preferred');
assert(preferred.reason.includes('优先池'));
assert(preferred.progression&&preferred.progression.chainId==='BODY01_KNEE_DOMINANT');
assert.strictEqual(preferred.progression.node.fallbackActionId,'movement_bench_box_squat');

const retained=Body.assessLevelPoolEligibility({familyId:'BODY-01',level:'L4',slotKey:'PRIMARY',actionId:'hake_shendun'});
assert.strictEqual(retained.ok,true);
assert.strictEqual(retained.preference,'preferred');
assert(retained.downwardCompatibleLevels.includes('L1'));
const excluded=Body.assessLevelPoolEligibility({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY',actionId:'hake_shendun'});
assert.strictEqual(excluded.ok,false);
assert(excluded.reasons.includes('BODY_LEVEL_POOL_EXCLUDED'));

// Candidate objects surface the #93 evidence consumed by #69 scoring and #70 UI.
const l2=Body.candidates({familyId:'BODY-01',level:'L2',slotKey:'PRIMARY'});
const goblet=l2.candidates.find(x=>x.actionId==='V13_SQ_DB_GOBLET');
assert(goblet?.levelPoolEligibility?.preference==='preferred');
assert(goblet.levelReason);
assert(goblet.reasons.some(x=>x.code==='LEVEL_POOL_PREFERRED'));

// Manual selection is subject to the same pool gate.
const rejected=R.resolve('body',{
  familyId:'BODY-01',level:'L3',
  selections:{PRIMARY:{source:'manual',actionId:'gangling_shendun'}}
});
assert.notStrictEqual(selected(rejected,'PRIMARY'),'gangling_shendun');
assert(rejected.warnings.includes('BODY_STALE_SELECTION_FALLBACK:PRIMARY'));

const accepted=R.resolve('body',{
  familyId:'BODY-01',level:'L4',
  selections:{PRIMARY:{source:'manual',actionId:'hake_shendun'}}
});
assert.strictEqual(selected(accepted,'PRIMARY'),'hake_shendun');

// Freeze the exact #93 16-state default session map after resolver-level review.
const EXPECTED_16_STATE={"BODY-01":{"L1":{"PRIMARY":"movement_bench_box_squat","SECONDARY":"movement_supported_split_squat","ACCESSORY":"kuangwai_zhan","ISOLATION-1":"tui_wanju","ISOLATION-2":"tunbu_houti"},"L2":{"PRIMARY":"V13_SQ_DB_GOBLET","SECONDARY":"movement_bodyweight_split_squat","ACCESSORY":"kuangwai_zhan","ISOLATION-1":"tui_qushen","ISOLATION-2":"tui_wanju"},"L3":{"PRIMARY":"hake_shendun","SECONDARY":"movement_dumbbell_reverse_lunge","ACCESSORY":"kuangwai_zhan","ISOLATION-1":"tui_wanju","ISOLATION-2":"tunbu_houti","OPTIONAL":"shengsuo_kuan_neishou"},"L4":{"PRIMARY":"hake_shendun","SECONDARY":"baojiayali_fentundun","ACCESSORY":"kuangwai_zhan","ISOLATION-1":"tui_wanju","ISOLATION-2":"tunbu_houti","OPTIONAL":"shengsuo_kuan_neishou"}},"BODY-02":{"L1":{"PRIMARY":"movement_dowel_hip_hinge","SECONDARY":"movement_supported_single_leg_hinge","ACCESSORY":"kuangwai_zhan","ISOLATION-1":"tui_wanju","ISOLATION-2":"tunbu_houti"},"L2":{"PRIMARY":"yaling_luomaniya_yingla","SECONDARY":"movement_supported_db_single_leg_rdl","ACCESSORY":"kuangwai_zhan","ISOLATION-1":"tui_wanju","ISOLATION-2":"tunbu_houti"},"L3":{"PRIMARY":"yaling_luomaniya_yingla","SECONDARY":"movement_db_single_leg_rdl","ACCESSORY":"kuangwai_zhan","ISOLATION-1":"tui_wanju","ISOLATION-2":"tunbu_houti","OPTIONAL":"shengsuo_kuan_neishou"},"L4":{"PRIMARY":"gangling_yingla","SECONDARY":"movement_advanced_db_single_leg_rdl","ACCESSORY":"kuangwai_zhan","ISOLATION-1":"tui_wanju","ISOLATION-2":"tunbu_houti","OPTIONAL":"shengsuo_kuan_neishou"}},"BODY-03":{"L1":{"PRIMARY":"V13_HR_SCAP_ROW","SECONDARY":"fuzhu_yinti_jianjia_xiachen","ACCESSORY":"shengsuo_cepingju","ISOLATION-1":"mianla","ISOLATION-2":"shengsuo_ertou_wanju"},"L2":{"PRIMARY":"feiji_labei_zhongba","SECONDARY":"gaowei_xiala_vba","ACCESSORY":"mianla","ISOLATION-1":"shengsuo_cepingju","ISOLATION-2":"shengsuo_ertou_wanju"},"L3":{"PRIMARY":"zuozi_huachuan_bianshi","SECONDARY":"fuzhu_yinti_xiangshang","ACCESSORY":"shengsuo_cepingju","ISOLATION-1":"mianla","ISOLATION-2":"shengsuo_ertou_wanju","OPTIONAL":"zhibi_xiala"},"L4":{"PRIMARY":"movement_bodyweight_pullup","SECONDARY":"gangling_huachuan","ACCESSORY":"shengsuo_cepingju","ISOLATION-1":"mianla","ISOLATION-2":"shengsuo_ertou_wanju","OPTIONAL":"zhibi_xiala"}},"BODY-04":{"L1":{"PRIMARY":"movement_incline_pushup","SECONDARY":"qixie_jian_tui","ACCESSORY":"shengsuo_cepingju","ISOLATION-1":"shengsuo_ertou_wanju","ISOLATION-2":"shengsuo_santou_xiaya"},"L2":{"PRIMARY":"qixie_xiongtui","SECONDARY":"qixie_jian_tui","ACCESSORY":"shengsuo_cepingju","ISOLATION-1":"shengsuo_ertou_wanju","ISOLATION-2":"shengsuo_santou_xiaya"},"L3":{"PRIMARY":"wotu_xiong_tui","SECONDARY":"movement_halfkneeling_landmine_press","ACCESSORY":"shengsuo_cepingju","ISOLATION-1":"shengsuo_ertou_wanju","ISOLATION-2":"shengsuo_santou_xiaya","OPTIONAL":"xiongjia_jiaxiong"},"L4":{"PRIMARY":"qixie_xiongtui","SECONDARY":"movement_halfkneeling_landmine_press","ACCESSORY":"shengsuo_cepingju","ISOLATION-1":"shengsuo_ertou_wanju","ISOLATION-2":"shengsuo_santou_xiaya","OPTIONAL":"xiongjia_jiaxiong"}}};
const snapshot={};
for(const familyId of D.bodyFamilyIds){
  snapshot[familyId]={};
  for(const level of ['L1','L2','L3','L4']){
    const session=R.resolve('body',{familyId,level});
    snapshot[familyId][level]=Object.fromEntries(session.main.content.map(x=>[x.key,x.actionId]));
  }
}
assert.strictEqual(Object.values(snapshot).reduce((n,x)=>n+Object.keys(x).length,0),16);
assert.deepStrictEqual(snapshot,EXPECTED_16_STATE,'#93 Body 16-state default session snapshot drifted');
for(const familyId of D.bodyFamilyIds){
  const primaryAcross=Object.values(snapshot[familyId]).map(x=>x.PRIMARY);
  assert(new Set(primaryAcross).size>=2,`${familyId} primary defaults must change across levels`);
}
console.log('ISSUE93_16_STATE_SNAPSHOT='+JSON.stringify(snapshot));
console.log('body_level_pool_runtime_test: PASS');
