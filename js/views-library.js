(function(){
  'use strict';

  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const D=()=>window.V14_DATA||{};
  const S=()=>window.V15TemplateSearch;
  const F=()=>window.V15Favorites;
  let filters={q:'',templateId:'',kind:'',pattern:'',tier:'',zone:'',equipment:'',category:'',status:''};

  function uniq(key){return [...new Set(Object.values(D().actions||{}).map(a=>a[key]).filter(Boolean))].sort();}
  function opts(values,label){return `<option value="">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');}
  function templateOpts(){
    const rows=S()?.activeTemplateOptions?.()||[];
    return '<option value="">全部 Template</option>'+rows.map(row=>`<option value="${esc(row.id)}">${esc(row.shortName)}｜${esc(row.label)}</option>`).join('');
  }
  function kindOpts(){
    return '<option value="">全部结果</option><option value="action">动作</option><option value="session">编课 / 模板</option>';
  }

  function searchOptions(overrides={}){
    return {...filters,...overrides};
  }

  function searchResults(f=filters){
    const service=S();
    if(!service)return [];
    return service.search(searchOptions(f));
  }

  function filterActions(f=filters){
    return searchResults({...f,kind:'action'}).map(entry=>D().actions?.[entry.id]).filter(Boolean);
  }

  function templateChips(entry){
    const registry=D().templateRegistry||{};
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
    if(entry.kind==='action'){
      return `<div class="search-result-wrap"><button class="action-row search-result-row" type="button" data-search-result-id="${esc(entry.id)}" data-search-result-kind="action">
        <div><b>${esc(entry.title)}</b><span>${esc(entry.subtitle||'动作')}</span><div class="search-template-chips">${templateChips(entry)}</div></div>
        <div class="action-row-meta"><span>动作</span><small>查看详情</small></div>
      </button>${favorite}</div>`;
    }
    return `<div class="search-result-wrap"><a class="action-row search-result-row search-session-row" href="${esc(entry.href)}" data-search-result-id="${esc(entry.id)}" data-search-result-kind="${esc(entry.kind)}">
      <div><b>${esc(entry.title)}</b><span>${esc(entry.subtitle||'编课入口')}</span><div class="search-template-chips">${templateChips(entry)}</div></div>
      <div class="action-row-meta"><span>编课</span><small>进入 Composer</small></div>
    </a>${favorite}</div>`;
  }

  function groupKey(entry){
    if(entry.templates?.length===1)return entry.templates[0];
    if((entry.templates||[]).length>1)return 'shared';
    return 'general';
  }

  function groupLabel(key){
    const record=D().templateRegistry?.[key];
    if(record)return `${record.shortName}｜${record.name}`;
    if(key==='shared')return '跨模板动作';
    return '通用动作';
  }

  function resultsHtml(items){
    if(!items.length)return '<div class="no-results">没有符合条件的动作或编课入口。</div>';
    const order=['f111','body','conditioning','shared','general'];
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
    return `<section class="view-hero compact"><span class="eyebrow">TEMPLATE-AWARE SEARCH</span><h1>动作与编课搜索</h1><p>统一搜索 Action、F111 组合、Body Family/Role 与 Conditioning Family/Protocol；搜索只负责发现与跳转，课程合法性仍由各 Template Resolver 决定。</p></section>
      <section class="section-card">
        <div class="library-controls template-search-controls">
          <input id="action-search" type="search" placeholder="搜索动作 / 肌群 / 器械 / Family / Protocol" value="${esc(filters.q)}">
          <select data-filter="templateId">${templateOpts()}</select>
          <select data-filter="kind">${kindOpts()}</select>
          <select data-filter="pattern">${opts(uniq('pattern'),'全部模式')}</select>
          <select data-filter="tier">${opts(uniq('tier'),'全部 V1.1 层级')}</select>
          <select data-filter="zone">${opts(zones,'全部区域 / 路由')}</select>
          <select data-filter="equipment">${opts(uniq('equipment'),'全部器械')}</select>
          <select data-filter="category">${opts(uniq('category'),'全部类别')}</select>
          <select data-filter="status">${opts(uniq('status'),'全部编排状态')}</select>
        </div>
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
    if(route?.query?.q!==undefined)filters.q=String(route.query.q||'');
    if(route?.query?.template&&['f111','body','conditioning'].includes(route.query.template))filters.templateId=route.query.template;
    if(route?.query?.kind&&['action','session'].includes(route.query.kind))filters.kind=route.query.kind;

    const rerender=()=>{
      const items=searchResults();
      const mount=document.getElementById('action-results');
      const count=document.getElementById('library-count');
      if(mount)mount.innerHTML=resultsHtml(items);
      if(count)count.textContent=items.length+' 个结果';
      bindRows();
      syncActionFilters();
    };

    const search=document.getElementById('action-search');
    if(search){
      search.value=filters.q;
      search.addEventListener('input',event=>{filters.q=event.target.value;rerender();});
    }

    document.querySelectorAll('[data-filter]').forEach(select=>{
      const key=select.dataset.filter;
      select.value=filters[key]||'';
      select.addEventListener('change',event=>{filters[key]=event.target.value;rerender();});
    });

    function bindRows(){
      document.querySelectorAll('[data-search-result-kind="action"]').forEach(button=>button.addEventListener('click',()=>{
        window.V14ActionDetail.open(button.dataset.searchResultId,{systemMode:window.V14State.getMode()==='system'});
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

    bindRows();
    syncActionFilters();
    if(route.query?.focus)window.V14ActionDetail.open(route.query.focus,{systemMode:window.V14State.getMode()==='system'});
  }

  window.V14Library={render,filterActions,searchResults};
  window.V14Views=window.V14Views||{};
  window.V14Views.library=()=>render();
  window.V14Bind=window.V14Bind||{};
  window.V14Bind.library=bind;
})();
