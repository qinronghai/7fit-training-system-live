(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const MAIN_ROUTES=new Set(['1F_ONLY','FLEX_1F_2F']);
  const SLOT_ORDER=Object.freeze(['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2','OPTIONAL']);
  const STABILITY_RANK=Object.freeze({low:0,medium:1,high:2});
  const LEVEL_STABILITY_MAX=Object.freeze({L1:0,L2:1,L3:2,L4:2});
  const COMPATIBILITY_POLICY=Object.freeze({
    weights:Object.freeze({
      slotFit:30,
      targetComplement:20,
      patternNovelty:14,
      exerciseSimilarity:16,
      fatigueOverlap:12,
      sessionBalance:16,
      progressionSuitability:12,
    }),
    level:Object.freeze({
      L1:Object.freeze({meaningfulDirectSets:1,excessiveShare:0.72,localFatigueWarn:5.5,preferredStability:0}),
      L2:Object.freeze({meaningfulDirectSets:2,excessiveShare:0.72,localFatigueWarn:6.0,preferredStability:1}),
      L3:Object.freeze({meaningfulDirectSets:2,excessiveShare:0.76,localFatigueWarn:6.5,preferredStability:2}),
      L4:Object.freeze({meaningfulDirectSets:3,excessiveShare:0.78,localFatigueWarn:7.0,preferredStability:2}),
    }),
    fatigue:Object.freeze({
      directTargetWeight:2,
      secondaryTargetWeight:1,
      patternTags:Object.freeze({
        '水平推':Object.freeze({front_delts:1,triceps:1}),
        '垂直推':Object.freeze({front_delts:1.5,triceps:1}),
        '水平拉':Object.freeze({biceps:1,grip:0.75,upper_back:0.5}),
        '垂直拉':Object.freeze({biceps:1,grip:0.75,lats:0.5}),
        '蹲':Object.freeze({quadriceps:1,glute_max:0.75}),
        '单腿':Object.freeze({quadriceps:1,glute_max:0.75}),
        '髋铰链':Object.freeze({hamstrings:1,glute_max:1,erectors:0.75}),
        '单腿拉':Object.freeze({hamstrings:1,glute_max:1,erectors:0.5}),
        '髋伸展':Object.freeze({glute_max:1}),
      }),
    }),
    sequence:Object.freeze({
      highComplexityThreshold:3,
      overlapWarnThreshold:0.35,
    }),
  });

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function unique(values){return [...new Set((Array.isArray(values)?values:[]).filter(Boolean))];}

  function normalizeActionId(value){
    if(typeof value==='string')return value;
    return value&&typeof value.actionId==='string'?value.actionId:'';
  }

  function normalizeManualActionId(value){
    return value&&typeof value==='object'&&value.source==='manual'&&typeof value.actionId==='string'?value.actionId:'';
  }

  function validateInput(input={},requireSlot=false){
    const data=D();
    const familyId=typeof input.familyId==='string'?input.familyId:'';
    const level=/^L[1-4]$/.test(input.level||'')?input.level:'';
    const family=data.bodyFamilies?.[familyId];
    const levelPolicy=data.bodyLevelPolicies?.[level];
    if(!familyId||!family)fail('BODY_INPUT_INVALID',`Unknown Body family: ${String(familyId||'')}`,{familyId});
    if(!level||!levelPolicy)fail('BODY_INPUT_INVALID','Body level must be L1-L4',{level:input.level});
    if(!requireSlot)return {familyId,level,family,levelPolicy};
    const slotKey=typeof input.slotKey==='string'?input.slotKey:'';
    const role=family.slotPolicy?.[slotKey];
    const workingSets=levelPolicy.defaultWorkingSets?.[slotKey];
    if(!slotKey||!role||!Number.isInteger(workingSets)||workingSets<=0){
      fail('BODY_INPUT_INVALID',`Inactive or unknown Body slot: ${String(slotKey||'')}`,{familyId,level,slotKey});
    }
    return {familyId,level,family,levelPolicy,slotKey,role};
  }

  function overlaps(a,b){
    const wanted=new Set(Array.isArray(b)?b:[]);
    return (Array.isArray(a)?a:[]).some(value=>wanted.has(value));
  }

  function overlapRatio(a,b){
    const left=new Set(Array.isArray(a)?a:[]),right=new Set(Array.isArray(b)?b:[]);
    const union=new Set([...left,...right]);
    if(!union.size)return 0;
    let intersection=0;
    left.forEach(value=>{if(right.has(value))intersection++;});
    return intersection/union.size;
  }

  function slotIntentFor(family,slotKey){
    const intent=family?.slotIntents?.[slotKey];
    return intent&&typeof intent==='object'?intent:null;
  }

  function exerciseFamilyOf(actionId){
    const meta=D().bodyActionMeta?.[actionId]||{};
    return String(meta.exerciseFamily||actionId||'');
  }

  function baseIntentAssessment({familyId,level,family,slotKey,role,actionId}){
    const data=D(),meta=data.bodyActionMeta?.[actionId],action=data.actions?.[actionId],reasons=[];
    const intent=slotIntentFor(family,slotKey);
    if(!meta||!action)reasons.push('BODY_ACTION_UNKNOWN');
    if(!intent)reasons.push('BODY_SLOT_INTENT_MISSING');
    if(reasons.length)return {ok:false,reasons,intent,meta,action};

    if(!meta.families?.includes(familyId))reasons.push('BODY_FAMILY_DEVIATION');
    if(!meta.levels?.includes(level))reasons.push('BODY_LEVEL_DEVIATION');
    if(!meta.roles?.includes(role))reasons.push('BODY_ROLE_DEVIATION');
    if(intent.role!==role||intent.slotKey!==slotKey)reasons.push('BODY_SLOT_INTENT_MISMATCH');
    if(action.status!=='可自动编排')reasons.push('BODY_STATUS_INVALID');
    if(!MAIN_ROUTES.has(action.route))reasons.push('BODY_ROUTE_INVALID');
    if((role==='PRIMARY'||role==='SECONDARY')&&!overlaps(meta.directTargets,family.primaryTargets)){
      reasons.push('BODY_PRIMARY_TARGET_MISMATCH');
    }

    const allowedClasses=Array.isArray(intent.allowedExerciseClasses)?intent.allowedExerciseClasses:[];
    if(allowedClasses.length&&!allowedClasses.includes(meta.exerciseClass)){
      reasons.push('BODY_SLOT_INTENT_EXERCISE_CLASS');
    }
    const requiredPatterns=Array.isArray(intent.requiredPatterns)?intent.requiredPatterns:[];
    if(requiredPatterns.length&&!requiredPatterns.includes(action.pattern)){
      reasons.push('BODY_SLOT_INTENT_PATTERN');
    }
    const requiredTargets=Array.isArray(intent.requiredDirectTargets)?intent.requiredDirectTargets:[];
    if(requiredTargets.length&&!overlaps(meta.directTargets,requiredTargets)){
      reasons.push('BODY_SLOT_INTENT_TARGET');
    }
    const disallowed=intent.disallowedCharacteristics||{};
    if((disallowed.fatigueCost||[]).includes(meta.fatigueCost)){
      reasons.push('BODY_SLOT_INTENT_FATIGUE');
    }
    if((disallowed.stabilityDemand||[]).includes(meta.stabilityDemand)){
      reasons.push('BODY_SLOT_INTENT_STABILITY');
    }
    return {ok:reasons.length===0,reasons,intent,meta,action};
  }

  function pairSimilarity(actionId,otherActionId){
    const data=D(),meta=data.bodyActionMeta?.[actionId]||{},otherMeta=data.bodyActionMeta?.[otherActionId]||{};
    const action=data.actions?.[actionId]||{},otherAction=data.actions?.[otherActionId]||{};
    return {
      sameExerciseFamily:exerciseFamilyOf(actionId)===exerciseFamilyOf(otherActionId),
      samePattern:!!action.pattern&&action.pattern===otherAction.pattern,
      sameLaterality:!!meta.laterality&&meta.laterality===otherMeta.laterality,
      directTargetOverlap:overlapRatio(meta.directTargets,otherMeta.directTargets),
    };
  }

  function pairIntentReasons({slotKey,intent,actionId,currentSelections={}}){
    const relation=intent?.pairRelationship;
    if(!relation||typeof relation!=='object')return [];
    const data=D(),meta=data.bodyActionMeta?.[actionId]||{},action=data.actions?.[actionId]||{},reasons=[];
    const threshold=Number.isFinite(Number(relation.minDirectTargetOverlap))
      ?Number(relation.minDirectTargetOverlap):0.75;

    for(const against of relation.against||[]){
      const otherId=normalizeActionId(currentSelections?.[against]);
      if(!otherId||otherId===actionId)continue;
      const similarity=pairSimilarity(actionId,otherId);
      if(relation.requireEffectiveDifference){
        if(relation.blockSamePattern&&similarity.samePattern){
          reasons.push('BODY_PRIMARY_SECONDARY_TOO_SIMILAR');
          continue;
        }
        if(similarity.samePattern&&similarity.sameLaterality&&similarity.directTargetOverlap>=threshold){
          reasons.push('BODY_PRIMARY_SECONDARY_TOO_SIMILAR');
          continue;
        }
      }
      if(
        relation.blockCompoundPatternRepeat
        &&meta.exerciseClass==='compound'
        &&similarity.samePattern
      ){
        reasons.push(slotKey==='ACCESSORY'?'BODY_ACCESSORY_ROLE_COLLAPSE':'BODY_SLOT_PAIR_REDUNDANCY');
      }
      if(
        slotKey==='ACCESSORY'
        &&meta.exerciseClass==='compound'
        &&similarity.samePattern
        &&similarity.directTargetOverlap>=threshold
      ){
        reasons.push('BODY_ACCESSORY_ROLE_COLLAPSE');
      }
      if(!action.pattern)reasons.push('BODY_SLOT_INTENT_PATTERN');
    }
    return [...new Set(reasons)];
  }

  function assessSlotIntent(input={}){
    let normalized;
    try{normalized=validateInput(input,true);}catch(error){
      if(error?.code==='BODY_INPUT_INVALID'){
        return {ok:false,reasons:['BODY_INPUT_INVALID'],intentId:'',slotKey:String(input.slotKey||''),actionId:normalizeActionId(input.actionId)};
      }
      throw error;
    }
    const actionId=normalizeActionId(input.actionId);
    if(!actionId)return {ok:false,reasons:['BODY_ACTION_UNKNOWN'],intentId:'',slotKey:normalized.slotKey,actionId:''};
    const base=baseIntentAssessment({...normalized,actionId});
    const pairReasons=base.ok?pairIntentReasons({
      slotKey:normalized.slotKey,
      intent:base.intent,
      actionId,
      currentSelections:input.currentSelections||{},
    }):[];
    const reasons=[...new Set([...base.reasons,...pairReasons])];
    return {
      ok:reasons.length===0,
      reasons,
      intentId:String(base.intent?.intentId||''),
      slotKey:normalized.slotKey,
      role:normalized.role,
      actionId,
      pairSimilarity:pairReasons.length?pairReasons.map(code=>({code})):[],
    };
  }

  function isLegalCandidate(input={}){
    return assessSlotIntent(input).ok;
  }

  function isSelectionValid(input={}){
    return assessSlotIntent(input).ok;
  }

  function selectionContext(currentSelections={},currentSlotKey=''){
    const data=D(),coveredTargets=new Set(),patterns=new Set(),usedActionIds=new Set(),usedExerciseFamilies=new Set(),selected=[];
    let highFatigueCompounds=0;
    for(const [slotKey,value] of Object.entries(currentSelections||{})){
      if(slotKey===currentSlotKey)continue;
      const actionId=normalizeActionId(value),meta=data.bodyActionMeta?.[actionId],action=data.actions?.[actionId];
      if(!actionId||!meta||!action)continue;
      usedActionIds.add(actionId);
      usedExerciseFamilies.add(exerciseFamilyOf(actionId));
      (meta.directTargets||[]).forEach(target=>coveredTargets.add(target));
      if(action.pattern)patterns.add(action.pattern);
      if(meta.exerciseClass==='compound'&&meta.fatigueCost==='high')highFatigueCompounds++;
      selected.push({slotKey,actionId,meta,action});
    }
    return {coveredTargets,patterns,usedActionIds,usedExerciseFamilies,highFatigueCompounds,selected};
  }

  function fatiguePreferenceScore(preference,cost){
    if(preference==='low')return cost==='low'?2:cost==='medium'?1:0;
    if(preference==='moderate')return cost==='medium'?2:cost==='low'?1:0;
    return 0;
  }

  function clamp(value,min=0,max=1){return Math.min(max,Math.max(min,Number(value)||0));}
  function roundScore(value){return Math.round((Number(value)||0)*10)/10;}
  function addNumeric(map,key,value){
    if(!key||!Number.isFinite(Number(value)))return;
    map[key]=(map[key]||0)+Number(value);
  }
  function normalizedSelectionEntries(level,currentSelections={},currentSlotKey=''){
    const data=D(),levelPolicy=data.bodyLevelPolicies?.[level]||{},entries=[];
    for(const [slotKey,value] of Object.entries(currentSelections||{})){
      if(slotKey===currentSlotKey)continue;
      const actionId=normalizeActionId(value),meta=data.bodyActionMeta?.[actionId],action=data.actions?.[actionId];
      if(!actionId||!meta||!action)continue;
      entries.push({
        slotKey,actionId,meta,action,
        workingSets:Number(levelPolicy.defaultWorkingSets?.[slotKey]||0),
      });
    }
    return entries;
  }
  function directSetMap(level,currentSelections={},currentSlotKey=''){
    const result={};
    normalizedSelectionEntries(level,currentSelections,currentSlotKey).forEach(entry=>{
      (entry.meta.directTargets||[]).forEach(target=>addNumeric(result,target,entry.workingSets));
    });
    return result;
  }
  function fatigueTagsForAction(actionId){
    const data=D(),meta=data.bodyActionMeta?.[actionId]||{},action=data.actions?.[actionId]||{},tags={};
    (meta.directTargets||[]).forEach(target=>addNumeric(tags,target,COMPATIBILITY_POLICY.fatigue.directTargetWeight));
    (meta.secondaryTargets||[]).forEach(target=>addNumeric(tags,target,COMPATIBILITY_POLICY.fatigue.secondaryTargetWeight));
    const extras=COMPATIBILITY_POLICY.fatigue.patternTags[action.pattern]||{};
    Object.entries(extras).forEach(([target,value])=>addNumeric(tags,target,value));
    return tags;
  }
  function fatigueContext(level,currentSelections={},currentSlotKey=''){
    const totals={},contributors={};
    normalizedSelectionEntries(level,currentSelections,currentSlotKey).forEach(entry=>{
      const tags=fatigueTagsForAction(entry.actionId);
      Object.entries(tags).forEach(([target,value])=>{
        addNumeric(totals,target,value);
        (contributors[target]||(contributors[target]=new Set())).add(entry.actionId);
      });
    });
    return {
      totals,
      contributors:Object.fromEntries(Object.entries(contributors).map(([key,set])=>[key,[...set].sort()])),
    };
  }
  function targetDistributionSnapshot({familyId,level,currentSelections={},slotKey='',candidate=null}){
    const data=D(),family=data.bodyFamilies?.[familyId]||{},levelPolicy=data.bodyLevelPolicies?.[level]||{};
    const policy=COMPATIBILITY_POLICY.level[level]||COMPATIBILITY_POLICY.level.L2;
    const direct=directSetMap(level,currentSelections,slotKey);
    const candidateSets=Number(levelPolicy.defaultWorkingSets?.[slotKey]||0);
    if(candidate){
      (candidate.directTargets||[]).forEach(target=>addNumeric(direct,target,candidateSets));
    }
    const totalSelected=normalizedSelectionEntries(level,currentSelections,slotKey)
      .reduce((sum,entry)=>sum+entry.workingSets,0)+candidateSets;
    const primary=(family.primaryTargets||[]).map(target=>({
      target,
      sets:Number(direct[target]||0),
      meaningful:Number(direct[target]||0)>=policy.meaningfulDirectSets,
    }));
    const volumeTargets=(family.volumeTargets||[]).map(target=>({
      target,
      sets:Number(direct[target]||0),
      covered:Number(direct[target]||0)>0,
    }));
    const shares=Object.entries(direct).map(([target,sets])=>({
      target,sets,share:totalSelected?Number(sets)/totalSelected:0,
    })).sort((a,b)=>b.share-a.share||String(a.target).localeCompare(String(b.target)));
    return {
      directSetsByTarget:direct,
      totalSelectedWorkingSets:totalSelected,
      primary,
      volumeTargets,
      excessive:shares.filter(item=>item.share>policy.excessiveShare),
      maxShare:shares[0]?.share||0,
      policy:{meaningfulDirectSets:policy.meaningfulDirectSets,excessiveShare:policy.excessiveShare},
    };
  }
  function progressionScore(level,candidate){
    const preferred=COMPATIBILITY_POLICY.level[level]?.preferredStability??1;
    const stability=STABILITY_RANK[candidate.stabilityDemand]??2;
    let value=stability<=preferred?1:Math.max(0.35,1-(stability-preferred)*0.35);
    if(level==='L1'&&candidate.fatigueCost==='high')value-=0.25;
    if(level==='L2'&&candidate.fatigueCost==='high')value-=0.1;
    return clamp(value);
  }
  function slotFitScore(intent,candidate){
    const preferredPatterns=Array.isArray(intent?.preferredPatterns)?intent.preferredPatterns:[];
    const preferredTargets=Array.isArray(intent?.preferredDirectTargets)?intent.preferredDirectTargets:[];
    const patternFit=preferredPatterns.length?(preferredPatterns.includes(candidate.pattern)?1:0):0.5;
    const targetHits=preferredTargets.filter(target=>(candidate.directTargets||[]).includes(target)).length;
    const targetFit=preferredTargets.length?targetHits/preferredTargets.length:0.5;
    const fatigueFit=fatiguePreferenceScore(intent?.fatiguePreference,candidate.fatigueCost)/2;
    return clamp(0.4+patternFit*0.25+targetFit*0.25+fatigueFit*0.1);
  }
  function candidateSimilarity(candidate,currentSelections,level,slotKey){
    const entries=normalizedSelectionEntries(level,currentSelections,slotKey);
    let max=0,closest=null;
    entries.forEach(entry=>{
      const similarity=pairSimilarity(candidate.actionId,entry.actionId);
      const score=clamp(
        (similarity.sameExerciseFamily?0.55:0)
        +(similarity.samePattern?0.2:0)
        +(similarity.sameLaterality?0.05:0)
        +similarity.directTargetOverlap*0.2
      );
      if(score>max){max=score;closest={slotKey:entry.slotKey,actionId:entry.actionId,...similarity};}
    });
    return {value:max,closest};
  }
  function fatigueOverlapScore(candidate,currentSelections,level,slotKey){
    const current=fatigueContext(level,currentSelections,slotKey),candidateTags=fatigueTagsForAction(candidate.actionId);
    const total=Object.values(candidateTags).reduce((sum,value)=>sum+value,0);
    let overlap=0;
    const hotspots=[];
    Object.entries(candidateTags).forEach(([target,value])=>{
      const existing=Number(current.totals[target]||0);
      if(existing>0){
        overlap+=Math.min(value,existing);
        hotspots.push({target,existing:roundScore(existing),added:roundScore(value)});
      }
    });
    hotspots.sort((a,b)=>b.existing-a.existing||String(a.target).localeCompare(String(b.target)));
    return {value:total?clamp(overlap/total):0,hotspots};
  }
  function balanceScore(snapshot){
    const primaryMeaningful=snapshot.primary.length
      ?snapshot.primary.filter(item=>item.meaningful).length/snapshot.primary.length:1;
    const volumeCoverage=snapshot.volumeTargets.length
      ?snapshot.volumeTargets.filter(item=>item.covered).length/snapshot.volumeTargets.length:1;
    const concentration=snapshot.excessive.length?clamp((snapshot.maxShare-snapshot.policy.excessiveShare)/(1-snapshot.policy.excessiveShare)):0;
    return clamp(primaryMeaningful*0.55+volumeCoverage*0.3+(1-concentration)*0.15);
  }
  function scoreCandidate({familyId,level,slotKey,candidate,currentSelections={},intent}={}){
    const weights=COMPATIBILITY_POLICY.weights;
    const selected=normalizedSelectionEntries(level,currentSelections,slotKey);
    const currentPatterns=new Set(selected.map(entry=>entry.action.pattern).filter(Boolean));
    const beforeDistribution=targetDistributionSnapshot({familyId,level,currentSelections,slotKey});
    const afterDistribution=targetDistributionSnapshot({familyId,level,currentSelections,slotKey,candidate});
    const slotFit=slotFitScore(intent,candidate);
    const candidateSets=Number(D().bodyLevelPolicies?.[level]?.defaultWorkingSets?.[slotKey]||0);
    const improvedTargets=(candidate.directTargets||[]).filter(target=>{
      const before=Number(beforeDistribution.directSetsByTarget[target]||0);
      const after=before+candidateSets;
      return after>before&&(
        (D().bodyFamilies?.[familyId]?.primaryTargets||[]).includes(target)
        || before===0
      );
    });
    const primaryMissingBefore=beforeDistribution.primary.filter(item=>!item.meaningful).map(item=>item.target);
    const fillsPrimary=improvedTargets.filter(target=>primaryMissingBefore.includes(target));
    const targetComplement=clamp(
      (fillsPrimary.length?0.65:0)
      +Math.min(0.35,improvedTargets.length*0.15)
      +(improvedTargets.length===0?0.15:0)
    );
    const patternNovelty=currentPatterns.size===0?1:(currentPatterns.has(candidate.pattern)?0.2:1);
    const similarity=candidateSimilarity(candidate,currentSelections,level,slotKey);
    const fatigue=fatigueOverlapScore(candidate,currentSelections,level,slotKey);
    const sessionBalance=balanceScore(afterDistribution);
    const progressionSuitability=progressionScore(level,candidate);
    const components={
      slotFit:roundScore(weights.slotFit*slotFit),
      targetComplement:roundScore(weights.targetComplement*targetComplement),
      patternNovelty:roundScore(weights.patternNovelty*patternNovelty),
      exerciseSimilarity:roundScore(-weights.exerciseSimilarity*similarity.value),
      fatigueOverlap:roundScore(-weights.fatigueOverlap*fatigue.value),
      sessionBalance:roundScore(weights.sessionBalance*sessionBalance),
      progressionSuitability:roundScore(weights.progressionSuitability*progressionSuitability),
    };
    const recommendationScore=roundScore(Object.values(components).reduce((sum,value)=>sum+value,0));
    const reasons=[],tradeoffs=[];
    if(slotFit>=0.75)reasons.push({code:'SLOT_FIT',text:'符合当前槽位的训练职责与优先方向'});
    if(fillsPrimary.length)reasons.push({code:'PRIMARY_TARGET_COMPLEMENT',text:`补足主要目标：${fillsPrimary.join('、')}`});
    else if(improvedTargets.length)reasons.push({code:'TARGET_COMPLEMENT',text:`补充当前训练量：${improvedTargets.join('、')}`});
    if(patternNovelty>=0.9)reasons.push({code:'PATTERN_NOVELTY',text:`提供新的动作方向：${candidate.pattern||'未标模式'}`});
    if(sessionBalance>=0.75)reasons.push({code:'SESSION_BALANCE',text:'加入后整体肌群与动作结构更均衡'});
    if(progressionSuitability>=0.9)reasons.push({code:'LEVEL_FIT',text:`稳定性与疲劳要求适合 ${level}`});
    if(similarity.value>=0.45)tradeoffs.push({code:'EXERCISE_SIMILARITY',text:'与已选动作存在较高相似度'});
    if(fatigue.value>=0.4)tradeoffs.push({code:'LOCAL_FATIGUE_OVERLAP',text:`局部疲劳有叠加：${fatigue.hotspots.slice(0,3).map(x=>x.target).join('、')}`});
    if(afterDistribution.excessive.length)tradeoffs.push({
      code:'TARGET_SHARE_HIGH',
      text:`局部训练量占比偏高：${afterDistribution.excessive.slice(0,2).map(x=>x.target).join('、')}`,
    });
    return {
      recommendationScore,
      components,
      reasons,
      tradeoffs,
      targetContribution:{
        addedDirectSetsByTarget:Object.fromEntries((candidate.directTargets||[]).map(target=>[target,candidateSets])),
        improvedTargets,
        fillsPrimaryTargets:fillsPrimary,
        distribution:afterDistribution,
      },
      patternContribution:{
        pattern:String(candidate.pattern||''),
        isNovel:patternNovelty>=0.9,
        currentPatterns:[...currentPatterns].sort(),
      },
      fatigueImpact:{
        overlapScore:roundScore(fatigue.value),
        hotspots:fatigue.hotspots,
      },
    };
  }
  function sessionSelections(session){
    return Object.fromEntries((session?.main?.content||[]).filter(item=>item?.key&&item?.actionId).map(item=>[item.key,item.actionId]));
  }
  function localFatigueAudit(session){
    const selections=sessionSelections(session),level=session?.level||'L2';
    const entries=normalizedSelectionEntries(level,selections,''),totals={},contributors={},indirect={};
    entries.forEach(entry=>{
      const tags=fatigueTagsForAction(entry.actionId);
      Object.entries(tags).forEach(([target,value])=>{
        addNumeric(totals,target,value);
        (contributors[target]||(contributors[target]=new Set())).add(entry.actionId);
      });
      (entry.meta.secondaryTargets||[]).forEach(target=>{indirect[target]=(indirect[target]||0)+1;});
    });
    const threshold=COMPATIBILITY_POLICY.level[level]?.localFatigueWarn??6;
    const hotspots=Object.entries(totals).map(([target,load])=>({
      target,
      load:roundScore(load),
      actionIds:[...(contributors[target]||[])].sort(),
      indirectContributors:Number(indirect[target]||0),
    })).filter(item=>item.actionIds.length>=3&&item.load>=threshold&&item.indirectContributors>0)
      .sort((a,b)=>b.load-a.load||String(a.target).localeCompare(String(b.target)));
    return {threshold,hotspots};
  }
  function targetDistributionAudit(session){
    const familyId=session?.familyId,level=session?.level||'L2',family=D().bodyFamilies?.[familyId]||{};
    const selections=sessionSelections(session),snapshot=targetDistributionSnapshot({familyId,level,currentSelections:selections,slotKey:''});
    const under=snapshot.primary.filter(item=>!item.meaningful);
    const excessive=snapshot.excessive;
    return {familyId,level,primaryTargets:[...(family.primaryTargets||[])],under,excessive,snapshot};
  }
  function sequenceAudit(session){
    const items=session?.main?.content||[],data=D(),warnings=[];
    const complexity=item=>{
      const meta=data.bodyActionMeta?.[item?.actionId]||{};
      const stability=STABILITY_RANK[meta.stabilityDemand]??0;
      return stability+(meta.fatigueCost==='high'?1:0)+(meta.repProfile==='compound_freeweight'?1:0);
    };
    for(let later=1;later<items.length;later++){
      const laterItem=items[later],laterComplexity=complexity(laterItem);
      if(laterComplexity<COMPATIBILITY_POLICY.sequence.highComplexityThreshold)continue;
      const laterTags=fatigueTagsForAction(laterItem.actionId);
      for(let earlier=0;earlier<later;earlier++){
        const earlierItem=items[earlier],earlierMeta=data.bodyActionMeta?.[earlierItem.actionId]||{};
        if(!['isolation','accessory'].includes(earlierMeta.exerciseClass))continue;
        const earlierTags=fatigueTagsForAction(earlierItem.actionId);
        const laterTotal=Object.values(laterTags).reduce((sum,value)=>sum+value,0)||1;
        let overlap=0;
        Object.entries(laterTags).forEach(([target,value])=>{overlap+=Math.min(value,Number(earlierTags[target]||0));});
        const ratio=overlap/laterTotal;
        if(ratio>=COMPATIBILITY_POLICY.sequence.overlapWarnThreshold){
          warnings.push({
            beforeSlot:earlierItem.key,
            beforeActionId:earlierItem.actionId,
            laterSlot:laterItem.key,
            laterActionId:laterItem.actionId,
            overlapScore:roundScore(ratio),
          });
          break;
        }
      }
    }
    return {warnings};
  }
  function analyzeSession(session){
    return {
      localFatigue:localFatigueAudit(session),
      targetDistribution:targetDistributionAudit(session),
      sequence:sequenceAudit(session),
    };
  }
  const Compatibility=Object.freeze({
    policy:COMPATIBILITY_POLICY,
    scoreCandidate,
    analyzeSession,
    localFatigueAudit,
    targetDistributionAudit,
    sequenceAudit,
    fatigueTagsForAction,
  });
  window.V15BodyCompatibility=Compatibility;

  function candidateSortKey(candidate,{family,level,context,intent}){
    const primaryTargets=new Set(family.primaryTargets||[]);
    const volumeTargets=new Set(family.volumeTargets||[]);
    const direct=candidate.directTargets||[];
    const preferredPatterns=Array.isArray(intent?.preferredPatterns)?intent.preferredPatterns:[];
    const preferredTargets=new Set(Array.isArray(intent?.preferredDirectTargets)?intent.preferredDirectTargets:[]);
    const intentPatternPreference=preferredPatterns.includes(candidate.pattern)?1:0;
    const intentTargetPreference=direct.filter(target=>preferredTargets.has(target)).length;
    const fatiguePreference=fatiguePreferenceScore(intent?.fatiguePreference,candidate.fatigueCost);
    const primaryCoverage=direct.filter(target=>primaryTargets.has(target)).length;
    const missingTargetBonus=direct.filter(target=>volumeTargets.has(target)&&!context.coveredTargets.has(target)).length;
    const stability=STABILITY_RANK[candidate.stabilityDemand]??2;
    const stabilityPenalty=Math.max(0,stability-(LEVEL_STABILITY_MAX[level]??2));
    const fatiguePenalty=candidate.exerciseClass==='compound'&&candidate.fatigueCost==='high'&&context.highFatigueCompounds>=2?1:0;
    const movementDiversity=candidate.pattern&&!context.patterns.has(candidate.pattern)?1:0;
    const targetRedundancy=direct.filter(target=>context.coveredTargets.has(target)).length;
    const similarityPenalty=context.selected.reduce((sum,item)=>{
      const similarity=pairSimilarity(candidate.actionId,item.actionId);
      return sum+(similarity.samePattern?1:0)+similarity.directTargetOverlap;
    },0);
    return {
      intentPatternPreference,intentTargetPreference,fatiguePreference,
      primaryCoverage,missingTargetBonus,stabilityPenalty,fatiguePenalty,
      movementDiversity,targetRedundancy,similarityPenalty
    };
  }

  function compareCandidates(a,b,ctx){
    const A=candidateSortKey(a,ctx),B=candidateSortKey(b,ctx);
    return B.intentPatternPreference-A.intentPatternPreference
      ||B.intentTargetPreference-A.intentTargetPreference
      ||B.fatiguePreference-A.fatiguePreference
      ||B.primaryCoverage-A.primaryCoverage
      ||B.missingTargetBonus-A.missingTargetBonus
      ||A.stabilityPenalty-B.stabilityPenalty
      ||A.fatiguePenalty-B.fatiguePenalty
      ||B.movementDiversity-A.movementDiversity
      ||A.targetRedundancy-B.targetRedundancy
      ||A.similarityPenalty-B.similarityPenalty
      ||a.actionId.localeCompare(b.actionId);
  }

  function candidates(input={}){
    const {familyId,level,family,slotKey,role}=validateInput(input,true);
    const data=D(),currentSelections=input.currentSelections||{},context=selectionContext(currentSelections,slotKey);
    const intent=slotIntentFor(family,slotKey),items=[];
    for(const actionId of Object.keys(data.bodyActionMeta||{})){
      if(context.usedActionIds.has(actionId))continue;
      const meta=data.bodyActionMeta[actionId],exerciseFamily=exerciseFamilyOf(actionId);
      if(context.usedExerciseFamilies.has(exerciseFamily))continue;
      const assessment=assessSlotIntent({familyId,level,slotKey,actionId,currentSelections});
      if(!assessment.ok)continue;
      const action=data.actions[actionId];
      const candidate={
        actionId,
        name:String(action.name||actionId),
        role,
        intentId:String(intent?.intentId||''),
        directTargets:[...(meta.directTargets||[])],
        secondaryTargets:[...(meta.secondaryTargets||[])],
        exerciseClass:String(meta.exerciseClass||''),
        fatigueCost:String(meta.fatigueCost||''),
        stabilityDemand:String(meta.stabilityDemand||''),
        repProfile:String(meta.repProfile||''),
        laterality:String(meta.laterality||''),
        exerciseFamily,
        pattern:String(action.pattern||''),
      };
      Object.assign(candidate,Compatibility.scoreCandidate({
        familyId,level,slotKey,candidate,currentSelections,intent,
      }));
      items.push(candidate);
    }
    items.sort((a,b)=>
      b.recommendationScore-a.recommendationScore
      ||compareCandidates(a,b,{family,level,context,intent})
    );
    return {
      recommended:items[0]?.actionId||'',
      slotIntent:intent?{slotKey,intentId:intent.intentId,role:intent.role}:null,
      candidates:items
    };
  }

  function publicAnatomy(actionIds){
    const summary=window.V14Anatomy?.aggregate?.(actionIds)||{};
    return {
      actionIds:unique(actionIds),
      primary:unique(summary.primary),
      secondary:unique(summary.secondary),
      stabilizers:unique(summary.stabilizers),
    };
  }

  function targetMuscleNames(targetIds){
    const catalog=D().bodyTargetCatalog||{};
    return unique((targetIds||[]).flatMap(id=>{
      const item=catalog[id]||{};
      return Array.isArray(item.anatomyAliases)&&item.anatomyAliases.length?item.anatomyAliases:[item.name||id];
    }));
  }

  function activeSlotKeys(levelPolicy){
    return SLOT_ORDER.filter(slotKey=>Number(levelPolicy.defaultWorkingSets?.[slotKey])>0);
  }

  function slotLabel(slotKey,role){
    const roleName=D().bodyRoles?.[role]?.name||role;
    return `${slotKey}｜${roleName}`;
  }

  function evaluateConflict(session){
    if(!window.V15Conflict?.evaluate)fail('BODY_CONFLICT_UNAVAILABLE','Body conflict service is unavailable');
    return window.V15Conflict.evaluate('body',session,{
      sharedPolicy:{
        allowedRoutes:[...MAIN_ROUTES],
        allowedStatuses:['可自动编排'],
      }
    });
  }

  function resolve(input={}){
    const {familyId,level,family,levelPolicy}=validateInput(input);
    if(!window.V15BodyVolume?.buildSlot||!window.V15BodyVolume?.summarize){
      fail('BODY_VOLUME_UNAVAILABLE','Body volume calculator is unavailable');
    }
    const requested=input.selections&&typeof input.selections==='object'?input.selections:{};
    const chosen={},domainSlots={},publicSlots=[],warnings=[];

    for(const slotKey of activeSlotKeys(levelPolicy)){
      const role=family.slotPolicy[slotKey];
      const requestedActionId=normalizeManualActionId(requested[slotKey]);
      let actionId='',source='auto';
      const used=new Set(Object.values(chosen));
      const usedExerciseFamilies=new Set(Object.values(chosen).map(exerciseFamilyOf));
      if(requestedActionId&&!used.has(requestedActionId)&&!usedExerciseFamilies.has(exerciseFamilyOf(requestedActionId))&&isLegalCandidate({familyId,level,slotKey,actionId:requestedActionId,currentSelections:chosen})){
        actionId=requestedActionId;
        source='manual';
      }else{
        if(requestedActionId)warnings.push(`BODY_STALE_SELECTION_FALLBACK:${slotKey}`);
        const result=candidates({familyId,level,slotKey,currentSelections:chosen});
        actionId=result.recommended;
        if(!actionId)fail('BODY_NO_ELIGIBLE_CANDIDATE',`No eligible Body candidate for ${familyId} ${level} ${slotKey}`,{familyId,level,slotKey});
      }
      chosen[slotKey]=actionId;
      const domainSlot=window.V15BodyVolume.buildSlot({level,slotKey,role,actionId});
      domainSlots[slotKey]=domainSlot;
      const action=D().actions[actionId]||{};
      publicSlots.push({
        key:slotKey,
        label:slotLabel(slotKey,role),
        actionId,
        name:String(action.name||actionId),
        tier:String(action.tier||''),
        grade:'',
        prescription:window.V15BodyVolume.formatPrescription(domainSlot),
        source,
      });
    }

    const actionIds=publicSlots.map(slot=>slot.actionId);
    const primaryId=chosen.PRIMARY||'',secondaryId=chosen.SECONDARY||'';
    const prepContext=window.V14PrepResolver?.contextFromBody?.({
      level,
      recipeId:familyId,
      firstCompoundId:primaryId,
      secondCompoundId:secondaryId,
      mainActionIds:unique([primaryId,secondaryId]),
      formalActionIds:actionIds,
      targetMuscles:targetMuscleNames(family.primaryTargets),
    })||{
      template:'body',level,recipeId:familyId,mainPatterns:[],mainActionIds:unique([primaryId,secondaryId]),
      formalActionIds:actionIds,targetMuscles:targetMuscleNames(family.primaryTargets),modalities:[],impactDemand:'',powerDemand:''
    };
    const title=`${family.name}｜${level}`;
    const summary=`Body ${level}｜${targetMuscleNames(family.primaryTargets).join(' + ')}主导`;
    const session={
      schemaVersion:1,
      resolverVersion:'body-v1',
      templateId:'body',
      familyId,
      level,
      title,
      summary,
      main:{kind:'SLOT',content:publicSlots},
      prepContext,
      anatomyContext:publicAnatomy(actionIds),
      conflictContext:{status:'PASS',hardCount:0,warnCount:0,issues:[]},
      copyContext:{title,summary,actionIds:unique(actionIds)},
      warnings,
      resolvedSelections:publicSlots.map(slot=>({key:slot.key,actionId:slot.actionId,source:slot.source})),
      source:{type:'GENERATED',id:`${familyId}-${level}`},
      domainContext:{kind:'BODY',slots:domainSlots,volume:window.V15BodyVolume.summarize(domainSlots)},
    };
    session.conflictContext=evaluateConflict(session);
    const validation=window.V15ResolvedSession?.validate?.(session);
    if(validation&&!validation.ok)fail('BODY_RESOLVED_SESSION_INVALID','Body Resolver produced invalid ResolvedSession',{validationErrors:validation.errors});
    return session;
  }

  const api={resolve,candidates,isSelectionValid,assessSlotIntent,pairSimilarity};
  window.V15BodyResolver=api;
  if(!window.V15TemplateResolver?.register)throw new Error('Template Resolver Dispatcher is unavailable');
  window.V15TemplateResolver.register('body',resolve);
})();
