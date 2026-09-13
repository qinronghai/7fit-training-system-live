(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common,esc=C.esc,D=C.D;
  const RESOLVER_VERSION='hyrox-v1';
  const LEVELS=['L1','L2','L3','L4'];
  const TYPE_LABEL={SKILL:'Skill｜技术学习',CAPACITY:'Capacity｜专项能力',MIXED:'Mixed｜综合训练',BENCHMARK:'Benchmark｜基准测试'};

  function identity(route){
    const sessionType=String(route.sessionType||'SKILL').toUpperCase();
    if(sessionType==='BENCHMARK'){
      const protocolId=String(route.protocolId||'B1').toUpperCase();
      const protocol=D().hyroxBenchmarkProtocols?.[protocolId]||D().hyroxBenchmarkProtocols?.B1||{};
      const level=protocol.level||'L1';
      return {sessionType,protocolId,level,capacityFocus:'',sessionKey:'BENCHMARK-'+protocolId,familyId:'HYROX-'+protocolId};
    }
    const rawLevel=String(route.level||'L1').toUpperCase(),level=LEVELS.includes(rawLevel)?rawLevel:'L1';
    const capacityFocus=sessionType==='CAPACITY'?String(route.query?.focus||'ENGINE').toUpperCase():'';
    const focus=(D().hyroxCapacityGroupIds||[]).includes(capacityFocus)?capacityFocus:'ENGINE';
    const sessionKey=sessionType==='CAPACITY'?'CAPACITY-'+focus+'-'+level:sessionType+'-'+level;
    const familyId=sessionType==='CAPACITY'?'HYROX-CAPACITY-'+focus:'HYROX-'+sessionType;
    return {sessionType,protocolId:'',level,capacityFocus:sessionType==='CAPACITY'?focus:'',sessionKey,familyId};
  }

  function defaultInput(id){
    return {
      sessionType:id.sessionType,
      level:id.level,
      loadLevel:id.level,
      ...(id.capacityFocus?{capacityFocus:id.capacityFocus}:{}),
      ...(id.protocolId?{benchmarkProtocolId:id.protocolId}:{}),
      sledCalibration:{},
      surface:'session',
    };
  }

  function ensureState(id){
    const S=window.V15State;
    if(!S)throw new Error('HYROX State service is unavailable');
    const current=S.getSession('hyrox',id.sessionKey);
    if(!current){
      return S.ensureSession('hyrox',id.sessionKey,{
        familyId:id.familyId,level:id.level,resolverVersion:RESOLVER_VERSION,input:defaultInput(id),
      });
    }
    return S.ensureSession('hyrox',id.sessionKey,{
      familyId:id.familyId,level:id.level,resolverVersion:RESOLVER_VERSION,
      input:{sessionType:id.sessionType,level:id.level,...(id.capacityFocus?{capacityFocus:id.capacityFocus}:{}),...(id.protocolId?{benchmarkProtocolId:id.protocolId}:{}),surface:'session'},
    });
  }

  function inputFor(id){
    const state=ensureState(id),input={...state.input,sessionType:id.sessionType,level:id.level};
    if(id.capacityFocus)input.capacityFocus=id.capacityFocus;else delete input.capacityFocus;
    if(id.protocolId)input.benchmarkProtocolId=id.protocolId;else delete input.benchmarkProtocolId;
    if(!LEVELS.includes(input.loadLevel))input.loadLevel=id.level;
    return input;
  }

  function resolveState(id){
    const input=inputFor(id);
    try{return {session:window.V15TemplateResolver.resolve('hyrox',input),input,error:null};}
    catch(error){
      if(String(error?.code||'').startsWith('HYROX_'))return {session:null,input,error};
      throw error;
    }
  }

  function context(route){
    const id=identity(route),state=ensureState(id),result=resolveState(id);
    const prep=result.session?M.HyroxPrep.resolve(result.session,id.sessionKey):null;
    return {...id,state:window.V15State.getSession('hyrox',id.sessionKey)||state,input:result.input,session:result.session,error:result.error,prep,route};
  }

  function patchInput(ctx,patch){
    const current=window.V15State.getSession('hyrox',ctx.sessionKey);
    return window.V15State.patchSession('hyrox',ctx.sessionKey,{input:{...(current?.input||{}),...patch}});
  }

  function reset(ctx){
    window.V15State.resetSession('hyrox',ctx.sessionKey);
    return ensureState(ctx);
  }

  function typeHref(type,level){
    if(type==='BENCHMARK')return '#/coach/hyrox/benchmark/b1';
    if(type==='CAPACITY')return '#/coach/hyrox/capacity/'+String(level||'L1').toLowerCase()+'?focus=ENGINE';
    return '#/coach/hyrox/'+type.toLowerCase()+'/'+String(level||'L1').toLowerCase();
  }

  function topNav(ctx){
    return '<div class="hyrox-type-tabs">'+['SKILL','CAPACITY','MIXED','BENCHMARK'].map(function(type){
      return '<a class="'+(ctx.sessionType===type?'active':'')+'" href="'+typeHref(type,ctx.level)+'">'+esc(TYPE_LABEL[type])+'</a>';
    }).join('')+'</div>';
  }

  function levelOptions(level){
    return LEVELS.map(function(item){return '<option value="'+item+'" '+(item===level?'selected':'')+'>'+item+'</option>';}).join('');
  }

  function controlPanel(ctx){
    const benchmark=ctx.sessionType==='BENCHMARK';
    const protocolOptions=(D().hyroxBenchmarkProtocolIds||[]).map(function(id){
      const p=D().hyroxBenchmarkProtocols?.[id]||{};
      return '<option value="'+id+'" '+(id===ctx.protocolId?'selected':'')+'>'+id+' · '+esc(p.name||'')+' · '+esc(p.level||'')+'</option>';
    }).join('');
    const focusOptions=(D().hyroxCapacityGroupIds||[]).map(function(id){
      const g=D().hyroxCapacityGroups?.[id]||{};
      return '<option value="'+id+'" '+(id===ctx.capacityFocus?'selected':'')+'>'+esc(g.name||id)+'</option>';
    }).join('');
    return '<section class="section-card hyrox-controls">'+
      '<div class="section-head"><div><h2>今日训练设置</h2><p>Session Type 与 Level 独立；负重等级也可以与容量等级分开。</p></div><button type="button" class="secondary-button" data-hyrox-reset>恢复系统推荐</button></div>'+
      topNav(ctx)+
      '<div class="hyrox-control-grid">'+
        (benchmark?'<label><span>Benchmark Protocol</span><select data-hyrox-protocol>'+protocolOptions+'</select></label>':'<label><span>容量等级</span><select data-hyrox-level>'+levelOptions(ctx.level)+'</select></label>')+
        (ctx.sessionType==='CAPACITY'?'<label><span>专项能力</span><select data-hyrox-focus>'+focusOptions+'</select></label>':'')+
        '<label><span>负重等级</span><select data-hyrox-load-level>'+levelOptions(ctx.input.loadLevel||ctx.level)+'</select></label>'+
      '</div>'+
    '</section>';
  }

  function calibrationValues(ctx){
    const c=ctx.input.sledCalibration||{};
    return {
      push:c.SLED_PUSH||{},
      pull:c.SLED_PULL||{},
      version:c.SLED_PUSH?.calibrationVersion||c.SLED_PULL?.calibrationVersion||'7fit-turf-v1',
    };
  }

  function needsSled(ctx){
    if(ctx.sessionType==='BENCHMARK')return true;
    if(ctx.sessionType==='CAPACITY'&&ctx.capacityFocus==='SLED')return true;
    return (ctx.session?.domainContext?.orderedStations||[]).some(function(id){return id==='H2'||id==='H3';});
  }

  function calibrationPanel(ctx){
    if(!needsSled(ctx)&&ctx.error?.code!=='HYROX_SLED_CALIBRATION_REQUIRED')return '';
    const v=calibrationValues(ctx),blocked=ctx.error?.code==='HYROX_SLED_CALIBRATION_REQUIRED';
    return '<section class="section-card hyrox-calibration '+(blocked?'blocked':'')+'">'+
      '<div class="section-head"><div><h2>雪橇场馆校准</h2><p>雪橇重量必须使用 7Fit 当前雪橇 + 8m 草坪的实测校准，不套用比赛公斤数。</p></div><span class="time-badge">'+(blocked?'必须完成':'已接入')+'</span></div>'+
      (blocked?'<div class="hyrox-blocker">当前 Session 需要 Sled Push / Pull，但还没有有效场馆校准。录入后才能生成可复现处方。</div>':'')+
      '<div class="hyrox-calibration-grid">'+
        '<label><span>Sled Push 校准重量</span><input type="number" min="1" step="1" value="'+esc(v.push.calibratedLoadKg??'')+'" data-hyrox-sled-push><small>kg</small></label>'+
        '<label><span>Sled Pull 校准重量</span><input type="number" min="1" step="1" value="'+esc(v.pull.calibratedLoadKg??'')+'" data-hyrox-sled-pull><small>kg</small></label>'+
        '<label><span>校准版本</span><input type="text" value="'+esc(v.version)+'" data-hyrox-sled-version></label>'+
        '<button type="button" data-hyrox-save-calibration>保存校准</button>'+
      '</div><div class="hyrox-inline-status" data-hyrox-calibration-status></div>'+
    '</section>';
  }

  function totalWorkText(session){
    const w=session?.domainContext?.totalWork||{},parts=[];
    if(w.meters)parts.push('器械 '+w.meters+'m');
    if(w.turfLengths)parts.push('草坪 '+w.turfLengths+' 趟 / '+w.turfMeters+'m');
    if(w.reps)parts.push(w.reps+' 次');
    return parts.join(' · ')||'—';
  }

  function timingText(ctx){
    const m=ctx.session?.main?.content?.metrics||{};
    if(ctx.sessionType==='BENCHMARK')return '整课计时｜总时间 + 分站时间';
    if(ctx.sessionType==='SKILL')return '技术质量优先｜不强制整课计时';
    return '按 '+(m.rounds??1)+' 轮 / Rest '+(m.restSeconds??0)+'s / Transition '+(m.transitionSeconds??0)+'s 执行';
  }

  function summaryPanel(ctx){
    const s=ctx.session,m=s.main.content.metrics||{},conf=s.conflictContext||{};
    const type=D().hyroxSessionTypes?.[ctx.sessionType]||{};
    return '<section class="section-card hyrox-summary-panel">'+
      '<div class="section-head"><div><h2>今日 HYROX 结构</h2><p>'+esc(type.goal||'')+'</p></div><span class="time-badge">'+esc(conf.status||'PASS')+'</span></div>'+
      '<div class="hyrox-metric-grid">'+
        '<div><small>类型</small><b>'+esc(TYPE_LABEL[ctx.sessionType])+'</b></div>'+
        '<div><small>容量等级</small><b>'+esc(ctx.level)+'</b></div>'+
        '<div><small>负重等级</small><b>'+esc(s.domainContext.loadLevel)+'</b></div>'+
        '<div><small>Station</small><b>'+esc(m.stationCount)+'</b></div>'+
        '<div><small>总工作量</small><b>'+esc(totalWorkText(s))+'</b></div>'+
        '<div><small>计时 / 时长</small><b>'+esc(timingText(ctx))+'</b></div>'+
        '<div><small>Target RPE</small><b>'+esc(m.targetRpe)+'</b></div>'+
        '<div><small>Turf</small><b>'+esc(s.domainContext.turfLengthMeters)+'m / 趟</b></div>'+
      '</div>'+
    '</section>';
  }

  function workUnit(item){
    if(item.work.metric==='METER')return 'm';
    if(item.work.metric==='REP')return '次';
    return '趟（1趟 = '+(D().hyroxVenuePolicy?.turfLengthMeters||8)+'m）';
  }

  function candidateOptions(ctx,index,item){
    if(ctx.sessionType==='BENCHMARK')return '';
    const ids=ctx.session.domainContext.orderedStations||[],options=[];
    for(const candidate of D().hyroxStationIds||[]){
      if(candidate!==item.stationId&&ids.includes(candidate))continue;
      const next=[...ids];next[index]=candidate;
      const valid=window.V15HyroxResolver.isSelectionValid({
        sessionType:ctx.sessionType,level:ctx.level,capacityFocus:ctx.capacityFocus,selections:next,
      });
      if(!valid)continue;
      const meta=D().hyroxStations?.[candidate]||{};
      options.push('<option value="'+candidate+'" '+(candidate===item.stationId?'selected':'')+'>'+candidate+'｜'+esc(meta.zhName||meta.name||candidate)+'</option>');
    }
    return '<label class="hyrox-adjust-field"><span>合法替换</span><select data-hyrox-station-swap="'+index+'">'+options.join('')+'</select></label>';
  }

  function stationCard(ctx,item,index){
    const meta=D().hyroxStations?.[item.stationId]||{},m=ctx.session.main.content.metrics||{};
    const loadable=meta.loadable===true,loadValue=item.load?.value??'',loadUnit=item.load?.unit==='KG_PER_HAND'?'kg / 手':'kg';
    const loadControl=loadable?'<label class="hyrox-adjust-field"><span>使用负重</span><div class="hyrox-input-unit"><input type="number" min="0" step="0.5" value="'+esc(loadValue)+'" data-hyrox-load="'+esc(item.stationId)+'"><small>'+esc(loadUnit)+'</small></div></label>':'<div class="hyrox-fixed-field"><span>负重</span><b>自重 / 器械输出</b></div>';
    const workControl=ctx.sessionType==='BENCHMARK'
      ?'<div class="hyrox-fixed-field"><span>工作量</span><b>'+esc(item.prescription.split('｜').slice(0,2).join('｜'))+'</b></div>'
      :'<label class="hyrox-adjust-field"><span>工作量</span><div class="hyrox-input-unit"><input type="number" min="1" step="1" value="'+esc(item.work.value)+'" data-hyrox-work="'+esc(item.stationId)+'"><small>'+esc(workUnit(item))+'</small></div></label>';
    const notes=(meta.techniqueNotes||[]).map(function(note){return '<li>'+esc(note)+'</li>';}).join('');
    return '<article class="hyrox-station-card" data-hyrox-station-card="'+esc(item.stationId)+'">'+
      '<div class="hyrox-station-head"><div><span>'+esc(item.stationId)+' · STATION '+(index+1)+'</span><h3>'+esc(item.name)+'</h3></div><small>'+(item.scaled?'已缩放':'标准处方')+'</small></div>'+
      '<div class="hyrox-prescription">'+esc(item.prescription)+'</div>'+
      '<div class="hyrox-station-meta"><span>Rounds '+esc(m.rounds)+'</span><span>Rest '+esc(m.restSeconds)+'s</span><span>Transition '+esc(m.transitionSeconds)+'s</span><span>RPE '+esc(m.targetRpe)+'</span></div>'+
      '<div class="hyrox-adjust-grid">'+candidateOptions(ctx,index,item)+workControl+loadControl+'</div>'+
      '<div class="hyrox-coach-observe"><small>教练观察重点</small><ul>'+notes+'</ul></div>'+
      (item.scaledVariant?'<div class="hyrox-scale-note">Scaling：'+esc(item.scaledVariant)+'</div>':'')+
    '</article>';
  }

  function mainTraining(ctx){
    const stations=Object.values(ctx.session.domainContext?.stations||{});
    const benchmark=ctx.sessionType==='BENCHMARK';
    return '<section class="section-card hyrox-main '+(benchmark?'benchmark':'')+'">'+
      '<div class="section-head"><div><h2>'+(benchmark?'BENCHMARK｜固定 8 Station':'HYROX MAIN｜今日 Station')+'</h2><p>'+(benchmark?'H1→H8 顺序锁定；不提供普通 Station Swap。':'Station 数量和顺序来自 Resolver，页面只提供 Resolver 允许的合法调整。')+'</p></div><span class="time-badge">'+(benchmark?esc(ctx.protocolId):stations.length+' STATIONS')+'</span></div>'+
      (benchmark?'<div class="hyrox-benchmark-note">只有 Protocol、工作量、有效负重、雪橇校准版本和 Scaling 全部一致，成绩才直接比较；规格变化会建立新基准。</div>':'')+
      '<div class="hyrox-station-grid">'+stations.map(function(item,index){return stationCard(ctx,item,index);}).join('')+'</div>'+
      (benchmark?'<div class="hyrox-result-shell"><b>Benchmark 成绩记录</b><span>本次先保留结果录入入口；PB、上次/本次比较与趋势历史在 #90 接入。</span></div>':'')+
    '</section>';
  }

  function conflictPanel(ctx){
    const r=ctx.session.conflictContext||{},issues=(r.issues||[]).map(function(i){return '<li><b>'+esc(i.title)+'</b><span>'+esc(i.text)+'</span></li>';}).join('');
    return '<section class="section-card hyrox-conflict '+String(r.status||'PASS').toLowerCase()+'"><div class="section-head"><div><h2>风险 / Compatibility</h2><p>局部疲劳、握力连续暴露和动线切换由 Resolver 输出。</p></div><span class="time-badge">'+esc(r.status||'PASS')+'</span></div>'+
      '<div class="hyrox-conflict-counts"><span>硬冲突 '+Number(r.hardCount||0)+'</span><span>警告 '+Number(r.warnCount||0)+'</span></div>'+
      (issues?'<ul>'+issues+'</ul>':'<p>当前没有需要额外处理的冲突。</p>')+'</section>';
  }

  function copyPanel(){
    return '<section class="section-card hyrox-copy-actions"><div class="section-head"><div><h2>课程复制</h2><p>复制内容只使用当前 ResolvedSession、PREP 与 Recovery，不暴露内部枚举或 comparisonKey。</p></div></div><div class="copy-actions"><button id="copy-hyrox-coach" type="button">复制教练版</button><button id="copy-hyrox-member" type="button">复制会员版</button></div><div id="copy-hyrox-status"></div></section>';
  }

  function blocked(ctx){
    return '<a class="back-link" href="#/coach/hyrox">← 返回 HYROX</a>'+
      '<section class="view-hero hyrox-session-hero"><span class="eyebrow">HYROX / '+esc(ctx.sessionType)+'</span><h1>'+esc(TYPE_LABEL[ctx.sessionType])+'</h1><p>当前训练身份已经确定，但 Resolver 在生成正式处方前需要补齐场馆条件。</p></section>'+
      controlPanel(ctx)+calibrationPanel(ctx)+
      '<section class="empty-state hyrox-resolver-block"><b>暂未生成正式 Session</b><span>'+esc(ctx.error?.message||'请补齐所需条件。')+'</span></section>'+
      (M.SavedSessionsUI?.controls?.(ctx.route)||'');
  }

  function renderSession(route){
    const ctx=context(route);
    if(!ctx.session)return blocked(ctx);
    return '<a class="back-link" href="#/coach/hyrox">← 返回 HYROX</a>'+
      '<section class="view-hero hyrox-session-hero"><span class="eyebrow">HYROX / '+esc(ctx.sessionType)+'</span><h1>'+esc(TYPE_LABEL[ctx.sessionType])+' · '+esc(ctx.level)+'</h1><p>'+esc(ctx.session.summary)+'</p><div class="chips"><span class="chip">'+esc(ctx.session.domainContext.orderedStations.length)+' Station</span><span class="chip">Turf '+esc(ctx.session.domainContext.turfLengthMeters)+'m</span><span class="chip">Load '+esc(ctx.session.domainContext.loadLevel)+'</span></div></section>'+
      controlPanel(ctx)+calibrationPanel(ctx)+summaryPanel(ctx)+
      (M.HyroxPrep?.renderResolved?M.HyroxPrep.renderResolved(ctx.prep,ctx.sessionKey):'')+
      mainTraining(ctx)+conflictPanel(ctx)+(M.HyroxRecovery?.render?M.HyroxRecovery.render(ctx.session):'')+copyPanel()+
      (M.SavedSessionsUI?.controls?.(route)||'');
  }

  function mapPatch(ctx,key,subkey,value){
    const state=window.V15State.getSession('hyrox',ctx.sessionKey),next={...(state?.input?.[key]||{})};
    if(value===null||value===undefined||value==='')delete next[subkey];else next[subkey]=value;
    patchInput(ctx,{[key]:next});
  }

  function targetRpe(level){
    const range=D().hyroxSledCalibrationPolicy?.profiles?.SLED_PUSH?.targetRpeByLevel?.[level]||[6,7];
    return (Number(range[0])+Number(range[1]))/2;
  }

  function bindCalibration(ctx,root,rerender){
    root.querySelector('[data-hyrox-save-calibration]')?.addEventListener('click',function(){
      const push=Number(root.querySelector('[data-hyrox-sled-push]')?.value),pull=Number(root.querySelector('[data-hyrox-sled-pull]')?.value);
      const version=String(root.querySelector('[data-hyrox-sled-version]')?.value||'').trim(),status=root.querySelector('[data-hyrox-calibration-status]');
      if(!(push>0)||!(pull>0)||!version){if(status)status.textContent='请填写 Push、Pull 校准重量和版本。';return;}
      const rpe=targetRpe(ctx.input.loadLevel||ctx.level);
      patchInput(ctx,{sledCalibration:{
        SLED_PUSH:{calibratedLoadKg:push,targetRpe:rpe,calibrationVersion:version},
        SLED_PULL:{calibratedLoadKg:pull,targetRpe:rpe,calibrationVersion:version},
      }});
      rerender();
    });
  }

  async function copyCurrent(route,kind,button){
    const fresh=context(route);if(!fresh.session)return;
    const payload=M.HyroxCopy.buildPayload(fresh.session,fresh.prep),text=kind==='member'?M.HyroxCopy.formatMember(payload):M.HyroxCopy.formatCoach(payload);
    const status=document.getElementById('copy-hyrox-status'),original=button?.textContent||'';
    try{await window.V14SessionCopy.copyText(text);if(status)status.textContent='已复制，可直接发送';if(button)button.textContent='已复制';}
    catch(_){if(status)status.textContent='复制失败，请手动选择内容复制';}
    finally{if(button)setTimeout(function(){button.textContent=original;},1200);}
  }

  function bind(route,root,rerender){
    if(route.page==='template')return;
    let ctx=context(route);
    root.querySelector('[data-hyrox-level]')?.addEventListener('change',function(e){
      const level=e.currentTarget.value,base='#/coach/hyrox/'+ctx.sessionType.toLowerCase()+'/'+level.toLowerCase();
      location.hash=ctx.sessionType==='CAPACITY'?base+'?focus='+encodeURIComponent(ctx.capacityFocus):base;
    });
    root.querySelector('[data-hyrox-protocol]')?.addEventListener('change',function(e){location.hash='#/coach/hyrox/benchmark/'+e.currentTarget.value.toLowerCase();});
    root.querySelector('[data-hyrox-focus]')?.addEventListener('change',function(e){location.hash='#/coach/hyrox/capacity/'+ctx.level.toLowerCase()+'?focus='+encodeURIComponent(e.currentTarget.value);});
    root.querySelector('[data-hyrox-load-level]')?.addEventListener('change',function(e){patchInput(ctx,{loadLevel:e.currentTarget.value});rerender();});
    root.querySelector('[data-hyrox-reset]')?.addEventListener('click',function(){reset(ctx);rerender();});
    bindCalibration(ctx,root,rerender);
    if(!ctx.session)return;

    root.querySelectorAll('[data-hyrox-station-swap]').forEach(function(select){
      select.addEventListener('change',function(e){
        const index=Number(e.currentTarget.dataset.hyroxStationSwap),next=[...(ctx.session.domainContext.orderedStations||[])];
        next[index]=e.currentTarget.value;patchInput(ctx,{selections:next});rerender();
      });
    });
    root.querySelectorAll('[data-hyrox-work]').forEach(function(input){
      input.addEventListener('change',function(e){
        const stationId=e.currentTarget.dataset.hyroxWork,value=Number(e.currentTarget.value);
        mapPatch(ctx,'workOverrides',stationId,Number.isFinite(value)&&value>0?value:null);rerender();
      });
    });
    root.querySelectorAll('[data-hyrox-load]').forEach(function(input){
      input.addEventListener('change',function(e){
        const stationId=e.currentTarget.dataset.hyroxLoad,raw=e.currentTarget.value,value=raw===''?null:Number(raw);
        mapPatch(ctx,'explicitLoads',stationId,Number.isFinite(value)&&value>=0?value:null);rerender();
      });
    });
    root.querySelectorAll('.hyrox-prep-select').forEach(function(select){
      select.addEventListener('change',function(e){M.HyroxPrep.setSelection(ctx.sessionKey,e.currentTarget.dataset.hyroxPrepSlot,e.currentTarget.value);rerender();});
    });
    root.querySelector('#copy-hyrox-coach')?.addEventListener('click',function(e){copyCurrent(route,'coach',e.currentTarget);});
    root.querySelector('#copy-hyrox-member')?.addEventListener('click',function(e){copyCurrent(route,'member',e.currentTarget);});
  }

  const adapter={
    canHandle:function(route){return route?.templateId==='hyrox'&&(route.page==='template'||route.page==='template-session');},
    render:function(route){return route.page==='template'?M.HyroxHome.render():renderSession(route);},
    bind,
  };
  M.HyroxSession={identity,sessionKeyFor:function(route){return identity(route).sessionKey;},ensureState,resolveState,context,patchInput,reset,renderSession,adapter};
  M.TemplateUI.register('hyrox',adapter);
})();