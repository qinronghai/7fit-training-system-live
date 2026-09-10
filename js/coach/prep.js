(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const G=()=>window.V14PrepGrade||null;
  const R=()=>window.V14PrepResolver||null;
  const S=()=>window.V15State||null;
  const F111_RESOLVER_VERSION='f111-adapter-v1';

  function legacyMatchedWarmups(recipeId,level){
    const data=D(),gradeApi=G();
    const eligible=id=>{
      const w=data.warmupDetails?.[id];
      return !!w&&(gradeApi?gradeApi.isAllowed(level,w.prepGrade):w.sessionLevels?.includes(level));
    };
    const gradeFirst=ids=>ids.map((id,index)=>({id,index,w:data.warmupDetails?.[id]})).filter(x=>x.w&&eligible(x.id)).sort((a,b)=>(gradeApi?gradeApi.gradeRank(level,a.w.prepGrade)-gradeApi.gradeRank(level,b.w.prepGrade):0)||a.index-b.index||a.id.localeCompare(b.id)).map(x=>x.id);
    const choose=(ids,pattern,used)=>{
      for(const id of gradeFirst(ids)){
        const w=data.warmupDetails?.[id];
        if(w.targetPatterns.includes(pattern)&&!used.has(id)){used.add(id);return id;}
      }
      return null;
    };
    const recipe=data.recipes[recipeId]||{},used=new Set(),picked=[];
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
      const ordered=gradeApi?gradeApi.sortIds(fallback,level,data.warmupDetails):fallback.slice().sort();
      ordered.slice(0,4-picked.length).forEach(id=>picked.push(id));
    }
    return picked.map(id=>data.warmupDetails[id]).filter(Boolean);
  }

  function matchedWarmups(recipeId,level,mainActionIds){
    const data=D(),tier=`T${level.slice(-1)}`;
    const ranked=window.V14Anatomy?window.V14Anatomy.rankWarmups(mainActionIds,{recipeId,level,tier,limit:6}):[];
    if(ranked.length)return ranked.map(id=>data.warmupDetails[id]).filter(Boolean);
    return legacyMatchedWarmups(recipeId,level);
  }

  function presetMetadata(sessionId,recipeId,level){
    return {familyId:recipeId,level,resolverVersion:F111_RESOLVER_VERSION,input:{mode:'preset',recipeId,level,sessionId}};
  }

  function composerMetadata(ctx){
    return {
      familyId:ctx.resolved?.compositionId||String(ctx.stateKey||'').replace(/-L[1-4]$/,''),
      level:ctx.level,
      resolverVersion:F111_RESOLVER_VERSION,
      input:{
        mode:'composer',legacyCompositionKey:ctx.stateKey,level:ctx.level,
        lowerMode:ctx.lowerMode,upperMode:ctx.upperMode,coreDemand:ctx.coreDemand,
      },
    };
  }

  function ensureStateSession(sessionKey,metadata){
    const state=S();
    if(!state)throw new Error('V15State is unavailable');
    let current=state.getSession('f111',sessionKey);
    if(current&&current.resolverVersion!==F111_RESOLVER_VERSION){
      current=state.reconcileSession('f111',sessionKey,{resolverVersion:F111_RESOLVER_VERSION}).session;
    }
    return state.ensureSession('f111',sessionKey,metadata);
  }

  function reconcileResolved(sessionKey,context,metadata){
    const state=S(),resolver=R();
    if(!resolver)throw new Error('V14PrepResolver is unavailable');
    ensureStateSession(sessionKey,metadata);
    const saved=state.getPrepSelections('f111',sessionKey);
    let resolved=resolver.resolve(context,{selections:saved});
    const fallbackSlots=[],cleaned={...saved};
    for(const slot of resolved.slots){
      const entry=saved[slot.slotKey];
      if(!entry||entry.source!=='manual')continue;
      if(slot.source==='manual'&&slot.actionId===entry.actionId)continue;
      delete cleaned[slot.slotKey];
      fallbackSlots.push(slot.slotKey);
    }
    if(fallbackSlots.length){
      state.patchSession('f111',sessionKey,{prepSelections:cleaned});
      resolved=resolver.resolve(context,{selections:cleaned});
    }
    return {...resolved,fallbackSlots};
  }

  function presetContext(sessionId,recipeId,level,selectedIds=[]){
    const data=D(),session=data.sessions?.[sessionId];
    const ids=Array.isArray(selectedIds)&&selectedIds.length?selectedIds:(window.V14State?.getSessionSelections?.(sessionId)||[]);
    const formalActionIds=ids.filter(Boolean),mainActionIds=[];
    (session?.slots||[]).forEach((slot,index)=>{
      const key=String(slot.slotKey||'').includes('__')?String(slot.slotKey).split('__').pop():String(slot.slotName||'').split('｜')[0];
      if(['A','B'].includes(key)&&ids[index])mainActionIds.push(ids[index]);
    });
    return R().contextFromF111({level,recipeId,mainActionIds,formalActionIds});
  }

  function resolvePresetPrep(sessionId,recipeId,level,selectedIds=[]){
    return reconcileResolved(sessionId,presetContext(sessionId,recipeId,level,selectedIds),presetMetadata(sessionId,recipeId,level));
  }

  function composerContext(ctx){
    const slots=ctx.resolved?.slots||[],mainActionIds=slots.filter(x=>['A','B'].includes(x.slotKey)).map(x=>x.actionId).filter(Boolean),formalActionIds=slots.map(x=>x.actionId).filter(Boolean);
    return R().contextFromF111({
      level:ctx.level,recipeId:'',mainActionIds,formalActionIds,
      mainPatterns:[ctx.resolved?.lower?.name,ctx.resolved?.upper?.name].filter(Boolean),
    });
  }

  function resolveComposerPrep(ctx){
    if(!ctx?.stateKey)throw new Error('Composer PREP requires stateKey');
    return reconcileResolved(ctx.stateKey,composerContext(ctx),composerMetadata(ctx));
  }

  function setPrepSelection(sessionKey,slotKey,actionId){
    return S().setPrepSelection('f111',sessionKey,slotKey,actionId,'manual');
  }

  function sourceLabel(source){return source==='manual'?'手动选择':'系统推荐';}
  function slotOptions(slot){
    if(!slot.candidates?.length)return '<option value="">暂无合法候选</option>';
    return slot.candidates.map(candidate=>`<option value="${esc(candidate.actionId)}" ${candidate.actionId===slot.actionId?'selected':''}>${esc(candidate.prepGrade||'PREP')}｜${esc(candidate.name)}</option>`).join('');
  }

  function resolvedItems(resolved){
    return (resolved?.slots||[]).filter(slot=>slot.actionId).map(slot=>({
      slotKey:slot.slotKey,name:slot.name,grade:slot.prepGrade,prescription:slot.prescription,why:slot.why,source:slot.source,prepId:slot.prepId,actionId:slot.actionId,
    }));
  }

  function resolvedGrid(resolved,sessionKey){
    const fallback=(resolved.fallbackSlots||[]).length?`<div class="prep-fallback-notice">原热身选择已失效，已恢复系统推荐：${esc(resolved.fallbackSlots.join(' / '))}</div>`:'';
    const cards=(resolved.slots||[]).map(slot=>{
      const detail=slot.prepId?`<a href="#/system/prep?focus=${encodeURIComponent(slot.prepId)}">查看动作详情</a>`:'';
      return `<div class="session-warmup-card prep-slot-card" data-prep-slot-card="${esc(slot.slotKey)}"><div><span>${esc(slot.prepGrade||'—')}</span><small>${esc(slot.slotKey)} · ${esc(sourceLabel(slot.source))}</small></div><b>${esc(slot.name||'暂无合法候选')}</b><p>${esc(slot.purpose||'')}</p><div class="slot-actions"><select class="prep-slot-select" data-prep-session="${esc(sessionKey)}" data-prep-slot="${esc(slot.slotKey)}" ${slot.candidates?.length?'':'disabled'}>${slotOptions(slot)}</select>${detail}${slot.why?`<small>${esc(slot.why)}</small>`:''}</div></div>`;
    }).join('');
    return `${fallback}<div class="session-warmup-grid prep-slot-grid">${cards}</div>`;
  }

  function registerCopy(key,title,resolved){
    if(!window.V14ModuleCopy)return '';
    window.V14ModuleCopy.register(key,'prep',{title,items:resolvedItems(resolved)});
    return window.V14ModuleCopy.button(key,'复制本模块');
  }

  function warmupCards(recipeId,level,mainActionIds){
    const data=D(),sessionId=`${recipeId}-${level}`,selected=window.V14State?.getSessionSelections?.(sessionId)||[],resolved=resolvePresetPrep(sessionId,recipeId,level,selected),recipe=data.recipes[recipeId]||{},grades=G()?.allowedGrades(level)||[];
    const copy=registerCopy(`coach-prep-${recipeId}-${level}`,`当前课程 PREP｜${recipe.name} · ${level}`,resolved);
    return `<div class="session-prep-match"><div class="prep-match-head"><div><b>当前课程热身匹配</b><span>${esc(recipe.lower)} + ${esc(recipe.upper)} · ${esc(level)} · PREP ${esc(grades.join(' → ')||'—')} · 五功能槽位</span></div><div class="prep-match-head-actions"><div class="prep-match-links"><a href="#/system/prep?pattern=${encodeURIComponent(recipe.lower)}&level=${encodeURIComponent(level)}">下肢匹配器</a><a href="#/system/prep?pattern=${encodeURIComponent(recipe.upper)}&level=${encodeURIComponent(level)}">上肢匹配器</a></div>${copy}</div></div>${resolvedGrid(resolved,sessionId)}</div>`;
  }

  function composerPrepItems(ctx){
    const resolved=resolveComposerPrep(ctx),data=D();
    return resolvedItems(resolved).map(item=>data.warmupDetails?.[item.prepId]||item);
  }

  function composerPrepHtml(ctx){
    const resolved=resolveComposerPrep(ctx),foam=M.Foam.composerFoamItems(ctx),title=`${ctx.resolved.lower.name} + ${ctx.resolved.upper.name} · ${ctx.level}`,grades=G()?.allowedGrades(ctx.level)||[];
    const foamCards=foam.map(f=>`<a class="session-foam-card" href="#/system/prep?foam=${encodeURIComponent(f.foamId)}"><div><span>ROLL</span><small>${esc((f.muscles||[]).join(' · '))}</small></div><b>${esc(f.name)}</b><p>${esc(f.prescription)}</p></a>`).join('');
    let foamCopy='';
    if(window.V14ModuleCopy){const fk=`composer-foam-${ctx.stateKey}`;window.V14ModuleCopy.register(fk,'foam',{title:`自由组合泡沫轴｜${title}`,items:foam.map(f=>({name:f.name,prescription:f.prescription,safety:f.safety}))});foamCopy=window.V14ModuleCopy.button(fk,'复制本模块');}
    const warmCopy=registerCopy(`composer-prep-${ctx.stateKey}`,`自由组合 PREP｜${title}`,resolved);
    return `<section class="section-card"><div class="section-head"><div><h2>2F｜PREP</h2><p>五功能槽位由 PREP Resolver V2 统一计算；手动替换写入当前 F111 State，条件变化后仅保留仍合法的选择。</p></div><span class="time-badge">约 10–12 分钟</span></div><div class="session-prep-match session-foam-match"><div class="prep-match-head"><div><b>泡沫轴推荐</b><span>${esc(title)}</span></div><div class="prep-match-head-actions">${foamCopy}</div></div><div class="session-foam-grid">${foamCards}</div></div><div class="session-prep-match"><div class="prep-match-head"><div><b>动态热身 / 激活</b><span>${esc(title)} · PREP ${esc(grades.join(' → ')||'—')}</span></div><div class="prep-match-head-actions">${warmCopy}</div></div>${resolvedGrid(resolved,ctx.stateKey)}</div></section>`;
  }

  M.Prep={
    legacyMatchedWarmups,matchedWarmups,warmupCards,composerPrepItems,composerPrepHtml,
    resolvePresetPrep,resolveComposerPrep,setPrepSelection,resolvedItems,resolvedGrid,
  };
})();
