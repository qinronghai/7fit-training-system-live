(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function copyRange(value,name){
    if(!Array.isArray(value)||value.length!==2||!value.every(Number.isFinite)){
      fail('BODY_VOLUME_INPUT_INVALID',`${name} must be a finite [min,max] range`,{value});
    }
    return [value[0],value[1]];
  }

  function buildSlot({level,slotKey,role,actionId}={}){
    const data=D(),levelPolicy=data.bodyLevelPolicies?.[level],meta=data.bodyActionMeta?.[actionId],action=data.actions?.[actionId];
    if(!levelPolicy)fail('BODY_VOLUME_INPUT_INVALID',`Unknown Body level: ${String(level||'')}`,{level});
    if(typeof slotKey!=='string'||!slotKey)fail('BODY_VOLUME_INPUT_INVALID','slotKey is required',{slotKey});
    const workingSets=levelPolicy.defaultWorkingSets?.[slotKey];
    if(!Number.isInteger(workingSets)||workingSets<=0)fail('BODY_VOLUME_INPUT_INVALID',`Inactive or unknown Body slot: ${slotKey}`,{level,slotKey});
    if(typeof role!=='string'||!role)fail('BODY_VOLUME_INPUT_INVALID','role is required',{role});
    if(!meta||!action)fail('BODY_VOLUME_INPUT_INVALID',`Unknown Body action: ${String(actionId||'')}`,{actionId});
    const profile=data.bodyPrescriptionProfiles?.[meta.repProfile];
    if(!profile)fail('BODY_VOLUME_INPUT_INVALID',`Unknown Body prescription profile: ${String(meta.repProfile||'')}`,{actionId,repProfile:meta.repProfile});
    return {
      role,
      actionId,
      workingSets,
      repRange:copyRange(profile.repRange,'repRange'),
      rirRange:copyRange(levelPolicy.rirRange,'rirRange'),
      restSecondsRange:copyRange(profile.restSecondsRange,'restSecondsRange'),
      directTargets:[...(meta.directTargets||[])],
      secondaryTargets:[...(meta.secondaryTargets||[])],
      exerciseClass:String(meta.exerciseClass||''),
      fatigueCost:String(meta.fatigueCost||''),
      stabilityDemand:String(meta.stabilityDemand||''),
      laterality:String(meta.laterality||''),
      perSide:profile.perSide===true,
    };
  }

  function add(map,key,amount){
    if(!key)return;
    map[key]=(map[key]||0)+amount;
  }

  function summarize(slots={}){
    const values=Array.isArray(slots)?slots:Object.values(slots||{});
    const active=values.filter(slot=>slot&&Number.isInteger(slot.workingSets)&&slot.workingSets>0);
    const directSetsByTarget={},secondaryExposureByTarget={};
    let totalWorkingSets=0,isolationWorkingSets=0,highFatigueCompoundCount=0,totalEstimatedSeconds=0;

    active.forEach(slot=>{
      const sets=slot.workingSets;
      totalWorkingSets+=sets;
      (slot.directTargets||[]).forEach(target=>add(directSetsByTarget,target,sets));
      (slot.secondaryTargets||[]).forEach(target=>add(secondaryExposureByTarget,target,sets));
      if(slot.exerciseClass==='isolation')isolationWorkingSets+=sets;
      if(slot.exerciseClass==='compound'&&slot.fatigueCost==='high')highFatigueCompoundCount++;

      const midReps=(Number(slot.repRange?.[0])+Number(slot.repRange?.[1]))/2;
      const midRest=(Number(slot.restSecondsRange?.[0])+Number(slot.restSecondsRange?.[1]))/2;
      if(!Number.isFinite(midReps)||!Number.isFinite(midRest)){
        fail('BODY_VOLUME_INPUT_INVALID','Body slot requires finite rep/rest ranges',{actionId:slot.actionId});
      }
      totalEstimatedSeconds+=sets*(midReps*4+45)+Math.max(sets-1,0)*midRest;
    });

    if(active.length>1)totalEstimatedSeconds+=(active.length-1)*60;
    return {
      totalWorkingSets,
      directSetsByTarget,
      secondaryExposureByTarget,
      isolationWorkingSets,
      isolationRatio:totalWorkingSets?isolationWorkingSets/totalWorkingSets:0,
      highFatigueCompoundCount,
      estimatedMinutes:Math.ceil(totalEstimatedSeconds/60),
    };
  }

  function rangeText(range){
    return range[0]===range[1]?String(range[0]):`${range[0]}–${range[1]}`;
  }

  function formatPrescription(slot={}){
    const side=slot.perSide?' / 侧':'';
    return `${slot.workingSets} × ${rangeText(slot.repRange)}${side}｜RIR ${rangeText(slot.rirRange)}｜休息 ${rangeText(slot.restSecondsRange)}s`;
  }

  window.V15BodyVolume={buildSlot,summarize,formatPrescription};
})();
