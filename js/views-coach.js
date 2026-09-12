(function(){
  const M=window.V14CoachModules||{},Home=M.Home,F111Home=M.F111Home,TemplateHome=M.TemplateHome,Session=M.Session,ComposerView=M.ComposerView;
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
        window.V14State.setComposerSelection(sel.dataset.composerKey,sel.dataset.slotKey,sel.value);
        const desc=window.V15RecentActions?.f111Composer?.(ctx,sel.dataset.slotKey);
        if(desc)window.V15RecentActions.record(desc,sel.value);
        rerender();
      }));
      document.querySelectorAll('[data-recent-f111-composer]').forEach(button=>button.addEventListener('click',()=>{
        const actionId=button.dataset.recentAction,slotKey=button.dataset.slotKey;
        window.V14State.setComposerSelection(button.dataset.composerKey,slotKey,actionId);
        const desc=window.V15RecentActions?.f111Composer?.(ctx,slotKey);
        if(desc)window.V15RecentActions.record(desc,actionId);
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
      window.V14State.setSelection(sel.dataset.session,sel.dataset.slotKey,sel.value);
      const desc=window.V15RecentActions?.f111Preset?.(sel.dataset.session,sel.dataset.slotKey);
      if(desc)window.V15RecentActions.record(desc,sel.value);
      rerender();
    }));
    document.querySelectorAll('[data-recent-f111-preset]').forEach(button=>button.addEventListener('click',()=>{
      const actionId=button.dataset.recentAction;
      window.V14State.setSelection(button.dataset.session,button.dataset.slotKey,actionId);
      const desc=window.V15RecentActions?.f111Preset?.(button.dataset.session,button.dataset.slotKey);
      if(desc)window.V15RecentActions.record(desc,actionId);
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