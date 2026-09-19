(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const LEVEL_META=Object.freeze({
    L1:'动作控制',
    L2:'基础负重',
    L3:'负重进阶',
    L4:'完整能力',
  });

  function modeSwitch(){
    return '<nav class="coach-mode-switch"><a class="active" href="#/coach/f111">7Fit 推荐预设</a><a href="#/coach/f111/compose">自由组合编课</a></nav>';
  }

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

  function chip(group,value,label,active){
    return `<button type="button" class="f111-preset-filter-chip${active?' active':''}" data-f111-filter-group="${esc(group)}" data-f111-filter-value="${esc(value)}" aria-pressed="${active?'true':'false'}">${esc(label||value)}</button>`;
  }

  function recentSection(){
    const Controls=M.F111PresetControls,Browser=M.F111PresetBrowser;
    const recent=Controls?.recent?.(3)||[];
    const cards=recent.map(item=>{
      const state=Browser?.find?.(item.recipeId,item.level);
      if(!state)return '';
      return `<button type="button" class="f111-preset-recent-card" data-f111-recent data-recipe-id="${esc(item.recipeId)}" data-level="${esc(item.level)}">
        <span>${esc(item.recipeId)} · ${esc(item.level)}</span>
        <b>${esc(state.label)}</b>
      </button>`;
    }).join('');
    return `<div class="f111-preset-recent">
      <div class="f111-preset-tool-label"><b>最近使用</b><small>最近查看 / 开始的预设</small></div>
      <div class="f111-preset-recent-list">${cards||'<span class="f111-preset-recent-empty">查看预设后会出现在这里</span>'}</div>
    </div>`;
  }

  function controlsPanel(filteredCount,total){
    const Browser=M.F111PresetBrowser,Controls=M.F111PresetControls;
    if(!Browser||!Controls)return '';
    const state=Controls.snapshot(),facets=Browser.facetValues();
    const active=!!(state.q||state.level!=='ALL'||state.lower.length||state.upper.length||state.support.length);
    const levels=['ALL',...facets.levels].map(level=>chip('level',level,level==='ALL'?'全部':level,state.level===level)).join('');
    const group=(key,label,values)=>`<div class="f111-preset-filter-group"><span>${esc(label)}</span><div>${values.map(value=>chip(key,value,value,state[key].includes(value))).join('')}</div></div>`;
    return `<div class="f111-preset-tools" data-f111-preset-tools>
      <div class="f111-preset-search-row">
        <label class="f111-preset-search">
          <span>快速搜索</span>
          <input type="search" id="f111-preset-search" value="${esc(state.q)}" placeholder="搜索 F111-03 / L2 / 髋铰链 / 水平拉" autocomplete="off"/>
        </label>
        <button type="button" class="f111-preset-clear" data-f111-filter-clear ${active?'':'disabled'}>清除筛选</button>
      </div>
      ${recentSection()}
      <div class="f111-preset-filter-stack">
        <div class="f111-preset-filter-group"><span>等级</span><div>${levels}</div></div>
        ${group('lower','下肢',facets.lower)}
        ${group('upper','上肢',facets.upper)}
        ${group('support','支撑',facets.support)}
      </div>
      <div class="f111-preset-result-context" data-f111-result-count><b>${esc(Controls.summary(filteredCount,total))}</b><span>筛选只缩小预设范围，不会改变课程内容。</span></div>
    </div>`;
  }

  function matrix(filtered){
    const Browser=M.F111PresetBrowser;
    if(!Browser?.recipeRows)return '';
    const selectedKey=M.F111PresetDetail?.selected?.()?.key||'';
    const matchKeys=new Set(filtered.map(item=>item.key));
    const rows=Browser.recipeRows().filter(row=>row.states.some(state=>matchKeys.has(state.key)));
    if(!rows.length)return '';
    const levelHeaders=Browser.LEVELS.map(level=>`
      <div class="f111-preset-level-head" role="columnheader">
        <b>${esc(level)}</b><small>${esc(LEVEL_META[level]||'')}</small>
      </div>`).join('');
    const body=rows.map(row=>{
      const states=row.states.map(state=>{
        if(!matchKeys.has(state.key)){
          return `<span class="f111-preset-cell is-filtered-out" role="gridcell" aria-disabled="true" data-f111-filtered-cell><span>—</span></span>`;
        }
        return `<a class="f111-preset-cell${selectedKey===state.key?' is-selected':''}"
           href="${esc(state.href)}"
           data-f111-preset-cell
           data-recipe-id="${esc(state.recipeId)}"
           data-level="${esc(state.level)}"
           role="gridcell"
           aria-selected="${selectedKey===state.key?'true':'false'}"
           aria-label="${esc(`${state.recipeId} ${state.level} ${state.label}`)}">
          <span>${esc(state.level)}</span>
        </a>`;
      }).join('');
      return `<div class="f111-preset-matrix-row" role="row" data-f111-recipe-row="${esc(row.recipeId)}">
        <div class="f111-preset-recipe" role="rowheader">
          <span>${esc(row.recipeId)}</span>
          <strong>${esc(row.label)}</strong>
        </div>
        ${states}
      </div>`;
    }).join('');
    return `<div class="f111-preset-matrix-shell" data-f111-preset-matrix-shell>
      <div class="f111-preset-matrix" role="grid" aria-label="F111 推荐预设筛选结果">
        <div class="f111-preset-matrix-row f111-preset-matrix-head" role="row">
          <div class="f111-preset-recipe-head" role="columnheader"><b>Recipe Family</b><small>动作模式组合</small></div>
          ${levelHeaders}
        </div>
        ${body}
      </div>
    </div>`;
  }

  function mobileCards(filtered){
    const data=D(),byRecipe=new Map();
    filtered.forEach(state=>{
      if(!byRecipe.has(state.recipeId))byRecipe.set(state.recipeId,[]);
      byRecipe.get(state.recipeId).push(state);
    });
    return (data.recipeIds||[]).filter(id=>byRecipe.has(id)).map(id=>{
      const r=data.recipes[id]||{},states=byRecipe.get(id)||[];
      const levels=states.map(state=>`<a href="${esc(state.href)}">${esc(state.level)}</a>`).join('');
      return `<article class="recipe-card"><div class="recipe-code">${esc(id)}</div><h3>${esc(r.name||id)}</h3><div class="recipe-tags"><span>${esc(r.lower||'')}</span><span>${esc(r.upper||'')}</span><span>${esc(r.support||'')}</span></div><div class="level-links">${levels}</div></article>`;
    }).join('');
  }

  function emptyState(){
    return `<div class="f111-preset-empty" data-f111-preset-empty><b>没有符合当前条件的预设</b><p>可以减少筛选条件，或直接清除全部筛选。</p><button type="button" data-f111-filter-clear>清除筛选</button></div>`;
  }

  function render(){
    const Browser=M.F111PresetBrowser,Controls=M.F111PresetControls;
    const all=Browser?.buildIndex?.()||[];
    const filtered=Controls?.filter?.(all)||all;
    const total=all.length||32;
    return modeSwitch()+homeHero()+
      `<section class="section-card f111-preset-browser-section" data-f111-preset-browser>
        <div class="section-head f111-preset-browser-head">
          <div><h2>7Fit 推荐预设</h2><p>8 个 Recipe Family × 4 个等级，共 ${esc(total)} 套标准课程。按等级和动作模式快速缩小范围。</p></div>
          <div class="f111-preset-head-actions"><span class="f111-preset-count">${esc(filtered.length)} / ${esc(total)} 套</span><a class="section-action-link" href="#/coach/f111/compose">进入自由组合编课 →</a></div>
        </div>
        ${controlsPanel(filtered.length,total)}
        ${filtered.length?matrix(filtered):emptyState()}
        <div class="recipe-grid f111-preset-mobile-fallback" data-f111-mobile-fallback>${filtered.length?mobileCards(filtered):''}</div>
      </section>`;
  }

  function openPreset(recipeId,level,rerender){
    const detail=M.F111PresetDetail;
    if(!detail?.open)return false;
    return detail.open({recipeId,level,rerender});
  }

  function bind(root,rerender){
    const Controls=M.F111PresetControls;

    root?.querySelectorAll?.('[data-f111-preset-cell]').forEach(cell=>cell.addEventListener('click',event=>{
      if(!M.F111PresetDetail?.open)return;
      event.preventDefault();
      openPreset(cell.dataset.recipeId,cell.dataset.level,rerender);
    }));

    root?.querySelectorAll?.('[data-f111-recent]').forEach(button=>button.addEventListener('click',()=>{
      openPreset(button.dataset.recipeId,button.dataset.level,rerender);
    }));

    root?.querySelectorAll?.('[data-f111-filter-group]').forEach(button=>button.addEventListener('click',()=>{
      const group=button.dataset.f111FilterGroup,value=button.dataset.f111FilterValue;
      if(group==='level')Controls?.setLevel?.(value);else Controls?.toggle?.(group,value);
      rerender();
    }));

    root?.querySelectorAll?.('[data-f111-filter-clear]').forEach(button=>button.addEventListener('click',()=>{
      Controls?.clear?.();
      rerender();
    }));

    const search=root?.querySelector?.('#f111-preset-search');
    search?.addEventListener('input',()=>{
      const value=search.value,position=search.selectionStart??value.length;
      Controls?.setSearch?.(value);
      rerender();
      requestAnimationFrame(()=>{
        const next=document.getElementById('f111-preset-search');
        next?.focus();
        try{next?.setSelectionRange(position,position);}catch(_){}
      });
    });
  }

  M.F111Home={render,bind};
})();
