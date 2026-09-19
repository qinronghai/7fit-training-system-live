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

  function prepSummary(preview){
    const section=(preview.sections||[]).find(item=>item.key==='PREP');
    const items=section?.items||[];
    if(!items.length)return '<span>系统会在正式课程页按当前训练内容解析 PREP。</span>';
    return items.slice(0,3).map(item=>`<span>${esc(item.name||item.label||item.actionId)}</span>`).join('<i>+</i>');
  }

  function trainingRows(preview){
    const rows=(preview.sections||[]).filter(section=>section.kind==='SLOT').map(section=>{
      const item=section.items?.[0]||{};
      return `<div class="f111-preset-preview-row" data-preview-slot="${esc(section.key)}">
        <div><span>${esc(section.label||section.key)}</span><b>${esc(item.name||item.actionId||'—')}</b></div>
        <small>${esc(prescription(item,preview.level))}</small>
      </div>`;
    }).join('');
    return `<div class="f111-preset-preview-row f111-preset-preview-prep">
      <div><span>PREP 热身</span><b class="f111-preset-prep-summary">${prepSummary(preview)}</b></div>
      <small>按当前主项实时匹配</small>
    </div>${rows}`;
  }

  function replacementEntries(recipeId,level){
    const data=D(),sessionId=sessionIdOf(recipeId,level),session=data.sessions?.[sessionId],view=data.sessionViews?.[sessionId]||{};
    if(!session)return [];
    return (session.slots||[]).filter(slot=>{
      const options=view.slotOptions?.[slot.slotKey]||[];
      return options.length>1;
    }).slice(0,3).map(slot=>({
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
    const replacementHtml=replacements.length
      ?replacements.map(item=>`<a href="${esc(state.href)}" data-f111-preset-navigate class="f111-preset-swap-chip">${esc(item.label)} 可替换</a>`).join('')
      :`<a href="${esc(state.href)}" data-f111-preset-navigate class="f111-preset-swap-chip">进入课程查看替换</a>`;
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
        <div class="f111-preset-preview-list">${trainingRows(preview)}</div>
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
        <div class="f111-preset-detail-section-head"><div><span>LEGAL SWAP</span><h3>可替换动作</h3></div><small>只进入现有合法替换流程</small></div>
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
    drawer.querySelector('[data-f111-preset-close]')?.addEventListener('click',()=>close());
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
