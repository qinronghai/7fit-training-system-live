(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const CAPABILITY_LABELS={
    preset:'推荐课程',composer:'自由编课',prep:'热身建议',anatomy:'肌群概览',
    copy:'复制课程',save:'保存课程',volume:'训练量',conditioningMetrics:'体能指标'
  };
  const HOME_TITLES={
    f111:'女性全身塑形',
    body:'健美式塑形训练',
    conditioning:'体能训练',
    hyrox:'HYROX 训练',
    posture:'体态评估与调整'
  };

  function capabilityChips(record){
    return Object.entries(record.capabilities||{})
      .filter(([,enabled])=>enabled)
      .map(([key])=>`<span>${esc(CAPABILITY_LABELS[key]||key)}</span>`)
      .join('');
  }

  function card(id){
    const record=D().templateRegistry?.[id];
    if(!record)return '';
    const future=record.status==='FUTURE',title=HOME_TITLES[id]||record.name;
    const status=future?'即将开放':'可使用';
    const action=future?'查看体态训练规划':'选择这个模板';
    return `<article class="recipe-card template-card${id==='f111'?' featured':''}${future?' future':''}" data-template-id="${esc(id)}">
      <div class="template-card-topline"><span class="recipe-code">${esc(record.shortName)}</span><span class="template-status ${future?'future':'active'}">${status}</span></div>
      <h3>${esc(title)}</h3>
      <p class="template-description">${esc(record.description)}</p>
      <div class="recipe-tags" aria-label="${esc(title)} 支持的功能">${capabilityChips(record)||'<span>即将开放</span>'}</div>
      <a class="template-entry" href="${esc(record.routeBase)}" aria-label="${future?'查看':'选择'}${esc(title)}">${action}<span aria-hidden="true">→</span></a>
    </article>`;
  }

  function render(){
    const data=D(),cards=(data.templateIds||[]).map(card).join('');
    const count=(data.templateIds||[]).length;
    return `<section class="view-hero coach-home-hero" aria-labelledby="coach-home-title">
      <div class="coach-home-hero-main">
        <span class="eyebrow">7FIT / 教练工作台</span>
        <h1 id="coach-home-title">选择模板，开始编课</h1>
        <p class="coach-home-lead">根据本次训练目标选择模板，安排动作并保存课程。</p>
        <a class="coach-home-action" href="#templates">查看训练模板 <span aria-hidden="true">↘</span></a>
      </div>
      <div class="coach-home-workflow" aria-label="编课步骤">
        <span class="workflow-label">编课步骤</span>
        <ol>
          <li><span>01</span><div><strong>选择模板</strong><small>根据训练目标选择合适的模板。</small></div></li>
          <li><span>02</span><div><strong>编排训练内容</strong><small>添加动作并安排训练顺序。</small></div></li>
          <li><span>03</span><div><strong>保存课程</strong><small>保存后可在下方查看本次编写的课程。</small></div></li>
        </ol>
      </div>
    </section>
    <section class="section-card coach-template-section" id="templates" aria-labelledby="coach-templates-title">
      <div class="section-head"><div><h2 id="coach-templates-title">选择训练模板</h2><p>按课程目标和训练方式选择模板。</p></div><span class="template-count">${count} 个模板</span></div>
      <div class="recipe-grid template-grid">${cards}</div>
    </section>
    <section class="coach-utilities" aria-labelledby="coach-utilities-title">
      <div class="section-head"><div><h2 id="coach-utilities-title">常用内容</h2><p>查找收藏的动作和训练组合，或查看已保存的课程。</p></div></div>
      <div class="coach-utility-grid">
        ${M.FavoritesUI?.section?.()||''}
        ${M.SavedSessionsUI?.librarySection?.()||''}
      </div>
    </section>`;
  }

  M.Home={render};
})();
