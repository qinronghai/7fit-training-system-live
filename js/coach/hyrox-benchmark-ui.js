(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common,esc=C.esc,D=C.D;
  const H=function(){return window.V15HyroxBenchmarkHistory;};

  function statusLabel(record){
    if(!record)return '暂无记录';
    return ({
      VALID_NEW_BASELINE:'新基准',
      VALID_COMPARABLE:'可比较',
      SCALED:'Scaling 记录',
      INCOMPLETE:'未完成',
      INVALID_PROTOCOL:'旧记录 / 不可比较',
    })[record.validityStatus]||record.validityStatus||'记录';
  }
  function time(value){return H().formatDuration(value);}
  function delta(value){return value==null?'—':H().formatDelta(value);}
  function stationName(id){const s=D().hyroxStations?.[id]||{};return s.zhName||s.name||id;}

  function selectedAthlete(){return H().getLastAthleteRef()||'';}
  function historyContext(session,athleteRef){
    const benchmark=session?.domainContext?.benchmarkContext||{};
    const athlete=String(athleteRef||selectedAthlete()).trim();
    const summary=H().summary({athleteRef:athlete,protocolId:benchmark.protocolId,comparisonKey:benchmark.comparisonKey});
    const profile=H().abilityProfile(summary);
    const recommendation=H().recommendation(profile,session?.level||'');
    const protocolRecords=athlete?H().list({athleteRef:athlete,protocolId:benchmark.protocolId}):[];
    const latestAny=protocolRecords.at(-1)||null;
    const deleted=athlete?H().list({athleteRef:athlete,protocolId:benchmark.protocolId,includeDeleted:true}).filter(function(r){return !!r.deletedAt;}):[];
    return {athlete,summary,profile,recommendation,protocolRecords,latestAny,deleted};
  }

  function athletePanel(session,ctx){
    const protocol=session.domainContext.benchmarkContext;
    return '<section class="section-card hyrox-benchmark-athlete">'+
      '<div class="section-head"><div><h2>会员 Benchmark 档案</h2><p>成绩按「会员 + comparisonKey」隔离，避免不同会员、不同负重或不同协议串 PB。</p></div><span class="time-badge">'+esc(protocol.protocolId)+'</span></div>'+
      '<div class="hyrox-history-athlete-row">'+
        '<label><span>会员姓名 / 唯一标识</span><input type="text" data-hyrox-history-athlete value="'+esc(ctx.athlete)+'" placeholder="例如：梦影"></label>'+
        '<button type="button" data-hyrox-history-load>载入该会员历史</button>'+
      '</div><div class="hyrox-history-status" data-hyrox-history-status></div>'+
    '</section>';
  }

  function recorder(session,ctx){
    const stations=Object.values(session.domainContext?.stations||{});
    const stationInputs=stations.map(function(item){
      return '<label class="hyrox-benchmark-time-field"><span>'+esc(item.stationId)+'｜'+esc(item.name)+'</span><small>'+esc(item.prescription)+'</small><input type="text" inputmode="decimal" placeholder="例如 2:21" data-hyrox-benchmark-time="'+esc(item.stationId)+'"></label>';
    }).join('');
    return '<section class="section-card hyrox-benchmark-recorder">'+
      '<div class="section-head"><div><h2>记录本次 Benchmark</h2><p>时间格式支持 <b>26:52</b> 或直接输入秒数。允许保存未完成记录，但未完成记录不会进入 PB。</p></div></div>'+
      '<div class="hyrox-benchmark-recorder-head">'+
        '<label><span>总时间</span><input type="text" inputmode="decimal" placeholder="26:52" data-hyrox-benchmark-total></label>'+
        '<label><span>整节 RPE</span><input type="number" min="1" max="10" step="0.5" placeholder="8" data-hyrox-benchmark-rpe></label>'+
        '<label class="wide"><span>备注</span><input type="text" placeholder="例如：Wall Ball 后段节奏下降" data-hyrox-benchmark-notes></label>'+
      '</div>'+
      '<div class="hyrox-benchmark-time-grid">'+stationInputs+'</div>'+
      '<div class="hyrox-benchmark-recorder-actions"><button type="button" data-hyrox-benchmark-save>保存本次成绩</button><span data-hyrox-benchmark-save-status></span></div>'+
    '</section>';
  }

  function metric(label,value,sub){
    return '<div><small>'+esc(label)+'</small><b>'+esc(value||'—')+'</b>'+(sub?'<span>'+esc(sub)+'</span>':'')+'</div>';
  }

  function summaryPanel(session,ctx){
    if(!ctx.athlete)return '<section class="section-card hyrox-benchmark-history-empty"><b>先输入会员</b><span>载入会员后，这里会显示本次、上次、PB 和同协议进步幅度。</span></section>';
    const s=ctx.summary,latest=ctx.latestAny,current=s.current;
    let baseline='';
    if(latest?.validityStatus==='VALID_NEW_BASELINE')baseline='<div class="hyrox-history-baseline">'+esc(H().baselineReasonLabel(latest.baselineReason))+'</div>';
    if(latest?.validityStatus==='SCALED')baseline='<div class="hyrox-history-baseline warn">本次为 Scaling 规格，只保留训练记录，不进入 canonical PB。</div>';
    if(latest?.validityStatus==='INCOMPLETE')baseline='<div class="hyrox-history-baseline warn">本次记录未完成，不进入 PB。</div>';
    return '<section class="section-card hyrox-benchmark-summary">'+
      '<div class="section-head"><div><h2>'+esc(ctx.athlete)+'｜'+esc(session.domainContext.benchmarkContext.protocolId)+' Benchmark</h2><p>只有相同 comparisonKey 的完整 canonical 记录才计算“上次 / PB / 进步”。</p></div><span class="time-badge">'+esc(statusLabel(latest))+'</span></div>'+
      baseline+
      '<div class="hyrox-benchmark-kpi-grid">'+
        metric('最近记录',latest?.totalTimeMs?time(latest.totalTimeMs):'—',latest?statusLabel(latest):'暂无')+
        metric('上次同规格',s.previous?time(s.previous.totalTimeMs):'—','同 comparisonKey')+
        metric('个人 PB',s.pb?time(s.pb.totalTimeMs):'—','同 comparisonKey')+
        metric('较上次',current&&s.previous?delta(s.deltaVsPrevious):'—',s.deltaVsPrevious>0?'进步':s.deltaVsPrevious<0?'变慢':'')+
      '</div>'+
      stationComparison(ctx)+
    '</section>';
  }

  function stationComparison(ctx){
    const s=ctx.summary;
    if(!s.current)return '';
    const cards=Object.entries(s.stationSummary||{}).map(function(entry){
      const id=entry[0],row=entry[1];
      return '<article class="hyrox-history-station"><span>'+esc(id)+'｜'+esc(stationName(id))+'</span>'+
        '<div><small>本次</small><b>'+esc(time(row.current.timeMs))+'</b></div>'+
        '<div><small>上次</small><b>'+esc(row.previous?time(row.previous.timeMs):'—')+'</b></div>'+
        '<div><small>变化</small><b>'+esc(row.deltaVsPrevious==null?'—':delta(row.deltaVsPrevious))+'</b></div>'+
        '<div><small>PB</small><b>'+esc(row.pb?time(row.pb.timeMs):'—')+'</b></div>'+
      '</article>';
    }).join('');
    return '<div class="hyrox-history-station-grid">'+cards+'</div>';
  }

  function abilityPanel(session,ctx){
    if(!ctx.athlete)return '';
    const p=ctx.profile,r=ctx.recommendation;
    if(!p.ready){
      return '<section class="section-card hyrox-ability-panel"><div class="section-head"><div><h2>能力画像</h2><p>至少需要 2 次同规格完整 Benchmark，才开始做专项短板判断。</p></div></div><div class="hyrox-history-baseline">数据不足：完成第二次同协议 Benchmark 后再评估。</div></section>';
    }
    const groupCards=Object.entries(p.groups||{}).map(function(entry){
      const id=entry[0],g=entry[1];
      return '<div class="'+(id===p.weakestGroup?'weak':'')+'"><small>'+esc(id)+'</small><b>距个人 PB '+esc(g.gapToPbPct.toFixed(1))+'%</b><span>较上次 '+esc((g.trendPct>=0?'+':'')+g.trendPct.toFixed(1))+'%</span></div>';
    }).join('');
    let link='';
    if(p.weakestGroup){
      const focus=p.weakestGroup==='BALL'?'MIXED_STRENGTH_ENDURANCE':p.weakestGroup;
      link='<a class="hyrox-recommend-link" href="#/coach/hyrox/capacity/'+String(session.level||'L1').toLowerCase()+'?focus='+encodeURIComponent(focus)+'">去做 '+esc(focus)+' Capacity →</a>';
    }
    return '<section class="section-card hyrox-ability-panel">'+
      '<div class="section-head"><div><h2>能力画像 / 下一阶段</h2><p>依据当前各 Station 距离“自己的分站 PB”还有多少，而不是使用不可解释的 AI 分数。</p></div></div>'+
      '<div class="hyrox-ability-grid">'+groupCards+'</div>'+
      '<div class="hyrox-recommendation"><b>'+esc(r.message)+'</b>'+link+'</div>'+
    '</section>';
  }

  function historyPanel(session,ctx){
    if(!ctx.athlete)return '';
    const rows=[...ctx.protocolRecords].reverse().slice(0,8).map(function(record){
      return '<article class="hyrox-history-row">'+
        '<div><b>'+esc(new Date(record.completedAt).toLocaleDateString('zh-CN'))+'</b><span>'+esc(statusLabel(record))+'</span></div>'+
        '<strong>'+esc(record.totalTimeMs?time(record.totalTimeMs):'—')+'</strong>'+
        '<small>'+esc(record.baselineReason?H().baselineReasonLabel(record.baselineReason):record.notes||'')+'</small>'+
        '<button type="button" data-hyrox-history-delete="'+esc(record.recordId)+'">删除</button>'+
      '</article>';
    }).join('');
    const deleted=ctx.deleted.slice(-5).reverse().map(function(record){
      return '<article class="hyrox-history-row deleted"><div><b>'+esc(new Date(record.completedAt).toLocaleDateString('zh-CN'))+'</b><span>已删除</span></div><strong>'+esc(record.totalTimeMs?time(record.totalTimeMs):'—')+'</strong><small>'+esc(statusLabel(record))+'</small><button type="button" data-hyrox-history-restore="'+esc(record.recordId)+'">恢复</button></article>';
    }).join('');
    return '<section class="section-card hyrox-history-list">'+
      '<div class="section-head"><div><h2>历史记录</h2><p>按当前会员与 '+esc(session.domainContext.benchmarkContext.protocolId)+' 协议查看；不同 comparisonKey 仍保留，但不会强行比较。</p></div></div>'+
      (rows?'<div class="hyrox-history-rows">'+rows+'</div>':'<div class="saved-session-empty">还没有 Benchmark 记录</div>')+
      (deleted?'<details class="hyrox-history-deleted"><summary>已删除记录（'+ctx.deleted.length+'）</summary><div class="hyrox-history-rows">'+deleted+'</div></details>':'')+
    '</section>';
  }

  function render(session){
    if(!session||session.domainContext?.sessionType!=='BENCHMARK')return '';
    const ctx=historyContext(session);
    return athletePanel(session,ctx)+recorder(session,ctx)+summaryPanel(session,ctx)+abilityPanel(session,ctx)+historyPanel(session,ctx);
  }

  function readDurationField(root,selector,label){
    const input=root.querySelector(selector),raw=String(input?.value||'').trim();
    if(!raw)return null;
    const ms=H().parseDuration(raw);
    if(!ms)throw new Error(label+' 时间格式不正确');
    return ms;
  }

  function bind(session,root,rerender){
    if(!session||session.domainContext?.sessionType!=='BENCHMARK')return;
    root.querySelector('[data-hyrox-history-load]')?.addEventListener('click',function(){
      const athlete=String(root.querySelector('[data-hyrox-history-athlete]')?.value||'').trim();
      const status=root.querySelector('[data-hyrox-history-status]');
      if(!athlete){if(status)status.textContent='请输入会员姓名或唯一标识。';return;}
      H().setLastAthleteRef(athlete);rerender();
    });
    root.querySelector('[data-hyrox-benchmark-save]')?.addEventListener('click',function(){
      const status=root.querySelector('[data-hyrox-benchmark-save-status]');
      try{
        const athleteRef=String(root.querySelector('[data-hyrox-history-athlete]')?.value||H().getLastAthleteRef()||'').trim();
        const totalTimeMs=readDurationField(root,'[data-hyrox-benchmark-total]','总');
        const stationTimes={};
        root.querySelectorAll('[data-hyrox-benchmark-time]').forEach(function(input){
          const raw=String(input.value||'').trim();if(!raw)return;
          const ms=H().parseDuration(raw);
          if(!ms)throw new Error(input.dataset.hyroxBenchmarkTime+' 时间格式不正确');
          stationTimes[input.dataset.hyroxBenchmarkTime]=ms;
        });
        const rpeRaw=String(root.querySelector('[data-hyrox-benchmark-rpe]')?.value||'').trim();
        const rpe=rpeRaw?Number(rpeRaw):null;
        if(rpeRaw&&(!Number.isFinite(rpe)||rpe<1||rpe>10))throw new Error('RPE 必须在 1–10 之间');
        const notes=String(root.querySelector('[data-hyrox-benchmark-notes]')?.value||'').trim();
        const record=H().saveSessionResult(session,{athleteRef,totalTimeMs,stationTimes,rpe,notes});
        if(status)status.textContent='已保存：'+statusLabel(record);
        rerender();
      }catch(error){if(status)status.textContent=error?.message||'保存失败';}
    });
    root.querySelectorAll('[data-hyrox-history-delete]').forEach(function(button){
      button.addEventListener('click',function(){H().deleteRecord(button.dataset.hyroxHistoryDelete);rerender();});
    });
    root.querySelectorAll('[data-hyrox-history-restore]').forEach(function(button){
      button.addEventListener('click',function(){H().restoreRecord(button.dataset.hyroxHistoryRestore);rerender();});
    });
  }

  M.HyroxBenchmarkUI={render,bind,historyContext,statusLabel};
})();