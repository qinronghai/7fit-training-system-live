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
    const match=/(?:^|\/)STATION-(\d+)$/.exec(String(slotKey||''));
    return match?Number(match[1])-1:-1;
  }

  function stationNamespace(slotKey){
    const value=String(slotKey||''),match=/^(BLOCK-[ABC])\/(STATION-\d+)$/.exec(value);
    return {blockKey:match?match[1]:'',stationKey:match?match[2]:value};
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
    if(input.variantId||input.sessionBlueprintId){
      const variant=window.V15ConditioningProtocol.blueprint({
        familyId:input.familyId,
        level:input.level,
        variantId:input.variantId||'A',
      });
      const namespace=stationNamespace(input.stationKey||input.slotKey);
      const block=variant.blocks.find(item=>item.key===namespace.blockKey);
      const index=stationIndex(namespace.stationKey);
      if(!block||index<0||index>=block.stations.length)return false;
      const actionId=normalizeActionId(input.actionId);
      if(!actionId)return false;
      if(variant.repeatPolicy==='UNIQUE_ACTIONS'){
        const currentKey=input.stationKey||input.slotKey||'';
        const duplicate=Object.entries(input.currentSelections||{})
          .some(([key,value])=>key!==currentKey&&normalizeActionId(value)===actionId);
        if(duplicate)return false;
      }
      return isLegalCandidate({
        familyId:input.familyId,
        level:input.level,
        protocolId:block.protocolId,
        actionId,
      });
    }
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
    const stationCount=Number.isInteger(Number(input.stationCount))?Number(input.stationCount):base.plan.stationCount;
    if(index<0||index>=stationCount){
      fail('CONDITIONING_INPUT_INVALID',`Inactive or unknown station: ${key}`,{stationKey:key});
    }
    const context=selectionContext(input.currentSelections||{},key),items=[];
    for(const actionId of Object.keys(D().conditioningActionMeta||{})){
      if(context.usedActionIds.has(actionId)&&input.allowRepeatedActions!==true)continue;
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

  function stationRecord(key,actionId,source,plan,details={}){
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
      taskLabel:String(details.taskLabel||action.name||actionId),
      setup:String(details.setup||''),
      equipment:String(details.equipment||action.equipment||''),
      zone:String(details.zone||action.zone||''),
      blockKey:String(details.blockKey||stationNamespace(key).blockKey||''),
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

  function resolveLegacy(input={}){
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

  function resolveBlueprintBlock({familyId,level,blueprint,definition,selections,chosen,warnings}){
    const protocol=window.V15ConditioningProtocol;
    const allowRepeatedActions=blueprint.repeatPolicy==='SKILL_VARIATION';
    const plan=protocol.plan({
      familyId,
      level,
      protocolId:definition.protocolId,
      stationCount:definition.stations.length,
      targetBlockMinutes:definition.targetMinutes,
      targetRpe:definition.targetRpe,
      allowRepeatedActions,
    });
    const stations={},items=[];
    definition.stations.forEach((stationDefinition,index)=>{
      const key=`${definition.key}/STATION-${index+1}`;
      const requestedActionId=normalizeManualActionId(selections[key]);
      const used=new Set(Object.values(chosen));
      const canUse=actionId=>isLegalCandidate({familyId,level,protocolId:definition.protocolId,actionId})
        &&(allowRepeatedActions||!used.has(actionId));
      let actionId='',source='auto';
      if(requestedActionId&&canUse(requestedActionId)){
        actionId=requestedActionId;
        source='manual';
      }else{
        if(requestedActionId)warnings.push(`COND_STALE_SELECTION_FALLBACK:${key}`);
        if(canUse(stationDefinition.actionId))actionId=stationDefinition.actionId;
        if(!actionId){
          const result=candidates({
            familyId,level,protocolId:definition.protocolId,stationKey:key,
            stationCount:definition.stations.length,currentSelections:chosen,allowRepeatedActions,
          });
          actionId=result.recommended;
        }
        if(!actionId)fail('CONDITIONING_NO_ELIGIBLE_CANDIDATE',
          `No eligible Conditioning candidate for ${familyId} ${level} ${definition.protocolId} ${key}`,
          {familyId,level,protocolId:definition.protocolId,stationKey:key});
      }
      chosen[key]=actionId;
      const record=stationRecord(key,actionId,source,plan,{...stationDefinition,blockKey:definition.key});
      stations[key]=record;
      items.push({
        actionId:record.actionId,
        name:record.name,
        prescription:record.prescription,
        allowRepeatedAction:allowRepeatedActions,
      });
    });
    return {
      key:definition.key,
      role:definition.role,
      roleLabel:definition.roleLabel,
      label:definition.label,
      goal:definition.goal,
      protocolId:definition.protocolId,
      protocolName:plan.protocolName,
      prescription:definition.prescription,
      plan:{...plan},
      stations,
      publicBlock:{key:definition.key,label:definition.label,items},
      metrics:{
        ...plan,
        durationMinutes:plan.blockMinutes,
        transitionAfterSeconds:definition.transitionAfterSeconds,
        interBlockRecoverySeconds:definition.interBlockRecoverySeconds,
      },
      coachingCues:[...definition.coachingCues],
      scaleRules:[...definition.scaleRules],
      stopCriteria:[...definition.stopCriteria],
      completionMetric:definition.completionMetric,
      equipment:[...definition.equipment],
      zone:definition.zone,
      setup:definition.setup,
      warnings:[],
      resolvedSelections:Object.values(stations).map(item=>({key:item.key,actionId:item.actionId,source:item.source})),
    };
  }

  function resolveBlueprint(input={}){
    const familyId=typeof input.familyId==='string'?input.familyId:'';
    const level=typeof input.level==='string'?input.level:'';
    const blueprint=window.V15ConditioningProtocol.blueprint({familyId,level,variantId:input.variantId||'A'});
    const selections=input.selections&&typeof input.selections==='object'?input.selections:{};
    const chosen={},warnings=[],blocks=[];
    blueprint.blocks.forEach(definition=>{
      blocks.push(resolveBlueprintBlock({familyId,level,blueprint,definition,selections,chosen,warnings}));
    });
    const stationItems=blocks.flatMap(block=>Object.values(block.stations));
    const actionIds=stationItems.map(item=>item.actionId),uniqueActionIds=unique(actionIds);
    const anatomy=publicAnatomy(actionIds);
    const modalities=unique(stationItems.flatMap(item=>item.modalities));
    const prepContext=window.V14PrepResolver?.contextFromConditioning?.({
      level,
      recipeId:familyId,
      firstStationActionIds:actionIds.slice(0,2),
      mainActionIds:actionIds,
      formalActionIds:actionIds,
      targetMuscles:anatomy.primary,
      modalities,
      impactDemand:maxRisk(stationItems,'impact'),
      powerDemand:familyId==='CON-04'?'high':stationItems.some(item=>item.powerEligible)?'moderate':'low',
    })||{
      template:'conditioning',level,recipeId:familyId,mainPatterns:[],mainActionIds:uniqueActionIds,
      formalActionIds:uniqueActionIds,targetMuscles:anatomy.primary,modalities,
      impactDemand:maxRisk(stationItems,'impact'),powerDemand:familyId==='CON-04'?'high':'low',
    };
    const blockExecutionMinutes=blocks.reduce((sum,block)=>sum+Number(block.metrics.blockMinutes||0),0);
    const transitionSeconds=blocks.reduce((sum,block)=>sum+Number(block.metrics.transitionAfterSeconds||0),0);
    const interBlockRecoverySeconds=blocks.reduce((sum,block)=>sum+Number(block.metrics.interBlockRecoverySeconds||0),0);
    const mainTrainingMinutes=Math.round((blockExecutionMinutes+(transitionSeconds+interBlockRecoverySeconds)/60)*10)/10;
    const fullSessionMinutes=Math.round((Number(blueprint.prep.durationMinutes||0)+mainTrainingMinutes+Number(blueprint.recovery.durationMinutes||0))*10)/10;
    const targetWorkMinutes=Math.round(blocks.reduce((sum,block)=>sum+Number(block.metrics.targetBlockMinutes||0),0)*10)/10;
    const timing={
      prepMinutes:Number(blueprint.prep.durationMinutes||0),
      blockExecutionMinutes:Math.round(blockExecutionMinutes*10)/10,
      transitionMinutes:Math.round(transitionSeconds/60*10)/10,
      interBlockRecoveryMinutes:Math.round(interBlockRecoverySeconds/60*10)/10,
      mainTrainingMinutes,
      recoveryMinutes:Number(blueprint.recovery.durationMinutes||0),
      fullSessionMinutes,
      estimatedMinutes:Math.round(fullSessionMinutes),
      targetWorkMinutes,
      blockCount:blocks.length,
      taskCount:stationItems.length,
    };
    const family=D().conditioningFamilies?.[familyId]||{};
    const mainBlock=blocks.find(block=>block.role==='MAIN')||blocks[0];
    const title=`${family.name||familyId}｜${level}`;
    const summary=`${blueprint.label}｜${blocks.length} 个训练段｜${timing.taskCount} 个任务｜整节约 ${timing.estimatedMinutes} 分钟`;
    const session={
      schemaVersion:2,
      resolverVersion:'conditioning-v2',
      templateId:'conditioning',
      familyId,
      level,
      title,
      summary,
      sessionBlueprintId:blueprint.sessionBlueprintId,
      variantId:blueprint.variantId,
      blocks,
      timing,
      main:{
        kind:'PROTOCOL',
        content:{
          protocolId:mainBlock?.protocolId||'INTERVAL',
          name:'多段式 Conditioning 课程',
          blocks:blocks.map(block=>block.publicBlock),
          metrics:{
            ...timing,
            protocolId:mainBlock?.protocolId||'INTERVAL',
            protocolName:mainBlock?.protocolName||'—',
            stationCount:timing.taskCount,
            rounds:mainBlock?.metrics?.rounds||1,
            targetRpe:mainBlock?.metrics?.targetRpe||0,
            blockMinutes:timing.mainTrainingMinutes,
            estimatedMinutes:timing.estimatedMinutes,
          },
        },
      },
      prepContext,
      anatomyContext:anatomy,
      conflictContext:{status:'PASS',hardCount:0,warnCount:0,issues:[]},
      copyContext:{title,summary,actionIds:uniqueActionIds},
      warnings,
      resolvedSelections:stationItems.map(item=>({key:item.key,actionId:item.actionId,source:item.source})),
      source:{type:'GENERATED',id:blueprint.sessionBlueprintId},
      domainContext:{
        kind:'CONDITIONING',
        protocolId:mainBlock?.protocolId||'INTERVAL',
        protocolName:'多段式 Conditioning 课程',
        sessionBlueprintId:blueprint.sessionBlueprintId,
        variantId:blueprint.variantId,
        blueprintLabel:blueprint.label,
        changeSummary:blueprint.changeSummary,
        repeatPolicy:blueprint.repeatPolicy,
        blocks,
        stations:Object.fromEntries(stationItems.map(item=>[item.key,item])),
        metrics:{
          ...timing,
          stationCount:timing.taskCount,
          rounds:mainBlock?.metrics?.rounds||1,
          workSeconds:mainBlock?.metrics?.workSeconds||0,
          restSeconds:mainBlock?.metrics?.restSeconds||0,
          transitionSeconds:mainBlock?.metrics?.transitionSeconds||0,
          densityWindowMinutes:mainBlock?.metrics?.densityWindowMinutes||0,
          targetRpe:mainBlock?.metrics?.targetRpe||0,
          activeWorkMinutes:timing.blockExecutionMinutes,
          blockMinutes:timing.mainTrainingMinutes,
          estimatedMinutes:timing.estimatedMinutes,
        },
      },
    };
    session.conflictContext=evaluateConflict(session);
    const validation=window.V15ResolvedSession?.validate?.(session);
    if(validation&&!validation.ok)fail('CONDITIONING_RESOLVED_SESSION_INVALID',
      'Conditioning Blueprint Resolver produced invalid ResolvedSession',{validationErrors:validation.errors});
    return session;
  }

  function resolve(input={}){
    if(input?.legacy===true||(input?.protocolId&&!input?.variantId&&!input?.sessionBlueprintId))return resolveLegacy(input);
    return resolveBlueprint(input);
  }

  const api={resolve,resolveLegacy,resolveBlueprint,resolveBlock,serializeBlock,candidates,isSelectionValid};
  window.V15ConditioningResolver=api;
  if(!window.V15TemplateResolver?.register)throw new Error('Template Resolver Dispatcher is unavailable');
  window.V15TemplateResolver.register('conditioning',resolve);
})();
