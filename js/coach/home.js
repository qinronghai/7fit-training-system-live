(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const HOME_TITLES={
    f111:'女性全身塑形',
    body:'健美式塑形训练',
    conditioning:'体能训练',
    hyrox:'HYROX 训练',
    posture:'体态评估与调整'
  };

  function templateRow(id){
    const record=D().templateRegistry?.[id];
    if(!record)return '';
    const future=record.status==='FUTURE',title=HOME_TITLES[id]||record.name;
    return `<li><a class="coach-start-template${future?' future':''}" data-template-id="${esc(id)}" href="${esc(record.routeBase)}">
      <span class="recipe-code">${esc(record.shortName)}</span><b>${esc(title)}</b>${future?'<small>即将开放</small>':''}<i aria-hidden="true">›</i>
    </a></li>`;
  }

  // Favourites and saved courses only take space once they hold something.
  function utilities(){
    const hasFavorites=(window.V15Favorites?.listResolved?.()||[]).length>0;
    const hasSaved=(window.V15SavedSessions?.list?.()||[]).length>0;
    if(!hasFavorites&&!hasSaved)return '';
    return `<section class="coach-utilities" aria-label="常用内容"><div class="coach-utility-grid">
        ${hasFavorites?M.FavoritesUI?.section?.()||'':''}
        ${hasSaved?M.SavedSessionsUI?.librarySection?.()||'':''}
      </div></section>`;
  }

  function render(){
    const data=D(),others=(data.templateIds||[]).filter(id=>id!=='f111').map(templateRow).join('');
    const levels=['L1','L2','L3','L4'].map(level=>`<a class="coach-start-level" href="#/coach/compose?level=${level}" aria-label="F111 ${level} 编课">${level}</a>`).join('');
    return `<h1 class="f111-visually-hidden">编课中心</h1>
    <section class="coach-start" aria-label="开始编课">
      <div class="coach-start-f111" data-template-id="f111">
        <a class="coach-start-f111-title" href="${esc(data.templateRegistry?.f111?.routeBase||'#/coach/compose')}"><span class="recipe-code">F111</span><b>${esc(HOME_TITLES.f111)}</b><i aria-hidden="true">›</i></a>
        <div class="coach-start-levels">${levels}</div>
      </div>
      <a class="coach-start-members" href="#/coach/members"><b>会员</b><i aria-hidden="true">›</i></a>
    </section>
    <section class="coach-start-others" aria-labelledby="coach-start-others-title">
      <h2 id="coach-start-others-title">其他模板</h2>
      <ul>${others}</ul>
    </section>
    ${utilities()}`;
  }

  M.Home={render};
})();
