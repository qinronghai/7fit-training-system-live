(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const UI=M.F111ComposeUI||{};
  const esc=M.Common?.esc||((value)=>String(value??''));

  function renderModes(options){
    return (options||[]).map(option=>`<button type="button" class="f111-drawer-option ${option.selected?'is-current':''}" data-f111-mode-choice="${esc(option.id)}" ${option.selected?'aria-current="true"':''}><span><b>${esc(option.name)}</b><small>${esc(option.subtitle||'')}</small></span><i aria-hidden="true">${option.selected?'✓':'›'}</i></button>`).join('');
  }

  function renderOptions(options){
    return (options||[]).map(option=>`<button type="button" class="f111-drawer-option ${option.selected?'is-current':''}" data-f111-option-choice="${esc(option.id)}" ${option.disabled?'disabled':''} ${option.selected?'aria-current="true"':''}><span><b>${esc(option.name)}</b>${option.subtitle?`<small>${esc(option.subtitle)}</small>`:''}</span><i aria-hidden="true">${option.selected?'✓':'›'}</i></button>`).join('');
  }

  function renderGroups(groups){
    return (groups||[]).map(group=>`<section class="f111-drawer-group"><div class="f111-drawer-group-head"><h3>${esc(group.label)}</h3><span>${group.items.length} ${esc(group.countLabel||'个动作')}</span></div><div class="f111-drawer-group-list">${group.items.map(item=>`<button type="button" class="f111-drawer-action ${item.selected?'is-current':''} ${item.disabled?'is-disabled':''}" data-f111-action-choice="${esc(item.id)}" ${item.disabled?'disabled':''} ${item.selected?'aria-current="true"':''}><span><b>${esc(item.name)}</b><small>${esc(item.pattern||'')}${item.disabled?' · 当前阶段暂不可选':''}</small>${item.detail?`<small class="f111-drawer-action-detail">${esc(item.detail)}</small>`:''}</span><i aria-hidden="true">${item.selected?'✓':'›'}</i></button>`).join('')}</div></section>`).join('');
  }

  function ensureDrawer(){
    if(typeof document==='undefined')return null;
    let root=document.getElementById('f111-action-drawer');
    if(root)return root;
    root=document.createElement('div');
    root.id='f111-action-drawer';
    root.className='f111-action-drawer-shell';
    root.hidden=true;
    root.innerHTML='<div class="f111-action-drawer-backdrop" data-f111-drawer-close></div><aside class="f111-action-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="f111-action-drawer-title"><div class="f111-action-drawer-head"><div><h2 id="f111-action-drawer-title">选择动作</h2><p data-f111-drawer-subtitle></p></div><button type="button" class="f111-action-drawer-close" data-f111-drawer-close aria-label="关闭抽屉">×</button></div><div class="f111-action-drawer-list" data-f111-drawer-list></div></aside>';
    document.body.appendChild(root);
    root.querySelectorAll('[data-f111-drawer-close]').forEach(button=>button.addEventListener('click',close));
    root.addEventListener('keydown',event=>{
      if(event.key==='Escape'){
        event.preventDefault();
        event.stopPropagation();
        close();
      }
      if(event.key!=='Tab')return;
      const buttons=root.querySelectorAll('button:not(:disabled)');
      const first=buttons[0],last=buttons[buttons.length-1];
      if(document.activeElement!==(event.shiftKey?first:last))return;
      event.preventDefault();
      (event.shiftKey?last:first)?.focus();
    });
    return root;
  }

  function close(){
    const root=document.getElementById('f111-action-drawer');
    if(!root||root.hidden)return;
    root.classList.remove('is-open');
    root.hidden=true;
    root._sourceSelect=null;
    root._inertRegions.forEach(region=>{region.inert=false;});
    root._inertRegions=[];
    M.DrawerMotion?.deactivate(root);
    document.documentElement.classList.remove('f111-drawer-open');
    const trigger=root._trigger;
    const focusKey=trigger?.dataset.f111Focus;
    const fallback=focusKey?document.querySelector(`[data-f111-focus="${CSS.escape(focusKey)}"]`):null;
    (trigger?.isConnected?trigger:fallback)?.focus({preventScroll:true});
    root._trigger=null;
  }

  function show(root,trigger,title,subtitle,html){
    root._trigger=trigger;
    root._inertRegions=[...document.querySelectorAll('.app-shell, #mobile-nav')].filter(region=>!region.inert);
    root._inertRegions.forEach(region=>{region.inert=true;});
    root.querySelector('#f111-action-drawer-title').textContent=title;
    const description=root.querySelector('[data-f111-drawer-subtitle]');
    description.textContent=subtitle;
    description.hidden=!subtitle;
    root.querySelector('[data-f111-drawer-list]').innerHTML=html;
    root.hidden=false;
    document.documentElement.classList.add('f111-drawer-open');
    M.DrawerMotion?.activate(root);
    requestAnimationFrame(()=>{if(!root.hidden)root.classList.add('is-open');});
    root.querySelector('.f111-action-drawer-close')?.focus();
  }

  function openMode(button,ctx){
    const root=ensureDrawer();
    if(!root)return;
    const axis=button.dataset.f111ModeDrawer;
    show(root,button,axis==='lower'?'选择下肢模式':'选择上肢模式','',renderModes(UI.modeOptions(ctx,axis)));
    root.querySelectorAll('[data-f111-mode-choice]').forEach(choice=>choice.addEventListener('click',()=>{
      const key=axis==='lower'?'lower':'upper';
      const href=M.ComposerView?.composeHref?M.ComposerView.composeHref(ctx,{[key]:choice.dataset.f111ModeChoice}):'';
      close();
      if(href)window.location.hash=href;
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
    const groups=UI.actionGroups(ctx,slotKey);
    const title=slotKey==='C'?'选择支撑动作':'选择核心动作';
    show(root,button,title,'',renderGroups(groups));
    bindSelectChoices(root);
  }

  function openOptions(button){
    const root=ensureDrawer();
    const select=button.closest('.post-cardio-field')?.querySelector('select');
    if(!root||!select)return;
    root._sourceSelect=select;
    const label=button.dataset.f111OptionTitle||button.closest('.post-cardio-field')?.querySelector('span')?.textContent||'选择项目';
    const options=[...select.options].map(option=>({
      id:option.value,
      name:option.textContent?.trim()||option.value,
      selected:option.selected,
      disabled:option.disabled,
    }));
    show(root,button,label,'',renderOptions(options));
    root.querySelectorAll('[data-f111-option-choice]').forEach(choice=>choice.addEventListener('click',()=>{
      const source=root._sourceSelect;
      if(!source||choice.disabled||![...source.options].some(option=>option.value===choice.dataset.f111OptionChoice))return;
      source.value=choice.dataset.f111OptionChoice;
      close();
      source.dispatchEvent(new Event('change',{bubbles:true}));
    }));
  }

  function bindSelectChoices(root){
    root.querySelectorAll('[data-f111-action-choice]').forEach(choice=>choice.addEventListener('click',()=>{
      const source=root._sourceSelect;
      if(!source||![...source.options].some(option=>option.value===choice.dataset.f111ActionChoice))return;
      source.value=choice.dataset.f111ActionChoice;
      close();
      source.dispatchEvent(new Event('change',{bubbles:true}));
    }));
  }

  function openReplacement(button,source,items){
    const root=ensureDrawer();
    if(!root||!source)return;
    root._sourceSelect=source;
    const title=button.dataset.replacementTitle||'替换动作';
    const subtitle=button.dataset.replacementSubtitle||'';
    const groupLabel=button.dataset.f111ReplacementGroup||'候选动作';
    show(root,button,title,subtitle,renderGroups([{label:groupLabel,countLabel:'个候选',items}]));
    bindSelectChoices(root);
  }

  function openCheck(button){
    const root=ensureDrawer();
    if(!root)return;
    const reasons=button.closest('.f111-course-check')?.querySelector('[data-f111-check-reasons]')?.innerHTML||'<p>暂无详细原因。</p>';
    show(root,button,'课程检查','',reasons);
  }

  function openCopy(button,copy){
    const root=ensureDrawer();
    if(!root)return;
    show(root,button,'复制课程','',renderOptions([{id:'coach',name:'复制给教练'},{id:'member',name:'复制给会员'}]));
    root.querySelectorAll('[data-f111-option-choice]').forEach(choice=>choice.addEventListener('click',()=>{
      const audience=choice.dataset.f111OptionChoice;
      close();
      copy(audience);
    }));
  }

  function bind(scope=document,ctx){
    ensureDrawer();
    scope.querySelectorAll('[data-f111-mode-drawer]').forEach(button=>{
      if(button.dataset.f111DrawerBound==='1')return;
      button.dataset.f111DrawerBound='1';
      button.addEventListener('click',()=>openMode(button,ctx));
    });
    scope.querySelectorAll('[data-f111-action-drawer]').forEach(button=>{
      if(button.dataset.f111DrawerBound==='1')return;
      button.dataset.f111DrawerBound='1';
      button.addEventListener('click',()=>openAction(button,ctx));
    });
    scope.querySelectorAll('[data-f111-option-drawer]').forEach(button=>{
      if(button.dataset.f111DrawerBound==='1')return;
      button.dataset.f111DrawerBound='1';
      button.addEventListener('click',()=>openOptions(button));
    });
    scope.querySelectorAll('[data-f111-check-details]').forEach(button=>{
      if(button.dataset.f111DrawerBound==='1')return;
      button.dataset.f111DrawerBound='1';
      button.addEventListener('click',()=>openCheck(button));
    });
  }

  M.F111ActionDrawer={renderModes,renderGroups,renderOptions,bind,openMode,openAction,openOptions,openReplacement,openCheck,openCopy,close};
})();
