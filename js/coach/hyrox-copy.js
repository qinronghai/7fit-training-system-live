(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},D=function(){return window.V14_DATA||{};},Shared=function(){return window.V14SessionCopy||{};};
  function clean(v){return String(v??'').trim();}
  function stationRows(session){
    return Object.values(session?.domainContext?.stations||{}).map(function(item,index){
      const meta=D().hyroxStations?.[item.stationId]||{};
      return {order:index+1,stationId:item.stationId,name:item.name,prescription:item.prescription,work:item.work,load:item.load,scaledVariant:item.scaledVariant||'',notes:meta.techniqueNotes||[]};
    });
  }
  function buildPayload(session,prep,now){
    if(!session||session.templateId!=='hyrox')throw new Error('HyroxCopy requires HYROX ResolvedSession');
    const type=D().hyroxSessionTypes?.[session.domainContext?.sessionType]||{};
    let benchmarkHistory=null;
    if(session.domainContext?.sessionType==='BENCHMARK'&&window.V15HyroxBenchmarkHistory){
      const H=window.V15HyroxBenchmarkHistory,athleteRef=H.getLastAthleteRef();
      if(athleteRef){
        const benchmark=session.domainContext.benchmarkContext||{};
        const summary=H.summary({athleteRef,protocolId:benchmark.protocolId,comparisonKey:benchmark.comparisonKey});
        const profile=H.abilityProfile(summary),recommendation=H.recommendation(profile,session.level);
        const latest=H.list({athleteRef,protocolId:benchmark.protocolId}).at(-1)||null;
        benchmarkHistory={athleteRef,summary,profile,recommendation,latest};
      }
    }
    return {
      date:Shared().formatDate?Shared().formatDate(now):'',
      sessionType:session.domainContext.sessionType,
      sessionTypeName:type.name||session.domainContext.sessionType,
      level:session.level,
      loadLevel:session.domainContext.loadLevel,
      capacityFocus:session.domainContext.capacityFocus||'',
      benchmark:session.domainContext.benchmarkContext||null,
      benchmarkHistory,
      metrics:session.main?.content?.metrics||{},
      prep:M.HyroxPrep?.items?M.HyroxPrep.items(prep):[],
      stations:stationRows(session),
      conflicts:session.conflictContext||{status:'PASS',hardCount:0,warnCount:0,issues:[]},
      recovery:M.HyroxRecovery?.payload?M.HyroxRecovery.payload(session):{title:'恢复',items:[],boundary:''},
    };
  }
  function prepLines(items){
    return (items||[]).length?(items||[]).map(function(item){return '- '+clean(item.name)+(item.prescription?'｜'+clean(item.prescription):'');}):['- 暂无热身动作'];
  }
  function formatCoach(p){
    const m=p.metrics||{},lines=['7Fit｜HYROX 教练训练单',clean(p.date),'类型：'+clean(p.sessionTypeName)+'｜'+clean(p.level)+'｜Load '+clean(p.loadLevel)];
    if(p.capacityFocus)lines.push('专项能力：'+clean(p.capacityFocus));
    if(p.benchmark)lines.push('Benchmark：'+clean(p.benchmark.protocolId)+'｜同协议、同工作量、同负重才直接比较成绩');
    lines.push('结构：'+(m.stationCount??p.stations.length)+' Station｜Rounds '+(m.rounds??'—')+'｜Rest '+(m.restSeconds??'—')+'s｜Transition '+(m.transitionSeconds??'—')+'s｜RPE '+(m.targetRpe??'—'),'','【PREP】',...prepLines(p.prep),'','【HYROX MAIN】');
    (p.stations||[]).forEach(function(s){
      lines.push(s.order+'. '+s.stationId+'｜'+clean(s.name),clean(s.prescription));
      if(s.notes?.length)lines.push('观察重点：'+s.notes.join('；'));
      if(s.scaledVariant)lines.push('Scaling：'+clean(s.scaledVariant));
    });
    lines.push('','【风险检查】','状态：'+clean(p.conflicts.status)+'｜硬冲突 '+Number(p.conflicts.hardCount||0)+'｜警告 '+Number(p.conflicts.warnCount||0));
    (p.conflicts.issues||[]).forEach(function(i){lines.push('- '+clean(i.title)+'｜'+clean(i.text));});
    lines.push('','【'+clean(p.recovery.title)+'】',...(p.recovery.items||[]).map(function(x){return '- '+clean(x);}),clean(p.recovery.boundary));
    if(p.benchmark){
      const H=window.V15HyroxBenchmarkHistory,h=p.benchmarkHistory;
      if(h?.latest){
        lines.push('','【Benchmark 成绩】','会员：'+clean(h.athleteRef),'本次：'+H.formatDuration(h.latest.totalTimeMs)+'｜'+clean(h.latest.validityStatus));
        if(h.summary?.previous&&h.summary?.current)lines.push('较上次：'+H.formatDelta(h.summary.deltaVsPrevious)+'｜PB：'+H.formatDuration(h.summary.pb?.totalTimeMs));
        (h.latest.stationResults||[]).forEach(function(s){if(s.timeMs)lines.push('- '+clean(s.stationId)+' '+clean((D().hyroxStations?.[s.stationId]||{}).zhName||s.stationId)+'｜'+H.formatDuration(s.timeMs));});
        if(h.recommendation?.message)lines.push('下一阶段：'+clean(h.recommendation.message));
      }else lines.push('','本次 Benchmark 成绩：待记录');
    }
    return lines.join('\n').trim();
  }
  function formatMember(p){
    const m=p.metrics||{},lines=['7Fit｜今日 HYROX 训练',clean(p.date),'训练类型：'+clean(p.sessionTypeName),'训练等级：'+clean(p.level)];
    if(p.capacityFocus)lines.push('今天重点：'+clean(p.capacityFocus));
    if(p.benchmark)lines.push('测试协议：'+clean(p.benchmark.protocolId)+'（固定 8 个 Station）');
    lines.push('目标强度：RPE '+(m.targetRpe??'—'),'','【训练前准备】',...prepLines(p.prep),'','【主要训练】');
    (p.stations||[]).forEach(function(s){lines.push(s.order+'. '+clean(s.name)+'｜'+clean(s.prescription));});
    if(p.benchmark){
      const H=window.V15HyroxBenchmarkHistory,h=p.benchmarkHistory;
      if(h?.latest){
        lines.push('','【本次 Benchmark】','会员：'+clean(h.athleteRef),'本次成绩：'+H.formatDuration(h.latest.totalTimeMs));
        if(h.summary?.previous&&h.summary?.current)lines.push('较上次：'+H.formatDelta(h.summary.deltaVsPrevious),'PB：'+H.formatDuration(h.summary.pb?.totalTimeMs));
        if(h.recommendation?.message)lines.push('下一阶段重点：'+clean(h.recommendation.message));
      }else lines.push('','本次成绩：待记录');
      lines.push('只有训练规格与负重一致时，才与上次成绩直接比较。');
    }
    lines.push('','【训练后恢复】',...(p.recovery.items||[]).map(function(x){return '- '+clean(x);}));
    return lines.join('\n').trim();
  }
  M.HyroxCopy={buildPayload,formatCoach,formatMember};
})();