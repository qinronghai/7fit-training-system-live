(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const C=M.Common;
  const {esc,D}=C;
  let current=null;
  let rerenderHome=null;
  let keyHandler=null;
  let hashHandler=null;

  const sessionIdOf=(recipeId,level)=>`${recipeId}-${level}`;
  const stateKey=(recipeId,level)=>`${recipeId}:${level}`;
  const clean=value=>String(value??'').trim();
  const isMobile=()=>typeof window.matchMedia==='function'&&window.matchMedia('(max-width:620px)').matches;

  function setMobileBackgroundInert(active){
    if(active&&!isMobile())return;
    const shell=document.querySelector('.app-shell'),nav=document.getElementById('mobile-nav');
    if(shell)shell.toggleAttribute('inert',!!active);
    if(nav)nav.toggleAttribute('inert',!!active);
    document.body.classList.toggle('drawer-open',!!active);
  }

  function selected(){
    return current?{...current}:null;
  }

  function currentSelections(recipeId,level){
    const sessionId=sessionIdOf(recipeId,level);
    return window.V14State?.getSessionSelections?.(sessionId)||[];
  }

  function currentPrepSelections(recipeId,level){
    const sessionId=sessionIdOf(recipeId,level);
    return window.V15State?.getPrepSelections?.('f111',sessionId)
      ||window.V14State?.getPrepSelections?.('f111',sessionId)
      ||{};
  }

  function composerHref(state){
    const query=new URLSearchParams({
      level:state.level,
      lower:state.modeIds?.lower||'',
      upper:state.modeIds?.upper||'',
    });
    return `#/coach/f111/compose?${query.toString()}`;
  }

  function prescription(item,level){
    return clean(item?.prescription)
      ||clean(window.V14ModuleCopy?.prescriptionForAction?.(item?.actionId,{level}))
      ||'按当前等级处方';
  }

  function dataSessionSlot(recipeId,level,slotKey){
    const session=D().sessions?.[sessionIdOf(recipeId,level)];
    return session?.slots?.find(item=>item.slotKey===slotKey||String(item.slotKey||'').endsWith(`__${slotKey}`)||String(item.slotName||'').startsWith(`${slotKey}｜`))?.slotKey||slotKey;
  }

  function sessionOptions(recipeId,level,slotKey,currentActionId){
    const data=D(),sessionId=sessionIdOf(recipeId,level),view=data.sessionViews?.[sessionId]||{};
    const sourceKey=dataSessionSlot(recipeId,level,slotKey);
    const options=(view.slotOptions?.[sourceKey]||[]).map(option=>({
      value:clean(option.id),
      label:clean(option.label)||clean(option.name)||clean(data.actions?.[option.id]?.name)||clean(option.id),
    })).filter(option=>option.value);
    if(currentActionId&&!options.some(option=>option.value===currentActionId)){
      options.unshift({
        value:currentActionId,
        label:clean(data.actions?.[currentActionId]?.name)||currentActionId,
      });
    }
    return options;
  }

  function prepSlots(recipeId,level){
    const sessionId=sessionIdOf(recipeId,level);
    try{
      return M.Prep?.resolvePresetPrep?.(sessionId,recipeId,level,currentSelections(recipeId,level))?.slots||[];
    }catch(error){
      return [];
    }
  }

  function optionMarkup(options,currentValue){
    return options.map(option=>`<option value="${esc(option.value)}" ${option.value===currentValue?'selected':''}>${esc(option.label)}</option>`).join('');
  }

  function replacementControl({kind,slotKey,stateSlotKey,label,options,currentValue,disabled=false}){
    const attribute=kind==='prep'?'data-f111-drawer-prep-select':'data-f111-drawer-session-select';
    return `<label class="f111-preset-replace-control"><span>替换动作</span><select ${attribute} data-slot-key="${esc(slotKey)}" ${stateSlotKey?`data-state-slot-key="${esc(stateSlotKey)}"`:''} aria-label="${esc(label)}：替换动作" ${disabled?'disabled':''}>${optionMarkup(options,currentValue)}</select></label>`;
  }

  function prepRows(recipeId,level,preview){
    const resolved=prepSlots(recipeId,level);
    const previewItems=new Map(((preview.sections||[]).find(section=>section.key==='PREP')?.items||[]).map(item=>[item.key,item]));
    return resolved.map(slot=>{
      const item=previewItems.get(slot.slotKey)||{};
      const options=(slot.candidates||[]).map(candidate=>({
        value:clean(candidate.actionId),
        label:[clean(candidate.prepGrade)||'PREP',clean(candidate.name)||clean(candidate.actionId)].filter(Boolean).join('｜'),
      })).filter(option=>option.value);
      const name=clean(slot.name)||clean(item.name)||'暂无合法候选';
      const prescriptionText=clean(slot.prescription)||prescription(item,level);
      return `<div class="f111-preset-preview-row f111-preset-preview-prep" data-preview-prep-slot="${esc(slot.slotKey)}">
        <div><span>${esc(slot.prepGrade||slot.slotName||slot.slotKey)}</span><b>${esc(name)}</b><small>${esc(slot.purpose||'按当前主项实时匹配')}</small></div>
        ${replacementControl({kind:'prep',slotKey:slot.slotKey,label:slot.slotName||slot.slotKey,options,currentValue:slot.actionId,disabled:!options.length})}
        <small class="f111-preset-preview-prescription">${esc(prescriptionText)}</small>
      </div>`;
    }).join('');
  }

  function trainingRows(preview,recipeId,level){
    const rows=(preview.sections||[]).filter(section=>section.kind==='SLOT').map(section=>{
      const item=section.items?.[0]||{};
      const displayKey=clean(section.label).split('｜')[0]||section.key;
      const session=dataSessionSlot(recipeId,level,displayKey);
      const options=sessionOptions(recipeId,level,displayKey,item.actionId);
      return `<div class="f111-preset-preview-row" data-preview-slot="${esc(displayKey)}">
        <div><span>${esc(section.label||section.key)}</span><b>${esc(item.name||item.actionId||'—')}</b></div>
        ${replacementControl({kind:'session',slotKey:displayKey,stateSlotKey:session,label:section.label||section.key,options,currentValue:item.actionId,disabled:!options.length})}
        <small>${esc(prescription(item,preview.level))}</small>
      </div>`;
    }).join('');
    return `${prepRows(recipeId,level,preview)}${rows}`;
  }

  function replacementEntries(recipeId,level){
    const data=D(),sessionId=sessionIdOf(recipeId,level),session=data.sessions?.[sessionId],view=data.sessionViews?.[sessionId]||{};
    if(!session)return [];
    return (session.slots||[]).filter(slot=>{
      const options=view.slotOptions?.[slot.slotKey]||[];
      return options.length>1;
    }).map(slot=>({
      slotKey:slot.slotKey,
      label:clean(slot.slotName).split('｜')[0]||'动作',
    }));
  }

  function render(recipeId,level){
    const Browser=M.F111PresetBrowser,state=Browser?.find?.(recipeId,level);
    if(!state)return '';
    let preview;
    try{
      preview=Browser.resolvePreview(recipeId,level,{
        selections:currentSelections(recipeId,level),
        prepSelections:currentPrepSelections(recipeId,level),
      });
    }catch(error){
      return `<div class="drawer-head f111-preset-drawer-head"><span class="f111-preset-sheet-handle" aria-hidden="true"></span><div><span>PRESET DETAIL</span><h2>${esc(recipeId)} · ${esc(level)}</h2></div><button type="button" data-f111-preset-close aria-label="关闭预设详情">×</button></div>
        <div class="drawer-body f111-preset-drawer-body"><section class="f111-preset-detail-error"><b>预设详情暂时无法解析</b><p>${esc(error?.message||'请进入正式课程页查看。')}</p><a href="${esc(Browser.canonicalHref(recipeId,level))}" data-f111-preset-navigate>进入课程</a></section></div>`;
    }

    const replacements=replacementEntries(recipeId,level);
    const prepReplacementCount=prepSlots(recipeId,level).filter(slot=>(slot.candidates||[]).length>1).length;
    const replacementHtml=replacements.length||prepReplacementCount
      ?`<span class="f111-preset-swap-chip">${replacements.length+prepReplacementCount} 个训练卡支持直接替换</span><span class="f111-preset-swap-note">替换后会保留当前预设、等级与合法候选范围。</span>`
      :`<span class="f111-preset-swap-chip">当前预设暂无其他合法候选</span>`;
    const equipment=preview.equipment.length?preview.equipment.join(' · '):'徒手 / 场馆现有器械';
    const goals=preview.goals.join(' / ')||state.label;

    return `<div class="drawer-head f111-preset-drawer-head">
      <span class="f111-preset-sheet-handle" aria-hidden="true"></span>
      <div class="f111-preset-drawer-title">
        <span>PRESET DETAIL</span>
        <h2>${esc(recipeId)} · ${esc(level)}</h2>
        <p>${esc(state.label)}</p>
      </div>
      <button type="button" data-f111-preset-close aria-label="关闭预设详情">×</button>
    </div>
    <div class="drawer-body f111-preset-drawer-body">
      <div class="f111-preset-detail-chips">
        <span>${esc(level)}</span><span>${esc(state.patterns.lower)}</span><span>${esc(state.patterns.upper)}</span><span>${esc(state.patterns.support)}</span>
      </div>
      <p class="f111-preset-detail-summary">${esc(preview.summary||state.recipeName)}</p>

      <section class="f111-preset-detail-section">
        <div class="f111-preset-detail-section-head"><div><span>SESSION PREVIEW</span><h3>今日训练</h3></div><small>${esc(preview.duration.label)}</small></div>
        <div class="f111-preset-preview-list">${trainingRows(preview,recipeId,level)}</div>
      </section>

      <section class="f111-preset-detail-section">
        <div class="f111-preset-detail-section-head"><div><span>SESSION INFO</span><h3>训练信息</h3></div></div>
        <div class="f111-preset-detail-facts">
          <div><small>目标</small><b>${esc(goals)}</b></div>
          <div><small>时长</small><b>${esc(preview.duration.label)}</b></div>
          <div><small>器械</small><b>${esc(equipment)}</b></div>
        </div>
      </section>

      <section class="f111-preset-detail-section">
        <div class="f111-preset-detail-section-head"><div><span>LEGAL SWAP</span><h3>卡片内直接替换</h3></div><small>仅显示当前合法候选</small></div>
        <div class="f111-preset-swap-chips">${replacementHtml}</div>
      </section>

      <div class="f111-preset-drawer-actions">
        <a class="f111-preset-cta secondary" href="${esc(state.href)}" data-f111-preset-navigate data-preset-replace>替换动作</a>
        <a class="f111-preset-cta tertiary" href="${esc(composerHref(state))}" data-f111-preset-navigate>加入自由组合编辑</a>
        <a class="f111-preset-cta primary" href="${esc(state.href)}" data-f111-preset-navigate data-preset-start>开始课程</a>
      </div>
    </div>`;
  }

  function focusables(drawer){
    return Array.from(drawer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'))
      .filter(node=>!node.hidden&&node.getAttribute('aria-hidden')!=='true');
  }

  function cleanupListeners(){
    if(keyHandler)document.removeEventListener('keydown',keyHandler);
    if(hashHandler)window.removeEventListener('hashchange',hashHandler);
    keyHandler=null;
    hashHandler=null;
  }

  function close({restoreFocus=true,rerender=true}={}){
    const drawer=document.getElementById('global-drawer');
    const last=current?{...current}:null;
    cleanupListeners();
    current=null;
    if(drawer){
      drawer.hidden=true;
      drawer.innerHTML='';
      drawer.removeAttribute('role');
      drawer.removeAttribute('aria-label');
      drawer.removeAttribute('aria-modal');
      drawer.removeAttribute('data-f111-preset-drawer');
    }
    if(rerender&&typeof rerenderHome==='function')rerenderHome();
    setMobileBackgroundInert(false);
    if(restoreFocus&&last){
      requestAnimationFrame(()=>{
        const selector=`[data-recipe-id="${last.recipeId}"][data-level="${last.level}"]`;
        const desktop=document.querySelector(`[data-f111-preset-cell]${selector}`);
        const mobile=document.querySelector(`[data-f111-mobile-preset]${selector}`);
        const recent=document.querySelector(`[data-f111-recent]${selector}`);
        const target=(desktop&&desktop.offsetParent!==null?desktop:null)
          ||(mobile&&mobile.offsetParent!==null?mobile:null)
          ||(recent&&recent.offsetParent!==null?recent:null);
        target?.focus();
      });
    }
    rerenderHome=null;
  }

  function bindDrawer(drawer){
    bindDrawerControls(drawer);
    drawer.querySelectorAll('[data-f111-preset-navigate]').forEach(link=>link.addEventListener('click',()=>{
      if(link.hasAttribute('data-preset-start')&&current)M.F111PresetControls?.recordRecent?.({recipeId:current.recipeId,level:current.level});
      close({restoreFocus:false,rerender:false});
    }));
    drawer.addEventListener('click',event=>{
      if(event.target===drawer)close();
    });

    keyHandler=event=>{
      if(event.key==='Escape'){
        event.preventDefault();
        close();
        return;
      }
      if(event.key!=='Tab'||!isMobile())return;
      const nodes=focusables(drawer);
      if(!nodes.length)return;
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();first.focus();
      }
    };
    document.addEventListener('keydown',keyHandler);

    hashHandler=()=>close({restoreFocus:false,rerender:false});
    window.addEventListener('hashchange',hashHandler,{once:true});
  }

  function focusReplacement(drawer,kind,slotKey){
    const attribute=kind==='prep'?'data-f111-drawer-prep-select':'data-f111-drawer-session-select';
    const target=Array.from(drawer.querySelectorAll(`[${attribute}]`)).find(node=>node.dataset.slotKey===slotKey);
    target?.focus();
  }

  function refreshDrawer(drawer,kind,slotKey){
    if(!current)return;
    drawer.innerHTML=render(current.recipeId,current.level);
    bindDrawerControls(drawer);
    focusReplacement(drawer,kind,slotKey);
  }

  function bindDrawerControls(drawer){
    drawer.querySelector('[data-f111-preset-close]')?.addEventListener('click',()=>close());
    drawer.querySelectorAll('[data-f111-drawer-session-select]').forEach(select=>select.addEventListener('change',()=>{
      if(!current)return;
      window.V14State?.setSelection?.(sessionIdOf(current.recipeId,current.level),select.dataset.stateSlotKey||select.dataset.slotKey,select.value);
      refreshDrawer(drawer,'session',select.dataset.slotKey);
    }));
    drawer.querySelectorAll('[data-f111-drawer-prep-select]').forEach(select=>select.addEventListener('change',()=>{
      if(!current)return;
      M.Prep?.setPrepSelection?.(sessionIdOf(current.recipeId,current.level),select.dataset.slotKey,select.value);
      refreshDrawer(drawer,'prep',select.dataset.slotKey);
    }));
  }

  function open({recipeId,level,rerender}={}){
    const Browser=M.F111PresetBrowser,state=Browser?.find?.(recipeId,level);
    if(!state)return false;
    cleanupListeners();
    current={key:stateKey(recipeId,level),recipeId,level};
    M.F111PresetControls?.recordRecent?.({recipeId,level});
    rerenderHome=typeof rerender==='function'?rerender:null;
    const drawer=document.getElementById('global-drawer');
    if(!drawer)return false;
    drawer.innerHTML=render(recipeId,level);
    drawer.hidden=false;
    drawer.setAttribute('role','dialog');
    drawer.setAttribute('aria-label',`${recipeId} ${level} 预设详情`);
    drawer.setAttribute('data-f111-preset-drawer','');
    if(isMobile())drawer.setAttribute('aria-modal','true');else drawer.removeAttribute('aria-modal');
    bindDrawer(drawer);
    if(rerenderHome)rerenderHome();
    setMobileBackgroundInert(isMobile());
    requestAnimationFrame(()=>drawer.querySelector('[data-f111-preset-close]')?.focus());
    return true;
  }

  M.F111PresetDetail=Object.freeze({open,close,selected,render});
})();
