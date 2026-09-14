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
    const blocks=Array.isArray(session?.blocks)&&session.blocks.length
      ?session.blocks
      :[{key:'MAIN',roleLabel:'主训练段',label:'Conditioning 主训练',stations:session?.domainContext?.stations||{}}];
    return blocks.flatMap((block,blockIndex)=>Object.values(block.stations||{}).map((station,index)=>{
      const fields=actionFields(station.actionId);
      return {
        key:station.key||`STATION-${index+1}`,
        order:index+1,
        blockKey:block.key||station.blockKey||`BLOCK-${blockIndex+1}`,
        blockLabel:block.label||block.roleLabel||'训练段',
        blockRole:block.roleLabel||block.role||'训练段',
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
    }));
  }

  function buildPayload(session,resolvedPrep,now){
    if(!session||session.templateId!=='conditioning')throw new Error('ConditioningCopy requires a Conditioning ResolvedSession');
    const family=D().conditioningFamilies?.[session.familyId]||{},metrics=session.domainContext?.metrics||{},timing=session.timing||{};
    const prep=M.ConditioningPrep?.items?M.ConditioningPrep.items(resolvedPrep):[];
    return {
      templateId:'conditioning',
      familyId:session.familyId,
      familyName:family.name||session.title||session.familyId,
      goal:family.goal||'',
      level:session.level,
      variantId:session.variantId||'',
      blueprintLabel:session.domainContext?.blueprintLabel||'',
      changeSummary:session.domainContext?.changeSummary||'',
      date:Shared().formatDate?Shared().formatDate(now):'',
      summary:session.summary||'',
      protocolId:session.domainContext?.protocolId||session.main?.content?.protocolId||'',
      protocolName:session.domainContext?.protocolName||session.main?.content?.name||'',
      metrics:{...metrics},
      timing:{...timing},
      blocks:(session.blocks||[]).map(block=>({
        key:block.key,
        role:block.roleLabel||block.role||'训练段',
        label:block.label||block.key,
        goal:block.goal||'',
        protocolName:block.protocolName||'',
        prescription:block.prescription||'',
        metrics:{...(block.metrics||{})},
        coachingCues:[...(block.coachingCues||[])],
        scaleRules:[...(block.scaleRules||[])],
        stopCriteria:[...(block.stopCriteria||[])],
        completionMetric:block.completionMetric||'',
        stations:buildStations({blocks:[block]}),
      })),
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
    if(p.timing?.fullSessionMinutes!==undefined){
      return `训练段 ${p.timing.blockCount??(p.blocks||[]).length} 个｜任务 ${p.timing.taskCount??(p.stations||[]).length} 个｜正式训练约 ${p.timing.mainTrainingMinutes??'—'} 分钟｜整节约 ${p.timing.estimatedMinutes??p.timing.fullSessionMinutes??'—'} 分钟`;
    }
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
    const blocks=p.blocks?.length?[...p.blocks]:[{role:'主训练段',label:'Conditioning 主训练',goal:'',protocolName:p.protocolName,prescription:'',coachingCues:[],scaleRules:[],stopCriteria:[],completionMetric:'',stations:p.stations||[]}];
    blocks.forEach((block,index)=>{
      lines.push(`【训练段 ${index+1}｜${clean(block.role)}】`,clean(block.label));
      if(clean(block.goal))lines.push(`本段目标：${clean(block.goal)}`);
      if(clean(block.prescription))lines.push(`执行方式：${clean(block.protocolName)}｜${clean(block.prescription)}`);
      (block.stations||[]).forEach(station=>{
        lines.push(`${station.order}. ${clean(station.name)}`);
        lines.push(clean(station.prescription));
        lines.push(stressLine(station));
        if(clean(station.purpose))lines.push(`训练目的：${clean(station.purpose)}`);
        if(clean(station.cue))lines.push(`教练口令：${clean(station.cue)}`);
        lines.push(`观察重点：${clean(station.observation)}`);
      });
      if(block.coachingCues?.length)lines.push(`教练重点：${block.coachingCues.join('；')}`);
      if(block.scaleRules?.length)lines.push(`降阶规则：${block.scaleRules.join('；')}`);
      if(block.stopCriteria?.length)lines.push(`停止标准：${block.stopCriteria.join('；')}`);
      if(clean(block.completionMetric))lines.push(`完成标准：${clean(block.completionMetric)}`);
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
      clean(p.blueprintLabel)?`课程变体：${clean(p.blueprintLabel)}`:'',
      metricLine(p),
      `预计训练时间：约 ${m.estimatedMinutes??'—'} 分钟`,
      '',
      '【训练前准备】',
      ...prepLines(p.prep),
      '',
      '【主要训练】',
      ...((p.blocks?.length?p.blocks:[{label:'主要训练',stations:p.stations||[]}]).flatMap((block,index)=>[
        `训练段 ${index+1}：${clean(block.label)}`,
        ...(block.stations||[]).map(memberStationLine),
      ])),
      '',
      `【${clean(r.title)}】`,
      clean(r.note),
      '今天完成完整体能课后，不再额外安排课后有氧。',
    ];
    return lines.filter((line,index,array)=>line!==''||array[index-1]!=='').join('\n').trim();
  }

  M.ConditioningCopy={buildPayload,formatCoach,formatMember,metricLine};
})();
