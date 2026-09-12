(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  function sessionCard(sessionId,slot){
    const data=D(),view=data.sessionViews[sessionId]||{},actionId=window.V14State.getSelection(sessionId,slot.slotKey),a=data.actions[actionId]||{};
    let opts=view.slotOptions?.[slot.slotKey]||[];
    if(!opts.length)opts=[{id:slot.baselineId,label:(data.actions[slot.baselineId]?.name||slot.baselineId),kind:'当前'}];
    if(!opts.some(o=>o.id===actionId))opts=[{id:actionId,label:(a.name||actionId),kind:'当前选择'},...opts];
    const options=opts.map(o=>`<option value="${esc(o.id)}" ${o.id===actionId?'selected':''}>${esc(o.label)}</option>`).join('');
    const detailRoute=a.isSupport?`#/system/support?focus=${encodeURIComponent(actionId)}`:a.isCore?`#/system/core?focus=${encodeURIComponent(actionId)}`:`#/library?focus=${encodeURIComponent(actionId)}`;
    const Recent=window.V15RecentActions,contextKey=Recent?.context?.f111Preset?.({sessionId,slotKey:slot.slotKey})||'';
    const quick=Recent?.renderButtons?.({templateId:'f111',contextKey,candidates:opts,currentActionId:actionId})||'';
    return `<article class="session-slot" data-slot="${esc(slot.slotKey)}"><div class="slot-kicker">${esc(slot.slotName)}</div><h3>${esc(a.name||actionId)}</h3><div class="slot-meta"><span>${esc(a.tier||a.supportGrade||a.coreGrade||'未标')}</span><span>${esc(a.pattern||'')}</span><span>${esc(a.equipment||'')}</span></div><div class="slot-actions"><a href="${detailRoute}">查看动作</a><select class="session-swap" data-session="${esc(sessionId)}" data-slot-key="${esc(slot.slotKey)}">${options}</select>${quick}</div></article>`;
  }
  function windowText(slotKey,resolved){
    if(slotKey==='A'||slotKey==='B'){const w=resolved.windows.main;return `推荐 ${w.recommended}｜常规 ${(w.normal||[]).join('–')}${(w.expanded||[]).length?`｜可退阶 ${(w.expanded||[]).join(' / ')}`:''}`;}
    if(slotKey==='C'){const w=resolved.windows.support;return `推荐 ${w.recommended}｜常规 ${(w.normal||[]).join('–')}${(w.expanded||[]).length?`｜扩展 ${(w.expanded||[]).join(' / ')}`:''}`;}
    if(slotKey==='CORE'){const w=resolved.windows.core;return `推荐 ${(w.recommended||[]).join(' / ')}｜常规 ${(w.normal||[]).join('–')}`;}
    return '系统按主项互补、动作暴露和场馆路由推荐';
  }
  function composerCard(ctx,slot){
    const data=D(),opts=ctx.resolved.slotOptions[slot.slotKey]||[],a=data.actions[slot.actionId]||{};
    const optionHtml=opts.map(o=>{const grade=o.tier||o.grade||'';return `<option value="${esc(o.id)}" ${o.id===slot.actionId?'selected':''}>${esc([grade,o.name].filter(Boolean).join('｜'))}</option>`;}).join('');
    const grade=slot.tier||slot.grade||'';
    const detailRoute=a.isSupport?`#/system/support?focus=${encodeURIComponent(slot.actionId)}`:a.isCore?`#/system/core?focus=${encodeURIComponent(slot.actionId)}`:`#/library?focus=${encodeURIComponent(slot.actionId)}`;
    const tierNote=slot.tierNote?`<small class="composer-tier-note">${esc(slot.tierNote)}</small>`:'';
    const rx=slot.prescriptionOverride?`<small class="composer-rx-note">高阶处方：${esc(slot.prescriptionOverride)}</small>`:'';
    const Recent=window.V15RecentActions,contextKey=Recent?.context?.f111Composer?.({
      lowerMode:ctx.lowerMode,upperMode:ctx.upperMode,level:ctx.level,coreDemand:ctx.coreDemand,slotKey:slot.slotKey,
    })||'';
    const quick=Recent?.renderButtons?.({templateId:'f111',contextKey,candidates:opts,currentActionId:slot.actionId})||'';
    return `<article class="composer-slot-card" data-composer-slot="${esc(slot.slotKey)}"><div class="composer-slot-head"><span>${esc(slot.slotName)}</span><b>${esc(grade||'辅助')}</b></div><h3>${esc(slot.name||'暂无候选')}</h3><p>${esc(windowText(slot.slotKey,ctx.resolved))}</p>${rx}${tierNote}<div class="composer-slot-actions"><a href="${detailRoute}">查看动作</a><select class="composer-slot-select" data-composer-key="${esc(ctx.stateKey)}" data-slot-key="${esc(slot.slotKey)}">${optionHtml}</select>${quick}</div></article>`;
  }
  M.Slot={sessionCard,composerCard,windowText};
})();