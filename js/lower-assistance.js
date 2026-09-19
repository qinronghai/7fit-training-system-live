(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const LEVELS=Object.freeze(['L1','L2','L3','L4']);
  const LOWER_TARGETS=new Set(['quadriceps','hamstrings','glute_max','glute_med','adductors','calves','tibialis_anterior']);
  const FUNCTIONAL_FAMILIES=Object.freeze({
    SQUAT:{key:'SQUAT',label:'膝主导复合'},
    HINGE:{key:'HINGE',label:'髋铰链'},
    HIP_EXTENSION:{key:'HIP_EXTENSION',label:'髋伸展'},
    UNILATERAL:{key:'UNILATERAL',label:'单腿复合'},
    KNEE_EXTENSION:{key:'KNEE_EXTENSION',label:'膝伸'},
    KNEE_FLEXION:{key:'KNEE_FLEXION',label:'膝屈'},
    HIP_ABDUCTION:{key:'HIP_ABDUCTION',label:'髋外展'},
    HIP_ADDUCTION:{key:'HIP_ADDUCTION',label:'髋内收'},
    CALF:{key:'CALF',label:'小腿 / 跖屈'},
    DORSIFLEXION:{key:'DORSIFLEXION',label:'胫骨前肌 / 踝背屈'},
    LOWER_STABILITY:{key:'LOWER_STABILITY',label:'下肢稳定'},
  });
  const TRAINING_ROLES=Object.freeze({
    MECHANICAL_TENSION:'机械张力',
    LOCAL_VOLUME:'局部容量',
    STABILITY:'稳定',
    MOTOR_CONTROL:'动作控制',
    METABOLIC:'代谢容量',
    UNILATERAL_CORRECTION:'单侧修正',
  });
  const EQUIPMENT_CLASS_LABELS=Object.freeze({
    fixed_machine:'固定器械',
    cable_station:'绳索 / 龙门架',
    free_weight:'自由重量',
    bodyweight:'徒手',
    sled_turf:'雪橇 / 草坪',
    other:'其他',
    unknown:'待补齐',
  });
  const LEGACY_MODE_FAMILY_PRIORITY=Object.freeze({
    squat:['KNEE_FLEXION','HIP_EXTENSION','HIP_ABDUCTION','HIP_ADDUCTION','CALF','DORSIFLEXION','KNEE_EXTENSION','LOWER_STABILITY','UNILATERAL','HINGE','SQUAT'],
    hinge:['KNEE_EXTENSION','HIP_ABDUCTION','HIP_ADDUCTION','CALF','DORSIFLEXION','HIP_EXTENSION','KNEE_FLEXION','LOWER_STABILITY','UNILATERAL','SQUAT','HINGE'],
    hip_extension:['KNEE_FLEXION','KNEE_EXTENSION','HIP_ABDUCTION','HIP_ADDUCTION','CALF','DORSIFLEXION','LOWER_STABILITY','UNILATERAL','HINGE','HIP_EXTENSION','SQUAT'],
    single_leg_squat:['KNEE_FLEXION','HIP_ABDUCTION','HIP_ADDUCTION','HIP_EXTENSION','CALF','DORSIFLEXION','KNEE_EXTENSION','LOWER_STABILITY','HINGE','UNILATERAL','SQUAT'],
    single_leg_hinge:['KNEE_EXTENSION','HIP_ABDUCTION','HIP_ADDUCTION','CALF','DORSIFLEXION','HIP_EXTENSION','KNEE_FLEXION','LOWER_STABILITY','SQUAT','UNILATERAL','HINGE'],
  });

  const unique=values=>[...new Set((Array.isArray(values)?values:[]).filter(Boolean))];
  const clean=value=>String(value??'').trim();

  function normalizeEquipmentClass(action={},meta={}){
    const explicit=clean(action.equipmentClass);
    if(EQUIPMENT_CLASS_LABELS[explicit])return explicit;
    if(clean(action.stationGroup)==='cable-frame')return 'cable_station';
    const equipmentIds=clean(action.equipmentId).split(/[、,，]/).map(value=>value.trim()).filter(Boolean);
    if(equipmentIds.includes('eq-dumbbell'))return 'free_weight';
    if(equipmentIds.includes('eq-backext'))return 'fixed_machine';
    if(meta.repProfile==='compound_freeweight')return 'free_weight';
    if(meta.repProfile==='compound_machine')return 'fixed_machine';
    if(meta.repProfile==='single_leg_compound'&&(equipmentIds.includes('eq-bench')||equipmentIds.includes('eq-rack')||equipmentIds.length===0))return 'bodyweight';
    if(meta.repProfile==='accessory_compound'&&equipmentIds.length===0)return 'bodyweight';
    return 'unknown';
  }

  function functionalFamily(action={},meta={}){
    const explicit=clean(meta.lowerAssistanceFamily||action.lowerAssistanceFamily);
    if(FUNCTIONAL_FAMILIES[explicit])return explicit;
    const direct=new Set(meta.directTargets||[]);
    const name=clean(action.name);
    const pattern=clean(action.pattern);
    if(direct.has('tibialis_anterior'))return 'DORSIFLEXION';
    if(direct.has('calves'))return 'CALF';
    if(direct.has('adductors'))return 'HIP_ADDUCTION';
    if(direct.has('glute_med'))return 'HIP_ABDUCTION';
    if(meta.exerciseClass==='isolation'&&direct.has('quadriceps'))return 'KNEE_EXTENSION';
    if(meta.exerciseClass==='isolation'&&direct.has('hamstrings'))return 'KNEE_FLEXION';
    if(/腿屈伸/.test(name))return 'KNEE_EXTENSION';
    if(/腿弯举/.test(name))return 'KNEE_FLEXION';
    if(pattern==='单腿'||pattern==='单腿拉')return 'UNILATERAL';
    if(pattern==='髋伸展')return 'HIP_EXTENSION';
    if(pattern==='髋铰链')return 'HINGE';
    if(pattern==='蹲')return 'SQUAT';
    if((meta.trainingRoles||[]).some(role=>['STABILITY','MOTOR_CONTROL'].includes(role)))return 'LOWER_STABILITY';
    return '';
  }

  function trainingRoles(meta={}){
    const roles=[];
    if(meta.exerciseClass==='compound'||(meta.roles||[]).some(role=>['PRIMARY','SECONDARY'].includes(role)))roles.push('MECHANICAL_TENSION');
    if(['isolation','accessory'].includes(meta.exerciseClass)||(meta.roles||[]).some(role=>['ACCESSORY','ISOLATION','OPTIONAL'].includes(role)))roles.push('LOCAL_VOLUME');
    if(meta.laterality==='unilateral')roles.push('UNILATERAL_CORRECTION');
    if(meta.stabilityDemand==='medium'&&meta.fatigueCost!=='high')roles.push('STABILITY');
    if(meta.repProfile==='accessory_compound'&&meta.fatigueCost==='low')roles.push('MOTOR_CONTROL');
    return unique([...(meta.trainingRoles||[]),...roles]);
  }

  function legacySourcePools(actionId){
    const lower=D().composer?.auxiliaryRules?.lower||{};
    return Object.entries(lower).filter(([,ids])=>Array.isArray(ids)&&ids.includes(actionId)).map(([key,ids])=>({
      key,
      label:D().composer?.lowerModes?.[key]?.name||key,
      index:ids.indexOf(actionId),
    }));
  }

  function isLowerMeta(meta={}){
    return (meta.directTargets||[]).some(target=>LOWER_TARGETS.has(target));
  }

  function isAssistanceMember(meta={}){
    return isLowerMeta(meta)&&(meta.roles||[]).some(role=>['ACCESSORY','ISOLATION','OPTIONAL'].includes(role));
  }

  function entry(actionId){
    const action=D().actions?.[actionId],meta=D().bodyActionMeta?.[actionId];
    if(!action||!meta||!isAssistanceMember(meta))return null;
    const family=functionalFamily(action,meta);
    if(!family)return null;
    return {
      id:actionId,
      action,
      meta,
      functionalFamily:family,
      functionalFamilyLabel:FUNCTIONAL_FAMILIES[family]?.label||family,
      trainingRoles:trainingRoles(meta),
      levels:[...(meta.levels||[])],
      slotIntents:[...(meta.roles||[])],
      equipmentClass:normalizeEquipmentClass(action,meta),
      sourcePools:legacySourcePools(actionId),
      sourcePoolKeys:legacySourcePools(actionId).map(pool=>pool.key),
      consumers:{
        f111D1:action.route==='1F_ONLY'&&meta.fatigueCost!=='high',
        body:(meta.roles||[]).some(role=>['SECONDARY','ACCESSORY','ISOLATION','OPTIONAL'].includes(role)),
      },
    };
  }

  function catalog(){
    const entries=Object.keys(D().bodyActionMeta||{}).map(entry).filter(Boolean)
      .filter(item=>item.action.status==='可自动编排'&&['1F_ONLY','FLEX_1F_2F'].includes(item.action.route))
      .sort((a,b)=>a.functionalFamily.localeCompare(b.functionalFamily)||a.id.localeCompare(b.id));
    const familyCounts={},classCounts={},roleCounts={};
    entries.forEach(item=>{
      familyCounts[item.functionalFamily]=(familyCounts[item.functionalFamily]||0)+1;
      classCounts[item.equipmentClass]=(classCounts[item.equipmentClass]||0)+1;
      item.trainingRoles.forEach(role=>{roleCounts[role]=(roleCounts[role]||0)+1;});
    });
    return {
      title:'12｜下肢辅助与容量动作',
      moduleId:'aux-lower',
      eyebrow:'D1 / Body｜下肢辅助',
      sourceLabel:'V15LowerAssistance / bodyActionMeta',
      intro:'统一展示 7Fit 已审计的下肢辅助与容量动作；固定器械只是器械筛选，不再是体系边界。',
      entries,total:entries.length,familyCounts,classCounts,roleCounts,
      functionalFamilies:FUNCTIONAL_FAMILIES,
      trainingRoleLabels:TRAINING_ROLES,
      equipmentClassLabels:EQUIPMENT_CLASS_LABELS,
    };
  }

  function currentActionIds(input={}){
    return unique([
      ...(input.currentActionIds||[]),
      ...Object.values(input.currentSelections||{}).map(value=>typeof value==='string'?value:value?.actionId),
    ]);
  }

  function fatigueTags(actionId){
    return window.V15BodyCompatibility?.fatigueTagsForAction?.(actionId)||{};
  }

  function localFatigueImpact(actionId,selectedIds=[]){
    const candidate=fatigueTags(actionId),totals={},overlapTargets=[];
    selectedIds.forEach(id=>{
      const tags=fatigueTags(id);
      Object.entries(tags).forEach(([target,value])=>{totals[target]=(totals[target]||0)+Number(value||0);});
    });
    Object.entries(candidate).forEach(([target,value])=>{
      if((totals[target]||0)>0)overlapTargets.push({target,current:totals[target],added:Number(value||0)});
    });
    const overlapScore=overlapTargets.reduce((sum,item)=>sum+Math.min(item.current,item.added),0);
    return {overlapScore:Math.round(overlapScore*10)/10,overlapTargets};
  }

  function stationImpact(actionId,selectedIds=[]){
    const stationRecord=window.V15BodyResolver?.actionStationRecord;
    if(typeof stationRecord!=='function')return {status:'UNVERIFIED',duplicate:false,peers:[]};
    const record=stationRecord(actionId),peers=selectedIds.map(stationRecord).filter(Boolean);
    const sameStation=record.stationId?peers.filter(peer=>peer.stationId===record.stationId):[];
    const sameGroup=record.stationGroup?peers.filter(peer=>peer.stationGroup===record.stationGroup):[];
    return {
      status:sameStation.length?'DUPLICATE':sameGroup.length?'GROUP_REUSE':record.status,
      duplicate:sameStation.length>0,
      groupReuse:sameGroup.length>0,
      stationId:record.stationId,
      stationGroup:record.stationGroup,
      peers:sameStation.map(peer=>({actionId:peer.actionId,actionName:peer.actionName})),
    };
  }

  function similarityImpact(actionId,selectedIds=[]){
    const pair=window.V15BodyResolver?.pairSimilarity;
    if(typeof pair!=='function')return {max:0,closest:null};
    let max=0,closest=null;
    selectedIds.forEach(id=>{
      const result=pair(actionId,id)||{};
      const score=(result.samePattern?0.45:0)+Number(result.directTargetOverlap||0)*0.35+Number(result.secondaryTargetOverlap||0)*0.1;
      if(score>max){max=score;closest={actionId:id,...result};}
    });
    return {max:Math.round(Math.min(1,max)*100)/100,closest};
  }

  function priorityForMode(lowerMode,family){
    const order=LEGACY_MODE_FAMILY_PRIORITY[lowerMode]||[];
    const index=order.indexOf(family);
    return index<0?0:Math.max(0,1-index/Math.max(1,order.length-1));
  }

  function reasonText(item,{lowerMode='',selectedIds=[]}={}){
    const reasons=[],tradeoffs=[];
    const priority=priorityForMode(lowerMode,item.functionalFamily);
    if(priority>=0.75)reasons.push('与当前下肢主项形成互补');
    if(item.meta.fatigueCost==='low')reasons.push('系统疲劳低，适合补容量');
    if(item.meta.exerciseClass==='isolation')reasons.push('局部刺激明确');
    if(item.trainingRoles.includes('UNILATERAL_CORRECTION'))reasons.push('可补充单侧训练');
    const fatigue=localFatigueImpact(item.id,selectedIds);
    if(fatigue.overlapScore>=2)tradeoffs.push('与当前动作存在局部疲劳叠加');
    const station=stationImpact(item.id,selectedIds);
    if(station.duplicate)tradeoffs.push('与当前动作使用同一物理器械');
    else if(station.groupReuse)tradeoffs.push('与当前动作共享器械站组');
    const similarity=similarityImpact(item.id,selectedIds);
    if(similarity.max>=0.7)tradeoffs.push('与当前动作刺激较相似');
    return {reasons,tradeoffs,fatigue,station,similarity};
  }

  function f111Candidates(input={}){
    const level=LEVELS.includes(input.level)?input.level:'L1';
    const lowerMode=clean(input.lowerMode);
    const selectedIds=currentActionIds(input);
    const legacyPool=D().composer?.auxiliaryRules?.lower?.[lowerMode]||[];
    const legacyDefault=legacyPool[0]||'';
    const result=catalog().entries.filter(item=>
      item.consumers.f111D1
      &&item.action.route==='1F_ONLY'
      &&item.levels.includes(level)
      &&!selectedIds.includes(item.id)
    ).map(item=>{
      const context=reasonText(item,{lowerMode,selectedIds});
      const priority=priorityForMode(lowerMode,item.functionalFamily);
      const localPenalty=Math.min(18,context.fatigue.overlapScore*3);
      const similarityPenalty=context.similarity.max*18;
      const stationPenalty=context.station.duplicate?16:context.station.groupReuse?5:0;
      const fatigueBonus=item.meta.fatigueCost==='low'?12:item.meta.fatigueCost==='medium'?5:0;
      const classBonus=item.meta.exerciseClass==='isolation'?8:item.meta.exerciseClass==='accessory'?5:0;
      const legacyBonus=legacyPool.includes(item.id)?3:0;
      const score=Math.round((priority*42+fatigueBonus+classBonus+legacyBonus-localPenalty-similarityPenalty-stationPenalty)*10)/10;
      return {
        actionId:item.id,
        id:item.id,
        name:item.action.name||item.id,
        functionalFamily:item.functionalFamily,
        functionalFamilyLabel:item.functionalFamilyLabel,
        trainingRoles:[...item.trainingRoles],
        levels:[...item.levels],
        equipmentClass:item.equipmentClass,
        fatigueCost:item.meta.fatigueCost,
        exerciseClass:item.meta.exerciseClass,
        recommendationScore:score,
        reasons:context.reasons.map(text=>({code:'LOWER_ASSISTANCE_FIT',text})),
        tradeoffs:context.tradeoffs.map(text=>({code:'LOWER_ASSISTANCE_TRADEOFF',text})),
        localFatigueImpact:context.fatigue,
        stationImpact:context.station,
        similarityImpact:context.similarity,
        legacySourcePools:[...item.sourcePoolKeys],
      };
    }).sort((a,b)=>
      (b.actionId===legacyDefault?1:0)-(a.actionId===legacyDefault?1:0)
      ||b.recommendationScore-a.recommendationScore
      ||a.actionId.localeCompare(b.actionId)
    );
    return {
      consumer:'F111_D1',
      level,lowerMode,
      recommended:result[0]?.actionId||'',
      candidates:result,
      catalogTotal:catalog().total,
      source:'V15LowerAssistance',
    };
  }

  function candidates(input={}){
    if(input.consumer==='BODY'){
      const raw=window.V15BodyResolver?.candidates?.(input);
      return raw?{consumer:'BODY',...raw,source:'V15BodyResolver'}:{consumer:'BODY',candidates:[],recommended:'',source:'V15BodyResolver'};
    }
    return f111Candidates(input);
  }

  function isF111SelectionValid(input={}){
    const actionId=clean(input.actionId);
    if(!actionId)return false;
    return f111Candidates({...input,currentActionIds:(input.currentActionIds||[]).filter(id=>id!==actionId)}).candidates.some(item=>item.actionId===actionId);
  }

  window.V15LowerAssistance=Object.freeze({
    functionalFamilies:FUNCTIONAL_FAMILIES,
    trainingRoles:TRAINING_ROLES,
    equipmentClassLabels:EQUIPMENT_CLASS_LABELS,
    catalog,
    entry,
    candidates,
    f111Candidates,
    isF111SelectionValid,
    functionalFamily,
    trainingRoles,
    normalizeEquipmentClass,
    localFatigueImpact,
    stationImpact,
  });
})();