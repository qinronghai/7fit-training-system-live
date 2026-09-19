(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const esc=C?.esc||((value)=>String(value??''));

  function ensureDrawer(){
    let root=document.getElementById('replacement-drawer');
    if(root)return root;
    root=document.createElement('div');
    root.id='replacement-drawer';
    root.className='replacement-drawer-shell';
    root.hidden=true;
    root.innerHTML=`
      <div class="replacement-drawer-backdrop" data-replacement-close></div>
      <aside class="replacement-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="replacement-drawer-title">
        <div class="replacement-drawer-head">
          <div><span>REPLACEMENT</span><h2 id="replacement-drawer-title">替换动作</h2><p data-replacement-subtitle>只显示当前课程通过 Gate 的候选。</p></div>
          <button type="button" class="replacement-drawer-close" data-replacement-close aria-label="关闭替换抽屉">×</button>
        </div>
        <div class="replacement-drawer-list" data-replacement-list></div>
      </aside>`;
    document.body.appendChild(root);
    root.querySelectorAll('[data-replacement-close]').forEach(button=>button.addEventListener('click',close));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.hidden)close();});
    return root;
  }

  function optionData(option){
    return {
      id:option.value,
      label:option.textContent?.trim()||option.value,
      selected:option.selected,
      disabled:option.disabled,
      score:option.dataset.score||'',
      family:option.dataset.family||'',
      reasons:option.dataset.reasons||'',
      tradeoffs:option.dataset.tradeoffs||'',
      role:option.dataset.role||'',
    };
  }

  function open(button){
    const card=button.closest('.session-slot,.body-slot-card,.composer-slot-card')||button.parentElement;
    const selector=button.dataset.replacementSelect||'select';
    const select=card?.querySelector(selector);
    if(!select)return;
    const root=ensureDrawer(),list=root.querySelector('[data-replacement-list]');
    root.dataset.sourceSelectId=select.id||'';
    root._sourceSelect=select;
    root.querySelector('#replacement-drawer-title').textContent=button.dataset.replacementTitle||'替换动作';
    root.querySelector('[data-replacement-subtitle]').textContent=button.dataset.replacementSubtitle||'只显示当前课程通过 Level / Venue / Compatibility Gate 的候选。';

    const rows=[...select.options].map(optionData);
    list.innerHTML=rows.map((row,index)=>`
      <article class="replacement-drawer-card ${row.selected?'is-current':''}" data-replacement-option="${esc(row.id)}">
        <div class="replacement-drawer-card-top">
          <div><span>${row.selected?'当前动作':index===0?'优先候选':'合法候选'}</span><h3>${esc(row.label)}</h3></div>
          ${row.score?`<b>${esc(row.score)} 分</b>`:''}
        </div>
        <div class="replacement-drawer-tags">
          ${row.family?`<span>${esc(row.family)}</span>`:''}
          ${row.role?`<span>${esc(row.role)}</span>`:''}
        </div>
        ${row.reasons?`<p><b>推荐原因：</b>${esc(row.reasons)}</p>`:''}
        ${row.tradeoffs?`<p class="replacement-drawer-tradeoff"><b>注意：</b>${esc(row.tradeoffs)}</p>`:''}
        <button type="button" data-replacement-choose="${esc(row.id)}" ${row.selected||row.disabled?'disabled':''}>${row.selected?'当前动作':'换成此动作'}</button>
      </article>`).join('');

    list.querySelectorAll('[data-replacement-choose]').forEach(choose=>choose.addEventListener('click',()=>{
      const source=root._sourceSelect;
      if(!source||![...source.options].some(option=>option.value===choose.dataset.replacementChoose))return;
      source.value=choose.dataset.replacementChoose;
      close();
      source.dispatchEvent(new Event('change',{bubbles:true}));
    }));

    root.hidden=false;
    document.documentElement.classList.add('replacement-drawer-open');
    requestAnimationFrame(()=>root.classList.add('is-open'));
    root.querySelector('.replacement-drawer-close')?.focus();
  }

  function close(){
    const root=document.getElementById('replacement-drawer');
    if(!root)return;
    root.classList.remove('is-open');
    root.hidden=true;
    root._sourceSelect=null;
    document.documentElement.classList.remove('replacement-drawer-open');
  }

  function bind(scope=document){
    ensureDrawer();
    scope.querySelectorAll('[data-replacement-drawer]').forEach(button=>{
      if(button.dataset.replacementBound==='1')return;
      button.dataset.replacementBound='1';
      button.addEventListener('click',()=>open(button));
    });
  }

  M.ReplacementDrawer={bind,open,close};
})();