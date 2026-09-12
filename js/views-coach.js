(function(){
  const M=window.V14CoachModules||{},Home=M.Home,F111Home=M.F111Home,TemplateHome=M.TemplateHome,Session=M.Session,ComposerView=M.ComposerView;
  const Recent=()=>window.V15RecentActions;
  const selectCandidates=select=>Array.from(select?.options||[]).filter(option=>option.value).map(option=>({actionId:option.value,name:option.textContent||option.value}));
  const selectHas=(select,actionId)=>selectCandidates(select).some(candidate=>candidate.actionId===actionId);
  function templateAdapter(route){
    if(!route?.templateId||route.templateId==='f111')return null;
    const adapter=M.TemplateUI?.get?.(route.templateId);
    return adapter?.canHandle?.(route)?adapter:null;
  }
  function render(route){
    const adapter=templateAdapter(route);
    if(adapter)return adapter.render(route);
    if(route.page==='compose')return ComposerView.render(route);
    if(route.recipeId)return Session.render(route);
    if(route.page==='template'||route.page==='template-compose')return route.templateId==='f111'?F111Home.render(route):TemplateHome.render(route.templateId);
    return Home.render(route);
  }
  function bind(route){
    const root=document.getElementById('app-main');
    const rerender=()=>{
      const current=window.V14Router.parseHash(location.hash);
      root.innerHTML=render(current);
      bind(current);
      if(window.V14ModuleCopy?.bind)window.V14ModuleCopy.bind(root);
    };
    const bindSaved=()=>M.SavedSessionsUI?.bind?.(route,root,rerender);
    const adapter=templateAdapter(route);
    if(adapter){
      adapter.bind(route,root,rerender);
      bindSaved();
      return;
    }
    if(route.page==='compose'){
      const ctx=ComposerView.composerContext(route);
      document.querySelectorAll('.composer-slot-select').forEach(sel=>sel.addEventListener('change',()=>{
        const contextKey=Recent()?.context?.f111Composer?.({
          lowerMode:ctx.lowerMode,upperMode:ctx.upperMode,level:ctx.level,coreDemand:ctx.coreDemand,slotKey:sel.dataset.slotKey,
        });
        Recent()?.record?.({templateId:'f111',contextKey,actionId:sel.value,candidates:selectCandidates(sel)});
        window.V14State.setComposerSelection(sel.dataset.composerKey,sel.dataset.slotKey,sel.value);
        rerender();
      }));
      document.querySelectorAll('.composer-slot-card [data-recent-action]').forEach(button=>button.addEventListener('click',()=>{
        const card=button.closest('.composer-slot-card'),slotKey=card?.dataset.composerSlot;
        const select=card?.querySelector('.composer-slot-select'),actionId=button.dataset.recentAction;
        if(!select||!slotKey||!selectHas(select,actionId))return;
        const contextKey=Recent()?.context?.f111Composer?.({
          lowerMode:ctx.lowerMode,upperMode:ctx.upperMode,level:ctx.level,coreDemand:ctx.coreDemand,slotKey,
        });
        Recent()?.record?.({templateId:'f111',contextKey,actionId,candidates:selectCandidates(select)});
        window.V14State.setComposerSelection(ctx.stateKey,slotKey,actionId);
        rerender();
      }));
      document.querySelectorAll('.prep-slot-select').forEach(sel=>sel.addEventListener('change',()=>{M.Prep.setPrepSelection(sel.dataset.prepSession,sel.dataset.prepSlot,sel.value);rerender();}));
      document.querySelectorAll('[data-compose-query]').forEach(sel=>sel.addEventListener('change',()=>{const key=sel.dataset.composeQuery;location.hash=ComposerView.composeHref(ctx,{[key]:sel.value});}));
      const status=document.getElementById('copy-session-status');
      const doCopy=async audience=>{const payload=ComposerView.buildComposerCopyPayload(ComposerView.composerContext(window.V14Router.parseHash(location.hash))),formatter=audience==='coach'?window.V14SessionCopy?.formatCoach:window.V14SessionCopy?.formatMember;if(typeof formatter!=='function')return;try{await window.V14SessionCopy.copyText(formatter(payload));if(status){status.textContent='已复制，可直接发送';status.className='success';}}catch(_){if(status){status.textContent='复制失败，请手动选择内容复制';status.className='error';}}};
      document.getElementById('copy-coach-session')?.addEventListener('click',()=>doCopy('coach'));
      document.getElementById('copy-member-session')?.addEventListener('click',()=>doCopy('member'));
      document.getElementById('reset-composer')?.addEventListener('click',()=>{window.V14State.resetComposer(ctx.stateKey);rerender();});
      bindSaved();
      return;
    }
    if(!route.recipeId){
      bindSaved();
      return;
    }
    const sessionId=`${route.recipeId}-${route.level}`;
    document.querySelectorAll('.session-swap').forEach(sel=>sel.addEventListener('change',()=>{
      const contextKey=Recent()?.context?.f111Preset?.({sessionId,slotKey:sel.dataset.slotKey});
      Recent()?.record?.({templateId:'f111',contextKey,actionId:sel.value,candidates:selectCandidates(sel)});
      window.V14State.setSelection(sel.dataset.session,sel.dataset.slotKey,sel.value);
      rerender();
    }));
    document.querySelectorAll('.session-slot [data-recent-action]').forEach(button=>button.addEventListener('click',()=>{
      const card=button.closest('.session-slot'),slotKey=card?.dataset.slot,select=card?.querySelector('.session-swap');
      const actionId=button.dataset.recentAction;
      if(!select||!slotKey||!selectHas(select,actionId))return;
      const contextKey=Recent()?.context?.f111Preset?.({sessionId,slotKey});
      Recent()?.record?.({templateId:'f111',contextKey,actionId,candidates:selectCandidates(select)});
      window.V14State.setSelection(sessionId,slotKey,actionId);
      rerender();
    }));
    document.querySelectorAll('.prep-slot-select').forEach(sel=>sel.addEventListener('change',()=>{M.Prep.setPrepSelection(sel.dataset.prepSession,sel.dataset.prepSlot,sel.value);rerender();}));
    const status=document.getElementById('copy-session-status');
    const doCopy=async audience=>{const payload=Session.buildCopyPayload(sessionId,route.recipeId,route.level),formatter=audience==='coach'?window.V14SessionCopy?.formatCoach:window.V14SessionCopy?.formatMember;if(typeof formatter!=='function'||typeof window.V14SessionCopy?.copyText!=='function')return;try{await window.V14SessionCopy.copyText(formatter(payload));if(status){status.textContent='已复制，可直接发送';status.className='success';setTimeout(()=>{if(status.textContent==='已复制，可直接发送'){status.textContent='';status.className='';}},1800);}}catch(_){if(status){status.textContent='复制失败，请手动选择内容复制';status.className='error';}}};
    const coachCopy=document.getElementById('copy-coach-session');if(coachCopy)coachCopy.addEventListener('click',()=>doCopy('coach'));
    const memberCopy=document.getElementById('copy-member-session');if(memberCopy)memberCopy.addEventListener('click',()=>doCopy('member'));
    const reset=document.getElementById('reset-session');if(reset)reset.addEventListener('click',()=>{window.V14State.resetSession(sessionId);rerender();});
    bindSaved();
  }
  window.V14CoachAnatomy={selectedTrainingIds:Session.selectedTrainingIds,buildCopyPayload:Session.buildCopyPayload,buildComposerCopyPayload:ComposerView.buildComposerCopyPayload,composerContext:ComposerView.composerContext};
  window.V14Views=window.V14Views||{};window.V14Views.coach=render;
  window.V14Bind=window.V14Bind||{};window.V14Bind.coach=bind;
})();