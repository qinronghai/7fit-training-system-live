(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const RISK=Object.freeze({low:0,medium:1,high:2});

  function issue(severity,title,text,code,order){
    return {severity,title,text,code,_order:order};
  }

  function asArray(value){return Array.isArray(value)?value:[];}
  function inRange(value,range){
    return Array.isArray(range)&&range.length===2&&Number.isFinite(value)&&value>=range[0]&&value<=range[1];
  }

  function domain(session){
    return session?.domainContext?.kind==='CONDITIONING'?session.domainContext:null;
  }

  function stations(session){
    const map=domain(session)?.stations;
    return map&&typeof map==='object'&&!Array.isArray(map)?Object.values(map):[];
  }

  function protocolIssues(session){
    const data=D(),family=data.conditioningFamilies?.[session?.familyId],ctx=domain(session),protocolId=ctx?.protocolId;
    if(!family||!data.conditioningLevelPolicies?.[session?.level]){
      return [issue('hard','Conditioning Family / Level 无效',
        `当前 Family / Level 无法识别：${String(session?.familyId||'未标')} / ${String(session?.level||'未标')}。`,
        'COND_FAMILY_LEVEL_INVALID',10000)];
    }
    if(!ctx||!data.conditioningProtocols?.[protocolId]||!family.protocolEligibility?.includes(protocolId)){
      return [issue('hard','Conditioning Protocol 非法',
        `${session.familyId} 不允许使用 ${String(protocolId||'未标')}。`,
        'COND_PROTOCOL_ILLEGAL',10010)];
    }
    return [];
  }

  function stationIssues(session){
    const data=D(),out=[],ctx=domain(session),protocolId=ctx?.protocolId,level=session?.level,familyId=session?.familyId;
    stations(session).forEach((station,index)=>{
      const actionId=station?.actionId||'',meta=data.conditioningActionMeta?.[actionId],action=data.actions?.[actionId];
      const legal=!!meta&&!!action
        &&meta.families?.includes(familyId)
        &&meta.levels?.includes(level)
        &&meta.protocolEligibility?.includes(protocolId)
        &&action.route==='CONDITIONING_2F'
        &&action.status==='可自动编排'
        &&(familyId!=='CON-04'||meta.powerEligible===true);
      if(!legal){
        out.push(issue('hard','Conditioning Station 非法',
          `${station?.key||`STATION-${index+1}`} 的 ${action?.name||actionId||'未知动作'} 不符合 ${familyId} / ${level} / ${protocolId} 候选规则。`,
          'COND_STATION_ILLEGAL',10100+index));
      }
    });
    return out;
  }

  function ceilingIssues(session){
    const data=D(),policy=data.conditioningLevelPolicies?.[session?.level]||{},out=[];
    const checks=[
      ['impact','impactCeiling','冲击需求','COND_IMPACT_CEILING'],
      ['coordinationDemand','coordinationCeiling','协调需求','COND_COORDINATION_CEILING'],
      ['fatigueRisk','fatigueCeiling','疲劳风险','COND_FATIGUE_CEILING'],
    ];
    stations(session).forEach((station,index)=>{
      checks.forEach(([field,ceilingField,label,code],offset)=>{
        const value=station?.[field],ceiling=policy?.[ceilingField];
        if(!(value in RISK)||!(ceiling in RISK)||RISK[value]<=RISK[ceiling])return;
        out.push(issue('hard',`${label}超出等级上限`,
          `${station?.name||station?.actionId||'动作'} 的 ${field}=${value}，高于 ${session.level} 的 ${ceilingField}=${ceiling}。`,
          code,10200+index*10+offset));
      });
    });
    return out;
  }

  function prescriptionIssues(session){
    const data=D(),ctx=domain(session),metrics=ctx?.metrics||{},protocolId=ctx?.protocolId;
    const protocol=data.conditioningProtocols?.[protocolId]||{},p=data.conditioningProtocolPolicies?.[protocolId]||{};
    const level=data.conditioningLevelPolicies?.[session?.level]||{},out=[];
    const hard=(title,text,code,order)=>out.push(issue('hard',title,text,code,order));

    if(!inRange(Number(metrics.stationCount),protocol.stationCountRange)||!inRange(Number(metrics.stationCount),level.stationCountRange)){
      hard('Station 数量不合法',`当前 stationCount=${metrics.stationCount} 不符合 Protocol / Level 范围。`,'COND_STATION_COUNT_POLICY',10300);
    }
    if(!inRange(Number(metrics.targetRpe),level.targetRpeRange)){
      hard('目标 RPE 不合法',`当前 RPE ${metrics.targetRpe} 不符合 ${session.level} 范围。`,'COND_RPE_POLICY',10310);
    }

    if(protocolId==='STEADY'){
      if(Number(metrics.rounds)!==1||Number(metrics.stationCount)!==1||Number(metrics.restSeconds)!==0){
        hard('STEADY 处方结构非法','STEADY 必须为单站、单轮、无固定休息。','COND_WORK_REST_POLICY',10320);
      }
    }else if(protocolId==='DENSITY'){
      if(!inRange(Number(metrics.rounds),p.roundsRange)||!inRange(Number(metrics.densityWindowMinutes),p.densityWindowMinutesRange)){
        hard('DENSITY 处方结构非法','DENSITY rounds / density window 超出 Protocol policy。','COND_WORK_REST_POLICY',10320);
      }
    }else{
      const workRange=[
        Math.max(level.workSecondsRange?.[0]??-Infinity,p.workSecondsRange?.[0]??-Infinity),
        Math.min(level.workSecondsRange?.[1]??Infinity,p.workSecondsRange?.[1]??Infinity),
      ];
      const restRange=[
        Math.max(level.restSecondsRange?.[0]??-Infinity,p.restSecondsRange?.[0]??-Infinity),
        Math.min(level.restSecondsRange?.[1]??Infinity,p.restSecondsRange?.[1]??Infinity),
      ];
      const roundsRange=[
        Math.max(level.roundsRange?.[0]??-Infinity,p.roundsRange?.[0]??-Infinity),
        Math.min(level.roundsRange?.[1]??Infinity,p.roundsRange?.[1]??Infinity),
      ];
      if(!inRange(Number(metrics.workSeconds),workRange)||!inRange(Number(metrics.restSeconds),restRange)||!inRange(Number(metrics.rounds),roundsRange)){
        hard('Work / Rest / Round 不合法','当前计时处方超出 Protocol 与 Level 的交集范围。','COND_WORK_REST_POLICY',10320);
      }
    }
    return out;
  }

  function riskCountIssues(session){
    const data=D(),policy=data.conditioningConflictPolicy||{},level=session?.level,out=[],items=stations(session);
    const configs=[
      ['impact','high','maxHighImpactStationsByLevel','高冲击 Station 偏多','COND_HIGH_IMPACT_STACK'],
      ['coordinationDemand','high','maxHighCoordinationStationsByLevel','高协调 Station 偏多','COND_HIGH_COORDINATION_STACK'],
      ['fatigueRisk','high','maxHighFatigueStationsByLevel','高疲劳 Station 偏多','COND_HIGH_FATIGUE_STACK'],
    ];
    configs.forEach(([field,value,mapKey,title,code],index)=>{
      const count=items.filter(item=>item?.[field]===value).length,max=Number(policy?.[mapKey]?.[level]);
      if(Number.isFinite(max)&&count>max){
        out.push(issue('warn',title,`当前 ${count} 个，超过 ${level} 建议上限 ${max} 个。`,code,10400+index));
      }
    });
    const powerCount=items.filter(item=>item?.powerEligible===true).length,powerMax=Number(policy.maxPowerStationsByLevel?.[level]);
    if(Number.isFinite(powerMax)&&powerCount>powerMax){
      out.push(issue('warn','Power Station 偏多',`当前 ${powerCount} 个，超过 ${level} 建议上限 ${powerMax} 个。`,'COND_POWER_STACK',10410));
    }
    return out;
  }

  function modalityIssues(session){
    const data=D(),policy=data.conditioningConflictPolicy||{},items=stations(session),out=[];
    const primary=items.map(item=>item?.primaryModality||'').filter(Boolean);
    let longest=0,current=0,last='';
    primary.forEach(value=>{
      if(value===last)current+=1;
      else{last=value;current=1;}
      longest=Math.max(longest,current);
    });
    const max=Number(policy.maxConsecutiveSameModality);
    if(Number.isFinite(max)&&longest>max){
      out.push(issue('warn','连续 Modality 重复',`同一主要 Modality 连续出现 ${longest} 次，超过建议上限 ${max}。`,'COND_MODALITY_REDUNDANCY',10500));
    }
    if(domain(session)?.protocolId==='CIRCUIT'){
      const distinct=new Set(primary).size,min=Number(policy.minDistinctModalitiesForCircuit);
      if(Number.isFinite(min)&&distinct<min){
        out.push(issue('warn','Circuit Modality 过于单一',`当前仅 ${distinct} 类主要 Modality，建议至少 ${min} 类。`,'COND_CIRCUIT_MODALITY_DIVERSITY',10510));
      }
    }
    return out;
  }

  function powerPlacementIssue(session){
    const data=D(),policy=data.conditioningConflictPolicy||{},items=stations(session);
    if(policy.powerMustPrecedeFatigue!==true)return null;
    const firstHighFatigue=items.findIndex(item=>item?.fatigueRisk==='high');
    if(firstHighFatigue<0)return null;
    const laterPower=items.findIndex((item,index)=>index>firstHighFatigue&&item?.powerEligible===true);
    if(laterPower<0)return null;
    return issue('warn','Power 排位过晚',
      '高疲劳 Station 之后仍安排 Power 动作；爆发质量应优先放在疲劳前段。',
      'COND_POWER_AFTER_FATIGUE',10600);
  }

  function timeIssue(session){
    const data=D(),metrics=domain(session)?.metrics||{},levelPolicy=data.conditioningLevelPolicies?.[session?.level]||{},max=Number(data.conditioningConflictPolicy?.maxEstimatedSessionMinutes);
    const estimated=Number(metrics.estimatedMinutes),block=Number(metrics.blockMinutes),issues=[];
    if(Number.isFinite(max)&&Number.isFinite(estimated)&&estimated>max){
      issues.push(issue('warn','Conditioning 时间预算过长',`预计 ${estimated} 分钟，超过 V1 上限 ${max} 分钟。`,'COND_TIME_BUDGET',10700));
    }
    if(Number.isFinite(estimated)&&Array.isArray(levelPolicy.estimatedSessionMinutesRange)&&!inRange(estimated,levelPolicy.estimatedSessionMinutesRange)){
      issues.push(issue('warn','Conditioning 等级时长偏离',
        `预计 ${estimated} 分钟，${session.level} 建议区间为 ${levelPolicy.estimatedSessionMinutesRange[0]}–${levelPolicy.estimatedSessionMinutesRange[1]} 分钟。`,
        'COND_LEVEL_DURATION',10710));
    }
    if(Number.isFinite(block)&&Array.isArray(levelPolicy.totalWorkMinutesRange)&&!inRange(block,levelPolicy.totalWorkMinutesRange)){
      issues.push(issue('warn','Protocol 主块时长偏离',
        `主块约 ${block} 分钟，${session.level} 目标区间为 ${levelPolicy.totalWorkMinutesRange[0]}–${levelPolicy.totalWorkMinutesRange[1]} 分钟。`,
        'COND_BLOCK_DURATION',10720));
    }
    return issues;
  }

  function evaluate(session){
    const issues=[
      ...protocolIssues(session),
      ...stationIssues(session),
      ...ceilingIssues(session),
      ...prescriptionIssues(session),
      ...riskCountIssues(session),
      ...modalityIssues(session),
      ...timeIssue(session),
    ];
    const power=powerPlacementIssue(session);
    if(power)issues.push(power);
    return issues;
  }

  const plugin={evaluate};
  window.V15ConditioningConflictPlugin=plugin;
  if(!window.V15Conflict?.register)throw new Error('V15Conflict service is unavailable');
  window.V15Conflict.register('conditioning',plugin);
})();
