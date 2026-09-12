(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const LEVEL_INDEX=Object.freeze({L1:0,L2:1,L3:2,L4:3});
  const DEFAULT_PROTOCOL=Object.freeze({
    'CON-01':Object.freeze({L1:'STEADY',L2:'STEADY',L3:'INTERVAL',L4:'INTERVAL'}),
    'CON-02':Object.freeze({L1:'INTERVAL',L2:'INTERVAL',L3:'INTERVAL',L4:'CIRCUIT'}),
    'CON-03':Object.freeze({L1:'CIRCUIT',L2:'CIRCUIT',L3:'CIRCUIT',L4:'DENSITY'}),
    'CON-04':Object.freeze({L1:'INTERVAL',L2:'INTERVAL',L3:'CIRCUIT',L4:'CIRCUIT'}),
  });
  const DESIRED_STATIONS=Object.freeze({
    STEADY:Object.freeze({L1:1,L2:1,L3:1,L4:1}),
    INTERVAL:Object.freeze({L1:2,L2:2,L3:2,L4:2}),
    CIRCUIT:Object.freeze({L1:3,L2:3,L3:4,L4:4}),
    DENSITY:Object.freeze({L1:2,L2:2,L3:3,L4:3}),
  });
  const DESIRED_RATIO=Object.freeze({L1:0.5,L2:0.75,L3:1,L4:1.5});

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function range(value){
    return Array.isArray(value)&&value.length===2&&value.every(Number.isFinite)?[Number(value[0]),Number(value[1])]:null;
  }

  function midpoint(value){
    const r=range(value);
    return r?(r[0]+r[1])/2:0;
  }

  function clamp(value,min,max){
    return Math.max(min,Math.min(max,value));
  }

  function intersect(a,b){
    const A=range(a),B=range(b);
    if(!A||!B)return null;
    const lo=Math.max(A[0],B[0]),hi=Math.min(A[1],B[1]);
    return lo<=hi?[lo,hi]:null;
  }

  function intValues(r,step=1){
    const R=range(r);
    if(!R)return [];
    const out=[];
    for(let x=Math.ceil(R[0]);x<=Math.floor(R[1]);x+=step)out.push(x);
    if(!out.length)out.push(Math.round((R[0]+R[1])/2));
    if(out[out.length-1]!==Math.floor(R[1]))out.push(Math.floor(R[1]));
    return [...new Set(out)];
  }

  function secondValues(r){
    const R=range(r);
    if(!R)return [];
    const out=[];
    const start=Math.ceil(R[0]/5)*5;
    for(let x=start;x<=R[1];x+=5)out.push(x);
    out.push(Math.round(R[0]),Math.round(R[1]));
    return [...new Set(out.filter(x=>x>=R[0]&&x<=R[1]))].sort((a,b)=>a-b);
  }

  function validateFamilyLevel(familyId,level){
    const data=D(),family=data.conditioningFamilies?.[familyId],levelPolicy=data.conditioningLevelPolicies?.[level];
    if(!family)fail('CONDITIONING_INPUT_INVALID',`Unknown Conditioning family: ${String(familyId||'')}`,{familyId});
    if(!/^L[1-4]$/.test(level||'')||!levelPolicy)fail('CONDITIONING_INPUT_INVALID','Conditioning level must be L1-L4',{level});
    return {family,levelPolicy};
  }

  function selectProtocol(familyId,level,requestedProtocol=''){
    const data=D(),{family}=validateFamilyLevel(familyId,level);
    const requested=typeof requestedProtocol==='string'?requestedProtocol:'';
    if(requested){
      if(!data.conditioningProtocols?.[requested]||!family.protocolEligibility?.includes(requested)){
        fail('CONDITIONING_PROTOCOL_ILLEGAL',`Protocol ${requested} is not legal for ${familyId}`,{familyId,level,protocolId:requested});
      }
      return requested;
    }
    const fallback=DEFAULT_PROTOCOL[familyId]?.[level];
    if(!fallback||!family.protocolEligibility?.includes(fallback)){
      fail('CONDITIONING_PROTOCOL_UNAVAILABLE',`No default protocol for ${familyId} ${level}`,{familyId,level});
    }
    return fallback;
  }

  function legalCandidateCount(familyId,level,protocolId){
    const data=D();
    return Object.entries(data.conditioningActionMeta||{}).filter(([actionId,meta])=>{
      const action=data.actions?.[actionId];
      return action&&action.status==='可自动编排'&&action.route==='CONDITIONING_2F'
        &&meta?.families?.includes(familyId)&&meta?.levels?.includes(level)
        &&meta?.protocolEligibility?.includes(protocolId)
        &&(familyId!=='CON-04'||meta.powerEligible===true);
    }).length;
  }

  function chooseStationCount(familyId,level,protocolId){
    const data=D(),protocol=data.conditioningProtocols?.[protocolId],levelPolicy=data.conditioningLevelPolicies?.[level];
    if(!protocol||!levelPolicy)return 0;
    if(protocolId==='STEADY')return 1;
    const bounds=intersect(protocol.stationCountRange,levelPolicy.stationCountRange)||range(protocol.stationCountRange);
    const available=legalCandidateCount(familyId,level,protocolId);
    if(!bounds||available<bounds[0]){
      fail('CONDITIONING_STATION_CAPACITY',`Not enough legal stations for ${familyId} ${level} ${protocolId}`,{familyId,level,protocolId,available});
    }
    const desired=DESIRED_STATIONS[protocolId]?.[level]||bounds[0];
    const powerMax=familyId==='CON-04'?Number(data.conditioningConflictPolicy?.maxPowerStationsByLevel?.[level]):Infinity;
    const effectiveMax=Number.isFinite(powerMax)?Math.min(bounds[1],powerMax):bounds[1];
    return Math.min(available,clamp(desired,bounds[0],effectiveMax));
  }

  function timedPlan({familyId,level,protocolId,stationCount,targetBlockMinutes}){
    const data=D(),levelPolicy=data.conditioningLevelPolicies[level],policy=data.conditioningProtocolPolicies[protocolId];
    const workRange=intersect(levelPolicy.workSecondsRange,policy.workSecondsRange)||range(policy.workSecondsRange);
    const restRange=intersect(levelPolicy.restSecondsRange,policy.restSecondsRange)||range(policy.restSecondsRange);
    const roundsRange=intersect(levelPolicy.roundsRange,policy.roundsRange)||range(policy.roundsRange);
    const transitionRange=stationCount>1
      ?(intersect(policy.transitionSecondsRange,data.conditioningTransitionPolicy?.stationChangeSecondsRange)||range(policy.transitionSecondsRange))
      :[0,0];
    if(!workRange||!restRange||!roundsRange||!transitionRange){
      fail('CONDITIONING_POLICY_INVALID','Conditioning timed protocol ranges are invalid',{familyId,level,protocolId});
    }

    const targetSeconds=targetBlockMinutes*60,ratioTarget=DESIRED_RATIO[level]||1;
    let best=null;
    for(const workSeconds of secondValues(workRange)){
      for(const restSeconds of secondValues(restRange)){
        for(const transitionSeconds of secondValues(transitionRange)){
          for(const rounds of intValues(roundsRange)){
            const intervals=stationCount*rounds;
            const gaps=Math.max(0,intervals-1);
            const blockSeconds=intervals*workSeconds+gaps*restSeconds+gaps*transitionSeconds;
            const ratio=restSeconds>0?workSeconds/restSeconds:workSeconds;
            const score=Math.abs(blockSeconds-targetSeconds)+Math.abs(ratio-ratioTarget)*45+transitionSeconds/100;
            const candidate={workSeconds,restSeconds,transitionSeconds,rounds,blockSeconds,score};
            if(!best||score<best.score||(score===best.score&&rounds<best.rounds))best=candidate;
          }
        }
      }
    }
    return best;
  }

  function densityPlan({level,targetBlockMinutes,stationCount}){
    const data=D(),policy=data.conditioningProtocolPolicies.DENSITY;
    const roundsRange=range(policy.roundsRange),windowRange=range(policy.densityWindowMinutesRange);
    if(!roundsRange||!windowRange)fail('CONDITIONING_POLICY_INVALID','DENSITY policy is invalid',{level});
    let best=null;
    for(const rounds of intValues(roundsRange)){
      for(const densityWindowMinutes of intValues(windowRange)){
        const transitionSeconds=stationCount>1?Math.round(midpoint(data.conditioningTransitionPolicy?.stationChangeSecondsRange)):0;
        const betweenRounds=Math.max(0,rounds-1)*Math.round(midpoint(policy.restSecondsRange));
        const blockSeconds=rounds*densityWindowMinutes*60+betweenRounds+Math.max(0,stationCount-1)*transitionSeconds;
        const score=Math.abs(blockSeconds-targetBlockMinutes*60);
        const candidate={workSeconds:0,restSeconds:Math.round(midpoint(policy.restSecondsRange)),transitionSeconds,rounds,densityWindowMinutes,blockSeconds,score};
        if(!best||score<best.score||(score===best.score&&rounds<best.rounds))best=candidate;
      }
    }
    return best;
  }

  function plan(input={}){
    const familyId=typeof input.familyId==='string'?input.familyId:'';
    const level=typeof input.level==='string'?input.level:'';
    const data=D(),{family,levelPolicy}=validateFamilyLevel(familyId,level);
    const protocolId=selectProtocol(familyId,level,input.protocolId||'');
    const protocol=data.conditioningProtocols[protocolId],stationCount=chooseStationCount(familyId,level,protocolId);
    const targetBlockMinutes=midpoint(levelPolicy.totalWorkMinutesRange);
    const targetRpe=Math.round(midpoint(levelPolicy.targetRpeRange));
    let timed;

    if(protocolId==='STEADY'){
      timed={
        workSeconds:0,restSeconds:0,transitionSeconds:0,rounds:1,densityWindowMinutes:0,
        blockSeconds:Math.round(targetBlockMinutes*60),
      };
    }else if(protocolId==='DENSITY'){
      timed=densityPlan({level,targetBlockMinutes,stationCount});
    }else{
      timed=timedPlan({familyId,level,protocolId,stationCount,targetBlockMinutes});
      timed.densityWindowMinutes=0;
    }

    const intervals=stationCount*timed.rounds;
    const activeWorkMinutes=protocolId==='STEADY'
      ?timed.blockSeconds/60
      :protocolId==='DENSITY'
        ?timed.rounds*timed.densityWindowMinutes
        :(intervals*timed.workSeconds)/60;
    const blockMinutes=Math.round(timed.blockSeconds/6)/10;
    const estimatedMinutes=Math.round(blockMinutes+5);

    return {
      familyId,level,protocolId,protocolName:String(protocol.name||protocolId),structure:String(protocol.structure||''),
      stationCount,rounds:timed.rounds,workSeconds:timed.workSeconds,restSeconds:timed.restSeconds,
      transitionSeconds:timed.transitionSeconds,densityWindowMinutes:timed.densityWindowMinutes||0,
      targetRpe,targetBlockMinutes:Math.round(targetBlockMinutes*10)/10,
      activeWorkMinutes:Math.round(activeWorkMinutes*10)/10,blockMinutes,estimatedMinutes,
      powerIntent:familyId==='CON-04'?'high':protocol.allowsPower?'available':'none',
    };
  }

  function formatPrescription(plan,workMetric='time'){
    const metricLabel={time:'时间',distance:'距离',reps:'次数',calories:'卡路里'}[workMetric]||workMetric;
    if(plan.protocolId==='STEADY')return `${plan.blockMinutes} 分钟持续输出｜${metricLabel}｜RPE ${plan.targetRpe}`;
    if(plan.protocolId==='DENSITY')return `${plan.densityWindowMinutes} 分钟密度窗 × ${plan.rounds}｜${metricLabel}｜RPE ${plan.targetRpe}`;
    if(plan.protocolId==='CIRCUIT')return `${plan.workSeconds}s 工作 / ${plan.restSeconds}s 恢复｜站间 ${plan.transitionSeconds}s｜${plan.rounds} 轮｜${metricLabel}`;
    return `${plan.workSeconds}s 工作 / ${plan.restSeconds}s 恢复｜${plan.rounds} 轮｜${metricLabel}｜RPE ${plan.targetRpe}`;
  }

  window.V15ConditioningProtocol={
    DEFAULT_PROTOCOL,selectProtocol,chooseStationCount,plan,formatPrescription,
  };
})();
