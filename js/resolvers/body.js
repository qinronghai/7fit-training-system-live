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

  function isLegalCandidate({familyId,level,family,role,actionId}){
    const data=D(),meta=data.bodyActionMeta?.[actionId],action=data.actions?.[actionId];
    if(!meta||!action)return false;
    if(!meta.families?.includes(familyId))return false;
    if(!meta.levels?.includes(level))return false;
    if(!meta.roles?.includes(role))return false;
    if(action.status!=='可自动编排')return false;
    if(!MAIN_ROUTES.has(action.route))return false;
    if((role==='PRIMARY'||role==='SECONDARY')&&!overlaps(meta.directTargets,family.primaryTargets))return false;
    return true;
  }

  function selectionContext(currentSelections={},currentSlotKey=''){
    const data=D(),coveredTargets=new Set(),patterns=new Set(),usedActionIds=new Set();
    let highFatigueCompounds=0;
    for(const [slotKey,value] of Object.entries(currentSelections||{})){
      if(slotKey===currentSlotKey)continue;
      const actionId=normalizeActionId(value),meta=data.bodyActionMeta?.[actionId],action=data.actions?.[actionId];
      if(!actionId||!meta||!action)continue;
      usedActionIds.add(actionId);
      (meta.directTargets||[]).forEach(target=>coveredTargets.add(target));
      if(action.pattern)patterns.add(action.pattern);
      if(meta.exerciseClass==='compound'&&meta.fatigueCost==='high')highFatigueCompounds++;
    }
    return {coveredTargets,patterns,usedActionIds,highFatigueCompounds};
  }

  function candidateSortKey(candidate,{family,level,context}){
    const primaryTargets=new Set(family.primaryTargets||[]);
    const volumeTargets=new Set(family.volumeTargets||[]);
    const direct=candidate.directTargets||[];
    const primaryCoverage=direct.filter(target=>primaryTargets.has(target)).length;
    const missingTargetBonus=direct.filter(target=>volumeTargets.has(target)&&!context.coveredTargets.has(target)).length;
    const stability=STABILITY_RANK[candidate.stabilityDemand]??2;
    const stabilityPenalty=Math.max(0,stability-(LEVEL_STABILITY_MAX[level]??2));
    const fatiguePenalty=candidate.exerciseClass==='compound'&&candidate.fatigueCost==='high'&&context.highFatigueCompounds>=2?1:0;
    const movementDiversity=candidate.pattern&&!context.patterns.has(candidate.pattern)?1:0;
    const targetRedundancy=direct.filter(target=>context.coveredTargets.has(target)).length;
    return {primaryCoverage,missingTargetBonus,stabilityPenalty,fatiguePenalty,movementDiversity,targetRedundancy};
  }

  function compareCandidates(a,b,ctx){
    const A=candidateSortKey(a,ctx),B=candidateSortKey(b,ctx);
    return B.primaryCoverage-A.primaryCoverage
      ||B.missingTargetBonus-A.missingTargetBonus
      ||A.stabilityPenalty-B.stabilityPenalty
      ||A.fatiguePenalty-B.fatiguePenalty
      ||B.movementDiversity-A.movementDiversity
      ||A.targetRedundancy-B.targetRedundancy
      ||a.actionId.localeCompare(b.actionId);
  }

  function candidates(input={}){
    const {familyId,level,family,slotKey,role}=validateInput(input,true);
    const data=D(),context=selectionContext(input.currentSelections||{},slotKey),items=[];
    for(const actionId of Object.keys(data.bodyActionMeta||{})){
      if(context.usedActionIds.has(actionId))continue;
      if(!isLegalCandidate({familyId,level,family,role,actionId}))continue;
      const meta=data.bodyActionMeta[actionId],action=data.actions[actionId];
      items.push({
        actionId,
        name:String(action.name||actionId),
        role,
        directTargets:[...(meta.directTargets||[])],
        secondaryTargets:[...(meta.secondaryTargets||[])],
        exerciseClass:String(meta.exerciseClass||''),
        fatigueCost:String(meta.fatigueCost||''),
        stabilityDemand:String(meta.stabilityDemand||''),
        repProfile:String(meta.repProfile||''),
        laterality:String(meta.laterality||''),
        pattern:String(action.pattern||''),
      });
    }
    items.sort((a,b)=>compareCandidates(a,b,{family,level,context}));
    return {recommended:items[0]?.actionId||'',candidates:items};
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
      const requestedActionId=normalizeActionId(requested[slotKey]);
      let actionId='',source='auto';
      const used=new Set(Object.values(chosen));
      if(requestedActionId&&!used.has(requestedActionId)&&isLegalCandidate({familyId,level,family,role,actionId:requestedActionId})){
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

  const api={resolve,candidates};
  window.V15BodyResolver=api;
  if(!window.V15TemplateResolver?.register)throw new Error('Template Resolver Dispatcher is unavailable');
  window.V15TemplateResolver.register('body',resolve);
})();
