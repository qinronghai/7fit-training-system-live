(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common,esc=C.esc,D=C.D;
  const H=()=>window.V15HyroxBenchmarkHistory;

  function statusLabel(status){
    return {
      VALID_COMPARABLE:'可比较',
      VALID_NEW_BASELINE:'新基准',
      SCALED:'Scaled｜不计 PB',
      INCOMPLETE:'未完整完成',
      INVALID_PROTOCOL:'旧记录 / 不可比较',
    }[status]||status||'—';
  }
  function dateText(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return value||'—';
    const p=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
  }
  function deltaText(value){
    if(value===null||value===undefined)return '—';
    return H().formatDeltaMs(value);
  }
  function latestSummary(ctx){
    const history=H()?.contextForSession?.(ctx.session);
    const a=history?.latestAnalysis;
    if(!history)return '';
    if(history.scaledSession){
      return '<div class="hyrox-benchmark-state warn"><b>当前为 Scaling / 非标准规格</b><span>本次记录可以保存，但不会进入 canonical PB，也不会与标准规格直接比较。</span></div>';
    }
    if(!a){
      return '<div class="hyrox-benchmark-state '+(history.needsNewBaseline?'warn':'')+'"><b>'+(history.needsNewBaseline?'规格变化，建立新基准':'尚无成绩')+'</b><span>'+(history.needsNewBaseline?'当前 Protocol 以前有其他规格记录，但 comparisonKey 不一致，因此不会显示进步或退步。':'完成后录入总时间与 8 个 Station 时间，建立第一条个人基准。')+'</span></div>';
    }
    const r=a.record,pb=a.pb,previous=a.previous;
    const cards=[
      ['本次',H().formatTimeMs(r.totalTimeMs)],
      ['上次同规格',previous?H().formatTimeMs(previous.totalTimeMs):'—'],
      ['PB',pb?H().formatTimeMs(pb.totalTimeMs):'—'],
      ['较上次',r.validityStatus==='VALID_COMPARABLE'?deltaText(a.deltaPreviousMs):'新基准'],
    ];
    const profile=a.abilityProfile||{},weak=profile.weakestGroup||'—',recommend=profile.recommendation?.hint||'';
    return '<div data-hyrox-benchmark-summary>'+
      '<div class="hyrox-benchmark-summary-grid">'+cards.map(function(x){return '<div><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>';}).join('')+'</div>'+
      '<div class="hyrox-benchmark-profile"><span>当前短板：<b>'+esc(weak)+'</b></span>'+(recommend?'<span>建议：'+esc(recommend)+'</span>':'')+
      '<small>'+(profile.basis==='TREND_VS_PREVIOUS'?'短板依据：同规格相较上次的分组趋势。':'短板依据：当前各能力组平均分站耗时，仅作教练可解释提示。')+'</small></div>'+
    '</div>';
  }
  function sessionStations(ctx){
    const values=Object.values(ctx.session?.domainContext?.stations||{});
    return (ctx.session?.domainContext?.orderedStations||[]).map(id=>values.find(x=>x.stationId===id)).filter(Boolean);
  }
  function inputRows(ctx){
    return sessionStations(ctx).map(function(item,index){
      const meta=D().hyroxStations?.[item.stationId]||{};
      return '<article class="hyrox-benchmark-input-row">'+
        '<div><span>'+esc(item.stationId)+' · '+(index+1)+'</span><b>'+esc(meta.zhName||item.name||item.stationId)+'</b><small>'+esc(item.prescription||'')+'</small></div>'+
        '<label><span>分站时间</span><input type="text" inputmode="numeric" placeholder="mm:ss" data-hyrox-benchmark-time="'+esc(item.stationId)+'"></label>'+
      '</article>';
    }).join('');
  }
  function stationComparison(ctx,analysis){
    if(!analysis)return '';
    const prevBy=Object.fromEntries((analysis.previous?.stationResults||[]).map(x=>[x.stationId,x]));
    const currentBy=Object.fromEntries((analysis.record?.stationResults||[]).map(x=>[x.stationId,x]));
    return '<div class="hyrox-benchmark-station-history">'+sessionStations(ctx).map(function(item){
      const cur=currentBy[item.stationId],prev=prevBy[item.stationId],delta=analysis.stationDeltas?.[item.stationId];
      return '<div><span>'+esc(item.stationId)+' · '+esc(item.name)+'</span><small>'+esc(item.prescription||'')+'</small>'+
        '<b>'+esc(cur?.timeMs?H().formatTimeMs(cur.timeMs):'—')+'</b>'+
        '<em>上次 '+esc(prev?.timeMs?H().formatTimeMs(prev.timeMs):'—')+' · '+esc(delta===null||delta===undefined?'—':deltaText(delta))+'</em></div>';
    }).join('')+'</div>';
  }
  function trend(history){
    const rows=(history?.sameKeyRecords||[]).slice(0,5);
    if(!rows.length)return '';
    return '<div class="hyrox-benchmark-trend"><small>近 '+rows.length+' 次同规格</small><div>'+rows.slice().reverse().map(function(r){
      return '<span><b>'+esc(H().formatTimeMs(r.totalTimeMs))+'</b><small>'+esc(dateText(r.completedAt).slice(5,10))+'</small></span>';
    }).join('')+'</div></div>';
  }
  function historyList(ctx,history){
    const rows=(history?.records||[]).slice(0,8);
    if(!rows.length)return '<div class="hyrox-benchmark-empty">还没有 '+esc(ctx.protocolId)+' 的历史记录。</div>';
    return '<div class="hyrox-benchmark-history" data-hyrox-benchmark-history>'+rows.map(function(r){
      const same=r.comparisonKey===history.comparisonKey&&!r.legacy;
      return '<article data-hyrox-benchmark-record="'+esc(r.recordId)+'">'+
        '<div><span>'+esc(dateText(r.completedAt))+'</span><b>'+esc(r.totalTimeMs?H().formatTimeMs(r.totalTimeMs):'未完整')+'</b></div>'+
        '<p>'+esc(statusLabel(r.validityStatus))+(same?' · 当前规格':' · 其他规格')+'</p>'+
        '<button type="button" class="danger" data-hyrox-benchmark-delete="'+esc(r.recordId)+'">删除</button>'+
      '</article>';
    }).join('')+'</div>';
  }
  function render(ctx){
    if(ctx.sessionType!=='BENCHMARK'||!ctx.session||!H())return '';
    const history=H().contextForSession(ctx.session),analysis=history?.latestAnalysis;
    return '<section class="section-card hyrox-benchmark-panel" data-hyrox-benchmark-panel>'+
      '<div class="section-head"><div><h2>Benchmark 成绩 / PB</h2><p>只比较完全相同的 Protocol、工作量、有效负重、雪橇校准与 Scaling。不同规格独立建立基准。</p></div><span class="time-badge">LOCAL HISTORY</span></div>'+
      latestSummary(ctx)+
      '<div class="hyrox-benchmark-entry">'+
        '<div class="hyrox-benchmark-total-row"><label><span>本次总时间</span><input type="text" inputmode="numeric" placeholder="例如 26:52" data-hyrox-benchmark-total></label>'+
        '<label><span>整课 RPE（可选）</span><input type="number" min="1" max="10" step="0.5" data-hyrox-benchmark-rpe></label></div>'+
        '<div class="hyrox-benchmark-inputs">'+inputRows(ctx)+'</div>'+
        '<label class="hyrox-benchmark-notes"><span>备注（可选）</span><input type="text" data-hyrox-benchmark-notes placeholder="节奏、技术或当日状态"></label>'+
        '<div class="hyrox-benchmark-save-row"><button type="button" data-hyrox-benchmark-save>保存本次成绩</button><span data-hyrox-benchmark-status></span></div>'+
      '</div>'+
      (analysis?'<div class="hyrox-benchmark-comparison"><h3>最近一次同规格分站对比</h3>'+stationComparison(ctx,analysis)+trend(history)+'</div>':trend(history))+
      '<div class="hyrox-benchmark-history-block"><h3>'+esc(ctx.protocolId)+' 历史</h3>'+historyList(ctx,history)+'</div>'+
    '</section>';
  }
  function bind(ctx,root,rerender){
    if(ctx.sessionType!=='BENCHMARK'||!ctx.session||!H())return;
    root.querySelector('[data-hyrox-benchmark-save]')?.addEventListener('click',function(){
      const status=root.querySelector('[data-hyrox-benchmark-status]');
      const stationTimes={};
      root.querySelectorAll('[data-hyrox-benchmark-time]').forEach(function(input){
        stationTimes[input.dataset.hyroxBenchmarkTime]=H().parseTimeText(input.value);
      });
      try{
        const result=H().saveFromSession(ctx.session,{
          totalTimeMs:H().parseTimeText(root.querySelector('[data-hyrox-benchmark-total]')?.value),
          stationTimes,
          rpe:Number(root.querySelector('[data-hyrox-benchmark-rpe]')?.value)||null,
          notes:String(root.querySelector('[data-hyrox-benchmark-notes]')?.value||'').trim(),
        });
        if(status)status.textContent=result.record.validityStatus==='INCOMPLETE'?'已保存为未完整记录，不计入 PB。':result.record.validityStatus==='SCALED'?'已保存 Scaling 记录，不计入 canonical PB。':result.record.validityStatus==='VALID_NEW_BASELINE'?'已建立新基准。':'已保存并完成同规格比较。';
        rerender();
      }catch(error){if(status)status.textContent=error?.message||'保存失败，历史记录未改动。';}
    });
    root.querySelectorAll('[data-hyrox-benchmark-delete]').forEach(function(button){
      button.addEventListener('click',function(){
        const id=button.dataset.hyroxBenchmarkDelete,record=H().get(id);
        if(!record)return;
        if(typeof window.confirm==='function'&&!window.confirm('确认删除这条 Benchmark 记录？\\n'+dateText(record.completedAt)+' · '+statusLabel(record.validityStatus)))return;
        try{H().remove(id);rerender();}catch(_){}
      });
    });
  }

  M.HyroxBenchmark={render,bind,statusLabel};
})();
