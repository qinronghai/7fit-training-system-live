(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const CAPABILITY_LABELS={preset:'推荐预设',composer:'自由编课',prep:'PREP 热身',anatomy:'动作解剖',copy:'课程复制',save:'保存课程',volume:'训练量管理',conditioningMetrics:'体能指标'};
  function capabilityRows(record){
    return Object.entries(record.capabilities||{}).map(([key,enabled])=>`<div><small>${esc(CAPABILITY_LABELS[key]||key)}</small><b>${enabled?'已接入':'待接入'}</b></div>`).join('');
  }
  function render(templateId){
    const record=D().templateRegistry?.[templateId];
    if(!record)return '<section class="empty-state"><b>模板不存在</b><span>Training Template Registry 中没有这个模板。</span><a href="#/coach">返回编课中心</a></section>';
    const future=record.status==='FUTURE';
    return `<a class="back-link" href="#/coach">← 返回模板中心</a>`+
      `<section class="view-hero"><span class="eyebrow">COACH CENTER / ${esc(record.shortName)}</span><h1>${esc(record.name)}</h1><p>${esc(record.description)}</p><div class="chips"><span class="chip">${esc(record.levelSystem)}</span><span class="chip">${future?'FUTURE · 即将开放':'ACTIVE · 已启用'}</span></div></section>`+
      `<section class="section-card"><div class="section-head"><div><h2>${future?'未来模板规划':'模板基础设施'}</h2><p>${future?'当前只保留统一入口和 Registry 身份，不提前生成训练内容。':'当前已注册到统一 Coach Center；具体编排引擎将在对应模板任务中接入，不使用 F111 逻辑伪装。'}</p></div></div><div class="detail-facts">${capabilityRows(record)}</div></section>`;
  }
  M.TemplateHome={render};
})();
