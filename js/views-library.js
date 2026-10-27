(function(){
  'use strict';

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const D=()=>window.V14_DATA||{};
  const S=()=>window.V15TemplateSearch;
  const F=()=>window.V15Favorites;
  const FOAM_ROLLER_QUERY='泡沫轴';
  let filters={q:'',templateId:'',kind:'',source:'',pattern:'',tier:'',zone:'',equipment:'',category:'',status:'',quick:''};
  const isActionEntry=entry=>entry?.kind==='action'||entry?.kind==='opengym-action';

  function uniq(key){return [...new Set(Object.values(D().actions||{}).map(a=>a[key]).filter(Boolean))].sort();}
  function opts(values,label){return `<option value="">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');}
  function templateOpts(){
    const rows=S()?.activeTemplateOptions?.()||[];
    return '<option value="">全部 Template</option>'+rows.map(row=>`<option value="${esc(row.id)}">${esc(row.shortName)}｜${esc(row.label)}</option>`).join('');
  }
  function kindOpts(){
    return '<option value="">全部结果</option><option value="action">动作</option><option value="session">编课 / 模板</option>';
  }
  function sourceOpts(){
    return '<option value="">全部来源</option><option value="formal">7Fit 正式动作</option><option value="opengym">OpenGym 外部候选</option>';
  }

  function searchOptions(overrides={}){
    return {...filters,...overrides};
  }

  function foamRollerFilterActive(){
    return filters.quick==='foam'&&filters.q===FOAM_ROLLER_QUERY&&filters.kind==='action'&&Object.entries(filters).every(([key,value])=>key==='q'||key==='kind'||key==='quick'||(key==='source'&&value==='formal')||!value);
  }

  function quickFiltersHtml(){
    const active=foamRollerFilterActive();
    return `<div class="library-quick-filters" aria-label="快捷筛选"><span>快捷筛选</span><button class="library-quick-filter ${active?'active':''}" type="button" data-quick-filter="foam" aria-pressed="${active?'true':'false'}">泡沫轴</button></div>`;
  }

  function searchResults(f=filters){
    const service=S();
    if(!service)return [];
    const results=service.search(searchOptions(f));
    if(f.quick!=='foam')return results;
    const foamIds=new Set((D().foamRollIds||[]).map(id=>D().foamRollDetails?.[id]?.actionId).filter(Boolean));
    return results.filter(entry=>entry.kind==='action'&&foamIds.has(entry.id));
  }

  function filterActions(f=filters){
    return searchResults({...f,kind:'action'}).filter(entry=>entry.kind==='action').map(entry=>D().actions?.[entry.id]).filter(Boolean);
  }

  function templateChips(entry){
    const registry=D().templateRegistry||{};
    if(entry.source==='opengym')return '<span>OpenGym 候选</span>';
    if(!entry.templates?.length)return '<span>通用</span>';
    return entry.templates.map(id=>`<span>${esc(registry[id]?.shortName||id)}</span>`).join('');
  }

  function favoriteTemplate(entry){
    return F()?.templateContext?.(entry,filters.templateId)||((entry.templates||[])[0]||'shared');
  }
  function favoriteButton(entry){
    const templateId=favoriteTemplate(entry),active=!!F()?.isFavorite?.(entry,templateId);
    return `<button class="favorite-toggle ${active?'active':''}" type="button" data-favorite-toggle data-favorite-entry-kind="${esc(entry.kind)}" data-favorite-entry-id="${esc(entry.id)}" data-favorite-template="${esc(templateId)}" aria-pressed="${active?'true':'false'}">${active?'★ 已收藏':'☆ 收藏'}</button>`;
  }
  function resultRow(entry){
    const favorite=favoriteButton(entry);
    if(isActionEntry(entry)){
      const kind=entry.source==='opengym'?'opengym-action':'action';
      const candidateAttr=entry.source==='opengym'?` data-opengym-action-id="${esc(entry.id)}"`:'';
      return `<div class="search-result-wrap"><button class="action-row search-result-row ${entry.source==='opengym'?'opengym-candidate-row':''}" type="button" data-search-result-id="${esc(entry.id)}" data-search-result-kind="${kind}"${candidateAttr}>
        <div><b>${esc(entry.title)}</b><span>${esc(entry.subtitle||'动作')}</span><div class="search-template-chips">${templateChips(entry)}</div></div>
      </button>${favorite}</div>`;
    }
    return `<div class="search-result-wrap"><a class="action-row search-result-row search-session-row" href="${esc(entry.href)}" data-search-result-id="${esc(entry.id)}" data-search-result-kind="${esc(entry.kind)}">
      <div><b>${esc(entry.title)}</b><span>${esc(entry.subtitle||'编课入口')}</span><div class="search-template-chips">${templateChips(entry)}</div></div>
    </a>${favorite}</div>`;
  }

  function groupKey(entry){
    if(entry.source==='opengym')return 'opengym';
    if(entry.templates?.length===1)return entry.templates[0];
    if((entry.templates||[]).length>1)return 'shared';
    return 'general';
  }

  function groupLabel(key){
    const record=D().templateRegistry?.[key];
    if(record)return `${record.shortName}｜${record.name}`;
    if(key==='shared')return '跨模板动作';
    if(key==='opengym')return 'OpenGym 外部候选｜待人工验收';
    return '通用动作';
  }

  function resultsHtml(items){
    if(!items.length)return '<div class="no-results">没有符合条件的动作或编课入口。</div>';
    const order=['f111','body','conditioning','hyrox','opengym','shared','general'];
    const grouped=new Map();
    for(const item of items){
      const key=groupKey(item);
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(item);
    }
    return order.filter(key=>grouped.has(key)).map(key=>{
      const rows=grouped.get(key);
      return `<section class="search-result-group" data-search-group="${esc(key)}">
        <div class="search-result-group-head"><b>${esc(groupLabel(key))}</b><span>${rows.length} 项</span></div>
        <div class="search-result-group-list">${rows.map(resultRow).join('')}</div>
      </section>`;
    }).join('');
  }

  function render(){
    const zones=uniq('zone').concat(uniq('routeLabel').filter(x=>!uniq('zone').includes(x)));
    const items=searchResults();
    return `<section class="view-hero compact"><h1>动作与编课搜索</h1><p>统一搜索动作与编课入口；课程合法性仍由当前模板决定。</p></section>
      <section class="section-card">
        <div class="library-controls library-primary-controls">
          <input id="action-search" aria-label="搜索动作与编课" type="search" maxlength="${S().MAX_QUERY_LENGTH}" placeholder="搜索动作 / 肌群 / 器械 / Family / Protocol" value="${esc(S().normalizeQuery(filters.q))}">
          <select aria-label="模板筛选" data-filter="templateId">${templateOpts()}</select>
          <select aria-label="结果类型筛选" data-filter="kind">${kindOpts()}</select>
        </div>
        <details class="library-advanced-filters">
          <summary>更多筛选</summary>
          <div class="library-controls template-search-controls">
          <select aria-label="动作来源筛选" data-filter="source">${sourceOpts()}</select>
          <select aria-label="动作模式筛选" data-filter="pattern">${opts(uniq('pattern'),'全部模式')}</select>
          <select aria-label="动作层级筛选" data-filter="tier">${opts(uniq('tier'),'全部 V1.1 层级')}</select>
          <select aria-label="区域与路由筛选" data-filter="zone">${opts(zones,'全部区域 / 路由')}</select>
          <select aria-label="器械筛选" data-filter="equipment">${opts(uniq('equipment'),'全部器械')}</select>
          <select aria-label="类别筛选" data-filter="category">${opts(uniq('category'),'全部类别')}</select>
          <select aria-label="编排状态筛选" data-filter="status">${opts(uniq('status'),'全部编排状态')}</select>
          </div>
        </details>
        ${quickFiltersHtml()}
        <div class="library-result-head"><b id="library-count">${items.length} 个结果</b><span>动作打开详情；编课结果进入当前合法 Composer Context</span></div>
        <div id="action-results" class="action-results template-search-results">${resultsHtml(items)}</div>
      </section>`;
  }

  function syncActionFilters(){
    const disabled=filters.kind==='session';
    document.querySelectorAll('[data-filter="pattern"],[data-filter="tier"],[data-filter="zone"],[data-filter="equipment"],[data-filter="category"],[data-filter="status"]').forEach(node=>{
      node.disabled=disabled;
      node.closest('select')?.classList.toggle('filter-disabled',disabled);
    });
  }

  function bind(route){
    const hasRouteFilters=!!route?.query&&['q','template','kind','source'].some(key=>route.query[key]!==undefined);
    if(route?.query?.q!==undefined)filters.q=String(route.query.q||'');
    if(route?.query?.template&&['f111','body','conditioning','hyrox'].includes(route.query.template))filters.templateId=route.query.template;
    if(route?.query?.kind&&['action','session'].includes(route.query.kind))filters.kind=route.query.kind;
    if(route?.query?.source&&['formal','opengym'].includes(route.query.source))filters.source=route.query.source;

    const rerender=()=>{
      const items=searchResults();
      const mount=document.getElementById('action-results');
      const count=document.getElementById('library-count');
      if(mount)mount.innerHTML=resultsHtml(items);
      if(count)count.textContent=items.length+' 个结果';
      bindRows();
      syncActionFilters();
      syncQuickFilters();
    };

    const search=document.getElementById('action-search');
    if(search){
      filters.q=S().normalizeQuery(filters.q);
      search.value=filters.q;
      search.addEventListener('input',event=>{
        filters.q=S().normalizeQuery(event.target.value);
        filters.quick='';
        event.target.value=filters.q;
        rerender();
      });
    }

    const foamQuickFilter=document.querySelector('[data-quick-filter="foam"]');
    foamQuickFilter?.addEventListener('click',()=>{
      const clear=foamRollerFilterActive();
      filters={q:clear?'':FOAM_ROLLER_QUERY,templateId:'',kind:clear?'':'action',source:clear?'':'formal',pattern:'',tier:'',zone:'',equipment:'',category:'',status:'',quick:clear?'':'foam'};
      if(search)search.value=filters.q;
      document.querySelectorAll('[data-filter]').forEach(select=>{select.value=filters[select.dataset.filter]||'';});
      rerender();
    });

    document.querySelectorAll('[data-filter]').forEach(select=>{
      const key=select.dataset.filter;
      select.value=filters[key]||'';
      select.addEventListener('change',event=>{filters[key]=event.target.value;filters.quick='';rerender();});
    });

    function bindRows(){
      document.querySelectorAll('[data-search-result-kind="action"]').forEach(button=>button.addEventListener('click',()=>{
        window.V14ActionDetail.open(button.dataset.searchResultId,{systemMode:window.V14State.getMode()==='system'});
      }));
      document.querySelectorAll('[data-search-result-kind="opengym-action"]').forEach(button=>button.addEventListener('click',()=>{
        window.V14ActionDetail.open(button.dataset.opengymActionId,{systemMode:window.V14State.getMode()==='system',source:'opengym'});
      }));
      document.querySelectorAll('[data-favorite-toggle]').forEach(button=>button.addEventListener('click',event=>{
        event.preventDefault();
        event.stopPropagation();
        F()?.toggleByIdentity?.(
          button.dataset.favoriteEntryKind,
          button.dataset.favoriteEntryId,
          {templateId:button.dataset.favoriteTemplate}
        );
        rerender();
      }));
    }

    function syncQuickFilters(){
      const button=document.querySelector('[data-quick-filter="foam"]');
      if(!button)return;
      const active=foamRollerFilterActive();
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    }

    if(hasRouteFilters)rerender();
    else {
      bindRows();
      syncActionFilters();
      syncQuickFilters();
    }
    if(route.query?.focus)window.V14ActionDetail.open(route.query.focus,{systemMode:window.V14State.getMode()==='system'});
  }

  window.V14Library={render,filterActions,searchResults};
  window.V14Views=window.V14Views||{};
  window.V14Views.library=()=>render();
  window.V14Bind=window.V14Bind||{};
  window.V14Bind.library=bind;
})();
