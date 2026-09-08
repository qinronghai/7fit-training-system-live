(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const D=()=>window.V14_DATA;
  function hero(title,body,chips=[]){return `<section class="view-hero"><span class="eyebrow">COACH CENTER / F111</span><h1>${esc(title)}</h1><p>${esc(body)}</p><div class="chips">${chips.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></section>`;}
  function coachModeSwitch(active){return `<nav class="coach-mode-switch"><a class="${active==='preset'?'active':''}" href="#/coach">7Fit 推荐预设</a><a class="${active==='compose'?'active':''}" href="#/coach/compose">自由组合编课</a></nav>`;}
  function homeHero(){
    return `<section class="view-hero coach-home-hero">
      <div class="coach-home-hero-main">
        <span class="eyebrow">COACH CENTER / F111</span>
        <h1>女性综合 1+1+1</h1>
        <p class="coach-home-lead">一下肢 + 一上肢 + 一支撑</p>
        <div class="chips"><span class="chip">8 个推荐预设</span><span class="chip">20 种自由组合</span><span class="chip">32 套原课程兼容</span><span class="chip">实时替换检查</span></div>
      </div>
      <div class="coach-home-intro">
        <div class="intro-head"><span>为什么是「1+1+1」</span><b>一下肢 + 一上肢 + 一支撑</b></div>
        <p class="intro-summary">每节课只锁定一个下肢主模式、一个上肢主模式和一个支撑任务，避免女性训练中一节课堆太多大动作、局部疲劳过度，或者为了“练得累”而失去动作质量。</p>
        <div class="intro-points">
          <article><b>① 全身都能练到，但重点非常清楚</b><p>下肢负责臀腿与力量，上肢负责肩背胸臂，支撑负责核心、肩胛和身体稳定。</p></article>
          <article><b>② 更适合女性长期塑形</b><p>不是单纯刷热量，而是同时兼顾：<strong>臀腿线条、背肩塑形、基础力量、核心稳定、动作质量和整体体态。</strong></p></article>
          <article><b>③ 可以连续进阶</b><p>同一个模板可以从 L1 一直练到 L4，会员不是频繁换体系，而是在同一个动作模式里逐步提高：<strong>动作控制 → 基础负重 → 独立负重 → 完整能力。</strong></p></article>
        </div>
      </div>
    </section>`;
  }
  function home(){
    const data=D();
    const cards=data.recipeIds.map(id=>{
      const r=data.recipes[id];
      const levels=[1,2,3,4].map(n=>`<a href="#/coach/${id.toLowerCase()}/l${n}">L${n}</a>`).join('');
      return `<article class="recipe-card"><div class="recipe-code">${id}</div><h3>${esc(r.name)}</h3><div class="recipe-tags"><span>${esc(r.lower)}</span><span>${esc(r.upper)}</span><span>${esc(r.support)}</span></div><div class="level-links">${levels}</div></article>`;
    }).join('');
    return coachModeSwitch('preset')+homeHero()+
      `<section class="section-card"><div class="section-head"><div><h2>7Fit 推荐预设</h2><p>保留原 8 个 Recipe Family 和 32 套 L1–L4 课程；新教练可直接使用，熟悉体系后可进入自由组合。</p></div><a class="section-action-link" href="#/coach/compose">进入自由组合编课 →</a></div><div class="recipe-grid">${cards}</div></section>`;
  }
  function slotCard(sessionId,slot){
    const data=D(), view=data.sessionViews[sessionId]||{}, actionId=window.V14State.getSelection(sessionId,slot.slotKey),a=data.actions[actionId]||{};
    let opts=view.slotOptions?.[slot.slotKey]||[];
    if(!opts.length)opts=[{id:slot.baselineId,label:(data.actions[slot.baselineId]?.name||slot.baselineId),kind:'当前'}];
    if(!opts.some(o=>o.id===actionId))opts=[{id:actionId,label:(a.name||actionId),kind:'当前选择'},...opts];
    const options=opts.map(o=>`<option value="${esc(o.id)}" ${o.id===actionId?'selected':''}>${esc(o.label)}</option>`).join('');
    const detailRoute=a.isSupport?`#/system/support?focus=${encodeURIComponent(actionId)}`:a.isCore?`#/system/core?focus=${encodeURIComponent(actionId)}`:`#/library?focus=${encodeURIComponent(actionId)}`;
    return `<article class="session-slot" data-slot="${esc(slot.slotKey)}"><div class="slot-kicker">${esc(slot.slotName)}</div><h3>${esc(a.name||actionId)}</h3><div class="slot-meta"><span>${esc(a.tier||a.supportGrade||a.coreGrade||'未标')}</span><span>${esc(a.pattern||'')}</span><span>${esc(a.equipment||'')}</span></div><div class="slot-actions"><a href="${detailRoute}">查看动作</a><select class="session-swap" data-session="${esc(sessionId)}" data-slot-key="${esc(slot.slotKey)}">${options}</select></div></article>`;
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
  function legacyMatchedWarmups(recipeId,level){
    const data=D(),recipe=data.recipes[recipeId]||{},tier=`T${level.slice(-1)}`;
    const eligible=id=>{
      const w=data.warmupDetails?.[id];
      return !!w&&w.sessionLevels.includes(level)&&w.mainTiers.includes(tier);
    };
    const choose=(ids,pattern,used)=>{
      for(const id of ids){
        const w=data.warmupDetails?.[id];
        if(eligible(id)&&w.targetPatterns.includes(pattern)&&!used.has(id)){used.add(id);return id;}
      }
      return null;
    };
    const used=new Set(),picked=[];
    const lowerPriority=['PREP-16','PREP-10','PREP-12','PREP-13','PREP-17','PREP-15','PREP-18','PREP-11','PREP-14','PREP-03'];
    const upperPriority=['PREP-04','PREP-02','PREP-06','PREP-07','PREP-05','PREP-03'];
    const lower=choose(lowerPriority,recipe.lower,used);if(lower)picked.push(lower);
    const upper=choose(upperPriority,recipe.upper,used);if(upper)picked.push(upper);
    const coreByLevel={L1:'PREP-09A',L2:'PREP-09C',L3:'PREP-08',L4:'PREP-08'};
    const core=coreByLevel[level];if(core&&eligible(core)&&!used.has(core)){used.add(core);picked.push(core);}
    const integrated=level==='L1'?'PREP-01':'PREP-03';
    if(integrated&&eligible(integrated)&&!used.has(integrated)){used.add(integrated);picked.push(integrated);}
    if(picked.length<4){
      const fallback=(data.warmupIds||[]).filter(id=>eligible(id)&&!used.has(id)&&(data.warmupDetails[id].targetPatterns.includes(recipe.lower)||data.warmupDetails[id].targetPatterns.includes(recipe.upper)));
      fallback.slice(0,4-picked.length).forEach(id=>picked.push(id));
    }
    return picked.map(id=>data.warmupDetails[id]).filter(Boolean);
  }
  function matchedWarmups(recipeId,level,mainActionIds){
    const data=D(),tier=`T${level.slice(-1)}`;
    const ranked=window.V14Anatomy?window.V14Anatomy.rankWarmups(mainActionIds,{recipeId,level,tier,limit:6}):[];
    if(ranked.length)return ranked.map(id=>data.warmupDetails[id]).filter(Boolean);
    return legacyMatchedWarmups(recipeId,level);
  }
  function legacyMatchedFoamRolls(recipeId,level){
    const data=D(),recipe=data.recipes[recipeId]||{},tier=`T${level.slice(-1)}`;
    const eligible=id=>{const f=data.foamRollDetails?.[id];return !!f&&f.sessionLevels.includes(level)&&f.mainTiers.includes(tier);};
    const picked=[],used=new Set();
    const take=(pattern,max)=>{
      const ids=data.foamRollMatchByPattern?.[pattern]||[];
      for(const id of ids){if(picked.length>=4||max<=0)break;if(eligible(id)&&!used.has(id)){used.add(id);picked.push(id);max--;}}
    };
    take(recipe.lower,2);take(recipe.upper,2);
    return picked.map(id=>data.foamRollDetails[id]).filter(Boolean);
  }
  function matchedFoamRolls(recipeId,level,foamActionIds){
    const data=D(),tier=`T${level.slice(-1)}`;
    const ranked=window.V14Anatomy?window.V14Anatomy.rankFoam(foamActionIds,{limit:4}):[];
    const eligible=ranked.filter(id=>{const f=data.foamRollDetails?.[id];return f&&f.sessionLevels.includes(level)&&f.mainTiers.includes(tier);});
    if(eligible.length)return eligible.map(id=>data.foamRollDetails[id]);
    return legacyMatchedFoamRolls(recipeId,level);
  }
  function foamRollCards(recipeId,level,foamActionIds){
    const data=D(),recipe=data.recipes[recipeId]||{},tier=`T${level.slice(-1)}`,items=matchedFoamRolls(recipeId,level,foamActionIds);
    const cards=items.map(f=>`<a class="session-foam-card" href="#/system/prep?foam=${encodeURIComponent(f.foamId)}"><div><span>ROLL</span><small>${esc(f.muscles.join(' · '))}</small></div><b>${esc(f.name)}</b><p>${esc(f.prescription)}</p></a>`).join('');
    const key=`coach-foam-${recipeId}-${level}`;
    const copy=window.V14ModuleCopy?(window.V14ModuleCopy.register(key,'foam',{title:`当前课程泡沫轴｜${recipe.name} · ${level}`,items:items.map(f=>({name:f.name,prescription:f.prescription,safety:f.safety}))}),window.V14ModuleCopy.button(key,'复制本模块')):'';
    return `<div class="session-prep-match session-foam-match"><div class="prep-match-head"><div><b>当前课程泡沫轴匹配</b><span>${esc(recipe.lower)} + ${esc(recipe.upper)} · ${esc(level)} / ${esc(tier)}</span></div><div class="prep-match-head-actions"><small>基于当前动作主要 / 辅助肌群排序；建议只选 2–4 个当天明显紧张部位。</small>${copy}</div></div><div class="session-foam-grid">${cards}</div></div>`;
  }
  function warmupCards(recipeId,level,mainActionIds){
    const data=D(),recipe=data.recipes[recipeId]||{},tier=`T${level.slice(-1)}`,items=matchedWarmups(recipeId,level,mainActionIds);
    const cards=items.map(w=>`<a class="session-warmup-card" href="#/system/prep?focus=${encodeURIComponent(w.prepId)}"><div><span>${esc(w.prepGrade)}</span><small>${esc(w.role)}</small></div><b>${esc(w.name)}</b><p>${esc(w.prescription)}</p></a>`).join('');
    const key=`coach-prep-${recipeId}-${level}`;
    const copy=window.V14ModuleCopy?(window.V14ModuleCopy.register(key,'prep',{title:`当前课程 PREP｜${recipe.name} · ${level}`,items:items.map(w=>({name:w.name,grade:w.prepGrade,prescription:w.prescription,why:w.why}))}),window.V14ModuleCopy.button(key,'复制本模块')):'';
    return `<div class="session-prep-match"><div class="prep-match-head"><div><b>当前课程热身匹配</b><span>${esc(recipe.lower)} + ${esc(recipe.upper)} · ${esc(level)} / ${esc(tier)}</span></div><div class="prep-match-head-actions"><div class="prep-match-links"><a href="#/system/prep?pattern=${encodeURIComponent(recipe.lower)}&level=${encodeURIComponent(level)}&tier=${encodeURIComponent(tier)}">下肢匹配器</a><a href="#/system/prep?pattern=${encodeURIComponent(recipe.upper)}&level=${encodeURIComponent(level)}&tier=${encodeURIComponent(tier)}">上肢匹配器</a></div>${copy}</div></div><div class="session-warmup-grid">${cards}</div></div>`;
  }
  function muscleSummaryHtml(actionIds){
    const summary=window.V14Anatomy?.aggregate(actionIds);
    if(!summary)return '';
    const primary=summary.primary.slice(0,6);
    const pset=new Set(primary);
    const secondary=summary.secondary.filter(x=>!pset.has(x)).slice(0,6);
    const used=new Set([...primary,...secondary]);
    const stabilizers=summary.stabilizers.filter(x=>!used.has(x)).slice(0,6);
    const row=(label,items)=>`<div><small>${label}</small><b>${esc(items.length?items.join(' · '):'—')}</b></div>`;
    return `<section class="session-muscle-summary"><div class="muscle-summary-head"><div><span>ANATOMY</span><h3>本节主要训练肌群</h3></div><small>根据当前 6 个正式训练动作实时汇总；仅表示动作暴露，不等同于有效组数。</small></div><div class="muscle-summary-grid">${row('主要刺激',primary)}${row('协同参与',secondary)}${row('核心 / 稳定',stabilizers)}</div></section>`;
  }
  function conflictHtml(result){
    const items=result.issues.length?result.issues.map(i=>`<div class="issue ${i.severity}"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div>`).join(''):`<p class="conflict-empty">当前方案未发现替换后冲突。</p>`;
    return `<section class="conflict-box ${result.status.toLowerCase()}"><div class="conflict-top"><div><span>LIVE CHECK</span><b>${result.status}</b></div><small>${result.hardCount} 硬冲突 · ${result.warnCount} 警告</small></div><div class="issue-list">${items}</div></section>`;
  }
  function buildCopyPayload(sessionId,recipeId,level){
    const data=D(),s=data.sessions[sessionId],view=data.sessionViews[sessionId]||{},recipe=data.recipes[recipeId]||{};
    const selected=window.V14State.getSessionSelections(sessionId),groups=selectedTrainingIds(sessionId,selected),result=window.V14Conflict.evaluate(sessionId,selected);
    const foam=matchedFoamRolls(recipeId,level,groups.foam).map(x=>({name:x.name,prescription:x.prescription}));
    const warmups=matchedWarmups(recipeId,level,groups.main).map(x=>({name:x.name,prescription:x.prescription}));
    const slots=(s?.slots||[]).map((slot,i)=>{
      const actionId=selected[i],a=data.actions[actionId]||{};
      const tier=window.V14ModuleCopy?.tierForAction?.(actionId)||(/^T[1-4]$/.test(a.tier||'')?a.tier:'');
      const prescription=window.V14ModuleCopy?.prescriptionForAction?.(actionId,{level})||'';
      const grade=a.grade||a.supportGrade||a.coreGrade||'';
      return {slot:slot.slotName,name:a.name||actionId,tier,grade,prescription};
    });
    const summary=window.V14Anatomy?.aggregate(groups.all)||{primary:[],secondary:[],stabilizers:[]};
    const recovery=(view.recovery||[]).map(x=>x.actions?.[0]?.name||x.text).filter(Boolean);
    const conflicts=(result.issues||[]).map(x=>`${x.title}：${x.text}`);
    return {
      brand:'7Fit',recipeId,recipeName:recipe.name||recipeId,level,summary:view.summary||'',foam,warmups,slots,
      muscles:{primary:summary.primary.slice(0,6),secondary:summary.secondary.slice(0,6),stabilizers:summary.stabilizers.slice(0,6)},
      recovery,postCardio:view.postCardio||'',conflicts
    };
  }
  function copyToolbar(){
    return `<div class="session-copy-actions"><button id="copy-coach-session" type="button">复制教练版</button><button id="copy-member-session" type="button">复制会员版</button><span id="copy-session-status" role="status" aria-live="polite"></span></div>`;
  }
  function session(route){
    const data=D(), recipeId=route.recipeId, level=route.level;
    if(!data.recipes[recipeId]||!/^L[1-4]$/.test(level))return `<section class="empty-state"><b>课程不存在</b><a href="#/coach">返回编课中心</a></section>`;
    const sessionId=`${recipeId}-${level}`, s=data.sessions[sessionId], view=data.sessionViews[sessionId];
    if(!s)return `<section class="empty-state"><b>课程不存在</b><a href="#/coach">返回编课中心</a></section>`;
    const selected=window.V14State.getSessionSelections(sessionId), groups=selectedTrainingIds(sessionId,selected), result=window.V14Conflict.evaluate(sessionId,selected);
    const top=s.slots.filter(x=>/^A｜|^B｜|^C｜/.test(x.slotName)).map(x=>slotCard(sessionId,x)).join('');
    const bottom=s.slots.filter(x=>!/^A｜|^B｜|^C｜/.test(x.slotName)).map(x=>slotCard(sessionId,x)).join('');
    const prep=(view?.prep||[]).map(x=>`<div class="flow-item"><b>${esc(x.text.split(' ')[0])}</b><span>${esc(x.text.replace(x.text.split(' ')[0],'').trim())}</span></div>`).join('');
    const recovery=(view?.recovery||[]).map(x=>`<div class="flow-item"><b>${esc(x.actions?.[0]?.name||'恢复')}</b><span>${esc(x.text)}</span></div>`).join('');
    const levelLinks=[1,2,3,4].map(n=>`<a class="${level===`L${n}`?'active':''}" href="#/coach/${recipeId.toLowerCase()}/l${n}">L${n}</a>`).join('');
    return `<a class="back-link" href="#/coach">← 返回 8 个模板</a>`+
      hero(`${recipeId}｜${data.recipes[recipeId].name}`,`${level}｜${view?.summary||''}`,[level,'2F PREP','1F STRENGTH','2F RECOVERY'])+
      `<div class="session-toolbar"><div class="level-switch">${levelLinks}</div><div class="session-toolbar-actions">${copyToolbar()}<button id="reset-session" data-session="${sessionId}" type="button">恢复默认</button></div></div>`+
      `<section class="route-strip"><span>2F PREP</span><i>↓</i><span>1F STRENGTH</span><i>↑</i><span>2F RECOVERY</span><small>课后有氧独立</small></section>`+
      `<section class="section-card"><div class="section-head"><div><h2>2F｜PREP</h2><p>下楼前完成泡沫轴、关节活动、目标激活和动作模式复习；热身动作根据当天 A / B 主训练自动匹配。</p></div><span class="time-badge">约 10–12 分钟</span></div>${foamRollCards(recipeId,level,groups.foam)}${warmupCards(recipeId,level,groups.main)}<details class="legacy-prep-flow"><summary>查看原有馆内固定流程参考</summary><div class="flow-grid">${prep}</div></details></section>`+
      `<section class="section-card strength-card"><div class="section-head"><div><h2>1F｜STRENGTH</h2><p>A / B / C 为主结构；D1 / D2 / CORE 为辅助结构。</p></div><span class="time-badge">约 40–43 分钟</span></div>${muscleSummaryHtml(groups.all)}<div id="conflict-mount">${conflictHtml(result)}</div><div class="slot-grid primary">${top}</div><div class="slot-grid secondary">${bottom}</div></section>`+
      `<section class="section-card"><div class="section-head"><div><h2>2F｜RECOVERY</h2><p>力量部分结束后一次上楼完成恢复。</p></div><span class="time-badge">约 5–8 分钟</span></div><div class="flow-grid recovery-grid">${recovery}</div></section>`+
      `<section class="post-cardio-note"><b>POST CARDIO ONLY</b><span>${esc(view?.postCardio||'课后有氧不计入 F111 正式 60 分钟模板。')}</span></section>`;
  }
  function composeHref(current,overrides={}){
    const q={level:current.level,lower:current.lowerMode,upper:current.upperMode,core:current.coreDemand,...overrides};
    if(current.includeExpandedMain)q.em='1';if(current.includeExpandedSupport)q.es='1';if(current.includeExpandedCore)q.ec='1';
    for(const k of ['em','es','ec'])if(overrides[k]===null)delete q[k];
    return '#/coach/compose?'+new URLSearchParams(q).toString();
  }
  function composerContext(route){
    const cfg=D().composer||{},q=route.query||{};
    const level=/^L[1-4]$/.test(q.level||'')?q.level:'L1';
    const lowerMode=cfg.lowerModes?.[q.lower]?q.lower:'squat';
    const upperMode=cfg.upperModes?.[q.upper]?q.upper:'horizontal_pull';
    const coreDemand=cfg.coreDemands?.[q.core]?q.core:'anti_extension';
    const flags={includeExpandedMain:q.em==='1',includeExpandedSupport:q.es==='1',includeExpandedCore:q.ec==='1'};
    const probe=window.V14Composer.resolve({level,lowerMode,upperMode,coreDemand,...flags});
    const stateKey=`${probe.compositionId}-${level}`;
    const selections=window.V14State.getComposerSelections(stateKey);
    const resolved=window.V14Composer.resolve({level,lowerMode,upperMode,coreDemand,selections,...flags});
    return {level,lowerMode,upperMode,coreDemand,stateKey,resolved,...flags};
  }
  function composerLevelSwitch(ctx){
    return `<div class="composer-level-switch">${['L1','L2','L3','L4'].map(l=>`<a class="${ctx.level===l?'active':''}" href="${composeHref(ctx,{level:l})}">${l}</a>`).join('')}</div>`;
  }
  function composerMatrix(ctx){
    const cfg=D().composer||{},uppers=Object.entries(cfg.upperModes||{}),lowers=Object.entries(cfg.lowerModes||{});
    const head=`<div class="composer-matrix-corner">下肢 × 上肢</div>${uppers.map(([,u])=>`<div class="composer-matrix-head">${esc(u.name)}</div>`).join('')}`;
    const rows=lowers.map(([lk,l])=>`<div class="composer-matrix-rowhead"><b>${esc(l.name)}</b><small>${esc(l.subtitle||'')}</small></div>${uppers.map(([uk,u])=>`<a class="composer-matrix-cell ${ctx.lowerMode===lk&&ctx.upperMode===uk?'active':''}" href="${composeHref(ctx,{lower:lk,upper:uk})}"><span>${esc(l.name)}</span><i>×</i><b>${esc(u.name)}</b></a>`).join('')}`).join('');
    return `<div class="composer-matrix" aria-label="5 × 4 主模式矩阵">${head}${rows}</div>`;
  }
  function composerMobileSelectors(ctx){
    const cfg=D().composer||{};
    const options=(obj,current)=>Object.entries(obj).map(([k,v])=>`<option value="${esc(k)}" ${k===current?'selected':''}>${esc(v.name)}</option>`).join('');
    return `<div class="composer-mobile-selectors"><label>② 选下肢模式<select data-compose-query="lower">${options(cfg.lowerModes||{},ctx.lowerMode)}</select></label><label>③ 选上肢模式<select data-compose-query="upper">${options(cfg.upperModes||{},ctx.upperMode)}</select></label></div>`;
  }
  function windowText(slotKey,resolved){
    if(slotKey==='A'||slotKey==='B'){const w=resolved.windows.main;return `推荐 ${w.recommended}｜常规 ${(w.normal||[]).join('–')}${(w.expanded||[]).length?`｜可退阶 ${(w.expanded||[]).join(' / ')}`:''}`;}
    if(slotKey==='C'){const w=resolved.windows.support;return `推荐 ${w.recommended}｜常规 ${(w.normal||[]).join('–')}${(w.expanded||[]).length?`｜扩展 ${(w.expanded||[]).join(' / ')}`:''}`;}
    if(slotKey==='CORE'){const w=resolved.windows.core;return `推荐 ${(w.recommended||[]).join(' / ')}｜常规 ${(w.normal||[]).join('–')}`;}
    return '系统按主项互补、动作暴露和场馆路由推荐';
  }
  function composerSlotCard(ctx,slot){
    const data=D(),opts=ctx.resolved.slotOptions[slot.slotKey]||[],a=data.actions[slot.actionId]||{};
    const optionHtml=opts.map(o=>{const grade=o.tier||o.grade||'';return `<option value="${esc(o.id)}" ${o.id===slot.actionId?'selected':''}>${esc([grade,o.name].filter(Boolean).join('｜'))}</option>`;}).join('');
    const grade=slot.tier||slot.grade||'';
    const detailRoute=a.isSupport?`#/system/support?focus=${encodeURIComponent(slot.actionId)}`:a.isCore?`#/system/core?focus=${encodeURIComponent(slot.actionId)}`:`#/library?focus=${encodeURIComponent(slot.actionId)}`;
    const tierNote=slot.tierNote?`<small class="composer-tier-note">${esc(slot.tierNote)}</small>`:'';
    const rx=slot.prescriptionOverride?`<small class="composer-rx-note">高阶处方：${esc(slot.prescriptionOverride)}</small>`:'';
    return `<article class="composer-slot-card"><div class="composer-slot-head"><span>${esc(slot.slotName)}</span><b>${esc(grade||'辅助')}</b></div><h3>${esc(slot.name||'暂无候选')}</h3><p>${esc(windowText(slot.slotKey,ctx.resolved))}</p>${rx}${tierNote}<div class="composer-slot-actions"><a href="${detailRoute}">查看动作</a><select class="composer-slot-select" data-composer-key="${esc(ctx.stateKey)}" data-slot-key="${esc(slot.slotKey)}">${optionHtml}</select></div></article>`;
  }
  function composerPrepItems(ctx){
    const data=D(),main=ctx.resolved.slots.filter(x=>['A','B'].includes(x.slotKey)).map(x=>x.actionId).filter(Boolean),tier=ctx.resolved.windows.main.recommended;
    return (window.V14Anatomy?.rankWarmups(main,{level:ctx.level,tier,limit:6})||[]).map(id=>data.warmupDetails[id]).filter(Boolean);
  }
  function composerFoamItems(ctx){
    const data=D(),ids=ctx.resolved.slots.filter(x=>['A','B','D1','D2'].includes(x.slotKey)).map(x=>x.actionId).filter(Boolean);
    return (window.V14Anatomy?.rankFoam(ids,{limit:4})||[]).map(id=>data.foamRollDetails[id]).filter(Boolean);
  }
  function composerPrepHtml(ctx){
    const items=composerPrepItems(ctx),foam=composerFoamItems(ctx),title=`${ctx.resolved.lower.name} + ${ctx.resolved.upper.name} · ${ctx.level}`;
    const warmCards=items.map(w=>`<a class="session-warmup-card" href="#/system/prep?focus=${encodeURIComponent(w.prepId)}"><div><span>${esc(w.prepGrade)}</span><small>${esc(w.role)}</small></div><b>${esc(w.name)}</b><p>${esc(w.prescription)}</p></a>`).join('');
    const foamCards=foam.map(f=>`<a class="session-foam-card" href="#/system/prep?foam=${encodeURIComponent(f.foamId)}"><div><span>ROLL</span><small>${esc((f.muscles||[]).join(' · '))}</small></div><b>${esc(f.name)}</b><p>${esc(f.prescription)}</p></a>`).join('');
    let warmCopy='',foamCopy='';
    if(window.V14ModuleCopy){const wk=`composer-prep-${ctx.stateKey}`,fk=`composer-foam-${ctx.stateKey}`;window.V14ModuleCopy.register(wk,'prep',{title:`自由组合 PREP｜${title}`,items:items.map(w=>({name:w.name,grade:w.prepGrade,prescription:w.prescription,why:w.why}))});window.V14ModuleCopy.register(fk,'foam',{title:`自由组合泡沫轴｜${title}`,items:foam.map(f=>({name:f.name,prescription:f.prescription,safety:f.safety}))});warmCopy=window.V14ModuleCopy.button(wk,'复制本模块');foamCopy=window.V14ModuleCopy.button(fk,'复制本模块');}
    return `<section class="section-card"><div class="section-head"><div><h2>2F｜PREP</h2><p>根据当前实际 A / B anatomy 自动匹配，不因 Session Level 机械提高热身难度。</p></div><span class="time-badge">约 10–12 分钟</span></div><div class="session-prep-match session-foam-match"><div class="prep-match-head"><div><b>泡沫轴推荐</b><span>${esc(title)}</span></div><div class="prep-match-head-actions">${foamCopy}</div></div><div class="session-foam-grid">${foamCards}</div></div><div class="session-prep-match"><div class="prep-match-head"><div><b>动态热身 / 激活</b><span>${esc(title)}</span></div><div class="prep-match-head-actions">${warmCopy}</div></div><div class="session-warmup-grid">${warmCards}</div></div></section>`;
  }
  function composerRecovery(ctx){return D().sessionViews?.[`F111-01-${ctx.level}`]||{};}
  function buildComposerCopyPayload(ctx){
    const data=D(),ids=ctx.resolved.slots.map(x=>x.actionId).filter(Boolean),summary=window.V14Anatomy?.aggregate(ids)||{primary:[],secondary:[],stabilizers:[]},result=window.V14Conflict.evaluateComposer(ctx.resolved),view=composerRecovery(ctx);
    return {brand:'7Fit',sessionTitle:`自由组合｜${ctx.resolved.lower.name} + ${ctx.resolved.upper.name}`,recipeName:`${ctx.resolved.lower.name} + ${ctx.resolved.upper.name}`,level:ctx.level,summary:'F111 自由组合｜一下肢 + 一上肢 + 一支撑',foam:composerFoamItems(ctx).map(x=>({name:x.name,prescription:x.prescription})),warmups:composerPrepItems(ctx).map(x=>({name:x.name,prescription:x.prescription})),slots:ctx.resolved.slots.map(x=>({slot:x.slotName,name:x.name,tier:x.tier,grade:x.grade,prescription:x.prescriptionOverride||window.V14ModuleCopy?.prescriptionForAction?.(x.actionId,{level:ctx.level})||''})),muscles:{primary:summary.primary.slice(0,6),secondary:summary.secondary.slice(0,6),stabilizers:summary.stabilizers.slice(0,6)},recovery:(view.recovery||[]).map(x=>x.actions?.[0]?.name||x.text).filter(Boolean),postCardio:view.postCardio||'',conflicts:(result.issues||[]).map(x=>`${x.title}：${x.text}`)};
  }
  function composer(route){
    const ctx=composerContext(route),cfg=D().composer||{},result=window.V14Conflict.evaluateComposer(ctx.resolved),allIds=ctx.resolved.slots.map(x=>x.actionId).filter(Boolean);
    const demands=Object.entries(cfg.coreDemands||{}).map(([k,v])=>`<a class="${ctx.coreDemand===k?'active':''}" href="${composeHref(ctx,{core:k})}">${esc(v.name)}</a>`).join('');
    const mainExpand=ctx.resolved.windows.main.expanded?.length?`<a class="composer-expand-link" href="${composeHref(ctx,{em:ctx.includeExpandedMain?null:'1'})}">${ctx.includeExpandedMain?'收起额外退阶':'展开额外退阶'}</a>`:'';
    const supportExpand=ctx.resolved.windows.support.expanded?.length?`<a class="composer-expand-link" href="${composeHref(ctx,{es:ctx.includeExpandedSupport?null:'1'})}">${ctx.includeExpandedSupport?'收起支撑扩展':'查看支撑扩展 '+ctx.resolved.windows.support.expanded.join(' / ')}</a>`:'';
    const coreExpand=ctx.resolved.windows.core.expanded?.length?`<a class="composer-expand-link" href="${composeHref(ctx,{ec:ctx.includeExpandedCore?null:'1'})}">${ctx.includeExpandedCore?'收起核心退阶':'查看更多核心退阶'}</a>`:'';
    const view=composerRecovery(ctx),recovery=(view.recovery||[]).map(x=>`<div class="flow-item"><b>${esc(x.actions?.[0]?.name||'恢复')}</b><span>${esc(x.text)}</span></div>`).join('');
    return coachModeSwitch('compose')+hero('自由组合编课','5 × 4 主模式矩阵：下肢推 / 下肢拉 / 臀伸 / 单腿蹲 / 单腿拉 × 水平拉 / 垂直拉 / 水平推 / 垂直推。Session L 决定推荐窗口，不把 T / S / CORE-L 机械锁死。',[ctx.level,'20 种基础组合','动态 D1 / D2','实时 Anatomy / Conflict'])+
      `<section class="section-card composer-builder"><div class="section-head"><div><h2>① 选择 Session Level</h2><p>先确定整节课阶段，再由系统给各模块不同的 Tier / Grade 候选窗口。</p></div></div>${composerLevelSwitch(ctx)}<div class="composer-builder-head"><div><h2>②–③ 选择主模式</h2><p>桌面端直接点击 5 × 4 主模式矩阵；手机端按下肢 → 上肢顺序选择。</p></div>${mainExpand}</div>${composerMatrix(ctx)}${composerMobileSelectors(ctx)}<div class="composer-current"><small>当前组合</small><b>${esc(ctx.level)}｜${esc(ctx.resolved.lower.name)} + ${esc(ctx.resolved.upper.name)}</b><span>${esc(ctx.resolved.compositionId)}</span></div></section>`+
      composerPrepHtml(ctx)+
      `<section class="section-card strength-card"><div class="section-head"><div><h2>1F｜STRENGTH</h2><p>A / B 选择主模式；C 使用独立 SUPPORT Grade；D1 / D2 自动补足；CORE 先选 Demand 再筛 Grade。</p></div><span class="time-badge">约 40–43 分钟</span></div>${muscleSummaryHtml(allIds)}${conflictHtml(result)}<div class="composer-subhead"><div><b>CORE Demand</b><span>先选功能，再选难度。</span></div><div class="core-demand-row">${demands}</div></div><div class="composer-window-actions">${supportExpand}${coreExpand}</div><div class="composer-slot-grid">${ctx.resolved.slots.map(x=>composerSlotCard(ctx,x)).join('')}</div><div class="session-toolbar composer-copy-toolbar"><div></div><div class="session-toolbar-actions">${copyToolbar()}<button id="reset-composer" type="button">恢复系统推荐</button></div></div></section>`+
      `<section class="section-card"><div class="section-head"><div><h2>2F｜RECOVERY</h2><p>力量部分结束后一次上楼完成恢复。</p></div><span class="time-badge">约 5–8 分钟</span></div><div class="flow-grid recovery-grid">${recovery}</div></section><section class="post-cardio-note"><b>POST CARDIO ONLY</b><span>${esc(view.postCardio||'课后有氧独立执行。')}</span></section>`;
  }
  function render(route){if(route.page==='compose')return composer(route);return route.recipeId?session(route):home();}
  function bind(route){
    if(route.page==='compose'){
      const rerender=()=>{const current=window.V14Router.parseHash(location.hash);document.getElementById('app-main').innerHTML=render(current);bind(current);if(window.V14ModuleCopy?.bind)window.V14ModuleCopy.bind(document.getElementById('app-main'));};
      const ctx=composerContext(route);
      document.querySelectorAll('.composer-slot-select').forEach(sel=>sel.addEventListener('change',()=>{window.V14State.setComposerSelection(sel.dataset.composerKey,sel.dataset.slotKey,sel.value);rerender();}));
      document.querySelectorAll('[data-compose-query]').forEach(sel=>sel.addEventListener('change',()=>{const key=sel.dataset.composeQuery;location.hash=composeHref(ctx,{[key]:sel.value});}));
      const status=document.getElementById('copy-session-status');
      const doCopy=async audience=>{const payload=buildComposerCopyPayload(composerContext(window.V14Router.parseHash(location.hash))),formatter=audience==='coach'?window.V14SessionCopy?.formatCoach:window.V14SessionCopy?.formatMember;if(typeof formatter!=='function')return;try{await window.V14SessionCopy.copyText(formatter(payload));if(status){status.textContent='已复制，可直接发送';status.className='success';}}catch(_){if(status){status.textContent='复制失败，请手动选择内容复制';status.className='error';}}};
      document.getElementById('copy-coach-session')?.addEventListener('click',()=>doCopy('coach'));document.getElementById('copy-member-session')?.addEventListener('click',()=>doCopy('member'));
      document.getElementById('reset-composer')?.addEventListener('click',()=>{window.V14State.resetComposer(ctx.stateKey);rerender();});
      return;
    }
    if(!route.recipeId)return;
    const sessionId=`${route.recipeId}-${route.level}`;
    document.querySelectorAll('.session-swap').forEach(sel=>sel.addEventListener('change',()=>{
      window.V14State.setSelection(sel.dataset.session,sel.dataset.slotKey,sel.value);
      const current=window.V14Router.parseHash(location.hash);
      document.getElementById('app-main').innerHTML=render(current);bind(current);
    }));
    const status=document.getElementById('copy-session-status');
    const doCopy=async audience=>{
      const payload=buildCopyPayload(sessionId,route.recipeId,route.level);
      const formatter=audience==='coach'?window.V14SessionCopy?.formatCoach:window.V14SessionCopy?.formatMember;
      if(typeof formatter!=='function'||typeof window.V14SessionCopy?.copyText!=='function')return;
      try{
        await window.V14SessionCopy.copyText(formatter(payload));
        if(status){status.textContent='已复制，可直接发送';status.className='success';setTimeout(()=>{if(status.textContent==='已复制，可直接发送'){status.textContent='';status.className='';}},1800);}
      }catch(_){if(status){status.textContent='复制失败，请手动选择内容复制';status.className='error';}}
    };
    const coachCopy=document.getElementById('copy-coach-session');if(coachCopy)coachCopy.addEventListener('click',()=>doCopy('coach'));
    const memberCopy=document.getElementById('copy-member-session');if(memberCopy)memberCopy.addEventListener('click',()=>doCopy('member'));
    const reset=document.getElementById('reset-session');if(reset)reset.addEventListener('click',()=>{window.V14State.resetSession(sessionId);const current=window.V14Router.parseHash(location.hash);document.getElementById('app-main').innerHTML=render(current);bind(current);});
  }
  window.V14CoachAnatomy={selectedTrainingIds,buildCopyPayload,buildComposerCopyPayload,composerContext};
  window.V14Views=window.V14Views||{};window.V14Views.coach=render;
  window.V14Bind=window.V14Bind||{};window.V14Bind.coach=bind;
})();
