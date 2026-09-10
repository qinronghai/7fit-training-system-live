(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const D=()=>window.V14_DATA;
  function hero(title,body,chips=[]){return `<section class="view-hero"><span class="eyebrow">COACH CENTER / F111</span><h1>${esc(title)}</h1><p>${esc(body)}</p><div class="chips">${chips.map(x=>`<span class="chip">${esc(x)}</span>`).join('')}</div></section>`;}
  function coachModeSwitch(active){return `<nav class="coach-mode-switch"><a class="${active==='preset'?'active':''}" href="#/coach/f111">7Fit 推荐预设</a><a class="${active==='compose'?'active':''}" href="#/coach/compose">自由组合编课</a></nav>`;}
  function copyToolbar(){return `<div class="session-copy-actions"><button id="copy-coach-session" type="button">复制教练版</button><button id="copy-member-session" type="button">复制会员版</button><span id="copy-session-status" role="status" aria-live="polite"></span></div>`;}
  M.Common={esc,D,hero,coachModeSwitch,copyToolbar};
})();