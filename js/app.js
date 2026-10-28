(function(){
  function labels(route){
    if(route.area==='coach'){
      if(route.page==='home')return ['编课中心','7Fit 教练工作台'];
      if(route.page==='member-list'||route.page==='member-detail')return ['会员训练','近期完成情况与课程记录'];
      if(route.page==='template'||route.page==='template-compose'){
        if(route.templateId==='f111')return ['编课中心','女性综合 1+1+1'];
        const record=window.V14_DATA?.templateRegistry?.[route.templateId];
        return ['编课中心',record?.name||'训练模板'];
      }
      if(route.page==='compose')return ['编课中心','女性综合 1+1+1'];
      if(route.recipeId)return ['编课中心','F111 女性综合 1+1+1'];
      // Family / session routes used to fall through to the generic placeholder, so
      // every non-F111 page was titled 'Multi-Template Coach Center'.
      if(route.page==='template-family'||route.page==='template-session'){
        const data=window.V14_DATA||{},registry=data.templateRegistry||{};
        const parts=[registry[route.templateId]?.name||'训练模板'];
        if(route.familyId){
          const families=route.templateId==='body'?data.bodyFamilies:data.conditioningFamilies;
          parts.push(families?.[route.familyId]?.name||route.familyId);
        }
        if(route.sessionType){
          parts.push(data.hyroxSessionTypes?.[route.sessionType]?.name||route.sessionType);
        }
        if(/^L[1-4]$/.test(route.level||''))parts.push(route.level);
        return ['编课中心',parts.filter(Boolean).join(' · ')];
      }
      return ['编课中心','Multi-Template Coach Center'];
    }
    const map={system:['训练体系','十大动作模式 · PREP 热身'],rules:['编排规则','场馆动线 · 替换 · 冲突'],library:['搜索','动作、模板与编课入口'],maintenance:['系统维护','数据健康度与审计']};
    return map[route.area]||['页面不存在',''];
  }
  function setActive(area){
    document.querySelectorAll('[data-area]').forEach(a=>a.classList.toggle('active',a.dataset.area===area));
  }
  function isF111ComposerRoute(route){
    return route?.area==='coach'&&(route.page==='compose'||(route.page==='template'&&route.templateId==='f111'));
  }
  function renderRoute(route){
    // Member lazy loading gate: member scripts are no longer in index.html.
    // On first member need, show the member loading state (reusing the
    // member module's own loading wording), load the five scripts in order,
    // then re-render the same route only if the user is still on it.
    // On failure, show an error state with a retry that re-attempts the
    // same original files; non-member routes never touch this path.
    const loader=window.V14MemberLoader;
    if(loader&&loader.needsMemberScripts(route)&&!loader.isReady()){
      const main=document.getElementById('app-main');
      const capturedHash=location.hash;
      const [gateTitle,gateSub]=labels(route);
      document.getElementById('page-title').textContent=gateTitle;
      document.getElementById('page-subtitle').textContent=gateSub;
      setActive(route.area);
      main.innerHTML='<section class="member-center-page"><div class="member-state-loading" data-member-loading>正在加载会员功能…</div></section>';
      loader.ensure().then(()=>{
        if(location.hash===capturedHash)renderRoute(window.V14Router.parseHash(location.hash));
      }).catch(()=>{
        if(location.hash!==capturedHash)return;
        main.innerHTML='<section class="empty-state"><b>会员功能加载失败</b><span>会员脚本未能加载（'+(loader.failedFile()||'网络或文件异常')+'）。非会员功能不受影响。</span><button type="button" data-member-retry>重试加载会员功能</button><a href="#/coach">返回编课中心</a></section>';
        const retry=main.querySelector('[data-member-retry]');
        if(retry)retry.addEventListener('click',()=>renderRoute(window.V14Router.parseHash(location.hash)));
      });
      return;
    }
    window.V14CoachModules?.MemberCenter?.routeChanged?.(route);
    if(!isF111ComposerRoute(route))window.V14CoachModules?.ComposerView?.resetMemberContextBinding?.();
    const main=document.getElementById('app-main');
    if(!window.V14Router.isValid(route)){
      document.getElementById('page-title').textContent='页面不存在';
      document.getElementById('page-subtitle').textContent='请返回编课中心';
      setActive('');
      main.innerHTML='<section class="empty-state"><b>页面不存在</b><span>这个地址不属于当前训练系统信息架构。</span><a href="#/coach">返回编课中心</a></section>';
      main.focus({preventScroll:true});
      return;
    }
    const [title,sub]=labels(route);
    document.getElementById('page-title').textContent=title;
    document.getElementById('page-subtitle').textContent=sub;
    setActive(route.area);
    const renderers=window.V14Views||{};
    const fn=renderers[route.area];
    if(typeof fn==='function') main.innerHTML=fn(route);
    else main.innerHTML='<section class="empty-state"><b>'+title+'</b><span>该模块将在后续任务中迁入训练系统。</span></section>';
    const bind=window.V14Bind?.[route.area]; if(typeof bind==='function') bind(route);
    if(window.V14ModuleCopy?.bind) window.V14ModuleCopy.bind(main);
    main.focus({preventScroll:true});
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const mode=window.V14State?.getMode?.()||'coach'; document.body.dataset.mode=mode;
    const btn=document.getElementById('mode-toggle');
    function syncModeButton(){const m=window.V14State.getMode();btn.dataset.mode=m;btn.querySelector('b').textContent=m==='system'?'系统管理':'教练模式';btn.querySelector('small').textContent=m==='system'?'管理训练数据和规则':'编写课程、查找动作和收藏常用训练';}
    syncModeButton();
    btn.addEventListener('click',()=>{const next=window.V14State.getMode()==='coach'?'system':'coach';window.V14State.setMode(next);syncModeButton();renderRoute(window.V14Router.parseHash(location.hash));});
    window.V14Router.start(renderRoute);
  });
})();
