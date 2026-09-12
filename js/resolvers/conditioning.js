(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const RISK=Object.freeze({low:0,medium:1,high:2});
  const METRIC_PREFERENCE=Object.freeze({
    STEADY:Object.freeze(['time','distance','calories','reps']),
    INTERVAL:Object.freeze(['time','reps','distance','calories']),
    CIRCUIT:Object.freeze(['reps','time','distance','calories']),
    DENSITY:Object.freeze(['reps','distance','time','calories']),
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

  function publicAnatomy(actionIds){
    const summary=window.V14Anatomy?.aggregate?.(actionIds)||{};
    return {
      actionIds:unique(actionIds),
      primary:unique(summary.primary),
      secondary:unique(summary.secondary),
      stabilizers:unique(summary.stabilizers),
    };
  }

  function validateBase(input={}){
    const data=D(),familyId=typeof input.familyId==='string'?input.familyId:'',level=typeof input.level==='string'?input.level:'';
    const family=data.conditioningFamilies?.[familyId],levelPolicy=data.conditioningLevelPolicies?.[level];
    if(!family)fail('CONDITIONING_INPUT_INVALID',`Unknown Conditioning family: ${String(familyId||'')}`,{familyId});
    if(!/^L[1-4]$/.test(level)||!levelPolicy)fail('CONDITIONING_INPUT_INVALID','Conditioning level must be L1-L4',{level});
    if(!window.V15ConditioningProtocol?.plan)fail('CONDITIONING_PROTOCOL_UNAVAILABLE','Conditioning Protocol Engine is unavailable');
    const plan=window.V15ConditioningProtocol.plan({familyId,level,protocolId:input.protocolId||''});
    return {familyId,level,family,levelPolicy,plan};
  }

  function stationIndex(slotKey){
    const match=/^STATION-(\d+)$/.exec(String(slotKey||''));
    return match?Number(match[1])-1:-1;
  }

  function primaryModality(meta){
    const active=new Set(Object.entries(D().conditioningModalities||{}).filter(([,r])=>r?.v1Status==='ACTIVE').map(([id])=>id));
    return (meta?.modalities||[]).find(id=>active.has(id))||meta?.modalities?.[0]||'';
  }

  function chooseWorkMetric(meta,protocolId){
    const allowed=new Set(D().conditioningProtocols?.[protocolId]?.allowedWorkMetrics||[]);
    const own=new Set(meta?.workMetrics||[]);
    return (METRIC_PREFERENCE[protocolId]||[]).find(metric=>allowed.has(metric)&&own.has(metric))
      ||[...own].find(metric=>allowed.has(metric))||'time';
  }

  function isLegalCandidate({familyId,level,protocolId,actionId}){
    const data=D(),meta=data.conditioningActionMeta?.[actionId],action=data.actions?.[actionId];
    if(!meta||!action)return false;
    if(action.status!=='可自动编排'||action.route!=='CONDITIONING_2F')return false;
    if(!meta.families?.includes(familyId)||!meta.levels?.includes(level)||!meta.protocolEligibility?.includes(protocolId))return false;
    if(familyId==='CON-04'&&meta.powerEligible!==true)return false;
    const protocol=data.conditioningProtocols?.[protocolId];
    if(!protocol)return false;
    if(!meta.workMetrics?.some(metric=>protocol.allowedWorkMetrics?.includes(metric)))return false;
    return true;
  }

  function isSelectionValid(input={}){
    let base;
    try{base=validateBase(input);}catch(error){
      if(['CONDITIONING_INPUT_INVALID','CONDITIONING_PROTOCOL_ILLEGAL','CONDITIONING_STATION_CAPACITY'].includes(error?.code))return false;
      throw error;
    }
    const index=stationIndex(input.stationKey||input.slotKey);
    if(index<0||index>=base.plan.stationCount)return false;
    const actionId=normalizeActionId(input.actionId);
    return !!actionId&&isLegalCandidate({...base,protocolId:base.plan.protocolId,actionId});
  }

  function selectionContext(currentSelections={},currentSlotKey=''){
    const data=D(),usedActionIds=new Set(),usedModalities=new Set();
    let lastPrimary='',highFatigueCount=0;
    const entries=Object.entries(currentSelections||{})
      .filter(([key])=>key!==currentSlotKey)
      .sort((a,b)=>stationIndex(a[0])-stationIndex(b[0]));
    entries.forEach(([,value])=>{
      const actionId=normalizeActionId(value),meta=data.conditioningActionMeta?.[actionId];
      if(!actionId||!meta)return;
      usedActionIds.add(actionId);
      (meta.modalities||[]).forEach(id=>usedModalities.add(id));
      lastPrimary=primaryModality(meta)||lastPrimary;
      if(meta.fatigueRisk==='high')highFatigueCount++;
    });
    return {usedActionIds,usedModalities,lastPrimary,highFatigueCount};
  }

  function candidateKey(candidate,{family,context}){
    const preferred=family.preferredModalities||[];
    const modalityIndex=preferred.indexOf(candidate.primaryModality);
    return {
      fatigue:RISK[candidate.fatigueRisk]??3,
      impact:RISK[candidate.impact]??3,
      coordination:RISK[candidate.coordinationDemand]??3,
      repeat:context.lastPrimary&&candidate.primaryModality===context.lastPrimary?1:0,
      noNew:candidate.modalities.some(id=>!context.usedModalities.has(id))?0:1,
      preferred:modalityIndex>=0?modalityIndex:999,
      power:family.familyId==='CON-04'?(candidate.powerEligible?0:1):0,
    };
  }

  function compareCandidates(a,b,ctx){
    const A=candidateKey(a,ctx),B=candidateKey(b,ctx);
    return A.power-B.power
      ||A.fatigue-B.fatigue
      ||A.impact-B.impact
      ||A.coordination-B.coordination
      ||A.repeat-B.repeat
      ||A.noNew-B.noNew
      ||A.preferred-B.preferred
      ||a.actionId.localeCompare(b.actionId);
  }

  function candidates(input={}){
    const base=validateBase(input),protocolId=base.plan.protocolId;
    const key=String(input.stationKey||input.slotKey||''),index=stationIndex(key);
    if(index<0||index>=base.plan.stationCount){
      fail('CONDITIONING_INPUT_INVALID',`Inactive or unknown station: ${key}`,{stationKey:key});
    }
    const context=selectionContext(input.currentSelections||{},key),items=[];
    for(const actionId of Object.keys(D().conditioningActionMeta||{})){
      if(context.usedActionIds.has(actionId))continue;
      if(!isLegalCandidate({familyId:base.familyId,level:base.level,protocolId,actionId}))continue;
      const meta=D().conditioningActionMeta[actionId],action=D().actions[actionId],workMetric=chooseWorkMetric(meta,protocolId);
      items.push({
        actionId,
        name:String(action.name||actionId),
        modalities:[...(meta.modalities||[])],
        primaryModality:primaryModality(meta),
        workMetric,
        impact:String(meta.impact||''),
        coordinationDemand:String(meta.coordinationDemand||''),
        fatigueRisk:String(meta.fatigueRisk||''),
        powerEligible:meta.powerEligible===true,
        pattern:String(action.pattern||''),
      });
    }
    items.sort((a,b)=>compareCandidates(a,b,{family:base.family,context}));
    return {recommended:items[0]?.actionId||'',candidates:items,protocolId};
  }

  function stationRecord(key,actionId,source,plan){
    const data=D(),meta=data.conditioningActionMeta[actionId]||{},action=data.actions[actionId]||{},workMetric=chooseWorkMetric(meta,plan.protocolId);
    return {
      key,
      actionId,
      name:String(action.name||actionId),
      source,
      primaryModality:primaryModality(meta),
      modalities:[...(meta.modalities||[])],
      workMetric,
      impact:String(meta.impact||''),
      coordinationDemand:String(meta.coordinationDemand||''),
      fatigueRisk:String(meta.fatigueRisk||''),
      powerEligible:meta.powerEligible===true,
      prescription:window.V15ConditioningProtocol.formatPrescription(plan,workMetric),
    };
  }

  function resolveBlock(input={}){
    const base=validateBase(input),plan=base.plan,requested=input.selections&&typeof input.selections==='object'?input.selections:{};
    const chosen={},stationMap={},publicItems=[],warnings=[];

    for(let index=0;index<plan.stationCount;index++){
      const key=`STATION-${index+1}`,requestedActionId=normalizeManualActionId(requested[key]);
      const used=new Set(Object.values(chosen));
      let actionId='',source='auto';
      if(requestedActionId&&!used.has(requestedActionId)&&isLegalCandidate({
        familyId:base.familyId,level:base.level,protocolId:plan.protocolId,actionId:requestedActionId,
      })){
        actionId=requestedActionId;
        source='manual';
      }else{
        if(requestedActionId)warnings.push(`COND_STALE_SELECTION_FALLBACK:${key}`);
        const result=candidates({
          familyId:base.familyId,level:base.level,protocolId:plan.protocolId,
          stationKey:key,currentSelections:chosen,
        });
        actionId=result.recommended;
        if(!actionId)fail('CONDITIONING_NO_ELIGIBLE_CANDIDATE',
          `No eligible Conditioning candidate for ${base.familyId} ${base.level} ${plan.protocolId} ${key}`,
          {familyId:base.familyId,level:base.level,protocolId:plan.protocolId,stationKey:key});
      }
      chosen[key]=actionId;
      const record=stationRecord(key,actionId,source,plan);
      stationMap[key]=record;
      publicItems.push({
        actionId:record.actionId,
        name:record.name,
        prescription:record.prescription,
      });
    }

    const metrics={
      stationCount:plan.stationCount,
      rounds:plan.rounds,
      workSeconds:plan.workSeconds,
      restSeconds:plan.restSeconds,
      transitionSeconds:plan.transitionSeconds,
      densityWindowMinutes:plan.densityWindowMinutes,
      targetRpe:plan.targetRpe,
      activeWorkMinutes:plan.activeWorkMinutes,
      blockMinutes:plan.blockMinutes,
      estimatedMinutes:plan.estimatedMinutes,
    };
    return {
      kind:'CONDITIONING_PROTOCOL_BLOCK',
      familyId:base.familyId,
      level:base.level,
      protocolId:plan.protocolId,
      protocolName:plan.protocolName,
      plan:{...plan},
      stations:stationMap,
      publicBlock:{key:'MAIN',label:'Conditioning 主训练',items:publicItems},
      metrics,
      warnings,
      resolvedSelections:Object.values(stationMap).map(item=>({key:item.key,actionId:item.actionId,source:item.source})),
    };
  }

  function serializeBlock(block){
    if(!block||block.kind!=='CONDITIONING_PROTOCOL_BLOCK')fail('CONDITIONING_BLOCK_INVALID','Conditioning block is invalid');
    return JSON.parse(JSON.stringify(block));
  }

  function maxRisk(items,field){
    let best='low';
    items.forEach(item=>{if((RISK[item?.[field]]??0)>(RISK[best]??0))best=item[field];});
    return best;
  }

  function evaluateConflict(session){
    if(!window.V15Conflict?.evaluate)fail('CONDITIONING_CONFLICT_UNAVAILABLE','Conditioning conflict service is unavailable');
    return window.V15Conflict.evaluate('conditioning',session,{
      sharedPolicy:{allowedRoutes:['CONDITIONING_2F'],allowedStatuses:['可自动编排']},
    });
  }

  function resolve(input={}){
    const block=resolveBlock(input),data=D(),family=data.conditioningFamilies[block.familyId];
    const stationItems=Object.values(block.stations),actionIds=stationItems.map(item=>item.actionId);
    const anatomy=publicAnatomy(actionIds);
    const modalities=unique(stationItems.flatMap(item=>item.modalities));
    const prepContext=window.V14PrepResolver?.contextFromConditioning?.({
      level:block.level,
      recipeId:block.familyId,
      firstStationActionIds:actionIds.slice(0,2),
      mainActionIds:actionIds,
      formalActionIds:actionIds,
      targetMuscles:anatomy.primary,
      modalities,
      impactDemand:maxRisk(stationItems,'impact'),
      powerDemand:block.familyId==='CON-04'?'high':stationItems.some(item=>item.powerEligible)?'moderate':'low',
    })||{
      template:'conditioning',level:block.level,recipeId:block.familyId,mainPatterns:[],mainActionIds:actionIds,
      formalActionIds:actionIds,targetMuscles:anatomy.primary,modalities,impactDemand:maxRisk(stationItems,'impact'),
      powerDemand:block.familyId==='CON-04'?'high':'low',
    };
    const title=`${family.name}｜${block.level}`;
    const summary=`${block.protocolName}｜${block.metrics.stationCount} 站｜RPE ${block.metrics.targetRpe}｜约 ${block.metrics.estimatedMinutes} 分钟`;
    const session={
      schemaVersion:1,
      resolverVersion:'conditioning-v1',
      templateId:'conditioning',
      familyId:block.familyId,
      level:block.level,
      title,
      summary,
      main:{
        kind:'PROTOCOL',
        content:{
          protocolId:block.protocolId,
          name:block.protocolName,
          blocks:[block.publicBlock],
          metrics:{...block.metrics},
        },
      },
      prepContext,
      anatomyContext:anatomy,
      conflictContext:{status:'PASS',hardCount:0,warnCount:0,issues:[]},
      copyContext:{title,summary,actionIds:unique(actionIds)},
      warnings:[...block.warnings],
      resolvedSelections:block.resolvedSelections,
      source:{type:'GENERATED',id:`${block.familyId}-${block.level}-${block.protocolId}`},
      domainContext:{
        kind:'CONDITIONING',
        protocolId:block.protocolId,
        protocolName:block.protocolName,
        stations:block.stations,
        metrics:{...block.metrics},
      },
    };
    session.conflictContext=evaluateConflict(session);
    const validation=window.V15ResolvedSession?.validate?.(session);
    if(validation&&!validation.ok)fail('CONDITIONING_RESOLVED_SESSION_INVALID',
      'Conditioning Resolver produced invalid ResolvedSession',{validationErrors:validation.errors});
    return session;
  }

  const api={resolve,resolveBlock,serializeBlock,candidates,isSelectionValid};
  window.V15ConditioningResolver=api;
  if(!window.V15TemplateResolver?.register)throw new Error('Template Resolver Dispatcher is unavailable');
  window.V15TemplateResolver.register('conditioning',resolve);
})();
