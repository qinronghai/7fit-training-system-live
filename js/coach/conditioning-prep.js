(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc}=C;

  function services(){
    const resolver=window.V14PrepResolver,state=window.V15State;
    if(!resolver?.resolve)throw new Error('Conditioning PREP resolver is unavailable');
    return {resolver,state};
  }

  function resolve(session,sessionKey){
    if(!session?.prepContext)throw new Error('Conditioning PREP requires ResolvedSession.prepContext');
    const {resolver,state}=services();
    const saved=state?.getPrepSelections?.('conditioning',sessionKey)||{};
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
      state.patchSession('conditioning',sessionKey,{prepSelections:cleaned});
      resolved=resolver.resolve(session.prepContext,{selections:cleaned});
    }
    return {...resolved,fallbackSlots};
  }

  function setSelection(sessionKey,slotKey,actionId){
    const state=window.V15State;
    if(!state?.setPrepSelection)throw new Error('Conditioning PREP State service is unavailable');
    return state.setPrepSelection('conditioning',sessionKey,slotKey,actionId,'manual');
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

  const RISK_LABEL={low:'低',medium:'中',high:'高'};

  function emptyGuidance(slot,session){
    if((slot.candidates||[]).length)return '';
    const ctx=session?.prepContext||{},level=ctx.level||session?.level||'—';
    const impact=RISK_LABEL[ctx.impactDemand]||ctx.impactDemand||'未指定';
    const patterns=(ctx.mainPatterns||[]).join(' / ')||'当前 Station 动作模式';
    const modalities=(ctx.modalities||[]).join(' / ')||'未指定';
    const queryPattern=(ctx.mainPatterns||[])[0]||'';
    const href='#/system/prep?level='+encodeURIComponent(level)+(queryPattern?'&pattern='+encodeURIComponent(queryPattern):'');
    if(slot.slotKey==='PRIMER'){
      return `<div class="conditioning-prep-empty" data-conditioning-prep-empty="PRIMER"><b>当前等级、冲击和动作模式约束下没有合法 Primer</b><span>当前约束：${esc(level)} · 冲击 ${esc(impact)} · 模式 ${esc(patterns)} · Modality ${esc(modalities)}</span><p>本槽可以安全跳过，继续完成活动度、核心激活与整合热身；不要为了填满卡片而绕过动作准入。若由教练人工安排，只选当前等级可见、低疲劳、与正式 Station 不重复且符合场馆路线的 PREP 动作。</p><a href="${href}">查看 PREP 规则 / 人工安排参考</a></div>`;
    }
    return `<div class="conditioning-prep-empty" data-conditioning-prep-empty="${esc(slot.slotKey)}"><b>当前约束下没有合法候选</b><span>${esc(level)} · 冲击 ${esc(impact)} · ${esc(patterns)}</span><p>保留其他合法 PREP 槽位即可，不放宽动作准入。</p></div>`;
  }

  function renderResolved(resolved,sessionKey,session){
    const foam=session&&M.Foam?.foamRollCardsFor
      ?M.Foam.foamRollCardsFor({session,level:session.level||'L1',subtitle:`${session.familyId||'Conditioning'} · ${session.level||'L1'}`})
      :'';
    const power=session?.prepContext?.powerDemand;
    const primerNote=power==='high'
      ?'爆发功率课：动态活动与动作排演优先，Primer 只做提速与神经准备，不提前制造疲劳。'
      :'热身按本节 Station 的 Modality、冲击与动作需求匹配，避免在 PREP 阶段提前累积疲劳。';
    const fallback=(resolved?.fallbackSlots||[]).length
      ?`<div class="prep-fallback-notice">原热身选择已失效，已恢复系统推荐：${esc(resolved.fallbackSlots.join(' / '))}</div>`:'';
    const cards=(resolved?.slots||[]).map(slot=>`<article class="session-warmup-card prep-slot-card conditioning-prep-card" data-conditioning-prep-slot-card="${esc(slot.slotKey)}">
      <div><span>${esc(slot.prepGrade||'—')}</span><small>${esc(slot.slotKey)} · ${slot.source==='manual'?'手动选择':'系统推荐'}</small></div>
      <b>${esc(slot.name||'暂无合法候选')}</b>
      <p>${esc(slot.purpose||'')}</p>
      <div class="slot-actions"><select class="conditioning-prep-select" aria-label="${esc(slot.slotName||slot.slotKey)}：Conditioning 热身动作替换" data-conditioning-prep-session="${esc(sessionKey)}" data-conditioning-prep-slot="${esc(slot.slotKey)}" ${slot.candidates?.length?'':'disabled'}>${optionHtml(slot)}</select>${slot.why?`<small>${esc(slot.why)}</small>`:''}</div>${emptyGuidance(slot,session)}
    </article>`).join('');
    return `<section class="section-card conditioning-prep-section"><div class="section-head"><div><h2>PREP / PRIMER｜动态热身 · 动作排演</h2><p>${esc(primerNote)}</p></div><span class="time-badge">约 10–12 分钟</span></div>${fallback}${foam}<div class="conditioning-prep-grid">${cards}</div></section>`;
  }

  function render(session,sessionKey){
    return renderResolved(resolve(session,sessionKey),sessionKey,session);
  }

  M.ConditioningPrep={resolve,setSelection,items,renderResolved,render};
})();
