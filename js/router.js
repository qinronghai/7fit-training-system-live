(function(){
  const REQUIRED_ROUTES = [
    '#/coach','#/coach/compose','#/coach/f111','#/coach/f111/compose',
    '#/coach/body','#/coach/body/compose','#/coach/conditioning','#/coach/conditioning/compose','#/coach/hyrox','#/coach/hyrox/skill/l1','#/coach/hyrox/capacity/l1','#/coach/hyrox/mixed/l1','#/coach/hyrox/benchmark/b1','#/coach/posture',
    '#/system/patterns','#/system/prep','#/system/support','#/system/core',
    '#/rules/venue','#/rules/replacement','#/rules/conflicts','#/library',
    '#/maintenance','#/maintenance/audit','#/maintenance/venue'
  ];
  const templateRegistry=()=>window.V14_DATA?.templateRegistry||{};
  const bodyFamilyIds=()=>window.V14_DATA?.bodyFamilyIds||[];
  const conditioningFamilyIds=()=>window.V14_DATA?.conditioningFamilyIds||[];
  const hyroxSessionTypes=()=>window.V14_DATA?.hyroxSessionTypeIds||[];
  const hyroxProtocols=()=>window.V14_DATA?.hyroxBenchmarkProtocolIds||[];
  const querySuffix=query=>{
    const text=new URLSearchParams(query||{}).toString();
    return text?`?${text}`:'';
  };
  function coachRoute(parts,query,raw){
    const second=parts[1]||'';
    if(!second)return {area:'coach',page:'home',query,raw:'#/'+raw};
    if(second==='compose')return {area:'coach',page:'compose',templateId:'f111',query,raw:'#/'+raw};

    const record=templateRegistry()[second];
    if(record){
      const third=parts[2]||'';
      if(!third)return {area:'coach',page:'template',templateId:second,query,raw:'#/'+raw};
      if(third==='compose'){
        return {area:'coach',page:second==='f111'?'compose':'template-compose',templateId:second,query,raw:'#/'+raw};
      }
      if(second==='f111'){
        return {
          area:'coach',page:'preset',templateId:'f111',recipeId:third.toUpperCase(),
          level:(parts[3]||'').toUpperCase(),query,raw:'#/'+raw
        };
      }
      if(second==='hyrox'){
        const sessionType=third.toUpperCase();
        if(sessionType==='BENCHMARK'){
          const protocolId=(parts[3]||'').toUpperCase();
          const level=window.V14_DATA?.hyroxBenchmarkProtocols?.[protocolId]?.level||'';
          return {area:'coach',page:'template-session',templateId:'hyrox',sessionType,protocolId,level,query,raw:'#/'+raw};
        }
        return {
          area:'coach',page:'template-session',templateId:'hyrox',sessionType,
          level:(parts[3]||'').toUpperCase(),query,raw:'#/'+raw
        };
      }
      if(second==='body'){
        const familyId=third.toUpperCase();
        if(!parts[3])return {area:'coach',page:'template-family',templateId:'body',familyId,query,raw:'#/'+raw};
        return {area:'coach',page:'template-session',templateId:'body',familyId,level:(parts[3]||'').toUpperCase(),query,raw:'#/'+raw};
      }
      if(second==='conditioning'){
        return {
          area:'coach',page:'template-session',templateId:second,familyId:third.toUpperCase(),
          level:(parts[3]||'').toUpperCase(),query,raw:'#/'+raw
        };
      }
      return {area:'coach',page:'invalid-template-route',templateId:second,query,raw:'#/'+raw};
    }

    return {
      area:'coach',page:'preset',templateId:'f111',recipeId:second.toUpperCase(),
      level:(parts[2]||'l1').toUpperCase(),query,raw:'#/'+raw
    };
  }
  window.V14Router = {
    REQUIRED_ROUTES,
    parseHash(hash){
      const raw=(hash||'#/coach').replace(/^#\/?/,'');
      const [pathOnly,queryString='']=raw.split('?');
      const parts=pathOnly.split('/').filter(Boolean);
      const query=Object.fromEntries(new URLSearchParams(queryString));
      const area=parts[0]||'coach';
      if(area==='coach')return coachRoute(parts,query,raw);
      return {area,page:parts[1]||'home',query,raw:'#/'+raw};
    },
    isValid(route){
      if(route.area==='coach'){
        if(route.page==='home')return true;
        if(route.page==='compose')return route.templateId==='f111';
        if(route.page==='template')return !!templateRegistry()[route.templateId];
        if(route.page==='template-compose')return templateRegistry()[route.templateId]?.status==='ACTIVE';
        if(route.page==='template-family')return route.templateId==='body'&&templateRegistry().body?.status==='ACTIVE'&&bodyFamilyIds().includes(route.familyId);
        if(route.page==='template-session'){
          const levelOk=/^L[1-4]$/.test(route.level||'');
          if(route.templateId==='body')return templateRegistry().body?.status==='ACTIVE'&&bodyFamilyIds().includes(route.familyId)&&levelOk;
          if(route.templateId==='conditioning')return templateRegistry().conditioning?.status==='ACTIVE'&&conditioningFamilyIds().includes(route.familyId)&&levelOk;
          if(route.templateId==='hyrox'){
            if(templateRegistry().hyrox?.status!=='ACTIVE'||!hyroxSessionTypes().includes(route.sessionType))return false;
            if(route.sessionType==='BENCHMARK')return hyroxProtocols().includes(route.protocolId)&&levelOk;
            if(route.sessionType==='CAPACITY'){
              const focus=String(route.query?.focus||'ENGINE').toUpperCase();
              return levelOk&&(window.V14_DATA?.hyroxCapacityGroupIds||[]).includes(focus);
            }
            return levelOk;
          }
          return false;
        }
        if(route.page==='preset')return route.templateId==='f111'&&/^F111-0[1-8]$/.test(route.recipeId)&&/^L[1-4]$/.test(route.level);
        return false;
      }
      if(route.area==='system')return ['home','patterns','prep','support','core'].includes(route.page);
      if(route.area==='rules')return ['home','venue','replacement','conflicts'].includes(route.page);
      if(route.area==='library')return route.page==='home';
      if(route.area==='maintenance')return ['home','audit','venue'].includes(route.page);
      return false;
    },
    canonicalHash(route){
      if(route.area!=='coach')return route.raw||'#/coach';
      const suffix=querySuffix(route.query);
      if(route.page==='home')return '#/coach'+suffix;
      if(route.page==='template')return `#/coach/${route.templateId}${suffix}`;
      if(route.page==='compose')return `#/coach/f111/compose${suffix}`;
      if(route.page==='template-compose')return `#/coach/${route.templateId}/compose${suffix}`;
      if(route.page==='template-family')return `#/coach/body/${String(route.familyId||'').toLowerCase()}${suffix}`;
      if(route.page==='template-session'){
        if(route.templateId==='hyrox'){
          if(route.sessionType==='BENCHMARK')return `#/coach/hyrox/benchmark/${String(route.protocolId||'').toLowerCase()}${suffix}`;
          return `#/coach/hyrox/${String(route.sessionType||'').toLowerCase()}/${String(route.level||'').toLowerCase()}${suffix}`;
        }
        return `#/coach/${route.templateId}/${String(route.familyId||'').toLowerCase()}/${String(route.level||'').toLowerCase()}${suffix}`;
      }
      if(route.page==='preset')return `#/coach/f111/${String(route.recipeId||'').toLowerCase()}/${String(route.level||'').toLowerCase()}${suffix}`;
      return route.raw||'#/coach';
    },
    navigate(hash){ location.hash=hash; },
    start(renderRoute){
      const run=()=>renderRoute(this.parseHash(location.hash));
      window.addEventListener('hashchange',run);
      if(!location.hash){ location.hash='#/coach'; } else { run(); }
    }
  };
})();
