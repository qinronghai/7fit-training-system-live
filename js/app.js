(function(){
  function labels(route){
    const map={coach:['编课中心','F111 女性综合 1+1+1'],system:['训练体系','十大动作模式 · PREP 热身'],rules:['编排规则','场馆动线 · 替换 · 冲突'],library:['动作库','搜索、筛选与动作详情'],maintenance:['系统维护','数据健康度与审计']};
    return map[route.area]||['页面不存在',''];
  }
  function setActive(area){
    document.querySelectorAll('[data-area]').forEach(a=>a.classList.toggle('active',a.dataset.area===area));
  }
  function renderRoute(route){
    const main=document.getElementById('app-main');
    if(!window.V14Router.isValid(route)){
      document.getElementById('page-title').textContent='页面不存在';
      document.getElementById('page-subtitle').textContent='请返回编课中心';
      setActive('');
      main.innerHTML='<section class="empty-state"><b>页面不存在</b><span>这个地址不属于当前 V14 信息架构。</span><a href="#/coach">返回编课中心</a></section>';
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
    else main.innerHTML='<section class="empty-state"><b>'+title+'</b><span>该模块将在后续任务中迁入 V14。</span></section>';
    const bind=window.V14Bind?.[route.area]; if(typeof bind==='function') bind(route);
    if(window.V14ModuleCopy?.bind) window.V14ModuleCopy.bind(main);
    main.focus({preventScroll:true});
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const mode=window.V14State?.getMode?.()||'coach'; document.body.dataset.mode=mode;
    const btn=document.getElementById('mode-toggle');
    function syncModeButton(){const m=window.V14State.getMode();btn.dataset.mode=m;btn.querySelector('b').textContent=m==='system'?'系统模式':'教练模式';btn.querySelector('small').textContent=m==='system'?'显示来源 / 审计字段':'隐藏开发 / 审计字段';}
    syncModeButton();
    btn.addEventListener('click',()=>{const next=window.V14State.getMode()==='coach'?'system':'coach';window.V14State.setMode(next);syncModeButton();renderRoute(window.V14Router.parseHash(location.hash));});
    window.V14Router.start(renderRoute);
  });
})();
