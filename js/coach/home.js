(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const CAPABILITY_LABELS={preset:'预设',composer:'自由编课',prep:'PREP',anatomy:'解剖',copy:'复制',save:'保存',volume:'训练量',conditioningMetrics:'体能指标'};
  function capabilityChips(record){
    return Object.entries(record.capabilities||{}).filter(([,enabled])=>enabled).map(([key])=>`<span>${esc(CAPABILITY_LABELS[key]||key)}</span>`).join('');
  }
  function card(id){
    const record=D().templateRegistry?.[id];
    if(!record)return '';
    const future=record.status==='FUTURE';
    return `<article class="recipe-card template-card" data-template-id="${esc(id)}">
      <div class="recipe-code">${esc(record.shortName)} · ${future?'即将开放':'已启用'}</div>
      <h3>${esc(record.name)}</h3>
      <p>${esc(record.description)}</p>
      <div class="recipe-tags">${capabilityChips(record)||'<span>规划中</span>'}</div>
      <div class="level-links"><a href="${esc(record.routeBase)}">${future?'查看规划':'进入模板'}</a></div>
    </article>`;
  }
  function render(){
    const data=D(),cards=(data.templateIds||[]).map(card).join('');
    return `<section class="view-hero coach-home-hero">
      <div class="coach-home-hero-main">
        <span class="eyebrow">7FIT / MULTI-TEMPLATE COACH CENTER</span>
        <h1>7Fit Coach Center</h1>
        <p class="coach-home-lead">从训练目标出发选择模板，再进入对应的编课引擎。</p>
        <div class="chips"><span class="chip">统一 PREP</span><span class="chip">统一动作库</span><span class="chip">统一解剖层</span><span class="chip">模板独立编排</span></div>
      </div>
    </section>`+
      `<section class="section-card"><div class="section-head"><div><h2>训练模板</h2><p>模板身份、状态、能力与入口全部来自 Training Template Registry；新增模板不再修改 Coach Center 的业务分支。</p></div></div><div class="recipe-grid template-grid">${cards}</div></section>`+
      (M.FavoritesUI?.section?.()||'')+
      (M.SavedSessionsUI?.librarySection?.()||'');
  }
  M.Home={render};
})();
