(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const RESOLVER_VERSION='conditioning-v1';
  const LEVELS=Object.freeze(['L1','L2','L3','L4']);
  const RISK_LABEL=Object.freeze({low:'低',medium:'中',high:'高'});
  const METRIC_LABEL=Object.freeze({time:'时间',distance:'距离',reps:'次数',calories:'卡路里'});

  function defaultProtocol(familyId,level){
    return window.V15ConditioningProtocol?.selectProtocol?.(familyId,level,'')||'';
  }

  function normalizeFamilyLevelProtocol(route={}){
    const familyIds=D().conditioningFamilyIds||[];
    const rawFamily=String(route.familyId||route.query?.family||'CON-01').toUpperCase();
    const familyId=familyIds.includes(rawFamily)?rawFamily:'CON-01';
    const rawLevel=String(route.level||route.query?.level||'').toUpperCase();
    const level=/^L[1-4]$/.test(rawLevel)?rawLevel:'L1';
    const family=D().conditioningFamilies?.[familyId]||{};
    const rawProtocol=route.page==='template-compose'?String(route.query?.protocol||'').toUpperCase():'';
    const legalProtocols=family.protocolEligibility||[];
    const protocolId=rawProtocol&&legalProtocols.includes(rawProtocol)?rawProtocol:defaultProtocol(familyId,level);
    return {familyId,level,protocolId};
  }

  function stateMetadata(familyId,level,protocolId){
    return {familyId,level,resolverVersion:RESOLVER_VERSION,input:{familyId,level,protocolId}};
  }

  function sessionKeyFor(familyId,level,protocolId){return `${familyId}-${level}-${protocolId}`;}

  function ensureState(familyId,level,protocolId){
    const S=window.V15State;
    if(!S)return null;
    const sessionKey=sessionKeyFor(familyId,level,protocolId),metadata=stateMetadata(familyId,level,protocolId);
    if(!S.getSession('conditioning',sessionKey))S.ensureSession('conditioning',sessionKey,metadata);
    const current=S.getSession('conditioning',sessionKey);
    const options={
      resolverVersion:RESOLVER_VERSION,
      isSelectionValid:(stationKey,entry,state)=>window.V15ConditioningResolver.isSelectionValid({
        familyId:state.familyId,
        level:state.level,
        protocolId:state.input?.protocolId,
        stationKey,
        actionId:entry.actionId,
      }),
    };
    if(current.resolverVersion!==RESOLVER_VERSION)return S.reconcileSession('conditioning',sessionKey,options).session;
    S.reconcileSession('conditioning',sessionKey,options);
    return S.getSession('conditioning',sessionKey);
  }

  function resolveState(familyId,level,protocolId){
    const S=window.V15State;
    if(!S)return window.V15TemplateResolver.resolve('conditioning',{familyId,level,protocolId,selections:{}});
    ensureState(familyId,level,protocolId);
    return window.V15TemplateResolver.resolve('conditioning',{
      familyId,
      level,
      protocolId,
      selections:S.getSelections('conditioning',sessionKeyFor(familyId,level,protocolId)),
    });
  }

  function setFormalSelection(familyId,level,protocolId,stationKey,actionId){
    const S=window.V15State;
    if(!S)throw new Error('Conditioning coach State service is unavailable');
    ensureState(familyId,level,protocolId);
    if(!window.V15ConditioningResolver.isSelectionValid({familyId,level,protocolId,stationKey,actionId})){
      throw new Error(`Invalid Conditioning selection: ${familyId} ${level} ${protocolId} ${stationKey} ${actionId}`);
    }
    return S.setSelection('conditioning',sessionKeyFor(familyId,level,protocolId),stationKey,actionId,'manual');
  }

  function reset(familyId,level,protocolId){
    const S=window.V15State;
    if(!S)return null;
    const sessionKey=sessionKeyFor(familyId,level,protocolId);
    S.resetSession('conditioning',sessionKey);
    return ensureState(familyId,level,protocolId);
  }

  function context(route={}){
    const {familyId,level,protocolId}=normalizeFamilyLevelProtocol(route);
    const sessionKey=sessionKeyFor(familyId,level,protocolId);
    const session=resolveState(familyId,level,protocolId);
    const selections=window.V15State?.getSelections?.('conditioning',sessionKey)||{};
    const prep=M.ConditioningPrep?.resolve?.(session,sessionKey)||null;
    return {
      familyId,level,protocolId,sessionKey,session,selections,prep,
      family:D().conditioningFamilies?.[familyId]||{},
      protocol:D().conditioningProtocols?.[protocolId]||{},
    };
  }

  function resolvedSelectionMap(session){
    return Object.fromEntries(Object.values(session?.domainContext?.stations||{}).map(station=>[
      station.key,{actionId:station.actionId,source:station.source}
    ]));
  }

  function stationSelect(ctx,station){
    const result=window.V15ConditioningResolver.candidates({
      familyId:ctx.familyId,
      level:ctx.level,
      protocolId:ctx.protocolId,
      stationKey:station.key,
      currentSelections:resolvedSelectionMap(ctx.session),
    });
    const desc=window.V15RecentActions?.conditioning?.(ctx.familyId,ctx.level,ctx.protocolId,station.key);
    const candidates=desc?window.V15RecentActions.rank(desc,result.candidates||[]):(result.candidates||[]);
    const options=candidates.map(candidate=>`<option value="${esc(candidate.actionId)}" ${candidate.actionId===station.actionId?'selected':''}>${esc(candidate.name)}</option>`).join('');
    const recent=desc&&M.Slot?.recentButtons
      ?M.Slot.recentButtons(desc,candidates,station.actionId,`data-recent-conditioning data-conditioning-station="${esc(station.key)}"`)
      :'';
    return `<div class="conditioning-station-swap-wrap"><label class="conditioning-station-swap"><span>替换 Station 动作</span><select class="conditioning-station-select" data-conditioning-session="${esc(ctx.sessionKey)}" data-conditioning-station="${esc(station.key)}">${options}</select></label>${recent}</div>`;
  }

  function stationCard(ctx,station,index){
    const source=station.source==='manual'?'手动选择':'系统推荐';
    const modalities=(station.modalities||[]).map(id=>D().conditioningModalities?.[id]?.name||id).join(' · ');
    return `<article class="conditioning-station-card" data-conditioning-station-card="${esc(station.key)}">
      <div class="conditioning-station-head"><div><span>STATION ${index+1}</span><h3>${esc(station.name)}</h3></div><small>${source}</small></div>
      <div class="conditioning-station-prescription">${esc(station.prescription||'—')}</div>
      <div class="conditioning-station-meta">
        <span>Work Metric：${esc(METRIC_LABEL[station.workMetric]||station.workMetric||'—')}</span>
        <span>Modality：${esc(modalities||'—')}</span>
        <span>冲击：${esc(RISK_LABEL[station.impact]||station.impact||'—')}</span>
        <span>协调：${esc(RISK_LABEL[station.coordinationDemand]||station.coordinationDemand||'—')}</span>
        <span>疲劳：${esc(RISK_LABEL[station.fatigueRisk]||station.fatigueRisk||'—')}</span>
        ${station.powerEligible?'<span>Power Eligible</span>':''}
      </div>
      <div class="conditioning-station-actions"><a href="#/library?focus=${encodeURIComponent(station.actionId)}">查看动作</a>${stationSelect(ctx,station)}</div>
    </article>`;
  }

  function stressSummary(session){
    const stations=Object.values(session?.domainContext?.stations||{});
    const rank={low:0,medium:1,high:2};
    const max=field=>stations.reduce((best,item)=>(rank[item?.[field]]??0)>(rank[best]??0)?item[field]:best,'low');
    const modalities=[...new Set(stations.flatMap(station=>station.modalities||[]))];
    return {
      impact:max('impact'),
      coordination:max('coordinationDemand'),
      fatigue:max('fatigueRisk'),
      powerCount:stations.filter(station=>station.powerEligible).length,
      modalityNames:modalities.map(id=>D().conditioningModalities?.[id]?.name||id),
    };
  }

  function protocolMetrics(session){
    const m=session?.domainContext?.metrics||{},protocolId=session?.domainContext?.protocolId;
    const cells=[
      ['Protocol',session?.domainContext?.protocolName||protocolId||'—'],
      ['Stations',m.stationCount??'—'],
      ['Rounds',m.rounds??'—'],
      ['Target RPE',m.targetRpe??'—'],
      ['主块时长',m.blockMinutes!==undefined?`${m.blockMinutes} 分钟`:'—'],
      ['预计整节',m.estimatedMinutes!==undefined?`${m.estimatedMinutes} 分钟`:'—'],
    ];
    if(protocolId==='STEADY'){
      cells.splice(2,0,['Work','持续输出'],['Rest','—']);
    }else if(protocolId==='DENSITY'){
      cells.splice(2,0,['Density Window',`${m.densityWindowMinutes??'—'} 分钟`],['Transition',`${m.transitionSeconds??'—'} 秒`]);
    }else{
      cells.splice(2,0,['Work',`${m.workSeconds??'—'} 秒`],['Rest',`${m.restSeconds??'—'} 秒`],['Transition',`${m.transitionSeconds??'—'} 秒`]);
    }
    return cells;
  }

  function protocolPanel(session){
    const stress=stressSummary(session),cells=protocolMetrics(session);
    return `<section class="section-card conditioning-protocol-panel"><div class="section-head"><div><h2>PROTOCOL｜今日体能结构</h2><p>Work / Rest、Rounds、Station、RPE 与 Duration 全部来自当前 ResolvedSession；页面不自行计算训练合法性。</p></div><span class="time-badge">${esc(session.domainContext?.protocolName||'PROTOCOL')}</span></div>
      <div class="conditioning-metric-grid">${cells.map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('')}</div>
      <div class="conditioning-stress-summary">
        <div><small>Impact</small><b>${esc(RISK_LABEL[stress.impact]||stress.impact)}</b></div>
        <div><small>Coordination</small><b>${esc(RISK_LABEL[stress.coordination]||stress.coordination)}</b></div>
        <div><small>Fatigue</small><b>${esc(RISK_LABEL[stress.fatigue]||stress.fatigue)}</b></div>
        <div><small>Power Stations</small><b>${esc(stress.powerCount)}</b></div>
        <div class="conditioning-modality-summary"><small>Modality Mix</small><b>${esc(stress.modalityNames.join(' · ')||'—')}</b></div>
      </div>
    </section>`;
  }

  function anatomy(session){
    const a=session.anatomyContext||{};
    const row=(label,items)=>`<div><small>${label}</small><b>${esc((items||[]).join(' · ')||'—')}</b></div>`;
    return `<section class="session-muscle-summary conditioning-anatomy-summary"><div class="muscle-summary-head"><div><span>ANATOMY</span><h2>动作参与概览</h2></div><small>用于教练观察动作负荷分布；不替代 Protocol / Conflict 规则。</small></div><div class="muscle-summary-grid">${row('主要参与',a.primary)}${row('协同参与',a.secondary)}${row('稳定参与',a.stabilizers)}</div></section>`;
  }

  function conflict(session){
    if(M.ConflictView?.render)return M.ConflictView.render(session.conflictContext);
    const result=session.conflictContext||{status:'PASS',hardCount:0,warnCount:0,issues:[]};
    return `<section class="conflict-box ${String(result.status||'PASS').toLowerCase()}"><b>${esc(result.status||'PASS')}</b><small>${esc(result.hardCount||0)} 硬冲突 · ${esc(result.warnCount||0)} 警告</small></section>`;
  }

  function recovery(){
    if(!M.ConditioningRecovery?.render)throw new Error('Conditioning Recovery presentation is unavailable');
    return M.ConditioningRecovery.render();
  }

  function renderEditor(ctx){
    const session=ctx.session,stations=Object.values(session.domainContext?.stations||{});
    const prepHtml=ctx.prep&&M.ConditioningPrep?.renderResolved
      ?M.ConditioningPrep.renderResolved(ctx.prep,ctx.sessionKey,session):'';
    const main=`<section class="section-card conditioning-editor" data-conditioning-session="${esc(ctx.sessionKey)}"><div class="section-head"><div><h2>2F CONDITIONING｜Station 执行</h2><p>${esc(session.summary)}</p></div><span class="time-badge">${esc(ctx.level)}</span></div>
      ${anatomy(session)}
      ${conflict(session)}
      <div class="conditioning-station-grid">${stations.map((station,index)=>stationCard(ctx,station,index)).join('')}</div>
      <div class="session-toolbar"><div class="conditioning-no-post-cardio-inline">完整 Conditioning：NO POST CARDIO</div><div class="session-toolbar-actions"><button data-conditioning-copy="coach" type="button">复制教练版</button><button data-conditioning-copy="member" type="button">复制会员版</button><button id="reset-conditioning-session" type="button">恢复系统推荐</button></div></div>
    </section>`;
    return `${prepHtml}${protocolPanel(session)}${main}${recovery()}`;
  }

  function render(route){
    const ctx=context(route),family=ctx.family;
    return `<a class="back-link" href="#/coach/conditioning">← 返回 Conditioning</a>`+
      `<section class="view-hero conditioning-session-hero"><span class="eyebrow">COACH CENTER / CONDITIONING</span><h1>${esc(family.name||ctx.familyId)}</h1><p>${esc(family.goal||ctx.session.summary)}</p><div class="chips"><span class="chip">${esc(ctx.level)}</span><span class="chip">${esc(ctx.session.domainContext.protocolName)}</span><span class="chip">${esc(ctx.session.domainContext.metrics.stationCount)} Stations</span><span class="chip">RPE ${esc(ctx.session.domainContext.metrics.targetRpe)}</span><span class="chip">约 ${esc(ctx.session.domainContext.metrics.estimatedMinutes)} 分钟</span><span class="chip">${esc(ctx.session.conflictContext.status)}</span></div></section>`+
      renderEditor(ctx)+(M.SavedSessionsUI?.controls?.(route)||'');
  }

  function legalProtocolOptions(familyId,level,selected){
    const family=D().conditioningFamilies?.[familyId]||{};
    return (family.protocolEligibility||[]).map(protocolId=>{
      const name=D().conditioningProtocols?.[protocolId]?.name||protocolId;
      return `<option value="${esc(protocolId)}" ${protocolId===selected?'selected':''}>${esc(name)}｜${esc(protocolId)}</option>`;
    }).join('');
  }

  function renderComposer(route){
    const ctx=context(route);
    const familyOptions=(D().conditioningFamilyIds||[]).map(familyId=>{
      const family=D().conditioningFamilies?.[familyId]||{};
      return `<option value="${esc(familyId)}" ${familyId===ctx.familyId?'selected':''}>${esc(family.name||familyId)}</option>`;
    }).join('');
    const levelOptions=LEVELS.map(level=>`<option value="${level}" ${level===ctx.level?'selected':''}>${level}</option>`).join('');
    return `<a class="back-link" href="#/coach/conditioning">← 返回 Conditioning</a>`+
      `<section class="view-hero conditioning-composer-hero"><span class="eyebrow">COACH CENTER / CONDITIONING COMPOSER</span><h1>Conditioning 自由编课</h1><p>选择体能目标、等级与合法 Protocol；下方与正式 Session 共用同一 Resolver、State、PREP、Conflict 与 Copy。</p><div class="conditioning-compose-controls">
        <label><span>训练 Family</span><select data-conditioning-compose-family>${familyOptions}</select></label>
        <label><span>训练等级</span><select data-conditioning-compose-level>${levelOptions}</select></label>
        <label><span>Protocol</span><select data-conditioning-compose-protocol>${legalProtocolOptions(ctx.familyId,ctx.level,ctx.protocolId)}</select></label>
      </div></section>`+
      renderEditor(ctx)+(M.SavedSessionsUI?.controls?.(route)||'');
  }

  function canHandle(route={}){
    return route.templateId==='conditioning'&&(route.page==='template'||route.page==='template-session'||route.page==='template-compose');
  }

  function composerHash(route,familyId,level,protocolId){
    const next={
      ...route,
      area:'coach',
      page:'template-compose',
      templateId:'conditioning',
      query:{family:familyId,level,protocol:protocolId},
    };
    return window.V14Router?.canonicalHash?.(next)
      ||`#/coach/conditioning/compose?family=${encodeURIComponent(familyId)}&level=${encodeURIComponent(level)}&protocol=${encodeURIComponent(protocolId)}`;
  }

  async function copyCurrent(route,kind,button){
    const Shared=window.V14SessionCopy;
    if(!M.ConditioningCopy||!Shared?.copyText)return false;
    const fresh=context(route);
    const payload=M.ConditioningCopy.buildPayload(fresh.session,fresh.prep);
    const text=kind==='member'?M.ConditioningCopy.formatMember(payload):M.ConditioningCopy.formatCoach(payload);
    const original=button?.textContent||'';
    try{
      await Shared.copyText(text);
      if(button)button.textContent='已复制';
      return true;
    }finally{
      if(button&&original)setTimeout(()=>{button.textContent=original;},1200);
    }
  }

  function bind(route,root,rerender){
    if(route.page!=='template-session'&&route.page!=='template-compose')return;
    const normalized=normalizeFamilyLevelProtocol(route);
    const {familyId,level,protocolId}=normalized;

    if(route.page==='template-compose'){
      const rawFamily=String(route.query?.family||'').toUpperCase();
      const rawLevel=String(route.query?.level||'').toUpperCase();
      const rawProtocol=String(route.query?.protocol||'').toUpperCase();
      const familyValid=(D().conditioningFamilyIds||[]).includes(rawFamily);
      const levelValid=/^L[1-4]$/.test(rawLevel);
      const protocolValid=(D().conditioningFamilies?.[familyId]?.protocolEligibility||[]).includes(rawProtocol);
      const needsCanonical=!familyValid||!levelValid||!protocolValid
        ||route.query?.family!==familyId||route.query?.level!==level||route.query?.protocol!==protocolId;
      if(needsCanonical){
        const hash=composerHash(route,familyId,level,protocolId);
        if(window.location?.hash!==hash){
          if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
          return;
        }
      }

      root.querySelector('[data-conditioning-compose-family]')?.addEventListener('change',event=>{
        const nextFamily=String(event.currentTarget.value||'CON-01').toUpperCase();
        const nextProtocol=defaultProtocol(nextFamily,level);
        const hash=composerHash(route,nextFamily,level,nextProtocol);
        if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
      });
      root.querySelector('[data-conditioning-compose-level]')?.addEventListener('change',event=>{
        const nextLevel=String(event.currentTarget.value||'L1').toUpperCase();
        const legal=(D().conditioningFamilies?.[familyId]?.protocolEligibility||[]).includes(protocolId);
        const nextProtocol=legal?protocolId:defaultProtocol(familyId,nextLevel);
        const hash=composerHash(route,familyId,nextLevel,nextProtocol);
        if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
      });
      root.querySelector('[data-conditioning-compose-protocol]')?.addEventListener('change',event=>{
        const nextProtocol=String(event.currentTarget.value||defaultProtocol(familyId,level)).toUpperCase();
        const hash=composerHash(route,familyId,level,nextProtocol);
        if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
      });
    }

    root.querySelectorAll('.conditioning-station-select').forEach(select=>select.addEventListener('change',()=>{
      const stationKey=select.dataset.conditioningStation;
      setFormalSelection(familyId,level,protocolId,stationKey,select.value);
      const desc=window.V15RecentActions?.conditioning?.(familyId,level,protocolId,stationKey);
      if(desc)window.V15RecentActions.record(desc,select.value);
      rerender();
    }));
    root.querySelectorAll('[data-recent-conditioning]').forEach(button=>button.addEventListener('click',()=>{
      const stationKey=button.dataset.conditioningStation,actionId=button.dataset.recentAction;
      setFormalSelection(familyId,level,protocolId,stationKey,actionId);
      const desc=window.V15RecentActions?.conditioning?.(familyId,level,protocolId,stationKey);
      if(desc)window.V15RecentActions.record(desc,actionId);
      rerender();
    }));
    root.querySelectorAll('.conditioning-prep-select').forEach(select=>select.addEventListener('change',()=>{
      M.ConditioningPrep.setSelection(select.dataset.conditioningPrepSession,select.dataset.conditioningPrepSlot,select.value);
      rerender();
    }));
    root.querySelectorAll('[data-conditioning-copy]').forEach(button=>button.addEventListener('click',()=>{
      copyCurrent(route,button.dataset.conditioningCopy,button).catch(error=>console.error('Conditioning copy failed',error));
    }));
    root.querySelector('#reset-conditioning-session')?.addEventListener('click',()=>{
      reset(familyId,level,protocolId);
      rerender();
    });
  }

  const adapter={
    canHandle,
    render(route){
      if(route.page==='template')return M.ConditioningHome.render(route);
      if(route.page==='template-compose')return renderComposer(route);
      return render(route);
    },
    bind,
  };
  M.ConditioningSession={
    context,render,renderEditor,renderComposer,ensureState,resolveState,setFormalSelection,reset,copyCurrent,
    sessionKeyFor,normalizeFamilyLevelProtocol,stressSummary,adapter,
  };
  M.TemplateUI.register('conditioning',adapter);
})();
