(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc}=C;

  function services(){
    const resolver=window.V14PrepResolver,state=window.V15State;
    if(!resolver?.resolve)throw new Error('Body PREP resolver is unavailable');
    return {resolver,state};
  }

  function resolve(session,sessionKey){
    if(!session?.prepContext)throw new Error('Body PREP requires ResolvedSession.prepContext');
    const {resolver,state}=services();
    const saved=state?.getPrepSelections?.('body',sessionKey)||{};
    let resolved=resolver.resolve(session.prepContext,{selections:saved});
    const fallbackSlots=[],cleaned={...saved};

    for(const slot of resolved.slots||[]){
      const entry=saved[slot.slotKey];
      if(!entry||entry.source!=='manual')continue;
      if(slot.source==='manual'&&slot.actionId===entry.actionId)continue;
      delete cleaned[slot.slotKey];
      fallbackSlots.push(slot.slotKey);
    }

    if(fallbackSlots.length&&state?.patchSession){
      state.patchSession('body',sessionKey,{prepSelections:cleaned});
      resolved=resolver.resolve(session.prepContext,{selections:cleaned});
    }
    return {...resolved,fallbackSlots};
  }

  function setSelection(sessionKey,slotKey,actionId){
    const state=window.V15State;
    if(!state?.setPrepSelection)throw new Error('Body PREP State service is unavailable');
    return state.setPrepSelection('body',sessionKey,slotKey,actionId,'manual');
  }

  function items(resolved){
    return (resolved?.slots||[]).filter(slot=>slot.actionId).map(slot=>({
      slotKey:slot.slotKey,
      actionId:slot.actionId,
      prepId:slot.prepId,
      name:slot.name,
      grade:slot.prepGrade,
      prescription:slot.prescription,
      why:slot.why,
      source:slot.source,
    }));
  }

  function optionHtml(slot){
    if(!(slot.candidates||[]).length)return '<option value="">暂无合法候选</option>';
    return slot.candidates.map(candidate=>`<option value="${esc(candidate.actionId)}" ${candidate.actionId===slot.actionId?'selected':''}>${esc(candidate.prepGrade||'PREP')}｜${esc(candidate.name)}</option>`).join('');
  }

  function renderResolved(resolved,sessionKey){
    const fallback=(resolved?.fallbackSlots||[]).length
      ?`<div class="prep-fallback-notice">原热身选择已失效，已恢复系统推荐：${esc(resolved.fallbackSlots.join(' / '))}</div>`:'';
    const cards=(resolved?.slots||[]).map(slot=>`<article class="session-warmup-card prep-slot-card body-prep-card" data-prep-slot-card="${esc(slot.slotKey)}">
      <div><span>${esc(slot.prepGrade||'—')}</span><small>${esc(slot.slotKey)} · ${slot.source==='manual'?'手动选择':'系统推荐'}</small></div>
      <b>${esc(slot.name||'暂无合法候选')}</b>
      <p>${esc(slot.purpose||'')}</p>
      <div class="slot-actions"><select class="body-prep-select" data-body-prep-session="${esc(sessionKey)}" data-body-prep-slot="${esc(slot.slotKey)}" ${slot.candidates?.length?'':'disabled'}>${optionHtml(slot)}</select>${slot.why?`<small>${esc(slot.why)}</small>`:''}</div>
    </article>`).join('');
    return `<section class="section-card body-prep-section"><div class="section-head"><div><h2>PREP｜动态热身 / 激活</h2><p>五功能槽位来自共享 PREP Resolver V2；替换仅保存当前 Body Session 的 manual intent。</p></div><span class="time-badge">约 10–12 分钟</span></div>${fallback}<div class="session-warmup-grid prep-slot-grid">${cards}</div></section>`;
  }

  function render(session,sessionKey){return renderResolved(resolve(session,sessionKey),sessionKey);}

  M.BodyPrep={resolve,setSelection,items,render,renderResolved};
})();
