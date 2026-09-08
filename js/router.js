(function(){
  const REQUIRED_ROUTES = [
    '#/coach','#/coach/compose','#/system/patterns','#/system/prep','#/system/support','#/system/core',
    '#/rules/venue','#/rules/replacement','#/rules/conflicts','#/library',
    '#/maintenance','#/maintenance/audit','#/maintenance/venue'
  ];
  window.V14Router = {
    REQUIRED_ROUTES,
    parseHash(hash){
      const raw=(hash||'#/coach').replace(/^#\/?/,'');
      const [pathOnly,queryString='']=raw.split('?');
      const parts=pathOnly.split('/').filter(Boolean);
      const query=Object.fromEntries(new URLSearchParams(queryString));
      const area=parts[0]||'coach';
      if(area==='coach' && parts[1]==='compose') return {area:'coach',page:'compose',query,raw:'#/'+raw};
      if(area==='coach' && parts[1]){
        return {area:'coach',page:'preset',recipeId:parts[1].toUpperCase(),level:(parts[2]||'l1').toUpperCase(),query,raw:'#/'+raw};
      }
      return {area,page:parts[1]||'home',query,raw:'#/'+raw};
    },
    isValid(route){
      if(route.area==='coach'){
        if(route.page==='compose')return true;
        if(!route.recipeId)return true;
        return /^F111-0[1-8]$/.test(route.recipeId) && /^L[1-4]$/.test(route.level);
      }
      if(route.area==='system')return ['home','patterns','prep','support','core'].includes(route.page);
      if(route.area==='rules')return ['home','venue','replacement','conflicts'].includes(route.page);
      if(route.area==='library')return route.page==='home';
      if(route.area==='maintenance')return ['home','audit','venue'].includes(route.page);
      return false;
    },
    navigate(hash){ location.hash=hash; },
    start(renderRoute){
      const run=()=>renderRoute(this.parseHash(location.hash));
      window.addEventListener('hashchange',run);
      if(!location.hash){ location.hash='#/coach'; } else { run(); }
    }
  };
})();
