(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;

  function targetNames(ids){
    const catalog=D().bodyTargetCatalog||{};
    return (ids||[]).map(id=>catalog[id]?.name||id).filter(Boolean);
  }

  function roleNames(ids){
    const roles=D().bodyRoles||{};
    return (ids||[]).map(id=>roles[id]?.name||id).filter(Boolean);
  }

  function familyModes(familyId){
    return (D().bodyTrainingModeIds||[])
      .map(id=>D().bodyTrainingModes?.[id])
      .filter(mode=>mode?.familyIds?.includes(familyId));
  }

  function modeCard(modeId){
    const mode=D().bodyTrainingModes?.[modeId];
    if(!mode)return '';
    const targets=targetNames(mode.primaryTargets);
    const roles=roleNames(mode.roles);
    const familyNames=(mode.familyIds||[]).map(id=>D().bodyFamilies?.[id]?.name||id);
    return `<article class="body-mode-card" data-body-mode="${esc(modeId)}">
      <div class="body-mode-head"><span>${esc(modeId.replace('BODY-MODE-','MODE '))}</span><b>${esc(mode.name)}</b></div>
      <p>${esc(mode.description)}</p>
      <div class="body-mode-facts"><div><small>主要刺激</small><strong>${esc(targets.join(' · '))}</strong></div><div><small>常用职责</small><strong>${esc(roles.join(' · '))}</strong></div></div>
      <p class="body-mode-use"><b>适用：</b>${esc(mode.useCase)}</p>
      <small class="body-mode-library">动作库：${esc(mode.actionLibraryRule)}</small>
      <div class="body-mode-families">${familyNames.map(name=>`<span>${esc(name)}</span>`).join('')}</div>
    </article>`;
  }

  function familyCard(familyId){
    const family=D().bodyFamilies?.[familyId];
    if(!family)return '';
    const primary=targetNames(family.primaryTargets),secondary=targetNames(family.secondaryTargets);
    const modes=familyModes(familyId);
    return `<article class="recipe-card body-family-card" data-body-family="${esc(familyId)}">
      <div class="body-family-top"><div><span class="recipe-code">${esc(familyId)}</span><h3>${esc(family.name)}</h3></div><span class="body-family-count">${esc(modes.length)} 个训练模式</span></div>
      <div class="body-family-targets"><div><small>主要训练目标</small><b>${esc(primary.join(' · ')||'—')}</b></div><div><small>辅助与平衡</small><span>${esc(secondary.join(' · ')||'—')}</span></div></div>
      <div class="body-family-mode-tags">${modes.map(mode=>`<span>${esc(mode.name)}</span>`).join('')}</div>
      <a class="body-family-enter" href="#/coach/body/${familyId.toLowerCase()}">查看 ${esc(family.name)} →</a>
    </article>`;
  }

  function render(){
    const cards=(D().bodyFamilyIds||[]).map(familyCard).join('');
    const modes=(D().bodyTrainingModeIds||[]).map(modeCard).join('');
    return `<a class="back-link" href="#/coach">← 返回模板中心</a>
      <section class="view-hero coach-home-hero body-home-hero" data-body-home-hero>
        <span class="eyebrow">COACH CENTER / BODY</span>
        <h1>健美式塑形</h1>
        <p class="coach-home-lead">面向女性长期塑形的力量训练系统：用明确的主项、第二训练方向、辅助塑形与局部补充，围绕臀腿、背肩、胸臂建立可持续的有效工作组，而不是单纯追求疲劳或热量消耗。</p>
        <p class="body-home-principle">教练先选择本节训练 Family，再按会员当前能力进入 L1–L4。等级决定动作准入与训练能力，Resolver 决定合法动作，Compatibility Score 决定当前 Session 中更合适的候选。</p>
        <div class="chips"><span class="chip">4 个训练 Family</span><span class="chip">6 个正式训练模式</span><span class="chip">L1–L4 能力进阶</span><span class="chip">Coach-first Session</span></div>
        <div class="body-home-actions"><a class="body-home-primary-cta" href="#/coach/body/compose?family=BODY-01&level=L1">进入 Body 自由编课 →</a><span>适合需要直接切换 Family / Level 的教练</span></div>
      </section>
      <section class="section-card body-mode-section" data-body-mode-section><div class="section-head"><div><span class="eyebrow">TRAINING MODES</span><h2>6 个正式训练模式</h2><p>这是 Body 动作库在女性塑形中的六条主要训练路径；每个模式都绑定真实动作模式、目标肌群、槽位职责与可用 Family。</p></div></div><div class="body-mode-grid">${modes}</div></section>
      <section class="section-card body-family-section" data-body-family-section><div class="section-head"><div><span class="eyebrow">CHOOSE FAMILY</span><h2>先选择本节训练 Family</h2><p>Family 决定今天主要训练什么；L1–L4 放到下一页选择，避免首页同时承载两层决策。</p></div></div><div class="recipe-grid body-family-grid">${cards}</div></section>`;
  }

  function levelCard(familyId,level){
    const policy=D().bodyLevelPolicies?.[level]||{};
    const sets=policy.sessionWorkingSetRange||[];
    const rir=policy.rirRange||[];
    return `<a class="body-level-card" data-body-level="${esc(level)}" href="#/coach/body/${familyId.toLowerCase()}/${level.toLowerCase()}">
      <div class="body-level-top"><span>${esc(level)}</span><b>${esc(policy.name||level)}</b></div>
      <p>${esc(policy.abilityIntent||'')}</p>
      <div class="body-level-facts"><span>工作组 ${esc(sets.join('–')||'—')}</span><span>RIR ${esc(rir.join('–')||'—')}</span></div>
      <strong>进入 ${esc(level)} 课程 →</strong>
    </a>`;
  }

  function renderFamily(route={}){
    const familyId=String(route.familyId||'').toUpperCase();
    const family=D().bodyFamilies?.[familyId];
    if(!family)return '<section class="section-card"><h2>未找到该 Body Family</h2><a href="#/coach/body">返回 Body 首页</a></section>';
    const primary=targetNames(family.primaryTargets),secondary=targetNames(family.secondaryTargets);
    const modes=familyModes(familyId);
    const levels=['L1','L2','L3','L4'].map(level=>levelCard(familyId,level)).join('');
    return `<a class="back-link" href="#/coach/body">← 返回 Body 首页</a>
      <section class="view-hero body-family-hero" data-body-family-detail="${esc(familyId)}">
        <span class="eyebrow">BODY FAMILY / ${esc(familyId)}</span><h1>${esc(family.name)}</h1>
        <p>先确认今天的训练重点，再选择会员当前能力等级。进入等级后继续使用 #70 的 Coach-first Session、PREP、替换、风险与高级训练信息。</p>
        <div class="body-family-detail-targets"><div><small>主要训练目标</small><b>${esc(primary.join(' · '))}</b></div><div><small>辅助与平衡</small><b>${esc(secondary.join(' · ')||'—')}</b></div></div>
        <div class="body-family-mode-tags">${modes.map(mode=>`<span>${esc(mode.name)}</span>`).join('')}</div>
      </section>
      <section class="section-card body-level-section"><div class="section-head"><div><span class="eyebrow">CHOOSE LEVEL</span><h2>选择 L1–L4 训练阶段</h2><p>等级代表当前训练能力，不只是容量差异。旧的 16 个 Session 直达链接继续有效。</p></div></div><div class="body-level-grid">${levels}</div></section>
      <section class="body-family-compose-cta"><div><span>需要更快切换？</span><b>直接进入 Body 自由编课</b><p>保留当前 Family，从 L1 开始，可在 Composer 内继续切换 Family 与 Level。</p></div><a href="#/coach/body/compose?family=${encodeURIComponent(familyId)}&level=L1">进入自由编课 →</a></section>`;
  }

  M.BodyHome={render,renderFamily,targetNames,familyModes};
})();
