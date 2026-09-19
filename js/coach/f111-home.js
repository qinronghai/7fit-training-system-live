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

  function legacyCards(){
    const data=D();
    return (data.recipeIds||[]).map(id=>{
      const r=data.recipes[id]||{};
      const levels=[1,2,3,4].map(n=>`<a href="#/coach/f111/${id.toLowerCase()}/l${n}">L${n}</a>`).join('');
      return `<article class="recipe-card"><div class="recipe-code">${esc(id)}</div><h3>${esc(r.name||id)}</h3><div class="recipe-tags"><span>${esc(r.lower||'')}</span><span>${esc(r.upper||'')}</span><span>${esc(r.support||'')}</span></div><div class="level-links">${levels}</div></article>`;
    }).join('');
  }

  function matrix(){
    const Browser=M.F111PresetBrowser;
    if(!Browser?.recipeRows)return '';
    const rows=Browser.recipeRows();
    const levelHeaders=Browser.LEVELS.map(level=>`
      <div class="f111-preset-level-head" role="columnheader">
        <b>${esc(level)}</b><small>${esc(LEVEL_META[level]||'')}</small>
      </div>`).join('');
    const body=rows.map(row=>{
      const states=row.states.map(state=>`
        <a class="f111-preset-cell"
           href="${esc(state.href)}"
           data-f111-preset-cell
           data-recipe-id="${esc(state.recipeId)}"
           data-level="${esc(state.level)}"
           role="gridcell"
           aria-label="${esc(`${state.recipeId} ${state.level} ${state.label}`)}">
          <span>${esc(state.level)}</span>
        </a>`).join('');
      return `<div class="f111-preset-matrix-row" role="row" data-f111-recipe-row="${esc(row.recipeId)}">
        <div class="f111-preset-recipe" role="rowheader">
          <span>${esc(row.recipeId)}</span>
          <strong>${esc(row.label)}</strong>
        </div>
        ${states}
      </div>`;
    }).join('');
    return `<div class="f111-preset-matrix-shell" data-f111-preset-matrix-shell>
      <div class="f111-preset-matrix" role="grid" aria-label="F111 32 套推荐预设">
        <div class="f111-preset-matrix-row f111-preset-matrix-head" role="row">
          <div class="f111-preset-recipe-head" role="columnheader"><b>Recipe Family</b><small>动作模式组合</small></div>
          ${levelHeaders}
        </div>
        ${body}
      </div>
    </div>`;
  }

  function render(){
    const Browser=M.F111PresetBrowser;
    const total=Browser?.buildIndex?.().length||32;
    return modeSwitch()+homeHero()+
      `<section class="section-card f111-preset-browser-section" data-f111-preset-browser>
        <div class="section-head f111-preset-browser-head">
          <div><h2>7Fit 推荐预设</h2><p>8 个 Recipe Family × 4 个等级，共 ${esc(total)} 套标准课程。桌面端用矩阵快速定位；手机端使用紧凑列表浏览。</p></div>
          <div class="f111-preset-head-actions"><span class="f111-preset-count">${esc(total)} 套预设</span><a class="section-action-link" href="#/coach/f111/compose">进入自由组合编课 →</a></div>
        </div>
        ${matrix()}
        <div class="recipe-grid f111-preset-mobile-fallback" data-f111-mobile-fallback>${legacyCards()}</div>
      </section>`;
  }

  M.F111Home={render};
})();
