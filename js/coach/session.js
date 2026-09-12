(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D,hero,copyToolbar}=C;
  function resolveResolvedSession(sessionId,recipeId,level,selectedIds){
    const selected=Array.isArray(selectedIds)&&selectedIds.length?selectedIds:window.V14State.getSessionSelections(sessionId);
    return window.V15TemplateResolver.resolve('f111',{mode:'preset',recipeId,level,selections:selected});
  }
  function selectedTrainingIds(sessionId,selectedIds){
    const s=D().sessions[sessionId];
    if(!s)return {all:[],main:[],foam:[]};
    const ids=Array.isArray(selectedIds)&&selectedIds.length?selectedIds:window.V14State.getSessionSelections(sessionId);
    const out={all:ids.slice(),main:[],foam:[]};
    s.slots.forEach((slot,i)=>{
      const id=ids[i];if(!id)return;
      if(/^A｜|^B｜/.test(slot.slotName))out.main.push(id);
      if(/^A｜|^B｜|^D1｜|^D2｜/.test(slot.slotName))out.foam.push(id);
    });
    return out;
  }
  function buildCopyPayload(sessionId,recipeId,level){
    const data=D(),s=data.sessions[sessionId],view=data.sessionViews[sessionId]||{},recipe=data.recipes[recipeId]||{};
    const resolvedSession=resolveResolvedSession(sessionId,recipeId,level),selected=resolvedSession.main.content.map(slot=>slot.actionId),groups=selectedTrainingIds(sessionId,selected),result=resolvedSession.conflictContext;
    const foam=M.Foam.matchedFoamRolls(recipeId,level,groups.foam).map(x=>({name:x.name,prescription:x.prescription}));
    const prepResolved=M.Prep.resolvePresetPrep(sessionId,recipeId,level,selected);
    const warmups=M.Prep.resolvedItems(prepResolved).map(x=>({name:x.name,prescription:x.prescription}));
    const slots=(s?.slots||[]).map((slot,i)=>{
      const actionId=selected[i],a=data.actions[actionId]||{};
      const tier=window.V14ModuleCopy?.tierForAction?.(actionId)||(/^T[1-4]$/.test(a.tier||'')?a.tier:'');
      const prescription=window.V14ModuleCopy?.prescriptionForAction?.(actionId,{level})||'';
      const grade=a.grade||a.supportGrade||a.coreGrade||'';
      return {slot:slot.slotName,name:a.name||actionId,tier,grade,prescription};
    });
    const summary=resolvedSession.anatomyContext||{primary:[],secondary:[],stabilizers:[]};
    const recovery=(view.recovery||[]).map(x=>x.actions?.[0]?.name||x.text).filter(Boolean);
    const conflicts=(result.issues||[]).map(x=>`${x.title}：${x.text}`);
    return {brand:'7Fit',recipeId,recipeName:recipe.name||recipeId,level,summary:view.summary||'',foam,warmups,slots,muscles:{primary:summary.primary.slice(0,6),secondary:summary.secondary.slice(0,6),stabilizers:summary.stabilizers.slice(0,6)},recovery,postCardio:view.postCardio||'',conflicts};
  }
  function render(route){
    const data=D(),recipeId=route.recipeId,level=route.level;
    if(!data.recipes[recipeId]||!/^L[1-4]$/.test(level))return `<section class="empty-state"><b>课程不存在</b><a href="#/coach/f111">返回编课中心</a></section>`;
    const sessionId=`${recipeId}-${level}`,s=data.sessions[sessionId],view=data.sessionViews[sessionId];
    if(!s)return `<section class="empty-state"><b>课程不存在</b><a href="#/coach/f111">返回编课中心</a></section>`;
    const resolvedSession=resolveResolvedSession(sessionId,recipeId,level),selected=resolvedSession.main.content.map(slot=>slot.actionId),groups=selectedTrainingIds(sessionId,selected),result=resolvedSession.conflictContext;
    const top=s.slots.filter(x=>/^A｜|^B｜|^C｜/.test(x.slotName)).map(x=>M.Slot.sessionCard(sessionId,x)).join('');
    const bottom=s.slots.filter(x=>!/^A｜|^B｜|^C｜/.test(x.slotName)).map(x=>M.Slot.sessionCard(sessionId,x)).join('');
    const prep=(view?.prep||[]).map(x=>`<div class="flow-item"><b>${esc(x.text.split(' ')[0])}</b><span>${esc(x.text.replace(x.text.split(' ')[0],'').trim())}</span></div>`).join('');
    const recovery=(view?.recovery||[]).map(x=>`<div class="flow-item"><b>${esc(x.actions?.[0]?.name||'恢复')}</b><span>${esc(x.text)}</span></div>`).join('');
    const levelLinks=[1,2,3,4].map(n=>`<a class="${level===`L${n}`?'active':''}" href="#/coach/f111/${recipeId.toLowerCase()}/l${n}">L${n}</a>`).join('');
    return `<a class="back-link" href="#/coach/f111">← 返回 8 个模板</a>`+hero(`${recipeId}｜${data.recipes[recipeId].name}`,`${level}｜${view?.summary||''}`,[level,'2F PREP','1F STRENGTH','2F RECOVERY'])+`<div class="session-toolbar"><div class="level-switch">${levelLinks}</div><div class="session-toolbar-actions">${copyToolbar()}<button id="reset-session" data-session="${sessionId}" type="button">恢复默认</button></div></div>`+`<section class="route-strip"><span>2F PREP</span><i>↓</i><span>1F STRENGTH</span><i>↑</i><span>2F RECOVERY</span><small>课后有氧独立</small></section>`+`<section class="section-card"><div class="section-head"><div><h2>2F｜PREP</h2><p>下楼前完成泡沫轴、关节活动、目标激活和动作模式复习；热身动作根据当天 A / B 主训练自动匹配。</p></div><span class="time-badge">约 10–12 分钟</span></div>${M.Foam.foamRollCards(recipeId,level,groups.foam)}${M.Prep.warmupCards(recipeId,level,groups.main)}<details class="legacy-prep-flow"><summary>查看原有馆内固定流程参考</summary><div class="flow-grid">${prep}</div></details></section>`+`<section class="section-card strength-card"><div class="section-head"><div><h2>1F｜STRENGTH</h2><p>A / B / C 为主结构；D1 / D2 / CORE 为辅助结构。</p></div><span class="time-badge">约 40–43 分钟</span></div>${M.Summary.render(groups.all)}<div id="conflict-mount">${M.ConflictView.render(result)}</div><div class="slot-grid primary">${top}</div><div class="slot-grid secondary">${bottom}</div></section>`+`<section class="section-card"><div class="section-head"><div><h2>2F｜RECOVERY</h2><p>力量部分结束后一次上楼完成恢复。</p></div><span class="time-badge">约 5–8 分钟</span></div><div class="flow-grid recovery-grid">${recovery}</div></section>`+`<section class="post-cardio-note"><b>POST CARDIO ONLY</b><span>${esc(view?.postCardio||'课后有氧不计入 F111 正式 60 分钟模板。')}</span></section>`+(M.SavedSessions?.render?.({templateId:'f111',sessionKey:sessionId,defaultName:`${recipeId}｜${level}`})||'');
  }
  M.Session={resolveResolvedSession,selectedTrainingIds,buildCopyPayload,render};
})();
