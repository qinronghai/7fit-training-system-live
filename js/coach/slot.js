(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  function recentButtons(desc,opts,currentActionId,attrs=''){
    const recent=window.V15RecentActions?.quick?.(desc,opts,{currentActionId,limit:3})||[];
    if(!recent.length)return '';
    return `<div class="recent-action-row"><small>最近</small>${recent.map(item=>{
      const candidate=item.candidate||{},id=item.actionId,name=candidate.name||candidate.label||D().actions?.[id]?.name||id;
      return `<button class="recent-action-chip" type="button" data-recent-action="${esc(id)}" ${attrs}>${esc(name)}</button>`;
    }).join('')}</div>`;
  }

  function sessionCard(sessionId,slot){
    const data=D(),view=data.sessionViews[sessionId]||{},actionId=window.V14State.getSelection(sessionId,slot.slotKey),a=data.actions[actionId]||{};
    let opts=view.slotOptions?.[slot.slotKey]||[];
    if(!opts.length)opts=[{id:slot.baselineId,label:(data.actions[slot.baselineId]?.name||slot.baselineId),kind:'当前'}];
    if(!opts.some(o=>o.id===actionId))opts=[{id:actionId,label:(a.name||actionId),kind:'当前选择'},...opts];
    const desc=window.V15RecentActions?.f111Preset?.(sessionId,slot.slotKey);
    if(desc)opts=window.V15RecentActions.rank(desc,opts);
    const options=opts.map(o=>`<option value="${esc(o.id)}" ${o.id===actionId?'selected':''}>${esc(o.label)}</option>`).join('');
    const detailRoute=a.isSupport?`#/system/support?focus=${encodeURIComponent(actionId)}`:a.isCore?`#/system/core?focus=${encodeURIComponent(actionId)}`:`#/library?focus=${encodeURIComponent(actionId)}`;
    const recent=desc?recentButtons(desc,opts,actionId,`data-recent-f111-preset data-session="${esc(sessionId)}" data-slot-key="${esc(slot.slotKey)}"`):'';
    return `<article class="session-slot" data-slot="${esc(slot.slotKey)}"><div class="slot-kicker">${esc(slot.slotName)}</div><h3>${esc(a.name||actionId)}</h3><div class="slot-meta"><span>${esc(a.tier||a.supportGrade||a.coreGrade||'未标')}</span><span>${esc(a.pattern||'')}</span><span>${esc(a.equipment||'')}</span></div><div class="slot-actions"><a href="${detailRoute}">查看动作</a><select class="session-swap" data-session="${esc(sessionId)}" data-slot-key="${esc(slot.slotKey)}">${options}</select></div>${recent}</article>`;
  }
  function windowText(slotKey,resolved){
    if(slotKey==='A'||slotKey==='B'){const w=resolved.windows.main;return `推荐 ${w.recommended}｜常规 ${(w.normal||[]).join('–')}${(w.expanded||[]).length?`｜可退阶 ${(w.expanded||[]).join(' / ')}`:''}`;}
    if(slotKey==='C'){const w=resolved.windows.support;return `推荐 ${w.recommended}｜常规 ${(w.normal||[]).join('–')}${(w.expanded||[]).length?`｜扩展 ${(w.expanded||[]).join(' / ')}`:''}`;}
    if(slotKey==='CORE'){const w=resolved.windows.core;return `推荐 ${(w.recommended||[]).join(' / ')}｜常规 ${(w.normal||[]).join('–')}`;}
    return '系统按主项互补、动作暴露和场馆路由推荐';
  }
  function composerCard(ctx,slot){
    const data=D(),rawOpts=ctx.resolved.slotOptions[slot.slotKey]||[],a=data.actions[slot.actionId]||{};
    const desc=window.V15RecentActions?.f111Composer?.(ctx,slot.slotKey);
    const opts=desc?window.V15RecentActions.rank(desc,rawOpts):rawOpts;
    const optionHtml=opts.map(o=>{const grade=o.tier||o.grade||'';return `<option value="${esc(o.id)}" ${o.id===slot.actionId?'selected':''}>${esc([grade,o.name].filter(Boolean).join('｜'))}</option>`;}).join('');
    const grade=slot.tier||slot.grade||'';
    const detailRoute=a.isSupport?`#/system/support?focus=${encodeURIComponent(slot.actionId)}`:a.isCore?`#/system/core?focus=${encodeURIComponent(slot.actionId)}`:`#/library?focus=${encodeURIComponent(slot.actionId)}`;
    const tierNote=slot.tierNote?`<small class="composer-tier-note">${esc(slot.tierNote)}</small>`:'';
    const rx=slot.prescriptionOverride?`<small class="composer-rx-note">高阶处方：${esc(slot.prescriptionOverride)}</small>`:'';
    const recent=desc?recentButtons(desc,opts,slot.actionId,`data-recent-f111-composer data-composer-key="${esc(ctx.stateKey)}" data-slot-key="${esc(slot.slotKey)}"`):'';
    return `<article class="composer-slot-card"><div class="composer-slot-head"><span>${esc(slot.slotName)}</span><b>${esc(grade||'辅助')}</b></div><h3>${esc(slot.name||'暂无候选')}</h3><p>${esc(windowText(slot.slotKey,ctx.resolved))}</p>${rx}${tierNote}<div class="composer-slot-actions"><a href="${detailRoute}">查看动作</a><select class="composer-slot-select" data-composer-key="${esc(ctx.stateKey)}" data-slot-key="${esc(slot.slotKey)}">${optionHtml}</select></div>${recent}</article>`;
  }
  M.Slot={sessionCard,composerCard,windowText,recentButtons};
})();