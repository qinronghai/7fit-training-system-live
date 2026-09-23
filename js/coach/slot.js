(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  function lowerAssistancePresetOptions(sessionId,slot,currentActionId){
    const data=D(),session=data.sessions?.[sessionId],match=String(sessionId||'').match(/^(F111-\d+)-(L[1-4])$/);
    if(!session||!match||!String(slot?.slotName||'').startsWith('D1｜')||!window.V15LowerAssistance?.candidates)return null;
    const recipeId=match[1],level=match[2],lowerMode=data.composer?.officialPresetMap?.[recipeId]?.[0]||'';
    const otherIds=(session.slots||[]).filter(item=>item.slotKey!==slot.slotKey).map(item=>window.V14State.getSelection(sessionId,item.slotKey)||item.baselineId).filter(Boolean);
    const result=window.V15LowerAssistance.candidates({consumer:'F111_D1',level,lowerMode,currentActionIds:otherIds});
    const byId=new Map((result.candidates||[]).map(candidate=>[candidate.actionId,candidate]));
    const baseline=slot.baselineId,ids=[baseline,...(result.candidates||[]).map(candidate=>candidate.actionId)];
    if(currentActionId&&!ids.includes(currentActionId))ids.unshift(currentActionId);
    const opts=[...new Set(ids)].filter(id=>data.actions?.[id]).map(id=>{
      const candidate=byId.get(id),name=data.actions[id]?.name||id;
      return {id,label:candidate?name+'｜'+(candidate.functionalFamilyLabel||'下肢辅助'):name,kind:id===baseline?'当前默认':'体系候选',candidate};
    });
    return {opts,result,recipeId,level,lowerMode};
  }
  function sessionCard(sessionId,slot){
    const data=D(),view=data.sessionViews[sessionId]||{},actionId=window.V14State.getSelection(sessionId,slot.slotKey),a=data.actions[actionId]||{};
    const lowerContext=lowerAssistancePresetOptions(sessionId,slot,actionId);
    let opts=lowerContext?.opts||(view.slotOptions?.[slot.slotKey]||[]);
    if(!opts.length)opts=[{id:slot.baselineId,label:(data.actions[slot.baselineId]?.name||slot.baselineId),kind:'当前'}];
    if(!opts.some(o=>o.id===actionId))opts=[{id:actionId,label:(a.name||actionId),kind:'当前选择'},...opts];
    const options=opts.map(o=>{
      const candidate=o.candidate||{},reasons=(candidate.reasons||[]).map(item=>item.text).filter(Boolean).join('；');
      const tradeoffs=(candidate.tradeoffs||[]).map(item=>item.text).filter(Boolean).join('；');
      const roles=(candidate.trainingRoles||[]).map(role=>window.V15LowerAssistance?.trainingRoles?.[role]||role).filter(Boolean).join(' / ');
      return `<option value="${esc(o.id)}" ${o.id===actionId?'selected':''} data-score="${esc(candidate.recommendationScore??'')}" data-family="${esc(candidate.functionalFamilyLabel||'')}" data-role="${esc(roles)}" data-reasons="${esc(reasons)}" data-tradeoffs="${esc(tradeoffs)}">${esc(o.label)}</option>`;
    }).join('');
    const detailRoute=a.isSupport?`#/system/support?focus=${encodeURIComponent(actionId)}`:a.isCore?`#/system/core?focus=${encodeURIComponent(actionId)}`:`#/library?focus=${encodeURIComponent(actionId)}`;
    const Recent=window.V15RecentActions,contextKey=Recent?.context?.f111Preset?.({sessionId,slotKey:slot.slotKey})||'';
    const quick=Recent?.renderButtons?.({templateId:'f111',contextKey,candidates:opts,currentActionId:actionId})||'';
    const recommended=lowerContext?.result?.candidates?.find(candidate=>candidate.actionId===lowerContext.result.recommended);
    const why=recommended?.reasons?.[0]?.text||'';
    const browse=lowerContext?`<a class="lower-assistance-browse" href="#/system/patterns?focus=aux-lower&template=f111&sessionId=${encodeURIComponent(sessionId)}&slotKey=${encodeURIComponent(slot.slotKey)}&level=${encodeURIComponent(lowerContext.level)}&lower=${encodeURIComponent(lowerContext.lowerMode)}">查看全部下肢辅助与容量动作 →</a>`:'';
    const drawer=lowerContext?`<button type="button" class="lower-assistance-drawer-open" data-replacement-drawer data-f111-replacement-drawer="1" data-f111-replacement-group="下肢辅助候选" data-replacement-select=".session-swap" data-replacement-title="D1｜下肢辅助替换" data-replacement-subtitle="${esc(lowerContext.level)} · 仅显示当前课程通过 Gate 的候选">打开替换抽屉</button>`:'';
    const whyHtml=why?`<small class="lower-assistance-why">推荐依据：${esc(why)}</small>`:'';
    return `<article class="session-slot" data-slot="${esc(slot.slotKey)}"><div class="slot-kicker">${esc(slot.slotName)}</div><h3>${esc(a.name||actionId)}</h3><div class="slot-meta"><span>${esc(a.tier||a.supportGrade||a.coreGrade||'未标')}</span><span>${esc(a.pattern||'')}</span><span>${esc(a.equipment||'')}</span></div><div class="slot-actions"><a href="${detailRoute}">查看动作</a><select class="session-swap" data-session="${esc(sessionId)}" data-slot-key="${esc(slot.slotKey)}">${options}</select>${drawer}${whyHtml}${browse}${quick}</div></article>`;
  }
  function windowText(slotKey,resolved){
    if(slotKey==='A'||slotKey==='B'){const w=resolved.windows.main;return `推荐 ${w.recommended}｜常规 ${(w.normal||[]).join('–')}${(w.expanded||[]).length?`｜可退阶 ${(w.expanded||[]).join(' / ')}`:''}`;}
    if(slotKey==='C'){const w=resolved.windows.support;return `推荐 ${w.recommended}｜常规 ${(w.normal||[]).join('–')}${(w.expanded||[]).length?`｜扩展 ${(w.expanded||[]).join(' / ')}`:''}`;}
    if(slotKey==='CORE'){const w=resolved.windows.core;return `推荐 ${(w.recommended||[]).join(' / ')}｜常规 ${(w.normal||[]).join('–')}`;}
    return '系统按主项互补、动作暴露和场馆路由推荐';
  }
  function composerCard(ctx,slot,controls=''){
    const data=D(),opts=ctx.resolved.slotOptions[slot.slotKey]||[],a=data.actions[slot.actionId]||{},special=slot.slotKey==='C'||slot.slotKey==='CORE';
    const grouped=special?M.F111ComposeUI?.actionGroups?.(ctx,slot.slotKey):null;
    const selectOptions=grouped?.length?grouped.flatMap(group=>group.items):opts;
    const optionHtml=selectOptions.map(o=>{const grade=o.tier||o.grade||'';return `<option value="${esc(o.id)}" ${o.id===slot.actionId?'selected':''} ${o.disabled?'disabled':''} data-grade="${esc(grade)}">${esc([grade,o.name].filter(Boolean).join('｜'))}</option>`;}).join('');
    const grade=slot.tier||slot.grade||'';
    const detailRoute=a.isSupport?`#/system/support?focus=${encodeURIComponent(slot.actionId)}`:a.isCore?`#/system/core?focus=${encodeURIComponent(slot.actionId)}`:`#/library?focus=${encodeURIComponent(slot.actionId)}`;
    const tierNote=slot.tierNote?`<small class="composer-tier-note">${esc(slot.tierNote)}</small>`:'';
    const rx=slot.prescriptionOverride?`<small class="composer-rx-note">${esc(slot.prescriptionOverride)}</small>`:'';
    const replace=special
      ?(M.F111ComposeUI?.actionTrigger?.(ctx,slot.slotKey)||'')
      :`<button type="button" class="f111-replace-trigger" data-replacement-drawer data-f111-replacement-drawer="1" data-f111-replacement-group="动作候选" data-replacement-select=".composer-slot-select" data-replacement-title="${esc(slot.slotName||slot.slotKey)}｜替换动作" aria-label="替换${esc(slot.name||'动作')}"><span>替换</span><i aria-hidden="true">⌄</i></button>`;
    return `<article class="composer-slot-card f111-slot-card" data-composer-slot="${esc(slot.slotKey)}" data-action-detail-href="${esc(detailRoute)}" tabindex="0" aria-label="查看${esc(slot.name||'动作')}详情"><div class="composer-slot-head"><div><span>${esc(slot.slotName||slot.slotKey)}</span><b>${esc(grade||'辅助')}</b></div>${replace}</div>${controls}<div class="f111-slot-main"><h3>${esc(slot.name||'暂无候选')}</h3></div>${rx}${tierNote}<select class="composer-slot-select f111-visually-hidden" aria-label="${esc(slot.slotName||slot.slotKey)}：替换动作" data-composer-key="${esc(ctx.stateKey)}" data-slot-key="${esc(slot.slotKey)}">${optionHtml}</select></article>`;
  }
  M.Slot={sessionCard,composerCard,windowText};
})();
