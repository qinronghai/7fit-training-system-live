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
      `<section class="view-hero coach-home-hero body-home-hero"><span class="eyebrow">COACH CENTER / BODY</span><h1>健美式塑形</h1><p class="coach-home-lead">围绕目标肌群、动作角色与有效工作组组织训练。</p><div class="chips"><span class="chip">4 个训练 Family</span><span class="chip">L1–L4</span><span class="chip">Direct Work Sets</span><span class="chip">Body Conflict</span></div><div class="body-home-actions"><a class="section-action-link" href="#/coach/body/compose?family=BODY-01&level=L1">自由编课 →</a></div></section>`+
      `<section class="section-card"><div class="section-head"><div><h2>推荐 Family / Level</h2><p>先按训练重点选择 Family，再选择当前训练阶段。动作与训练量由 Body Resolver 统一解析。</p></div></div><div class="recipe-grid body-family-grid">${cards}</div></section>`;
  }

  M.BodyHome={render,targetNames};
})();
