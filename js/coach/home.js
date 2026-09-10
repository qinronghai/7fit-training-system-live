(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D,coachModeSwitch}=C;
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
  function render(){
    const data=D();
    const cards=data.recipeIds.map(id=>{
      const r=data.recipes[id];
      const levels=[1,2,3,4].map(n=>`<a href="#/coach/${id.toLowerCase()}/l${n}">L${n}</a>`).join('');
      return `<article class="recipe-card"><div class="recipe-code">${id}</div><h3>${esc(r.name)}</h3><div class="recipe-tags"><span>${esc(r.lower)}</span><span>${esc(r.upper)}</span><span>${esc(r.support)}</span></div><div class="level-links">${levels}</div></article>`;
    }).join('');
    return coachModeSwitch('preset')+homeHero()+
      `<section class="section-card"><div class="section-head"><div><h2>7Fit 推荐预设</h2><p>保留原 8 个 Recipe Family 和 32 套 L1–L4 课程；新教练可直接使用，熟悉体系后可进入自由组合。</p></div><a class="section-action-link" href="#/coach/compose">进入自由组合编课 →</a></div><div class="recipe-grid">${cards}</div></section>`;
  }
  M.Home={render};
})();