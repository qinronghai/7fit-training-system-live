(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const UI=M.F111ComposeUI||{};
  const esc=M.Common?.esc||((value)=>String(value??''));

  function renderModes(options){
    return (options||[]).map(option=>`<button type="button" class="f111-drawer-option ${option.selected?'is-current':''}" data-f111-mode-choice="${esc(option.id)}" ${option.selected?'aria-current="true"':''}><span><b>${esc(option.name)}</b><small>${esc(option.subtitle||'')}</small></span><i aria-hidden="true">${option.selected?'✓':'›'}</i></button>`).join('');
  }

  function renderGroups(groups){
    return (groups||[]).map(group=>`<section class="f111-drawer-group"><div class="f111-drawer-group-head"><h3>${esc(group.label)}</h3><span>${group.items.length} 个动作</span></div><div class="f111-drawer-group-list">${group.items.map(item=>`<button type="button" class="f111-drawer-action ${item.selected?'is-current':''} ${item.disabled?'is-disabled':''}" data-f111-action-choice="${esc(item.id)}" ${item.disabled?'disabled':''} ${item.selected?'aria-current="true"':''}><span><b>${esc(item.name)}</b><small>${esc(item.pattern||'')}${item.disabled?' · 当前阶段暂不可选':''}</small></span><i aria-hidden="true">${item.selected?'✓':'›'}</i></button>`).join('')}</div></section>`).join('');
  }

  function ensureDrawer(){
    if(typeof document==='undefined')return null;
    let root=document.getElementById('f111-action-drawer');
    if(root)return root;
    root=document.createElement('div');
    root.id='f111-action-drawer';
    root.className='f111-action-drawer-shell';
    root.hidden=true;
    root.innerHTML='<div class="f111-action-drawer-backdrop" data-f111-drawer-close></div><aside class="f111-action-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="f111-action-drawer-title"><div class="f111-action-drawer-head"><div><span data-f111-drawer-kicker>F111</span><h2 id="f111-action-drawer-title">选择动作</h2><p data-f111-drawer-subtitle></p></div><button type="button" class="f111-action-drawer-close" data-f111-drawer-close aria-label="关闭抽屉">×</button></div><div class="f111-action-drawer-list" data-f111-drawer-list></div></aside>';
    document.body.appendChild(root);
    root.querySelectorAll('[data-f111-drawer-close]').forEach(button=>button.addEventListener('click',close));
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.hidden)close();});
    return root;
  }

  function close(){
    const root=document.getElementById('f111-action-drawer');
    if(!root)return;
    root.classList.remove('is-open');
    root.hidden=true;
    root._sourceSelect=null;
    root._modeContext=null;
    root._axis=null;
    document.documentElement.classList.remove('f111-drawer-open');
  }

  function show(root,title,subtitle,html){
    root.querySelector('#f111-action-drawer-title').textContent=title;
    root.querySelector('[data-f111-drawer-subtitle]').textContent=subtitle||'';
    root.querySelector('[data-f111-drawer-list]').innerHTML=html;
    root.hidden=false;
    document.documentElement.classList.add('f111-drawer-open');
    requestAnimationFrame(()=>root.classList.add('is-open'));
    root.querySelector('.f111-action-drawer-close')?.focus();
  }

  function openMode(button,ctx){
    const root=ensureDrawer();
    if(!root)return;
    const axis=button.dataset.f111ModeDrawer;
    root._modeContext=ctx;
    root._axis=axis;
    root._sourceSelect=null;
    show(root,axis==='lower'?'选择下肢模式':'选择上肢模式','选择后会更新当前 F111 课程组合。',renderModes(UI.modeOptions(ctx,axis)));
    root.querySelectorAll('[data-f111-mode-choice]').forEach(choice=>choice.addEventListener('click',()=>{
      const key=axis==='lower'?'lower':'upper';
      const href=M.ComposerView?.composeHref?M.ComposerView.composeHref(ctx,{[key]:choice.dataset.f111ModeChoice}):'';
      if(href)window.location.hash=href;
      close();
    }));
  }

  function openAction(button,ctx){
    const root=ensureDrawer();
    if(!root)return;
    const slotKey=button.dataset.f111ActionDrawer;
    const card=button.closest('.composer-slot-card');
    const select=card?.querySelector('.composer-slot-select');
    if(!select)return;
    root._sourceSelect=select;
    root._modeContext=null;
    root._axis=null;
    const groups=UI.actionGroups(ctx,slotKey);
    const title=slotKey==='C'?'选择支撑动作':'选择核心动作';
    const count=groups.reduce((total,group)=>total+group.items.length,0);
    show(root,title,`当前课程可选 ${count} 个动作，按训练阶段分组显示。`,renderGroups(groups));
    root.querySelectorAll('[data-f111-action-choice]').forEach(choice=>choice.addEventListener('click',()=>{
      const source=root._sourceSelect;
      if(!source||![...source.options].some(option=>option.value===choice.dataset.f111ActionChoice))return;
      source.value=choice.dataset.f111ActionChoice;
      close();
      source.dispatchEvent(new Event('change',{bubbles:true}));
    }));
  }

  function openCheck(button){
    const root=ensureDrawer();
    if(!root)return;
    const reasons=button.closest('.f111-course-check')?.querySelector('[data-f111-check-reasons]')?.innerHTML||'<p>暂无详细原因。</p>';
    root._sourceSelect=null;
    root._modeContext=null;
    root._axis=null;
    show(root,'课程检查','请先处理以下问题，再继续使用当前课程。',reasons);
  }

  function bind(scope=document,ctx,rerender){
    ensureDrawer();
    scope.querySelectorAll('[data-f111-mode-drawer]').forEach(button=>{
      if(button.dataset.f111DrawerBound==='1')return;
      button.dataset.f111DrawerBound='1';
      button.addEventListener('click',()=>openMode(button,ctx,rerender));
    });
    scope.querySelectorAll('[data-f111-action-drawer]').forEach(button=>{
      if(button.dataset.f111DrawerBound==='1')return;
      button.dataset.f111DrawerBound='1';
      button.addEventListener('click',()=>openAction(button,ctx,rerender));
    });
    scope.querySelectorAll('[data-f111-check-details]').forEach(button=>{
      if(button.dataset.f111DrawerBound==='1')return;
      button.dataset.f111DrawerBound='1';
      button.addEventListener('click',()=>openCheck(button));
    });
  }

  M.F111ActionDrawer={renderModes,renderGroups,bind,openMode,openAction,openCheck,close};
})();
