(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common,esc=C.esc;
  function prepContext(session){
    const stations=Object.values(session?.domainContext?.stations||{});
    return window.V14PrepResolver.contextFromHyrox({
      level:session.level,
      recipeId:session.familyId,
      stationIds:session.domainContext?.orderedStations||[],
      modalities:stations.map(function(item){return item.modality;}),
      impactDemand:session.prepContext?.impactDemand||'',
      powerDemand:session.prepContext?.powerDemand||'',
    });
  }
  function resolve(session,sessionKey){
    if(!session)throw new Error('HYROX PREP requires a ResolvedSession');
    const resolver=window.V14PrepResolver,state=window.V15State,context=prepContext(session);
    const saved=state?.getPrepSelections?.('hyrox',sessionKey)||{};
    let result=resolver.resolve(context,{selections:saved}),cleaned={...saved},fallbackSlots=[];
    (result.slots||[]).forEach(function(slot){
      const entry=saved[slot.slotKey];
      if(!entry||entry.source!=='manual')return;
      if(slot.source==='manual'&&slot.actionId===entry.actionId)return;
      delete cleaned[slot.slotKey];fallbackSlots.push(slot.slotKey);
    });
    if(fallbackSlots.length&&state?.patchSession){
      state.patchSession('hyrox',sessionKey,{prepSelections:cleaned});
      result=resolver.resolve(context,{selections:cleaned});
    }
    return {...result,fallbackSlots,context};
  }
  function setSelection(sessionKey,slotKey,actionId){
    return window.V15State.setPrepSelection('hyrox',sessionKey,slotKey,actionId,'manual');
  }
  function items(result){
    return (result?.slots||[]).filter(function(slot){return !!slot.actionId;}).map(function(slot){
      return {slotKey:slot.slotKey,actionId:slot.actionId,name:slot.name,grade:slot.prepGrade,prescription:slot.prescription,why:slot.why,source:slot.source};
    });
  }
  function options(slot){
    if(!(slot.candidates||[]).length)return '<option value="">暂无合法候选</option>';
    return slot.candidates.map(function(item){
      return '<option value="'+esc(item.actionId)+'" '+(item.actionId===slot.actionId?'selected':'')+'>'+esc(item.prepGrade||'PREP')+'｜'+esc(item.name)+'</option>';
    }).join('');
  }
  function renderResolved(result,sessionKey){
    const notice=(result?.fallbackSlots||[]).length?'<div class="prep-fallback-notice">原热身选择已失效，已恢复系统推荐：'+esc(result.fallbackSlots.join(' / '))+'</div>':'';
    const cards=(result?.slots||[]).map(function(slot){
      return '<article class="session-warmup-card prep-slot-card hyrox-prep-card" data-hyrox-prep-slot-card="'+esc(slot.slotKey)+'">'+
        '<div><span>'+esc(slot.prepGrade||'—')+'</span><small>'+esc(slot.slotKey)+' · '+(slot.source==='manual'?'手动选择':'系统推荐')+'</small></div>'+
        '<b>'+esc(slot.name||'暂无合法候选')+'</b><p>'+esc(slot.purpose||'')+'</p>'+
        '<div class="slot-actions"><select class="hyrox-prep-select" data-hyrox-prep-session="'+esc(sessionKey)+'" data-hyrox-prep-slot="'+esc(slot.slotKey)+'" '+(slot.candidates?.length?'':'disabled')+'>'+options(slot)+'</select>'+
        (slot.why?'<small>'+esc(slot.why)+'</small>':'')+'</div></article>';
    }).join('');
    return '<section class="section-card hyrox-prep-section"><div class="section-head"><div><h2>PREP｜动态热身 · Station 准备</h2><p>由共享 PREP Resolver 根据本节实际 Station、等级、冲击与动作模式重新匹配。</p></div><span class="time-badge">约 10–12 分钟</span></div>'+notice+'<div class="hyrox-prep-grid">'+cards+'</div></section>';
  }
  function render(session,sessionKey){return renderResolved(resolve(session,sessionKey),sessionKey);}
  M.HyroxPrep={prepContext,resolve,setSelection,items,renderResolved,render};
})();