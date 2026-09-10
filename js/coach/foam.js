(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
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
  function composerFoamItems(ctx){
    const data=D(),ids=ctx.resolved.slots.filter(x=>['A','B','D1','D2'].includes(x.slotKey)).map(x=>x.actionId).filter(Boolean);
    return (window.V14Anatomy?.rankFoam(ids,{limit:4})||[]).map(id=>data.foamRollDetails[id]).filter(Boolean);
  }
  M.Foam={matchedFoamRolls,foamRollCards,composerFoamItems};
})();