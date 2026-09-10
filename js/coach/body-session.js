(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;

  function normalizeFamilyLevel(route={}){
    const familyId=String(route.familyId||route.query?.family||'BODY-01').toUpperCase();
    const level=/^L[1-4]$/.test(String(route.level||route.query?.level||'').toUpperCase())?String(route.level||route.query?.level).toUpperCase():'L1';
    return {familyId,level};
  }

  function context(route={}){
    const {familyId,level}=normalizeFamilyLevel(route);
    const sessionKey=`${familyId}-${level}`;
    const session=window.V15TemplateResolver.resolve('body',{familyId,level,selections:{}});
    return {familyId,level,sessionKey,session,family:D().bodyFamilies?.[familyId]||{}};
  }

  function rangeText(values,suffix=''){
    const list=Array.isArray(values)?values:[];
    if(!list.length)return '—';
    const text=list.length===1?String(list[0]):list.join('–');
    return text+suffix;
  }

  function roleName(role){return D().bodyRoles?.[role]?.name||role||'动作';}

  function slotCard(session,slot){
    const domain=session.domainContext?.slots?.[slot.key]||{};
    return `<article class="body-slot-card" data-body-slot="${esc(slot.key)}">
      <div class="body-slot-head"><div><span>${esc(slot.key)}</span><h3>${esc(roleName(domain.role))}</h3></div><small>${slot.source==='manual'?'手动选择':'系统推荐'}</small></div>
      <div class="body-slot-action"><b>${esc(slot.name)}</b><a href="#/library?focus=${encodeURIComponent(slot.actionId)}">查看动作</a></div>
      <div class="body-prescription-grid"><div><small>Sets</small><b>${esc(domain.workingSets??'—')}</b></div><div><small>Reps</small><b>${esc(rangeText(domain.repRange))}</b></div><div><small>RIR</small><b>${esc(rangeText(domain.rirRange))}</b></div><div><small>Rest</small><b>${esc(rangeText(domain.restSecondsRange,' 秒'))}</b></div></div>
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
    return `<section class="section-card body-editor" data-body-session="${esc(ctx.sessionKey)}"><div class="section-head"><div><h2>今日训练重点</h2><p>${esc(session.summary)}</p></div><span class="time-badge">${esc(ctx.level)}</span></div>${anatomy(session)}${M.BodyVolumeView.render(session)}${conflict(session)}<div class="body-slot-grid">${session.main.content.map(slot=>slotCard(session,slot)).join('')}</div></section>`;
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

  function bind(){/* Task 3 adds Body state/swap bindings. */}

  const adapter={
    canHandle,
    render(route){return route.page==='template'?M.BodyHome.render(route):render(route);},
    bind,
  };
  M.BodySession={context,render,renderEditor,adapter};
  M.TemplateUI.register('body',adapter);
})();
