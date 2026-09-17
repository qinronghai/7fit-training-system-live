(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const D=()=>window.V14_DATA;
  const A=()=>window.V14_ANATOMY||{meta:{phaseAExpected:0,phaseAIds:[]},records:{}};
  const CHANGELOG=()=>Array.isArray(window.V14_CHANGELOG)?window.V14_CHANGELOG:[];
  function tabs(active){return `<nav class="subnav"><a class="${active==='home'?'active':''}" href="#/maintenance">数据健康度</a><a class="${active==='audit'?'active':''}" href="#/maintenance/audit">同步审计</a><a class="${active==='venue'?'active':''}" href="#/maintenance/venue">Venue Truth</a></nav>`;}
  function hero(title,body){return `<section class="view-hero compact system-hero"><span class="eyebrow">SYSTEM MAINTENANCE</span><h1>${esc(title)}</h1><p>${esc(body)}</p></section>`;}
  function kpi(value,label,note=''){return `<article class="health-kpi"><b>${esc(value)}</b><span>${esc(label)}</span><small>${esc(note)}</small></article>`;}
  function changeTypeClass(type){return {'功能':'feature','修复':'fix','规则':'rule','数据':'data','架构':'arch','体验':'ux','部署':'deploy'}[type]||'other';}
  function changelogPanel(){
    const items=[...CHANGELOG()].sort((a,b)=>
      `${b.date} ${b.time||''}`.localeCompare(`${a.date} ${a.time||''}`));
    if(!items.length)return '';
    const dates=[...new Set(items.map(item=>item.date))];
    const groups=dates.map((date,index)=>{
      const dayItems=items.filter(item=>item.date===date);
      const rows=dayItems.map(item=>{
        const issue=item.issue?'<span>#'+esc(item.issue)+'</span>':'';
        const commit=item.commit?'<span>'+esc(item.commit)+'</span>':'';
        return '<article class="change-row" data-change-log><time>'+esc(item.time||'')+'</time><span class="change-type '+changeTypeClass(item.type)+'">'+esc(item.type||'更新')+'</span><div class="change-copy"><div class="change-title"><b>'+esc(item.title)+'</b><span>'+esc(item.area||'系统')+'</span></div><p>'+esc(item.detail||'')+'</p></div><div class="change-meta">'+issue+commit+'</div></article>';
      }).join('');
      const head='<div class="change-day-head"><b>'+esc(date)+'</b><span>'+(index===0?'最新':'历史')+' · '+dayItems.length+' 条</span></div>';
      if(index===0)return '<div class="change-day current">'+head+'<div class="change-rows">'+rows+'</div></div>';
      return '<details class="change-day"><summary>'+head+'</summary><div class="change-rows">'+rows+'</div></details>';
    }).join('');
    return '<section class="section-card change-log-card"><div class="section-head"><div><h2>网站变更记录</h2><p>按日期记录网站功能、规则、数据、修复与部署变化；最新记录置顶，历史日期默认收起。</p></div><span class="time-badge">最近 '+items.length+' 条</span></div><div class="change-log-list">'+groups+'</div></section>';
  }
  function anatomyCoverage(){
    const d=D(),a=A(),records=a.records||{},meta=a.meta||{};
    const phaseAIds=meta.phaseAIds||[],phaseBIds=meta.phaseBIds||[],phaseCIds=meta.phaseCIds||[];
    const phase=(ids)=>({expected:ids.length,covered:ids.filter(id=>records[id]).length,missing:ids.filter(id=>!records[id])});
    const phaseA=phase(phaseAIds),phaseB=phase(phaseBIds),phaseC=phase(phaseCIds);
    const runtimeIds=Object.keys(d.actions||{}),runtimeCovered=runtimeIds.filter(id=>records[id]).length;
    const confidence={high:0,medium:0,review:0};
    Object.values(records).forEach(r=>{if(confidence[r.confidence]!==undefined)confidence[r.confidence]++;});
    const uncoveredRuntime=runtimeIds.filter(id=>!records[id]);
    const reviewIds=runtimeIds.filter(id=>records[id]?.confidence==='review');
    return {runtimeExpected:runtimeIds.length,runtimeCovered,phaseA,phaseB,phaseC,confidence,uncoveredRuntime,reviewIds,records};
  }
  function anatomyPanel(){
    const d=D(),c=anatomyCoverage();
    const missing=[...c.phaseA.missing,...c.phaseB.missing,...c.phaseC.missing].map(id=>`<li><b>${esc(d.actions[id]?.name||id)}</b><span>${esc(id)}</span></li>`).join('');
    const uncovered=c.uncoveredRuntime.map(id=>`<li><b>${esc(d.actions[id]?.name||id)}</b><span>${esc(id)}</span></li>`).join('');
    const reviews=c.reviewIds.map(id=>`<article><b>${esc(d.actions[id]?.name||id)}</b><span>${esc(id)}</span><p>${esc(c.records[id]?.sourceNote||'')}</p></article>`).join('');
    return `<section class="section-card anatomy-coverage-card"><div class="section-head"><div><h2>Runtime Anatomy</h2><p>Anatomy Coverage：V14.6 已把 Phase A / B / C 合并为完整运行时解剖基线；REVIEW 节点保留人工复核状态，但不等于缺失。</p></div><span class="time-badge">${c.runtimeCovered}/${c.runtimeExpected}</span></div><div class="anatomy-coverage-stats">${kpi(c.runtimeCovered+'/'+c.runtimeExpected,'Runtime Anatomy','全部运行节点')}${kpi(c.phaseA.covered+'/'+c.phaseA.expected,'Phase A','核心运行节点')}${kpi(c.phaseB.covered+'/'+c.phaseB.expected,'Phase B','低频力量 / 激活 / 热身')}${kpi(c.phaseC.covered+'/'+c.phaseC.expected,'Phase C','体能 / 恢复 / 拉伸')}${kpi(c.confidence.high,'HIGH','高可信')}${kpi(c.confidence.medium,'MEDIUM','执行细节会影响参与比例')}${kpi(c.confidence.review,'REVIEW','不进入精准肌群集中 WARN')}</div><div class="maintenance-list"><details ${missing?'open':''}><summary><b>Phase A/B/C 缺失</b><span>${c.phaseA.missing.length+c.phaseB.missing.length+c.phaseC.missing.length}</span></summary><ul class="anatomy-id-list">${missing||'<li><b>0</b><span>Phase A / B / C 全部完整</span></li>'}</ul></details><details><summary><b>未覆盖运行节点</b><span>${c.uncoveredRuntime.length}</span></summary><ul class="anatomy-id-list">${uncovered||'<li><b>0</b><span>全部 ${c.runtimeExpected} 个运行节点已有 anatomy</span></li>'}</ul></details><details><summary><b>REVIEW 待动作视频复核</b><span>${c.reviewIds.length}</span></summary><div class="overlay-grid">${reviews||'<p class="muted-copy">当前无 REVIEW 节点。</p>'}</div></details></div></section>`;
  }
  function reviewRows(filters={},limit=80){
    const api=window.V14ContentReview;
    if(!api)return '<div data-content-review-empty class="content-review-empty">Review 服务尚未加载。</div>';
    const rows=api.list(filters),visible=rows.slice(0,limit),statusLabels=api.labels.status,evidenceLabels=api.labels.evidence;
    if(!visible.length)return '<div data-content-review-empty class="content-review-empty">没有符合条件的内容，请放宽筛选条件。</div>';
    const cards=visible.map(row=>`<article class="content-review-row" data-content-review-row data-domain="${esc(row.domain)}" data-status="${esc(row.metadata.reviewStatus||'')}" data-evidence-level="${esc(row.metadata.evidenceLevel||'')}"><div class="content-review-title"><b>${esc(row.title)}</b><small>${esc(row.id)}</small></div><span class="content-review-domain">${esc(row.domainLabel)}</span><span class="content-review-status">${esc(statusLabels[row.metadata.reviewStatus]||row.metadata.reviewStatus||'未标记')}</span><span class="content-review-evidence">证据：${esc(evidenceLabels[row.metadata.evidenceLevel]||row.metadata.evidenceLevel||'未标记')}</span><p>来源：${esc(row.metadata.source||'未填写')} · ${esc(row.metadata.reviewerNote||'未填写')}</p></article>`).join('');
    const more=rows.length>visible.length?`<p class="content-review-more">当前显示前 ${visible.length} 条，共 ${rows.length} 条；逐项审核后可在 contentReview.overrides 写入明确记录。</p>`:'';
    return `<div class="content-review-list">${cards}</div>${more}`;
  }
  function contentReviewPanel(){
    const api=window.V14ContentReview;if(!api)return '';
    const summary=api.summary(),statusLabels=api.labels.status,evidenceLabels=api.labels.evidence,initial={status:'pending'};
    const domainOptions=api.domains().map(item=>`<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('');
    const statusOptions=api.statuses().map(item=>`<option value="${esc(item.id)}" ${initial.status===item.id?'selected':''}>${esc(item.label)}</option>`).join('');
    const evidenceOptions=api.evidenceLevels().map(item=>`<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('');
    const rows=api.list(initial);
    return `<section class="section-card content-review-panel" data-content-review-panel><div class="section-head"><div><h2>Content Review 元数据</h2><p>这里记录来源、证据等级和审核边界。历史内容默认是「待审核 / 未评估」，不把内部整理包装成外部证据，也不改变训练 Resolver。</p></div><span class="time-badge">${summary.pending} 待处理</span></div><div class="content-review-kpis">${kpi(summary.total,'正式内容项','覆盖 Actions / Templates / Anatomy 等数据域')}${kpi(summary.reviewed,'已审核','需要明确 reviewerNote 与 reviewedAt')}${kpi(summary.pending,'待审核','默认筛选项')}${kpi(summary.not_assessed,'未评估','低证据待处理')}${kpi(summary.experimental,'实验性','不等于正式推荐')}</div><div class="content-review-controls" aria-label="Content Review 筛选"><label>数据域<select data-content-review-filter="domain"><option value="">全部数据域</option>${domainOptions}</select></label><label>审核状态<select data-content-review-filter="status"><option value="">全部审核状态</option>${statusOptions}</select></label><label>证据等级<select data-content-review-filter="evidenceLevel"><option value="">全部证据等级</option>${evidenceOptions}</select></label></div><div class="content-review-count" data-content-review-count>当前筛选：${esc(statusLabels[initial.status])} · ${rows.length} 条</div><div data-content-review-results>${reviewRows(initial)}</div></section>`;
  }
  function home(){
    const d=D(),c=d.maintenanceCounts||{},auto=Object.values(d.actions).filter(a=>a.status==='可自动编排'||a.status==='SUPPORT_CANON'||a.status==='CORE_CANON').length;
    const anatomy=anatomyCoverage(),tenPatterns=d.tenPatternCatalog||[],freeCombos=window.V14Composer?.combinations?.()||[];
    return tabs('home')+hero('系统维护','这里是馆主 / 开发维护层。普通教练无需在日常编课时阅读这些内容。')+
      `<section class="health-grid">${kpi(tenPatterns.length+'/10','十大动作模式','Ten Pattern Catalog')}${kpi(freeCombos.length+'/20','自由组合','20/20 主模式矩阵')}${kpi('2/2','单腿双分支','单腿蹲 + 单腿拉')}${kpi(d.meta.baselineActionCards,'动作库总数','来源动作详情')}${kpi(auto,'可编排节点','含 SUPPORT / CORE Canon')}${kpi((c.supportPending||0)+(c.corePending||0),'待回写','SUPPORT + CORE')}${kpi(c.tierDiff||0,'层级差异','Source Tier vs V1.1')}${kpi(c.venueOverlay||0,'Venue Overlay','场馆覆盖动作')}${kpi(anatomy.runtimeCovered+'/'+anatomy.runtimeExpected,'Runtime Anatomy',anatomy.runtimeCovered+' / '+anatomy.runtimeExpected)}</section>`+
      changelogPanel()+
      anatomyPanel()+
      contentReviewPanel()+
      `<section class="section-card"><div class="section-head"><div><h2>当前维护重点</h2><p>系统层规则已经可用，但数据源仍有待回写项。</p></div></div><div class="maintenance-list"><a href="#/maintenance/audit"><b>V1.1 同步审计</b><span>查看源 T 与冻结标准差异、场馆覆盖节点。</span></a><a href="#/maintenance/venue"><b>Venue Truth</b><span>查看真实器械和楼层资料。</span></a><details><summary><b>当前动作库需要补齐的地方</b><span>点击展开</span></summary><div class="legacy-panel">${d.legacyHtml.dataGaps||'<p>暂无记录。</p>'}</div></details><details><summary><b>完整替换矩阵（高级资料）</b><span>点击展开</span></summary><div class="legacy-panel">${d.legacyHtml.replacementMatrix||'<p>暂无记录。</p>'}</div></details></div></section>`;
  }
  function cleanTier(v){const m=String(v||'').match(/T[1-4]/);return m?m[0]:'';}
  function audit(){const d=D();const diffs=Object.values(d.actions).filter(a=>a.sourceTier&&a.tier&&cleanTier(a.sourceTier)&&cleanTier(a.sourceTier)!==a.tier);const overlays=Object.values(d.actions).filter(a=>a.isVenueOverlay);const rows=diffs.map(a=>`<tr><td>${esc(a.name)}</td><td>${esc(a.sourceTier)}</td><td>${esc(a.tier)}</td><td>${esc(a.pattern||'')}</td></tr>`).join('');const ov=overlays.map(a=>`<article><b>${esc(a.name)}</b><span>${esc(a.tier)} · ${esc(a.pattern)}</span><p>${esc(a.note||'')}</p><small>来源映射：${esc(a.sourceActionId||'—')}</small></article>`).join('');return tabs('audit')+hero('V1.1 同步审计','Source Tier 与 V1.1 Standard Tier 始终分开保存；网站不静默改写 Excel 源字段。')+`<section class="section-card"><h2 class="small-title">层级差异</h2><div class="table-scroll"><table class="audit-table"><thead><tr><th>动作</th><th>Source Tier</th><th>V1.1</th><th>模式</th></tr></thead><tbody>${rows||'<tr><td colspan="4">当前运行数据未检测到差异。</td></tr>'}</tbody></table></div></section><section class="section-card"><h2 class="small-title">Venue Overlay</h2><div class="overlay-grid">${ov}</div></section><details class="advanced-reference"><summary>查看 V13 原同步审计记录</summary><div class="legacy-panel">${d.legacyHtml.syncAudit||''}</div></details>`;}
  function venue(){const d=D();return tabs('venue')+hero('Venue Truth','器械和楼层是真实场馆约束，不应该在编课首页长期铺开，但必须可追溯。')+`<section class="section-card legacy-panel venue-legacy">${d.legacyHtml.equipment||'<p>未找到器械清单。</p>'}</section><details class="advanced-reference"><summary>查看 V8 原场馆硬规则资料</summary><div class="legacy-panel">${d.legacyHtml.hardRules||''}</div></details>`;}
  function bind(route){
    if((route.page||'home')!=='home')return;
    const panel=document.querySelector('[data-content-review-panel]');
    if(!panel||!window.V14ContentReview)return;
    const update=()=>{
      const filters={};
      panel.querySelectorAll('[data-content-review-filter]').forEach(select=>{if(select.value)filters[select.dataset.contentReviewFilter]=select.value;});
      const rows=window.V14ContentReview.list(filters),status=filters.status?window.V14ContentReview.labels.status[filters.status]:'全部审核状态';
      panel.querySelector('[data-content-review-count]').textContent=`当前筛选：${status} · ${rows.length} 条`;
      panel.querySelector('[data-content-review-results]').innerHTML=reviewRows(filters);
    };
    panel.querySelectorAll('[data-content-review-filter]').forEach(select=>select.addEventListener('change',update));
  }
  function render(route){const p=route.page||'home';if(p==='audit')return audit();if(p==='venue')return venue();return home();}
  window.V14Maintenance={renderHome:home,renderAudit:audit,renderVenueTruth:venue,anatomyCoverage,changelogPanel,contentReviewPanel};window.V14Views=window.V14Views||{};window.V14Views.maintenance=render;window.V14Bind=window.V14Bind||{};window.V14Bind.maintenance=bind;
})();
