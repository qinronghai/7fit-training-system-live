const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
]) load(file);

const D=window.V14_DATA,Body=window.V15BodyResolver,Compat=window.V15BodyCompatibility,R=window.V15TemplateResolver;
assert(Compat&&typeof Compat.scoreCandidate==='function','Body Compatibility service must exist');
assert(Compat.policy&&Compat.policy.weights,'Compatibility weights must be centralized');
assert.deepStrictEqual(Object.keys(Compat.policy.weights),[
  'slotFit','targetComplement','patternNovelty','exerciseSimilarity','fatigueOverlap','sessionBalance','progressionSuitability'
]);

function scoreSnapshot(input){
  return Body.candidates(input).candidates.map(candidate=>({
    actionId:candidate.actionId,
    score:candidate.recommendationScore,
    components:candidate.components,
    reasons:candidate.reasons,
    tradeoffs:candidate.tradeoffs,
    levelEligibility:candidate.levelEligibility,
  }));
}

const input={
  familyId:'BODY-04',level:'L2',slotKey:'SECONDARY',
  currentSelections:{PRIMARY:'qixie_xiongtui'}
};
const first=scoreSnapshot(input),second=scoreSnapshot(input);
assert.deepStrictEqual(second,first,'Compatibility score must be deterministic');
assert(first.length>=2,'BODY-04 L2 SECONDARY must expose representative candidates');
for(let i=0;i<first.length;i++){
  const item=first[i];
  assert(Number.isFinite(item.score),`${item.actionId} score must be finite`);
  assert.deepStrictEqual(Object.keys(item.components),Object.keys(Compat.policy.weights));
  assert(Array.isArray(item.reasons)&&item.reasons.length>0,`${item.actionId} requires recommendation reasons`);
  assert(Array.isArray(item.tradeoffs),`${item.actionId} requires tradeoffs array`);
  assert.strictEqual(item.levelEligibility.ok,true,'Compatibility ranking must consume #92 legal level candidates only');
  if(i>0)assert(first[i-1].score>=item.score,'candidates must be sorted by Compatibility Score');
}

for(const [familyId,scenario] of Object.entries({
  'BODY-01':{level:'L2',slotKey:'SECONDARY',currentSelections:{PRIMARY:'banjie_hake'}},
  'BODY-02':{level:'L2',slotKey:'SECONDARY',currentSelections:{PRIMARY:'tun_tui'}},
  'BODY-03':{level:'L3',slotKey:'SECONDARY',currentSelections:{PRIMARY:'feiji_labei_zhongba'}},
  'BODY-04':{level:'L2',slotKey:'ACCESSORY',currentSelections:{PRIMARY:'qixie_xiongtui',SECONDARY:'qixie_jian_tui'}},
})){
  const result=Body.candidates({familyId,...scenario});
  assert(result.recommended,`${familyId} representative scenario requires a recommendation`);
  assert(result.candidates.length>0,`${familyId} representative scenario requires candidates`);
  const top=result.candidates[0];
  assert.strictEqual(top.actionId,result.recommended);
  assert(Number.isFinite(top.recommendationScore));
  assert(top.reasons.length>0);
  assert(top.targetContribution&&top.patternContribution&&top.fatigueImpact);
}

const body03=Body.candidates({
  familyId:'BODY-03',level:'L3',slotKey:'SECONDARY',
  currentSelections:{PRIMARY:'feiji_labei_zhongba'}
});
assert(body03.candidates.every(candidate=>candidate.pattern==='垂直拉'));
assert(body03.candidates[0].patternContribution.isNovel);

const horizontalPrimary='feiji_labei_zhongba';
const verticalPrimary='gaowei_xiala_vba';
assert(Body.isSelectionValid({familyId:'BODY-03',level:'L3',slotKey:'PRIMARY',actionId:horizontalPrimary}));
assert(Body.isSelectionValid({familyId:'BODY-03',level:'L3',slotKey:'PRIMARY',actionId:verticalPrimary}));
let changed=false;
for(const downstreamSlot of ['ACCESSORY','ISOLATION-1','ISOLATION-2','OPTIONAL']){
  const a=Body.candidates({
    familyId:'BODY-03',level:'L3',slotKey:downstreamSlot,
    currentSelections:{PRIMARY:horizontalPrimary}
  }).candidates;
  const b=Body.candidates({
    familyId:'BODY-03',level:'L3',slotKey:downstreamSlot,
    currentSelections:{PRIMARY:verticalPrimary}
  }).candidates;
  const scoresA=Object.fromEntries(a.map(x=>[x.actionId,x.recommendationScore]));
  for(const item of b){
    if(Object.prototype.hasOwnProperty.call(scoresA,item.actionId)&&scoresA[item.actionId]!==item.recommendationScore)changed=true;
  }
}
assert(changed,'manual pull-direction change must alter at least one downstream Compatibility Score');

const syntheticPush={
  templateId:'body',familyId:'BODY-04',level:'L2',
  main:{content:[
    {key:'PRIMARY',actionId:'qixie_xiongtui'},
    {key:'SECONDARY',actionId:'qixie_jian_tui'},
    {key:'ACCESSORY',actionId:'V13_VP_SEATED_LIGHT_DB'},
  ]}
};
const pushAudit=Compat.analyzeSession(syntheticPush);
assert(pushAudit.localFatigue.hotspots.some(item=>item.target==='front_delts'),
  'chest press -> shoulder press chain should surface front-delt fatigue');
assert(pushAudit.targetDistribution.excessive.length>0,
  'concentrated synthetic push session should surface excessive target share');

const sequenceAudit=Compat.sequenceAudit({
  templateId:'body',familyId:'BODY-04',level:'L3',
  main:{content:[
    {key:'ISOLATION-2',actionId:'shengsuo_santou_xiaya'},
    {key:'PRIMARY',actionId:'gangling_wotu'},
  ]}
});
assert(sequenceAudit.warnings.length>0,'pre-fatigue before a high-complexity main lift should warn');

for(const familyId of D.bodyFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const one=R.resolve('body',{familyId,level});
    const two=R.resolve('body',{familyId,level});
    assert.deepStrictEqual(two,one,`${familyId} ${level} resolve must remain deterministic`);
    assert.notStrictEqual(one.conflictContext.status,'FAIL',`${familyId} ${level} auto session must not FAIL`);
    const selections=Object.fromEntries(one.main.content.map(item=>[item.key,item.actionId]));
    for(const item of one.main.content){
      const result=Body.candidates({familyId,level,slotKey:item.key,currentSelections:selections});
      assert(result.candidates.every(candidate=>Number.isFinite(candidate.recommendationScore)));
    }
  }
}

console.log('body_compatibility_score_test: deterministic scoring + fatigue/distribution/sequence GREEN');
