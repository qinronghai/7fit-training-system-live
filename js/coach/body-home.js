(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;

  function targetNames(ids){
    const catalog=D().bodyTargetCatalog||{};
    return (ids||[]).map(id=>catalog[id]?.name||id).filter(Boolean);
  }

  function familyCard(familyId){
    const family=D().bodyFamilies?.[familyId];
    if(!family)return '';
    const primary=targetNames(family.primaryTargets),secondary=targetNames(family.secondaryTargets);
    const levels=['L1','L2','L3','L4'].map(level=>`<a href="#/coach/body/${familyId.toLowerCase()}/${level.toLowerCase()}">${level}</a>`).join('');
    return `<article class="recipe-card body-family-card" data-body-family="${esc(familyId)}">
      <div class="recipe-code">${esc(familyId)}</div>
      <h3>${esc(family.name)}</h3>
      <div class="body-family-targets"><div><small>主要目标</small><b>${esc(primary.join(' · ')||'—')}</b></div><div><small>辅助目标</small><span>${esc(secondary.join(' · ')||'—')}</span></div></div>
      <div class="level-links">${levels}</div>
    </article>`;
  }

  function render(){
    const cards=(D().bodyFamilyIds||[]).map(familyCard).join('');
    return `<a class="back-link" href="#/coach">← 返回模板中心</a>`+
      `<section class="view-hero coach-home-hero body-home-hero"><span class="eyebrow">COACH CENTER / BODY</span><h1>健美式塑形</h1><p class="coach-home-lead">先选训练重点，再按主项 → 辅助 → 孤立组织有效工作组。</p><div class="chips"><span class="chip">4 个训练方向</span><span class="chip">L1–L4 分级</span><span class="chip">有效工作组</span><span class="chip">重复与疲劳检查</span></div><div class="body-home-actions"><a class="section-action-link" href="#/coach/body/compose?family=BODY-01&level=L1">自由编课 →</a></div></section>`+
      `<section class="section-card body-family-section"><div class="section-head"><div><span class="body-section-kicker">BODY FAMILIES</span><h2>选择训练方向与等级</h2><p>按当日主要刺激选择训练方向，再选择会员当前等级。系统自动安排主项、次主项、辅助与孤立训练。</p></div></div><div class="recipe-grid body-family-grid">${cards}</div></section>`;
  }

  M.BodyHome={render,targetNames};
})();
