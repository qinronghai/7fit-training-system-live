(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const D=()=>window.V14_DATA||{};
  const Shared=()=>window.V14SessionCopy||{};

  const RISK_LABEL=Object.freeze({low:'低',medium:'中',high:'高'});

  function clean(value){return String(value??'').trim();}
  function actionFields(actionId){return D().actionDetails?.[actionId]?.fields||{};}
  function recovery(){
    if(!M.ConditioningRecovery?.payload)throw new Error('Conditioning Recovery presentation is unavailable');
    return M.ConditioningRecovery.payload();
  }

  function buildStations(session){
    const domains=session?.domainContext?.stations||{};
    return Object.values(domains).map((station,index)=>{
      const fields=actionFields(station.actionId);
      return {
        key:station.key||`STATION-${index+1}`,
        order:index+1,
        actionId:station.actionId,
        name:station.name||D().actions?.[station.actionId]?.name||station.actionId,
        prescription:station.prescription||'',
        workMetric:station.workMetric||'',
        impact:station.impact||'',
        coordinationDemand:station.coordinationDemand||'',
        fatigueRisk:station.fatigueRisk||'',
        powerEligible:station.powerEligible===true,
        purpose:clean(fields['训练目标']||fields['训练目的']),
        cue:clean(fields['教练口令']),
        observation:clean(fields['常见错误']||fields['常见代偿'])||'保持动作质量与节奏；疲劳上升时优先控制幅度和速度。',
      };
    });
  }

  function buildPayload(session,resolvedPrep,now){
    if(!session||session.templateId!=='conditioning')throw new Error('ConditioningCopy requires a Conditioning ResolvedSession');
    const family=D().conditioningFamilies?.[session.familyId]||{},metrics=session.domainContext?.metrics||{};
    const prep=M.ConditioningPrep?.items?M.ConditioningPrep.items(resolvedPrep):[];
    return {
      templateId:'conditioning',
      familyId:session.familyId,
      familyName:family.name||session.title||session.familyId,
      goal:family.goal||'',
      level:session.level,
      date:Shared().formatDate?Shared().formatDate(now):'',
      summary:session.summary||'',
      protocolId:session.domainContext?.protocolId||session.main?.content?.protocolId||'',
      protocolName:session.domainContext?.protocolName||session.main?.content?.name||'',
      metrics:{...metrics},
      prep,
      stations:buildStations(session),
      anatomy:session.anatomyContext||{},
      conflicts:session.conflictContext||{status:'PASS',hardCount:0,warnCount:0,issues:[]},
      recovery:recovery(),
    };
  }

  function prepLines(items){
    if(!(items||[]).length)return ['- 暂无热身动作'];
    return items.map(item=>{
      const detail=[clean(item.prescription),clean(item.why)].filter(Boolean).join('｜');
      return `- ${clean(item.name)||'暂无合法候选'}${detail?`｜${detail}`:''}`;
    });
  }

  function metricLine(p){
    const m=p.metrics||{};
    if(p.protocolId==='STEADY')return `持续输出：约 ${m.blockMinutes??'—'} 分钟｜RPE ${m.targetRpe??'—'}`;
    if(p.protocolId==='DENSITY')return `密度窗：${m.densityWindowMinutes??'—'} 分钟 × ${m.rounds??'—'}｜站间转换 ${m.transitionSeconds??'—'} 秒｜RPE ${m.targetRpe??'—'}`;
    return `Work / Rest：${m.workSeconds??'—'}s / ${m.restSeconds??'—'}s｜Transition ${m.transitionSeconds??'—'}s｜Rounds ${m.rounds??'—'}｜RPE ${m.targetRpe??'—'}`;
  }

  function conflictLines(conflicts){
    const result=conflicts||{};
    const lines=[`状态：${clean(result.status)||'PASS'}｜硬冲突 ${Number(result.hardCount||0)}｜警告 ${Number(result.warnCount||0)}`];
    (result.issues||[]).forEach(item=>{
      const text=[clean(item.title),clean(item.text)].filter(Boolean).join('｜');
      if(text)lines.push(`- ${text}`);
    });
    return lines;
  }

  function stressLine(station){
    return `冲击 ${RISK_LABEL[station.impact]||station.impact||'—'}｜协调 ${RISK_LABEL[station.coordinationDemand]||station.coordinationDemand||'—'}｜疲劳 ${RISK_LABEL[station.fatigueRisk]||station.fatigueRisk||'—'}${station.powerEligible?'｜Power':''}`;
  }

  function formatCoach(payload){
    const p=payload||{},m=p.metrics||{},r=p.recovery||{};
    const lines=[
      '7Fit｜Conditioning 教练训练单',
      clean(p.date),
      `目标：${clean(p.familyName)}｜${clean(p.level)}`,
      clean(p.goal)?`训练目标：${clean(p.goal)}`:'',
      `Protocol：${clean(p.protocolName)}`,
      metricLine(p),
      `Station：${m.stationCount??(p.stations||[]).length} 站｜主块约 ${m.blockMinutes??'—'} 分钟｜整节预计 ${m.estimatedMinutes??'—'} 分钟`,
      '',
      '【PREP / PRIMER】',
      ...prepLines(p.prep),
      '',
      '【2F CONDITIONING】',
    ];
    (p.stations||[]).forEach(station=>{
      lines.push(`${station.order}. ${clean(station.name)}`);
      lines.push(clean(station.prescription));
      lines.push(stressLine(station));
      if(clean(station.purpose))lines.push(`训练目的：${clean(station.purpose)}`);
      if(clean(station.cue))lines.push(`教练口令：${clean(station.cue)}`);
      lines.push(`观察重点：${clean(station.observation)}`);
    });
    lines.push(
      '',
      '【Conditioning Conflict】',
      ...conflictLines(p.conflicts),
      '',
      `【${clean(r.title)}】`,
      clean(r.note),
      clean(r.boundary),
    );
    return lines.filter((line,index,array)=>line!==''||array[index-1]!=='').join('\n').trim();
  }

  function memberStationLine(station){
    return `${station.order}. ${clean(station.name)}${clean(station.prescription)?`｜${clean(station.prescription)}`:''}`;
  }

  function formatMember(payload){
    const p=payload||{},m=p.metrics||{},r=p.recovery||{};
    const lines=[
      '7Fit｜今日体能训练',
      clean(p.date),
      `训练主题：${clean(p.familyName)||'体能训练'}`,
      clean(p.goal)?`今天目标：${clean(p.goal)}`:'',
      `训练等级：${clean(p.level)}`,
      `训练方式：${clean(p.protocolName)}`,
      metricLine(p),
      `预计训练时间：约 ${m.estimatedMinutes??'—'} 分钟`,
      '',
      '【训练前准备】',
      ...prepLines(p.prep),
      '',
      '【主要训练】',
      ...(p.stations||[]).map(memberStationLine),
      '',
      `【${clean(r.title)}】`,
      clean(r.note),
      '今天完成完整体能课后，不再额外安排课后有氧。',
    ];
    return lines.filter((line,index,array)=>line!==''||array[index-1]!=='').join('\n').trim();
  }

  M.ConditioningCopy={buildPayload,formatCoach,formatMember,metricLine};
})();
