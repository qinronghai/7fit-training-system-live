(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const RESOLVER_VERSION='body-v1';

  function normalizeFamilyLevel(route={}){
    const familyId=String(route.familyId||route.query?.family||'BODY-01').toUpperCase();
    const rawLevel=String(route.level||route.query?.level||'').toUpperCase();
    const level=/^L[1-4]$/.test(rawLevel)?rawLevel:'L1';
    return {familyId,level};
  }

  function stateMetadata(familyId,level){
    return {familyId,level,resolverVersion:RESOLVER_VERSION,input:{familyId,level}};
  }

  function sessionKeyFor(familyId,level){return `${familyId}-${level}`;}

  function ensureState(familyId,level){
    const S=window.V15State;
    if(!S)return null;
    const sessionKey=sessionKeyFor(familyId,level),metadata=stateMetadata(familyId,level);
    if(!S.getSession('body',sessionKey))S.ensureSession('body',sessionKey,metadata);
    const current=S.getSession('body',sessionKey);
    const options={
      resolverVersion:RESOLVER_VERSION,
      isSelectionValid:(slotKey,entry,state)=>window.V15BodyResolver.isSelectionValid({
        familyId:state.familyId,
        level:state.level,
        slotKey,
        actionId:entry.actionId,
      }),
    };
    if(current.resolverVersion!==RESOLVER_VERSION)return S.reconcileSession('body',sessionKey,options).session;
    S.reconcileSession('body',sessionKey,options);
    return S.getSession('body',sessionKey);
  }

  function resolveState(familyId,level){
    const S=window.V15State;
    if(!S)return window.V15TemplateResolver.resolve('body',{familyId,level,selections:{}});
    ensureState(familyId,level);
    return window.V15TemplateResolver.resolve('body',{
      familyId,
      level,
      selections:S.getSelections('body',sessionKeyFor(familyId,level)),
    });
  }

  function setFormalSelection(familyId,level,slotKey,actionId){
    const S=window.V15State;
    if(!S)throw new Error('Body coach State service is unavailable');
    ensureState(familyId,level);
    if(!window.V15BodyResolver.isSelectionValid({familyId,level,slotKey,actionId})){
      throw new Error(`Invalid Body selection: ${familyId} ${level} ${slotKey} ${actionId}`);
    }
    return S.setSelection('body',sessionKeyFor(familyId,level),slotKey,actionId,'manual');
  }

  function reset(familyId,level){
    const S=window.V15State;
    if(!S)return null;
    const sessionKey=sessionKeyFor(familyId,level);
    S.resetSession('body',sessionKey);
    return ensureState(familyId,level);
  }

  function context(route={}){
    const {familyId,level}=normalizeFamilyLevel(route);
    const sessionKey=sessionKeyFor(familyId,level);
    const session=resolveState(familyId,level);
    const selections=window.V15State?.getSelections?.('body',sessionKey)||{};
    const prep=M.BodyPrep?.resolve?.(session,sessionKey)||null;
    return {familyId,level,sessionKey,session,selections,prep,family:D().bodyFamilies?.[familyId]||{}};
  }

  function rangeText(values,suffix=''){
    const list=Array.isArray(values)?values:[];
    if(!list.length)return '—';
    const text=list.length===1?String(list[0]):list.join('–');
    return text+suffix;
  }

  function roleName(role){return D().bodyRoles?.[role]?.name||role||'动作';}
  function resolvedSelectionMap(session){
    return Object.fromEntries((session?.main?.content||[]).map(slot=>[slot.key,{actionId:slot.actionId,source:slot.source}]));
  }

  function slotSelect(ctx,slot){
    const result=window.V15BodyResolver.candidates({
      familyId:ctx.familyId,
      level:ctx.level,
      slotKey:slot.key,
      currentSelections:resolvedSelectionMap(ctx.session),
    });
    const options=(result.candidates||[]).map(candidate=>`<option value="${esc(candidate.actionId)}" ${candidate.actionId===slot.actionId?'selected':''}>${esc(candidate.name)}</option>`).join('');
    return `<label class="body-slot-swap"><span>替换动作</span><select class="body-slot-select" data-body-session="${esc(ctx.sessionKey)}" data-body-slot="${esc(slot.key)}">${options}</select></label>`;
  }

  function slotCard(ctx,slot){
    const session=ctx.session,domain=session.domainContext?.slots?.[slot.key]||{};
    return `<article class="body-slot-card" data-body-slot="${esc(slot.key)}">
      <div class="body-slot-head"><div><span>${esc(slot.key)}</span><h3>${esc(roleName(domain.role))}</h3></div><small>${slot.source==='manual'?'手动选择':'系统推荐'}</small></div>
      <div class="body-slot-action"><b>${esc(slot.name)}</b><a href="#/library?focus=${encodeURIComponent(slot.actionId)}">查看动作</a></div>
      <div class="body-prescription-grid"><div><small>Sets</small><b>${esc(domain.workingSets??'—')}</b></div><div><small>Reps</small><b>${esc(rangeText(domain.repRange))}</b></div><div><small>RIR</small><b>${esc(rangeText(domain.rirRange))}</b></div><div><small>Rest</small><b>${esc(rangeText(domain.restSecondsRange,' 秒'))}</b></div></div>
      ${slotSelect(ctx,slot)}
    </article>`;
  }

  function anatomy(session){
    const a=session.anatomyContext||{};
    const row=(label,items)=>`<div><small>${label}</small><b>${esc((items||[]).join(' · ')||'—')}</b></div>`;
    return `<section class="session-muscle-summary body-anatomy-summary"><div class="muscle-summary-head"><div><span>ANATOMY</span><h2>ANATOMY｜动作涉及肌群</h2></div><small>表示本节动作中的主要 / 协同 / 稳定参与，不等同于有效工作组数。</small></div><div class="muscle-summary-grid">${row('主要参与',a.primary)}${row('协同参与',a.secondary)}${row('稳定参与',a.stabilizers)}</div></section>`;
  }

  function conflict(session){
    if(M.ConflictView?.render)return M.ConflictView.render(session.conflictContext);
    const result=session.conflictContext||{status:'PASS',hardCount:0,warnCount:0,issues:[]};
    return `<section class="conflict-box ${String(result.status||'PASS').toLowerCase()}"><b>${esc(result.status||'PASS')}</b><small>${esc(result.hardCount||0)} 硬冲突 · ${esc(result.warnCount||0)} 警告</small></section>`;
  }

  function renderEditor(ctx){
    const session=ctx.session;
    const prepHtml=ctx.prep&&M.BodyPrep?.renderResolved?M.BodyPrep.renderResolved(ctx.prep,ctx.sessionKey):'';
    return `${prepHtml}<section class="section-card body-editor" data-body-session="${esc(ctx.sessionKey)}"><div class="section-head"><div><h2>今日训练重点</h2><p>${esc(session.summary)}</p></div><span class="time-badge">${esc(ctx.level)}</span></div>${anatomy(session)}${M.BodyVolumeView.render(session)}${conflict(session)}<div class="body-slot-grid">${session.main.content.map(slot=>slotCard(ctx,slot)).join('')}</div><div class="session-toolbar"><div></div><div class="session-toolbar-actions"><button id="reset-body-session" type="button">恢复系统推荐</button></div></div></section>`;
  }

  function render(route){
    const ctx=context(route),family=ctx.family;
    return `<a class="back-link" href="#/coach/body">← 返回 Body</a>`+
      `<section class="view-hero body-session-hero"><span class="eyebrow">COACH CENTER / BODY</span><h1>${esc(family.name||ctx.familyId)}</h1><p>${esc(ctx.session.summary)}</p><div class="chips"><span class="chip">${esc(ctx.level)}</span><span class="chip">${esc(ctx.session.domainContext.volume.totalWorkingSets)} 个工作组</span><span class="chip">${esc(ctx.session.conflictContext.status)}</span></div></section>`+
      renderEditor(ctx);
  }

  function canHandle(route={}){
    return route.templateId==='body'&&(route.page==='template'||route.page==='template-session');
  }

  function bind(route,root,rerender){
    if(route.page!=='template-session')return;
    const {familyId,level}=normalizeFamilyLevel(route);
    root.querySelectorAll('.body-slot-select').forEach(select=>select.addEventListener('change',()=>{
      setFormalSelection(familyId,level,select.dataset.bodySlot,select.value);
      rerender();
    }));
    root.querySelectorAll('.body-prep-select').forEach(select=>select.addEventListener('change',()=>{
      M.BodyPrep.setSelection(select.dataset.bodyPrepSession,select.dataset.bodyPrepSlot,select.value);
      rerender();
    }));
    root.querySelector('#reset-body-session')?.addEventListener('click',()=>{
      reset(familyId,level);
      rerender();
    });
  }

  const adapter={
    canHandle,
    render(route){return route.page==='template'?M.BodyHome.render(route):render(route);},
    bind,
  };
  M.BodySession={context,render,renderEditor,ensureState,resolveState,setFormalSelection,reset,adapter};
  M.TemplateUI.register('body',adapter);
})();
