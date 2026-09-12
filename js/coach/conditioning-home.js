(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;

  const META=Object.freeze({
    'CON-01':Object.freeze({advantage:'节奏稳定、技术门槛低，适合建立持续输出能力。',boundary:'以稳态 / 基础间歇为主，不用复杂动作堆强度。'}),
    'CON-02':Object.freeze({advantage:'Work / Rest 清晰，便于控制强度与恢复质量。',boundary:'避免连续高疲劳、高冲击 Station 堆叠。'}),
    'CON-03':Object.freeze({advantage:'多 Modality 组合，训练全身工作容量与节奏切换。',boundary:'Circuit / Density 必须保留站点多样性和转换时间。'}),
    'CON-04':Object.freeze({advantage:'把爆发与功率动作放在疲劳前段，强调输出质量。',boundary:'不以疲劳状态下的高技术复杂动作为默认进阶。'}),
  });

  function protocolNames(family){
    const protocols=D().conditioningProtocols||{};
    return (family?.protocolEligibility||[]).map(id=>protocols[id]?.name||id);
  }

  function familyCard(familyId){
    const family=D().conditioningFamilies?.[familyId],meta=META[familyId]||{};
    if(!family)return '';
    const levels=['L1','L2','L3','L4']
      .map(level=>`<a href="#/coach/conditioning/${familyId.toLowerCase()}/${level.toLowerCase()}">${level}</a>`).join('');
    return `<article class="recipe-card conditioning-family-card" data-conditioning-family="${esc(familyId)}">
      <div class="recipe-code">${esc(familyId)}</div>
      <h3>${esc(family.name)}</h3>
      <div class="conditioning-family-copy">
        <div><small>目标</small><b>${esc(family.goal||'—')}</b></div>
        <div><small>优势</small><span>${esc(meta.advantage||'—')}</span></div>
        <div><small>使用边界</small><span>${esc(meta.boundary||'—')}</span></div>
      </div>
      <div class="recipe-tags">${protocolNames(family).map(name=>`<span>${esc(name)}</span>`).join('')}</div>
      <div class="level-links">${levels}</div>
    </article>`;
  }

  function render(){
    const cards=(D().conditioningFamilyIds||[]).map(familyCard).join('');
    return `<a class="back-link" href="#/coach">← 返回模板中心</a>`+
      `<section class="view-hero coach-home-hero conditioning-home-hero"><span class="eyebrow">COACH CENTER / CONDITIONING</span><h1>体能训练</h1><p class="coach-home-lead">围绕 Goal、Protocol、Work / Rest、Rounds、Station、RPE 与 Duration 组织完整 2F 体能私教课。</p><div class="chips"><span class="chip">4 个 Conditioning Family</span><span class="chip">4 个 Protocol</span><span class="chip">L1–L4</span><span class="chip">2F Workflow</span></div><div class="conditioning-home-actions"><a class="section-action-link" href="#/coach/conditioning/compose?family=CON-01&level=L1&protocol=STEADY">自由编课 →</a></div></section>`+
      `<section class="section-card"><div class="section-head"><div><h2>选择体能目标 / 等级</h2><p>先选择 Family 与 Level；正式 Session 的 Protocol、工作/休息结构、Station 数量与时长统一由 Conditioning Resolver 解析。</p></div></div><div class="recipe-grid conditioning-family-grid">${cards}</div></section>`;
  }

  M.ConditioningHome={render,META};
})();
