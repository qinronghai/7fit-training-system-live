(function(){
  function labels(route){
    if(route.area==='coach'){
      if(route.page==='home')return ['编课中心','7Fit 教练工作台'];
      if(route.page==='member-list'||route.page==='member-detail')return ['会员管理',''];
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
    document.querySelectorAll('[data-area]').forEach(link=>{
      const active=link.dataset.area===area;
      link.classList.toggle('active',active);
      if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
    });
  }
  function isF111ComposerRoute(route){
    return route?.area==='coach'&&(route.page==='compose'||(route.page==='template'&&route.templateId==='f111'));
  }
  function renderRoute(route){
    window.V14CoachModules?.MemberCenter?.routeChanged?.(route);
    if(!isF111ComposerRoute(route))window.V14CoachModules?.ComposerView?.resetMemberContextBinding?.();
    const main=document.getElementById('app-main');
    const titleNode=document.getElementById('page-title');
    const valid=window.V14Router.isValid(route);
    const memberDirectory=valid&&route.area==='coach'&&route.page==='member-list';
    document.getElementById('member-directory-create').hidden=!memberDirectory;
    if(memberDirectory){
      titleNode.setAttribute('role','heading');
      titleNode.setAttribute('aria-level','1');
    }else{
      titleNode.removeAttribute('role');
      titleNode.removeAttribute('aria-level');
    }
    if(!valid){
      titleNode.textContent='页面不存在';
      document.getElementById('page-subtitle').textContent='请返回编课中心';
      setActive('');
      main.innerHTML='<section class="empty-state"><b>页面不存在</b><span>这个地址不属于当前训练系统信息架构。</span><a href="#/coach">返回编课中心</a></section>';
      main.focus({preventScroll:true});
      return;
    }
    const [title,sub]=labels(route);
    titleNode.textContent=title;
    document.getElementById('page-subtitle').textContent=sub;
    setActive(['member-list','member-detail'].includes(route.page)?'members':route.area);
    const renderers=window.V14Views||{};
    const fn=renderers[route.area];
    const restoreUi=isF111ComposerRoute(route)?window.V14CoachModules?.ComposerView?.captureUi(main):null;
    if(typeof fn==='function') main.innerHTML=fn(route);
    else main.innerHTML='<section class="empty-state"><b>'+title+'</b><span>该模块将在后续任务中迁入训练系统。</span></section>';
    const bind=window.V14Bind?.[route.area]; if(typeof bind==='function') bind(route);
    if(window.V14ModuleCopy?.bind) window.V14ModuleCopy.bind(main);
    if(!restoreUi?.())main.focus({preventScroll:true});
    if((route.page==='prep'&&route.query?.slot)||['member-detail','member-list'].includes(route.page))window.scrollTo({top:0,behavior:'instant'});
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const menu=document.getElementById('mobile-navigation');
    menu.append(document.querySelector('.primary-nav').cloneNode(true));
    document.getElementById('mobile-menu-button').addEventListener('click',()=>menu.showModal());
    menu.addEventListener('click',event=>{if(event.target.closest('a,button'))menu.close();});
    const mode=window.V14State?.getMode?.()||'coach'; document.body.dataset.mode=mode;
    const btn=document.getElementById('mode-toggle');
    function syncModeButton(){const m=window.V14State.getMode();btn.dataset.mode=m;btn.querySelector('b').textContent=m==='system'?'系统管理':'教练模式';btn.querySelector('small').textContent=m==='system'?'管理训练数据和规则':'编写课程、查找动作和收藏常用训练';}
    syncModeButton();
    btn.addEventListener('click',()=>{const next=window.V14State.getMode()==='coach'?'system':'coach';window.V14State.setMode(next);syncModeButton();renderRoute(window.V14Router.parseHash(location.hash));});
    window.V14Router.start(renderRoute);
  });
})();
