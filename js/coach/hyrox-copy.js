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
    return {
      date:Shared().formatDate?Shared().formatDate(now):'',
      sessionType:session.domainContext.sessionType,
      sessionTypeName:type.name||session.domainContext.sessionType,
      level:session.level,
      loadLevel:session.domainContext.loadLevel,
      capacityFocus:session.domainContext.capacityFocus||'',
      benchmark:session.domainContext.benchmarkContext||null,
      benchmarkResult:window.V15HyroxBenchmarkHistory?.contextForSession?.(session)?.latestAnalysis||null,
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
      const a=p.benchmarkResult;
      if(a){
        lines.push('','【Benchmark 成绩】','本次：'+window.V15HyroxBenchmarkHistory.formatTimeMs(a.record.totalTimeMs));
        if(a.previous)lines.push('上次同规格：'+window.V15HyroxBenchmarkHistory.formatTimeMs(a.previous.totalTimeMs),'较上次：'+window.V15HyroxBenchmarkHistory.formatDeltaMs(a.deltaPreviousMs));
        else lines.push('比较：新基准');
        if(a.pb)lines.push('PB：'+window.V15HyroxBenchmarkHistory.formatTimeMs(a.pb.totalTimeMs));
        if(a.abilityProfile?.weakestGroup)lines.push('当前短板：'+a.abilityProfile.weakestGroup);
        if(a.abilityProfile?.recommendation?.hint)lines.push('下一阶段建议：'+a.abilityProfile.recommendation.hint);
      }else lines.push('','本次 Benchmark 成绩：待记录（成绩历史由 Benchmark 模块统一管理）');
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
      const a=p.benchmarkResult;
      if(a){
        lines.push('','本次成绩：'+window.V15HyroxBenchmarkHistory.formatTimeMs(a.record.totalTimeMs));
        if(a.previous)lines.push('较上次：'+window.V15HyroxBenchmarkHistory.formatDeltaMs(a.deltaPreviousMs));
        else lines.push('本次建立新基准。');
        const improved=Object.entries(a.stationDeltas||{}).filter(function(x){return Number(x[1])>0;}).sort(function(x,y){return y[1]-x[1];})[0];
        if(improved)lines.push('最明显进步：'+improved[0]+'｜'+window.V15HyroxBenchmarkHistory.formatDeltaMs(improved[1]));
        if(a.abilityProfile?.weakestGroup)lines.push('下一阶段重点：'+a.abilityProfile.weakestGroup);
      }else lines.push('','本次成绩：待记录','只有训练规格与负重一致时，才与上次成绩直接比较。');
    }
    lines.push('','【训练后恢复】',...(p.recovery.items||[]).map(function(x){return '- '+clean(x);}));
    return lines.join('\n').trim();
  }
  M.HyroxCopy={buildPayload,formatCoach,formatMember};
})();