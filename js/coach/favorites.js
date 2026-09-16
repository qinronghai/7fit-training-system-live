(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const F=()=>window.V15Favorites;

  function templateLabel(id){
    if(id==='shared')return '跨模板';
    return D().templateRegistry?.[id]?.shortName||id;
  }
  function reasonLabel(reason){
    return ({
      ENTRY_NOT_FOUND:'收藏对象已不存在',
      TEMPLATE_MISMATCH:'收藏对象已不属于该模板',
      ROUTE_INVALID:'收藏入口已不可用',
    })[reason]||'收藏已失效';
  }
  function card(item){
    const record=item.record||{},entry=item.entry||{};
    if(item.stale){
      return `<article class="favorite-card stale" data-favorite-id="${esc(record.favoriteId)}">
        <div class="favorite-card-head"><span>${esc(templateLabel(record.templateId))}</span><b>已失效</b></div>
        <h3>${esc(record.entryId||'未知收藏')}</h3>
        <p>${esc(reasonLabel(item.reason))}</p>
        <div class="favorite-card-actions"><button type="button" data-favorite-remove="${esc(record.favoriteId)}">移除失效收藏</button></div>
      </article>`;
    }
    return `<article class="favorite-card" data-favorite-id="${esc(record.favoriteId)}">
      <div class="favorite-card-head"><span>${esc(templateLabel(record.templateId))}</span><b>${entry.kind==='action'?'动作':'编课'}</b></div>
      <h3>${esc(entry.title||record.entryId)}</h3>
      <p>${esc(entry.subtitle||'')}</p>
      <div class="favorite-card-actions">
        <a data-favorite-open href="${esc(item.href)}">${entry.kind==='action'?'查看动作':'打开编课'}</a>
        <button type="button" data-favorite-remove="${esc(record.favoriteId)}">取消收藏</button>
      </div>
    </article>`;
  }
  function section(){
    const items=F()?.listResolved?.()||[];
    return `<section class="section-card favorites-library"><div class="section-head"><div><h2>常用收藏</h2><p>收藏只保存入口身份；每次打开都会重新经过当前 Search / Router 解析，不直接恢复旧 URL。</p></div><a class="section-action-link" href="#/library">去搜索收藏 →</a></div>
      ${items.length?`<div class="favorite-grid">${items.map(card).join('')}</div>`:'<div class="favorite-empty">还没有收藏。可在动作与编课搜索中收藏常用动作、F111 组合、Body Family 或 Conditioning Protocol。</div>'}
    </section>`;
  }
  function bind(root,rerender){
    root.querySelectorAll('[data-favorite-remove]').forEach(button=>button.addEventListener('click',()=>{
      F()?.removeById?.(button.dataset.favoriteRemove);
      rerender();
    }));
  }

  M.FavoritesUI={section,bind};
})();