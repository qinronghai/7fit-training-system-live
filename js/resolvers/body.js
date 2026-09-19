(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const MAIN_ROUTES=new Set(['1F_ONLY','FLEX_1F_2F']);
  const SLOT_ORDER=Object.freeze(['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2','OPTIONAL']);
  const STABILITY_RANK=Object.freeze({low:0,medium:1,high:2});
  const FATIGUE_RANK=Object.freeze({low:0,medium:1,high:2});
  const LEVEL_ORDER=Object.freeze(['L1','L2','L3','L4']);
  const LOADING_STYLE_BY_PROFILE=Object.freeze({
    accessory_compound:'bodyweight_or_light',
    compound_machine:'stable_machine',
    compound_freeweight:'freeweight',
    single_leg_compound:'unilateral',
    isolation_large:'isolation',
    isolation_small:'isolation',
  });

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
      L1:Object.freeze({meaningfulDirectSets:1,excessiveShare:0.72,localFatigueWarn:5.5}),
      L2:Object.freeze({meaningfulDirectSets:2,excessiveShare:0.72,localFatigueWarn:6.0}),
      L3:Object.freeze({meaningfulDirectSets:2,excessiveShare:0.76,localFatigueWarn:6.5}),
      L4:Object.freeze({meaningfulDirectSets:3,excessiveShare:0.78,localFatigueWarn:7.0}),
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

  function familyLevelPool(familyId,level){
    const pool=D().bodyFamilies?.[familyId]?.levelPools?.[level];
    return pool&&typeof pool==='object'?pool:null;
  }

  function progressionMembership(familyId,actionId){
    const chains=D().bodyFamilies?.[familyId]?.progressionChains||{};
    for(const [chainId,chain] of Object.entries(chains)){
      const nodes=Array.isArray(chain?.nodes)?chain.nodes:[];
      const index=nodes.findIndex(node=>node?.actionId===actionId);
      if(index>=0)return {
        chainId,
        chainName:String(chain?.name||chainId),
        index,
        node:{...nodes[index]},
        retentionPolicy:String(chain?.retentionPolicy||''),
      };
    }
    return null;
  }

  function exerciseFamilyOf(actionId){
    const meta=D().bodyActionMeta?.[actionId]||{};
    return String(meta.exerciseFamily||actionId||'');
  }

  function actionEntryLevel(meta={}){
    const levels=Array.isArray(meta.levels)?meta.levels:[];
    return LEVEL_ORDER.find(level=>levels.includes(level))||'';
  }

  function loadingStyleOf(meta={}){
    return LOADING_STYLE_BY_PROFILE[meta.repProfile]||'';
  }

  function normalizeVenueOverrideReason(value){
    if(typeof value==='string')return value.trim();
    if(value&&typeof value==='object'&&typeof value.venueOverrideReason==='string')return value.venueOverrideReason.trim();
    if(value&&typeof value==='object'&&typeof value.overrideReason==='string')return value.overrideReason.trim();
    return '';
  }

  function finiteVenueNumber(value){
    if(typeof value==='number')return Number.isFinite(value)?value:null;
    if(typeof value==='string'&&value.trim()!==''){
      const parsed=Number(value);
      return Number.isFinite(parsed)?parsed:null;
    }
    return null;
  }

  function actionEquipmentIds(actionId){
    const action=D().actions?.[actionId]||{};
    const declared=Array.isArray(action.requiresEquipmentId)&&action.requiresEquipmentId.length
      ?action.requiresEquipmentId
      :String(action.equipmentId||'').split(/[、,，]/).map(value=>value.trim()).filter(Boolean);
    return unique(declared);
  }

  function stationDiversityPolicy(){
    return D().venueCapabilityPolicy?.stationDiversityPolicy||{};
  }

  function actionStationRecord(actionId){
    const data=D(),action=data.actions?.[actionId]||{},policy=stationDiversityPolicy();
    const equipmentIds=actionEquipmentIds(actionId);
    const explicitStationId=typeof action.stationId==='string'?action.stationId.trim():'';
    const venueStations=unique(equipmentIds.map(equipmentId=>String(
      data.venueCapabilityPolicy?.equipment?.[equipmentId]?.stationId||''
    ).trim()).filter(Boolean));
    const stationId=explicitStationId||(venueStations.length===1?venueStations[0]:'');
    const stationGroup=typeof action.stationGroup==='string'?action.stationGroup.trim():'';
    const group=stationGroup?policy.stationGroups?.[stationGroup]:null;
    return {
      actionId:String(actionId||''),
      actionName:String(action.name||actionId||'未知动作'),
      equipmentIds,
      stationId,
      stationGroup,
      stationName:String(action.equipment||group?.name||stationId||''),
      stationGroupName:String(group?.name||stationGroup||''),
      stationGroupMaxFormalActions:Number.isInteger(group?.maxFormalActions)?group.maxFormalActions:null,
      status:stationId?'MAPPED':'UNVERIFIED',
    };
  }

  function stationRole(familyId,slotKey){
    return D().bodyFamilies?.[familyId]?.slotPolicy?.[slotKey]||'';
  }

  function stationReuseIsExplicit(stationReusePolicy){
    return String(stationReusePolicy||'')===String(stationDiversityPolicy().explicitReuseToken||'');
  }

  function assessEquipmentStation({familyId,level,slotKey,actionId,currentSelections={},stationReusePolicy=''}={}){
    const policy=stationDiversityPolicy(),record=actionStationRecord(actionId);
    const formalRoles=new Set(Array.isArray(policy.formalRoles)?policy.formalRoles:[]);
    const role=stationRole(familyId,slotKey);
    const explicitReuse=stationReuseIsExplicit(stationReusePolicy);
    const peers=[];
    for(const [peerSlotKey,peerValue] of Object.entries(currentSelections||{})){
      if(peerSlotKey===slotKey)continue;
      const peerActionId=normalizeActionId(peerValue),peerRole=stationRole(familyId,peerSlotKey);
      if(!peerActionId||!formalRoles.has(peerRole))continue;
      peers.push({slotKey:peerSlotKey,role:peerRole,...actionStationRecord(peerActionId)});
    }
    const sameStation=record.stationId
      ?peers.filter(peer=>peer.stationId===record.stationId)
      :[];
    const sameGroup=record.stationGroup
      ?peers.filter(peer=>peer.stationGroup===record.stationGroup)
      :[];
    const exactConflict=sameStation.length>0;
    const groupLimit=record.stationGroupMaxFormalActions;
    const groupConcentration=Number.isInteger(groupLimit)&&sameGroup.length+1>groupLimit;
    const reasons=[];
    const warnings=[];
    if(exactConflict&&!explicitReuse)reasons.push('BODY_EQUIPMENT_STATION_DUPLICATE');
    if(groupConcentration)warnings.push('BODY_EQUIPMENT_STATION_CONCENTRATION');
    const reason=exactConflict
      ?`${record.actionName} 与 ${sameStation.map(peer=>peer.actionName).join('、')} 使用同一台物理器械（${record.stationName||record.stationGroupName||record.stationId}）；同一节 Body 正式动作默认不重复占用。`
      :groupConcentration
        ?`${record.stationName||record.stationGroupName||record.stationGroup} 本节将承担 ${sameGroup.length+1} 个正式动作，超过 ${groupLimit} 个的体验提醒阈值；请确认站点安排。`
        :!record.stationId
          ?`${record.actionName} 尚未录入已核验的物理站点；系统不按 equipmentId 猜测，保留未核验审计状态。`
          :'';
    return {
      ok:reasons.length===0,
      status:exactConflict?(explicitReuse?'EXPLICIT_REUSE':'BLOCKED'):groupConcentration?'GROUP_WARN':record.status,
      familyId:String(familyId||''),
      level:String(level||''),
      slotKey:String(slotKey||''),
      role,
      ...record,
      reasons,
      warnings,
      conflicts:sameStation.map(peer=>({slotKey:peer.slotKey,actionId:peer.actionId,actionName:peer.actionName,stationId:peer.stationId})),
      groupPeers:sameGroup.map(peer=>({slotKey:peer.slotKey,actionId:peer.actionId,actionName:peer.actionName,stationGroup:peer.stationGroup})),
      reusePolicy:explicitReuse?'STATION_REUSE_ALLOWED':String(policy.defaultReuseMode||'BLOCK'),
      explicitReuse,
      reason,
    };
  }

  function venueReasonText(code,{level,levelCeilingKg,minimumSystemLoadKg,equipmentId,actionName,minimumReasonLength}={}){
    if(code==='BODY_VENUE_MIN_LOAD_EXCEEDS_LEVEL'){
      return `${actionName||equipmentId||'当前动作'} 的场馆最低系统负重约 ${minimumSystemLoadKg}kg，高于 ${level} 默认可接受的 ${levelCeilingKg}kg；已准备安全退阶。`;
    }
    if(code==='BODY_VENUE_EQUIPMENT_UNAVAILABLE')return `${equipmentId||'当前器械'} 当前标记为不可用，不能进入默认编课。`;
    if(code==='BODY_VENUE_OVERRIDE_REASON_REQUIRED')return `场馆 Gate 需要至少 ${minimumReasonLength} 个字的教练现场确认理由。`;
    return '';
  }

  function assessVenueEligibility({familyId,level,slotKey,actionId,overrideReason=''}={}){
    const data=D(),policy=data.venueCapabilityPolicy||{},action=data.actions?.[actionId]||{};
    const levelCeilingRaw=policy.bodyLevelMinimumSystemLoadCeilingKg?.[level];
    const levelCeilingKg=finiteVenueNumber(levelCeilingRaw);
    const equipmentIds=actionEquipmentIds(actionId),equipment=policy.equipment||{};
    const checks=[],blocking=[],minimumSystemLoads=[],minimumExternalLoads=[];
    for(const equipmentId of equipmentIds){
      const record=equipment[equipmentId];
      if(!record){
        checks.push({equipmentId,status:'UNVERIFIED',minimumSystemLoadKg:null,minimumExternalLoadKg:null});
        continue;
      }
      const minimumSystemLoadKg=finiteVenueNumber(record.minimumSystemLoadKg);
      const minimumExternalLoadKg=finiteVenueNumber(record.minimumExternalLoadKg);
      if(minimumSystemLoadKg!==null)minimumSystemLoads.push(minimumSystemLoadKg);
      if(minimumExternalLoadKg!==null)minimumExternalLoads.push(minimumExternalLoadKg);
      if(record.venueAvailability==='UNAVAILABLE'){
        blocking.push({code:'BODY_VENUE_EQUIPMENT_UNAVAILABLE',equipmentId,minimumSystemLoadKg,minimumExternalLoadKg});
        checks.push({equipmentId,status:'BLOCKED',minimumSystemLoadKg,minimumExternalLoadKg});
        continue;
      }
      if(minimumSystemLoadKg!==null&&levelCeilingKg!==null&&minimumSystemLoadKg>levelCeilingKg){
        blocking.push({code:'BODY_VENUE_MIN_LOAD_EXCEEDS_LEVEL',equipmentId,minimumSystemLoadKg,minimumExternalLoadKg});
        checks.push({equipmentId,status:'BLOCKED',minimumSystemLoadKg,minimumExternalLoadKg});
        continue;
      }
      checks.push({
        equipmentId,
        status:minimumSystemLoadKg===null?'UNVERIFIED':'PASS',
        minimumSystemLoadKg,
        minimumExternalLoadKg,
      });
    }
    const minimumSystemLoadKg=minimumSystemLoads.length?Math.max(...minimumSystemLoads):null;
    const minimumExternalLoadKg=minimumExternalLoads.length?Math.max(...minimumExternalLoads):null;
    const hasUnverified=checks.some(check=>check.status==='UNVERIFIED');
    const gate=action.beginnerLoadGate&&typeof action.beginnerLoadGate==='object'?action.beginnerLoadGate:null;
    const manualPolicy=policy.manualOverridePolicy||{};
    const reason=normalizeVenueOverrideReason(overrideReason);
    const minimumReasonLength=Number.isInteger(manualPolicy.minimumReasonLength)?manualPolicy.minimumReasonLength:8;
    const blocked=blocking.length>0;
    const onlyLoadThresholdBlock=blocked&&blocking.every(item=>item.code==='BODY_VENUE_MIN_LOAD_EXCEEDS_LEVEL');
    const overrideAllowed=onlyLoadThresholdBlock&&gate?.type==='minimum_system_load'&&gate.manualOverrideAllowed===true;
    const reasonRequired=overrideAllowed&&manualPolicy.requiresReason===true;
    const overrideAccepted=overrideAllowed&&(!reasonRequired||reason.length>=minimumReasonLength);
    const reasonCodes=[...new Set(blocking.map(item=>item.code))];
    if(blocked&&overrideAllowed&&reasonRequired&&reason.length>0&&reason.length<minimumReasonLength){
      reasonCodes.push('BODY_VENUE_OVERRIDE_REASON_REQUIRED');
    }
    if(!blocked&&hasUnverified)reasonCodes.push('BODY_VENUE_METADATA_UNVERIFIED');
    const primaryCode=reasonCodes[0]||'';
    const status=overrideAccepted?'OVERRIDDEN':blocked?'BLOCKED':hasUnverified?'UNVERIFIED':'PASS';
    return {
      ok:!blocked||overrideAccepted,
      status,
      familyId:String(familyId||''),
      level:String(level||''),
      slotKey:String(slotKey||''),
      actionId:String(actionId||''),
      actionName:String(action.name||actionId||''),
      equipmentIds,
      equipmentChecks:checks,
      minimumSystemLoadKg,
      minimumExternalLoadKg,
      levelCeilingKg,
      reasons:reasonCodes,
      reason:venueReasonText(primaryCode,{level,levelCeilingKg,minimumSystemLoadKg,equipmentId:blocking[0]?.equipmentId,actionName:action.name,minimumReasonLength})
        ||(hasUnverified?'场馆尚未录入该器械最低负重；不虚构 Gate，保留未核验审计状态。':''),
      overrideAllowed,
      overrideReasonRequired:reasonRequired,
      overrideAccepted,
      overrideReason:overrideAccepted?reason:'',
      minimumReasonLength,
      fallbackActionGroup:String(action.fallbackActionGroup||''),
      policyVersion:String(policy.policyVersion||''),
    };
  }

  function assessLevelPoolEligibility({familyId,level,slotKey,actionId}={}){
    const pool=familyLevelPool(familyId,level),family=D().bodyFamilies?.[familyId];
    if(!pool||!family||!actionId)return {
      ok:false,reasons:['BODY_LEVEL_POOL_MISSING'],familyId:String(familyId||''),level:String(level||''),
      slotKey:String(slotKey||''),actionId:String(actionId||''),preference:'excluded',priorityScore:0,reason:''
    };
    const replacement=Array.isArray(pool.replacementActionIds)?pool.replacementActionIds:[];
    if(!replacement.includes(actionId))return {
      ok:false,reasons:['BODY_LEVEL_POOL_EXCLUDED'],familyId,level,slotKey,actionId,
      preference:'excluded',priorityScore:0,reason:`不在 ${familyId} ${level} 正式替换池`
    };
    const preferred=Array.isArray(pool.preferredBySlot?.[slotKey])?pool.preferredBySlot[slotKey]:[];
    const preferredIndex=preferred.indexOf(actionId);
    const introduced=(pool.introducedActionIds||[]).includes(actionId);
    const retained=(pool.retainedActionIds||[]).includes(actionId);
    const membership=progressionMembership(familyId,actionId);
    let preference='replacement',priorityScore=0.08,reason='当前等级合法替换动作';
    if(preferredIndex>=0){
      preference='preferred';
      priorityScore=preferredIndex===0?1:0.82;
      reason=`当前 ${level} ${slotKey} 优先池第 ${preferredIndex+1} 位`;
    }else if(introduced){
      preference='introduced';
      priorityScore=0.55;
      reason=`当前 ${level} 新准入动作，可作为替换`;
    }else if(retained){
      preference='retained';
      priorityScore=0.18;
      reason=`低等级已掌握动作，${level} 明确保留为向下兼容替换`;
    }
    return {
      ok:true,reasons:[],familyId,level,slotKey,actionId,preference,preferredIndex,
      priorityScore,reason,
      qualificationReason:String(pool.qualificationReason||''),
      downwardCompatibleLevels:[...(pool.downwardCompatibleLevels||[])],
      fallbackLevel:String(pool.fallbackLevel||''),
      progression:membership,
    };
  }

  function assessLevelEligibility({level,actionId}={}){
    const data=D(),policy=data.bodyLevelPolicies?.[level],meta=data.bodyActionMeta?.[actionId],action=data.actions?.[actionId];
    const reasons=[];
    if(!policy||!meta||!action)return {
      ok:false,reasons:['BODY_LEVEL_INPUT_INVALID'],currentLevel:String(level||''),actionId:String(actionId||''),
      actionEntryLevel:'',loadingStyle:'',qualifiedBy:[]
    };

    const entryLevel=actionEntryLevel(meta),loadingStyle=loadingStyleOf(meta);
    if(!meta.levels?.includes(level))reasons.push('BODY_LEVEL_NOT_LISTED');
    if(!entryLevel||!policy.eligibleEntryLevels?.includes(entryLevel))reasons.push('BODY_LEVEL_ENTRY_TIER');
    if(!loadingStyle||!policy.allowedLoadingStyles?.includes(loadingStyle))reasons.push('BODY_LEVEL_LOADING_STYLE');

    const stability=STABILITY_RANK[meta.stabilityDemand]??99;
    const maxStability=STABILITY_RANK[policy.maxStabilityDemand]??-1;
    if(stability>maxStability)reasons.push('BODY_LEVEL_STABILITY');

    if(meta.exerciseClass==='compound'){
      const fatigue=FATIGUE_RANK[meta.fatigueCost]??99;
      const maxFatigue=FATIGUE_RANK[policy.maxCompoundFatigue]??-1;
      if(fatigue>maxFatigue)reasons.push('BODY_LEVEL_FATIGUE');
    }

    const qualifiedBy=[
      entryLevel?`最早准入 ${entryLevel}`:'',
      loadingStyle?`负荷类型 ${loadingStyle}`:'',
      meta.stabilityDemand?`稳定性 ${meta.stabilityDemand}`:'',
      meta.laterality==='unilateral'?`单侧准备 ${policy.unilateralReadiness}`:'',
      policy.romExpectation?`ROM ${policy.romExpectation}`:'',
    ].filter(Boolean);
    return {
      ok:reasons.length===0,reasons,currentLevel:level,actionId,
      actionEntryLevel:entryLevel,loadingStyle,
      maxStabilityDemand:policy.maxStabilityDemand,
      maxCompoundFatigue:policy.maxCompoundFatigue,
      unilateralReadiness:policy.unilateralReadiness,
      romExpectation:policy.romExpectation,
      tempoPauseEligibility:[...(policy.tempoPauseEligibility||[])],
      intensityTechniqueEligibility:[...(policy.intensityTechniqueEligibility||[])],
      fallbackLevel:policy.fallbackLevel,
      qualifiedBy,
    };
  }

  function baseIntentAssessment({familyId,level,family,slotKey,role,actionId}){
    const data=D(),meta=data.bodyActionMeta?.[actionId],action=data.actions?.[actionId],reasons=[];
    const intent=slotIntentFor(family,slotKey);
    if(!meta||!action)reasons.push('BODY_ACTION_UNKNOWN');
    if(!intent)reasons.push('BODY_SLOT_INTENT_MISSING');
    if(reasons.length)return {ok:false,reasons,intent,meta,action};

    if(!meta.families?.includes(familyId))reasons.push('BODY_FAMILY_DEVIATION');
    const levelEligibility=assessLevelEligibility({level,actionId});
    if(!levelEligibility.ok)reasons.push(...levelEligibility.reasons);
    const levelPoolEligibility=assessLevelPoolEligibility({familyId,level,slotKey,actionId});
    if(!levelPoolEligibility.ok)reasons.push(...levelPoolEligibility.reasons);
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
    return {ok:reasons.length===0,reasons:[...new Set(reasons)],intent,meta,action,levelEligibility,levelPoolEligibility};
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
    const venueEligibility=assessVenueEligibility({
      familyId:normalized.familyId,
      level:normalized.level,
      slotKey:normalized.slotKey,
      actionId,
      overrideReason:normalizeVenueOverrideReason(input),
    });
    const equipmentStation=assessEquipmentStation({
      familyId:normalized.familyId,
      level:normalized.level,
      slotKey:normalized.slotKey,
      actionId,
      currentSelections:input.currentSelections||{},
      stationReusePolicy:input.stationReusePolicy,
    });
    const pairReasons=base.ok?pairIntentReasons({
      slotKey:normalized.slotKey,
      intent:base.intent,
      actionId,
      currentSelections:input.currentSelections||{},
    }):[];
    const reasons=[...new Set([
      ...base.reasons,
      ...pairReasons,
      ...equipmentStation.reasons,
      ...(input.includeVenueGate===false||venueEligibility.ok||venueEligibility.overrideAccepted?[]:venueEligibility.reasons),
    ])];
    return {
      ok:reasons.length===0,
      reasons,
      intentId:String(base.intent?.intentId||''),
      slotKey:normalized.slotKey,
      role:normalized.role,
      actionId,
      pairSimilarity:pairReasons.length?pairReasons.map(code=>({code})):[],
      equipmentStation,
      levelEligibility:base.levelEligibility||assessLevelEligibility({level:normalized.level,actionId}),
      levelPoolEligibility:base.levelPoolEligibility||assessLevelPoolEligibility({
        familyId:normalized.familyId,level:normalized.level,slotKey:normalized.slotKey,actionId
      }),
      venueEligibility,
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
  function progressionScore(familyId,level,slotKey,candidate){
    const eligibility=candidate.levelEligibility||assessLevelEligibility({level,actionId:candidate.actionId});
    const poolEligibility=candidate.levelPoolEligibility||assessLevelPoolEligibility({
      familyId,level,slotKey,actionId:candidate.actionId
    });
    if(!eligibility.ok||!poolEligibility.ok)return 0;
    let value=Number(poolEligibility.priorityScore||0);
    if(level==='L1'&&candidate.fatigueCost==='high')value-=0.2;
    if(level==='L2'&&candidate.fatigueCost==='high')value-=0.08;
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
    const progressionSuitability=progressionScore(familyId,level,slotKey,candidate);
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
    if(candidate.levelPoolEligibility?.preference==='preferred'){
      reasons.push({code:'LEVEL_POOL_PREFERRED',text:candidate.levelPoolEligibility.reason});
    }else if(progressionSuitability>=0.6){
      reasons.push({code:'LEVEL_FIT',text:candidate.levelPoolEligibility?.reason||`能力要求与当前 ${level} 准入契约匹配`});
    }
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
      const patternExtras=COMPATIBILITY_POLICY.fatigue.patternTags[entry.action.pattern]||{};
      Object.keys(patternExtras).forEach(target=>{
        if(!(entry.meta.directTargets||[]).includes(target))indirect[target]=(indirect[target]||0)+1;
      });
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
    const maxStability=STABILITY_RANK[D().bodyLevelPolicies?.[level]?.maxStabilityDemand]??2;
    const stabilityPenalty=Math.max(0,stability-maxStability);
    const currentLevelIndex=LEVEL_ORDER.indexOf(level);
    const entryLevelIndex=LEVEL_ORDER.indexOf(candidate.levelEligibility?.actionEntryLevel||'');
    const levelFit=entryLevelIndex<0?0:Math.max(0,4-Math.abs(currentLevelIndex-entryLevelIndex));
    const fatiguePenalty=candidate.exerciseClass==='compound'&&candidate.fatigueCost==='high'&&context.highFatigueCompounds>=2?1:0;
    const movementDiversity=candidate.pattern&&!context.patterns.has(candidate.pattern)?1:0;
    const targetRedundancy=direct.filter(target=>context.coveredTargets.has(target)).length;
    const similarityPenalty=context.selected.reduce((sum,item)=>{
      const similarity=pairSimilarity(candidate.actionId,item.actionId);
      return sum+(similarity.samePattern?1:0)+similarity.directTargetOverlap;
    },0);
    return {
      intentPatternPreference,intentTargetPreference,levelFit,fatiguePreference,
      primaryCoverage,missingTargetBonus,stabilityPenalty,fatiguePenalty,
      movementDiversity,targetRedundancy,similarityPenalty
    };
  }

  function compareCandidates(a,b,ctx){
    const A=candidateSortKey(a,ctx),B=candidateSortKey(b,ctx);
    return B.intentPatternPreference-A.intentPatternPreference
      ||B.intentTargetPreference-A.intentTargetPreference
      ||B.levelFit-A.levelFit
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

  function candidateRecord({actionId,role,intent,level,assessment,currentSelections,familyId,slotKey}={}){
    const data=D(),meta=data.bodyActionMeta[actionId],action=data.actions[actionId],exerciseFamily=exerciseFamilyOf(actionId);
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
      levelEligibility:assessment.levelEligibility,
      levelPoolEligibility:assessment.levelPoolEligibility,
      venueEligibility:assessment.venueEligibility||assessVenueEligibility({familyId,level,slotKey,actionId}),
      equipmentStation:assessment.equipmentStation||assessEquipmentStation({familyId,level,slotKey,actionId,currentSelections}),
      levelReason:assessment.levelPoolEligibility?.reason||(
        assessment.levelEligibility?.actionEntryLevel===level
          ?'当前等级正式准入'
          :'低等级已掌握动作，当前等级继续合法'
      ),
    };
    Object.assign(candidate,Compatibility.scoreCandidate({
      familyId,level,slotKey,candidate,currentSelections,intent,
    }));
    return candidate;
  }

  function candidates(input={}){
    const {familyId,level,family,slotKey,role}=validateInput(input,true);
    const data=D(),currentSelections=input.currentSelections||{},context=selectionContext(currentSelections,slotKey);
    const intent=slotIntentFor(family,slotKey),items=[],blockedItems=[],stationBlockedItems=[];
    for(const actionId of Object.keys(data.bodyActionMeta||{})){
      const meta=data.bodyActionMeta[actionId],exerciseFamily=exerciseFamilyOf(actionId);
      const assessment=assessSlotIntent({familyId,level,slotKey,actionId,currentSelections,stationReusePolicy:input.stationReusePolicy});
      const stationOnly=assessment.reasons.length===1&&assessment.reasons[0]==='BODY_EQUIPMENT_STATION_DUPLICATE';
      if(stationOnly&&!context.usedActionIds.has(actionId)){
        const candidate=candidateRecord({actionId,role,intent,level,assessment,currentSelections,familyId,slotKey});
        candidate.stationBlocked=true;
        candidate.blockedReasons=[...assessment.reasons];
        stationBlockedItems.push(candidate);
      }
      if(context.usedActionIds.has(actionId)||context.usedExerciseFamilies.has(exerciseFamily))continue;
      if(assessment.ok){
        items.push(candidateRecord({actionId,role,intent,level,assessment,currentSelections,familyId,slotKey}));
        continue;
      }
      if(input.includeVenueBlocked===true&&assessment.venueEligibility?.status==='BLOCKED'){
        const venueFree=assessSlotIntent({familyId,level,slotKey,actionId,currentSelections,includeVenueGate:false,stationReusePolicy:input.stationReusePolicy});
        if(venueFree.ok){
          const candidate=candidateRecord({actionId,role,intent,level,assessment:venueFree,currentSelections,familyId,slotKey});
          candidate.venueEligibility=assessment.venueEligibility;
          candidate.requiresVenueOverride=true;
          candidate.blockedReasons=[...(assessment.venueEligibility.reasons||[])];
          blockedItems.push(candidate);
        }
      }
    }
    items.sort((a,b)=>
      b.recommendationScore-a.recommendationScore
      ||compareCandidates(a,b,{family,level,context,intent})
    );
    return {
      recommended:items[0]?.actionId||'',
      slotIntent:intent?{slotKey,intentId:intent.intentId,role:intent.role}:null,
      levelContract:{...data.bodyLevelPolicies[level]},
      levelPool:familyLevelPool(familyId,level)?{...familyLevelPool(familyId,level)}:null,
      candidates:items,
      blockedCandidates:blockedItems.sort((a,b)=>compareCandidates(a,b,{family,level,context,intent})),
      stationBlockedCandidates:stationBlockedItems.sort((a,b)=>compareCandidates(a,b,{family,level,context,intent})),
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

  function venueAuditRecord({slotKey,actionId,requestedActionId,source,finalVenue,requestedVenue}={}){
    const overridden=source==='manual'&&requestedVenue?.overrideAccepted===true;
    const fallback=!!requestedActionId&&requestedActionId!==actionId;
    return {
      slotKey,
      actionId,
      requestedActionId:String(requestedActionId||''),
      status:overridden?'OVERRIDDEN':fallback?'FALLBACK':String(finalVenue?.status||'PASS'),
      equipmentIds:[...(finalVenue?.equipmentIds||[])],
      minimumSystemLoadKg:finalVenue?.minimumSystemLoadKg??null,
      requestedMinimumSystemLoadKg:requestedVenue?.minimumSystemLoadKg??null,
      levelCeilingKg:finalVenue?.levelCeilingKg??null,
      reasonCodes:[...(requestedVenue?.reasons||finalVenue?.reasons||[])],
      reason:String(requestedVenue?.reason||finalVenue?.reason||''),
      fallbackActionGroup:String(requestedVenue?.fallbackActionGroup||''),
      overrideReason:overridden?String(requestedVenue.overrideReason||''):'',
      policyVersion:String(finalVenue?.policyVersion||requestedVenue?.policyVersion||''),
    };
  }

  function resolve(input={}){
    const {familyId,level,family,levelPolicy}=validateInput(input);
    if(!window.V15BodyVolume?.buildSlot||!window.V15BodyVolume?.summarize){
      fail('BODY_VOLUME_UNAVAILABLE','Body volume calculator is unavailable');
    }
    const requested=input.selections&&typeof input.selections==='object'?input.selections:{};
    const stationReusePolicy=String(input.stationReusePolicy||'');
    const chosen={},domainSlots={},publicSlots=[],warnings=[],venueSlots={},venueOverrides=[],stationSlots={};

    for(const slotKey of activeSlotKeys(levelPolicy)){
      const role=family.slotPolicy[slotKey];
      const requestedEntry=requested[slotKey];
      const requestedActionId=normalizeManualActionId(requestedEntry);
      const overrideReason=normalizeVenueOverrideReason(requestedEntry);
      let actionId='',source='auto';
      const used=new Set(Object.values(chosen));
      const usedExerciseFamilies=new Set(Object.values(chosen).map(exerciseFamilyOf));
      const requestedIntent= requestedActionId
        ?assessSlotIntent({familyId,level,slotKey,actionId:requestedActionId,currentSelections:chosen,includeVenueGate:false,stationReusePolicy})
        :null;
      const requestedVenue=requestedActionId
        ?assessVenueEligibility({familyId,level,slotKey,actionId:requestedActionId,overrideReason})
        :null;
      const uniqueRequested=!!requestedActionId&&!used.has(requestedActionId)&&!usedExerciseFamilies.has(exerciseFamilyOf(requestedActionId));
      if(uniqueRequested&&requestedIntent?.ok&&(requestedVenue?.ok||requestedVenue?.overrideAccepted)){
        actionId=requestedActionId;
        source='manual';
        if(requestedVenue.overrideAccepted)warnings.push(`BODY_VENUE_MANUAL_OVERRIDE:${slotKey}`);
      }else{
        if(requestedActionId){
          warnings.push(`BODY_STALE_SELECTION_FALLBACK:${slotKey}`);
          if(requestedVenue?.status==='BLOCKED'){
            warnings.push(`BODY_VENUE_GATE_FALLBACK:${slotKey}`);
            if(requestedVenue.overrideReasonRequired&&!requestedVenue.overrideAccepted){
              warnings.push(`BODY_VENUE_OVERRIDE_REASON_REQUIRED:${slotKey}`);
            }
          }
        }
        const result=candidates({familyId,level,slotKey,currentSelections:chosen,stationReusePolicy});
        actionId=result.recommended;
        if(!actionId)fail('BODY_NO_ELIGIBLE_CANDIDATE',`No eligible Body candidate for ${familyId} ${level} ${slotKey}`,{familyId,level,slotKey});
      }
      const equipmentStation=assessEquipmentStation({
        familyId,level,slotKey,actionId,currentSelections:chosen,stationReusePolicy,
      });
      chosen[slotKey]=actionId;
      stationSlots[slotKey]=equipmentStation;
      equipmentStation.warnings.forEach(code=>warnings.push(`${code}:${slotKey}`));
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
      const finalVenue=assessVenueEligibility({familyId,level,slotKey,actionId});
      const audit=venueAuditRecord({slotKey,actionId,requestedActionId,source,finalVenue,requestedVenue});
      venueSlots[slotKey]=audit;
      if(audit.status==='OVERRIDDEN'){
        venueOverrides.push({
          slotKey,
          actionId,
          reason:audit.overrideReason,
          auditCode:String(D().venueCapabilityPolicy?.manualOverridePolicy?.auditCode||'BODY_VENUE_MANUAL_OVERRIDE'),
          policyVersion:audit.policyVersion,
        });
      }
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
      domainContext:{
        kind:'BODY',
        levelContract:{...levelPolicy},
        slots:domainSlots,
        volume:window.V15BodyVolume.summarize(domainSlots),
        venue:{
          policyVersion:String(D().venueCapabilityPolicy?.policyVersion||''),
          venueId:String(D().venueCapabilityPolicy?.venueId||''),
          levelCeilingKg:Number(D().venueCapabilityPolicy?.bodyLevelMinimumSystemLoadCeilingKg?.[level]??0),
          slots:venueSlots,
          overrides:venueOverrides,
        },
        equipmentStations:{
          policyVersion:String(stationDiversityPolicy().policyVersion||''),
          reusePolicy:stationReuseIsExplicit(stationReusePolicy)
            ?String(stationDiversityPolicy().explicitReuseToken||stationReusePolicy)
            :String(stationDiversityPolicy().defaultReuseMode||'BLOCK'),
          slots:stationSlots,
          unknownActionIds:Object.values(stationSlots).filter(item=>item.status==='UNVERIFIED').map(item=>item.actionId),
        },
      },
    };
    session.conflictContext=evaluateConflict(session);
    const validation=window.V15ResolvedSession?.validate?.(session);
    if(validation&&!validation.ok)fail('BODY_RESOLVED_SESSION_INVALID','Body Resolver produced invalid ResolvedSession',{validationErrors:validation.errors});
    return session;
  }

  const api={resolve,candidates,isSelectionValid,assessSlotIntent,assessEquipmentStation,assessLevelEligibility,assessLevelPoolEligibility,assessVenueEligibility,pairSimilarity,actionStationRecord};
  window.V15BodyResolver=api;
  if(!window.V15TemplateResolver?.register)throw new Error('Template Resolver Dispatcher is unavailable');
  window.V15TemplateResolver.register('body',resolve);
})();
