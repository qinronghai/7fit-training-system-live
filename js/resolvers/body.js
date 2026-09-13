(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const MAIN_ROUTES=new Set(['1F_ONLY','FLEX_1F_2F']);
  const SLOT_ORDER=Object.freeze(['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2','OPTIONAL']);
  const STABILITY_RANK=Object.freeze({low:0,medium:1,high:2});
  const LEVEL_STABILITY_MAX=Object.freeze({L1:0,L2:1,L3:2,L4:2});

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
      items.push({
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
      });
    }
    items.sort((a,b)=>compareCandidates(a,b,{family,level,context,intent}));
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
