(function(){
  const D=()=>window.V14_DATA;
  const clean=x=>String(x??'').trim();
  // Issue #5: D1/D2 are 1F strength-zone auxiliaries; FLEX is reserved for formal main slots.
  const AUXILIARY_ROUTE_POLICY=Object.freeze(['1F_ONLY']);
  function cfg(){return D().composer||{};}
  function auxiliaryRoutePolicy(){return [...AUXILIARY_ROUTE_POLICY];}
  function isAuxiliaryRouteAllowed(route){return AUXILIARY_ROUTE_POLICY.includes(route);}
  function mainTierWindow(level){return cfg().levelMap?.[level]||cfg().levelMap?.L1||{recommended:'T1',normal:['T1'],expanded:[]};}
  function supportWindow(level){return cfg().supportMap?.[level]||cfg().supportMap?.L1||{recommended:'SUP-S1',normal:['SUP-S1'],expanded:[]};}
  function coreWindow(level){return cfg().coreMap?.[level]||cfg().coreMap?.L1||{recommended:['CORE-L1'],normal:['CORE-L1'],expanded:[]};}
  function combinations(){
    const out=[];
    for(const [lk,l] of Object.entries(cfg().lowerModes||{})) for(const [uk,u] of Object.entries(cfg().upperModes||{})) out.push({id:`F111-C-${l.code}-${u.code}`,lowerMode:lk,upperMode:uk,lower:l.name,upper:u.name});
    return out;
  }
  function actionView(id){
    const a=D().actions?.[id]||{};
    return {id,name:a.name||id,tier:a.tier||'',grade:a.supportGrade||a.grade||a.coreGrade||'',coreDemand:a.coreDemand||'',pattern:a.pattern||'',route:a.route||'',status:a.status||''};
  }
  function byTier(ids,level,includeExpanded=false,mode={}){
    const w=mainTierWindow(level),allowed=new Set([...(w.normal||[]),...(includeExpanded?(w.expanded||[]):[])]),rec=w.recommended,tiers=['T1','T2','T3','T4'];
    const ranked=(ids||[]).map((id,index)=>{
      const x=actionView(id),effectiveTier=tiers[index]||x.tier;
      x.sourceTier=x.tier;x.tier=effectiveTier;
      x.prescriptionOverride=clean(mode.prescriptionByTier?.[effectiveTier]);
      x.tierNote=clean(mode.tierNoteByTier?.[effectiveTier]);
      return x;
    }).filter(x=>allowed.has(x.tier)&&x.status==='可自动编排'&&['1F_ONLY','FLEX_1F_2F'].includes(x.route))
      .sort((a,b)=>(a.tier===rec?-1:0)-(b.tier===rec?-1:0));
    const seen=new Set();
    return ranked.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});
  }
  function mainCandidates(kind,modeKey,level,includeExpanded=false){
    const mode=(kind==='lower'?cfg().lowerModes:cfg().upperModes)?.[modeKey];
    return byTier(mode?.ids||[],level,includeExpanded,mode||{});
  }
  function supportCandidates(level,includeExpanded=false){
    const w=supportWindow(level),grades=[...(w.normal||[]),...(includeExpanded?(w.expanded||[]):[])],allowed=new Set(grades),rec=w.recommended;
    return (D().supportIds||[]).map(id=>{const a=actionView(id);a.grade=D().actions[id]?.grade||D().actions[id]?.supportGrade||id.split('-').slice(0,2).join('-');return a;}).filter(x=>allowed.has(x.grade)).sort((a,b)=>(a.grade===rec?-1:0)-(b.grade===rec?-1:0));
  }
  function matchesDemand(a,demandKey){
    const meta=cfg().coreDemands?.[demandKey]; if(!meta)return true;
    const text=clean(a.coreDemand); return (meta.keywords||[]).some(k=>text.includes(k));
  }
  function coreCandidates(level,demandKey='anti_extension',includeExpanded=false){
    const w=coreWindow(level),grades=[...(w.normal||[]),...(includeExpanded?(w.expanded||[]):[])],allowed=new Set(grades),recommended=new Set(w.recommended||[]);
    const base=(D().coreIds||[]).map(id=>{const a=actionView(id);a.grade=D().actions[id]?.coreGrade||a.tier;return a;}).filter(x=>allowed.has(x.grade));
    const matched=base.filter(x=>matchesDemand(x,demandKey));
    const list=matched.length?matched:base;
    return list.sort((a,b)=>(recommended.has(a.grade)?-1:0)-(recommended.has(b.grade)?-1:0));
  }
  function auxCandidates(kind,modeKey,selectedIds=[]){
    const ids=cfg().auxiliaryRules?.[kind]?.[modeKey]||[],blocked=new Set(selectedIds||[]);
    return ids.filter(id=>!blocked.has(id)).map(actionView).filter(x=>x.status==='可自动编排'&&isAuxiliaryRouteAllowed(x.route));
  }
  function chooseById(options,id){return options.find(x=>x.id===id)||options[0]||null;}
  function resolve(input={}){
    const level=/^L[1-4]$/.test(input.level)?input.level:'L1';
    const lowerMode=cfg().lowerModes?.[input.lowerMode]?input.lowerMode:Object.keys(cfg().lowerModes||{})[0];
    const upperMode=cfg().upperModes?.[input.upperMode]?input.upperMode:Object.keys(cfg().upperModes||{})[0];
    const lower=cfg().lowerModes[lowerMode],upper=cfg().upperModes[upperMode],selections=input.selections||{};
    const Aopts=mainCandidates('lower',lowerMode,level,!!input.includeExpandedMain), Bopts=mainCandidates('upper',upperMode,level,!!input.includeExpandedMain);
    const A=chooseById(Aopts,selections.A),B=chooseById(Bopts,selections.B);
    const Copts=supportCandidates(level,!!input.includeExpandedSupport),C=chooseById(Copts,selections.C);
    const D1opts=auxCandidates('lower',lowerMode,[A?.id,B?.id]),D1=chooseById(D1opts,selections.D1);
    const D2opts=auxCandidates('upper',upperMode,[A?.id,B?.id,D1?.id]),D2=chooseById(D2opts,selections.D2);
    const coreDemand=cfg().coreDemands?.[input.coreDemand]?input.coreDemand:'anti_extension';
    const COREopts=coreCandidates(level,coreDemand,!!input.includeExpandedCore),CORE=chooseById(COREopts,selections.CORE);
    const slot=(key,label,x)=>({slotKey:key,slotName:label,actionId:x?.id||'',name:x?.name||'',tier:x?.tier||'',grade:x?.grade||'',coreDemand:x?.coreDemand||'',prescriptionOverride:x?.prescriptionOverride||'',tierNote:x?.tierNote||''});
    return {
      compositionId:`F111-C-${lower.code}-${upper.code}`,
      level,lowerMode,upperMode,lower,upper,coreDemand,
      windows:{main:mainTierWindow(level),support:supportWindow(level),core:coreWindow(level)},
      slots:[slot('A','A｜下肢主项',A),slot('B','B｜上肢主项',B),slot('C','C｜支撑模式',C),slot('D1','D1｜下肢辅助',D1),slot('D2','D2｜上肢辅助',D2),slot('CORE','CORE｜核心模式',CORE)],
      slotOptions:{A:Aopts,B:Bopts,C:Copts,D1:D1opts,D2:D2opts,CORE:COREopts}
    };
  }
  window.V14Composer={combinations,mainTierWindow,supportWindow,coreWindow,mainCandidates,supportCandidates,coreCandidates,auxCandidates,auxiliaryRoutePolicy,isAuxiliaryRouteAllowed,resolve};
})();
