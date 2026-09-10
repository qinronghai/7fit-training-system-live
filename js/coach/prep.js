(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
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
  function warmupCards(recipeId,level,mainActionIds){
    const data=D(),recipe=data.recipes[recipeId]||{},tier=`T${level.slice(-1)}`,items=matchedWarmups(recipeId,level,mainActionIds);
    const cards=items.map(w=>`<a class="session-warmup-card" href="#/system/prep?focus=${encodeURIComponent(w.prepId)}"><div><span>${esc(w.prepGrade)}</span><small>${esc(w.role)}</small></div><b>${esc(w.name)}</b><p>${esc(w.prescription)}</p></a>`).join('');
    const key=`coach-prep-${recipeId}-${level}`;
    const copy=window.V14ModuleCopy?(window.V14ModuleCopy.register(key,'prep',{title:`当前课程 PREP｜${recipe.name} · ${level}`,items:items.map(w=>({name:w.name,grade:w.prepGrade,prescription:w.prescription,why:w.why}))}),window.V14ModuleCopy.button(key,'复制本模块')):'';
    return `<div class="session-prep-match"><div class="prep-match-head"><div><b>当前课程热身匹配</b><span>${esc(recipe.lower)} + ${esc(recipe.upper)} · ${esc(level)} / ${esc(tier)}</span></div><div class="prep-match-head-actions"><div class="prep-match-links"><a href="#/system/prep?pattern=${encodeURIComponent(recipe.lower)}&level=${encodeURIComponent(level)}&tier=${encodeURIComponent(tier)}">下肢匹配器</a><a href="#/system/prep?pattern=${encodeURIComponent(recipe.upper)}&level=${encodeURIComponent(level)}&tier=${encodeURIComponent(tier)}">上肢匹配器</a></div>${copy}</div></div><div class="session-warmup-grid">${cards}</div></div>`;
  }
  function composerPrepItems(ctx){
    const data=D(),main=ctx.resolved.slots.filter(x=>['A','B'].includes(x.slotKey)).map(x=>x.actionId).filter(Boolean),tier=ctx.resolved.windows.main.recommended;
    return (window.V14Anatomy?.rankWarmups(main,{level:ctx.level,tier,limit:6})||[]).map(id=>data.warmupDetails[id]).filter(Boolean);
  }
  function composerPrepHtml(ctx){
    const items=composerPrepItems(ctx),foam=M.Foam.composerFoamItems(ctx),title=`${ctx.resolved.lower.name} + ${ctx.resolved.upper.name} · ${ctx.level}`;
    const warmCards=items.map(w=>`<a class="session-warmup-card" href="#/system/prep?focus=${encodeURIComponent(w.prepId)}"><div><span>${esc(w.prepGrade)}</span><small>${esc(w.role)}</small></div><b>${esc(w.name)}</b><p>${esc(w.prescription)}</p></a>`).join('');
    const foamCards=foam.map(f=>`<a class="session-foam-card" href="#/system/prep?foam=${encodeURIComponent(f.foamId)}"><div><span>ROLL</span><small>${esc((f.muscles||[]).join(' · '))}</small></div><b>${esc(f.name)}</b><p>${esc(f.prescription)}</p></a>`).join('');
    let warmCopy='',foamCopy='';
    if(window.V14ModuleCopy){const wk=`composer-prep-${ctx.stateKey}`,fk=`composer-foam-${ctx.stateKey}`;window.V14ModuleCopy.register(wk,'prep',{title:`自由组合 PREP｜${title}`,items:items.map(w=>({name:w.name,grade:w.prepGrade,prescription:w.prescription,why:w.why}))});window.V14ModuleCopy.register(fk,'foam',{title:`自由组合泡沫轴｜${title}`,items:foam.map(f=>({name:f.name,prescription:f.prescription,safety:f.safety}))});warmCopy=window.V14ModuleCopy.button(wk,'复制本模块');foamCopy=window.V14ModuleCopy.button(fk,'复制本模块');}
    return `<section class="section-card"><div class="section-head"><div><h2>2F｜PREP</h2><p>根据当前实际 A / B anatomy 自动匹配，不因 Session Level 机械提高热身难度。</p></div><span class="time-badge">约 10–12 分钟</span></div><div class="session-prep-match session-foam-match"><div class="prep-match-head"><div><b>泡沫轴推荐</b><span>${esc(title)}</span></div><div class="prep-match-head-actions">${foamCopy}</div></div><div class="session-foam-grid">${foamCards}</div></div><div class="session-prep-match"><div class="prep-match-head"><div><b>动态热身 / 激活</b><span>${esc(title)}</span></div><div class="prep-match-head-actions">${warmCopy}</div></div><div class="session-warmup-grid">${warmCards}</div></div></section>`;
  }
  M.Prep={matchedWarmups,warmupCards,composerPrepItems,composerPrepHtml};
})();