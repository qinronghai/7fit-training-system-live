(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const ACTIVE_TEMPLATES=['f111','body','conditioning'];
  const clean=value=>String(value??'').trim();
  const lower=value=>clean(value).toLowerCase();
  const unique=values=>[...new Set((Array.isArray(values)?values:[]).filter(Boolean))];

  function flattenText(value,out=[]){
    if(value===null||value===undefined)return out;
    if(typeof value==='string'||typeof value==='number'||typeof value==='boolean'){
      const text=clean(value);
      if(text)out.push(text);
      return out;
    }
    if(Array.isArray(value)){
      value.forEach(item=>flattenText(item,out));
      return out;
    }
    if(typeof value==='object'){
      Object.values(value).forEach(item=>flattenText(item,out));
    }
    return out;
  }

  function f111ActionSet(){
    const data=D(),set=new Set();
    Object.values(data.sessions||{}).forEach(session=>{
      (session?.slots||[]).forEach(slot=>{if(slot?.baselineId)set.add(slot.baselineId);});
    });
    Object.values(data.sessionViews||{}).forEach(view=>{
      Object.values(view?.slotOptions||{}).forEach(options=>{
        (options||[]).forEach(option=>{if(option?.id)set.add(option.id);});
      });
    });
    const composer=data.composer||{};
    for(const modes of [composer.lowerModes||{},composer.upperModes||{}]){
      Object.values(modes).forEach(mode=>{
        (mode?.ids||[]).forEach(id=>set.add(id));
        (mode?.candidates||[]).forEach(candidate=>{
          const id=typeof candidate==='string'?candidate:candidate?.id;
          if(id)set.add(id);
        });
      });
    }
    Object.values(composer.auxiliaryRules||{}).forEach(group=>{
      Object.values(group||{}).forEach(ids=>(ids||[]).forEach(id=>set.add(id)));
    });
    (data.supportIds||[]).forEach(id=>set.add(id));
    (data.coreIds||[]).forEach(id=>set.add(id));
    return set;
  }

  function templatesForAction(actionId){
    const data=D(),templates=[],f111=f111ActionSet();
    if(f111.has(actionId))templates.push('f111');
    if(data.bodyActionMeta?.[actionId])templates.push('body');
    if(data.conditioningActionMeta?.[actionId])templates.push('conditioning');
    return templates;
  }

  function templateLabel(templateId){
    return D().templateRegistry?.[templateId]?.shortName||templateId;
  }

  function targetNames(ids){
    const catalog=D().bodyTargetCatalog||{};
    return (ids||[]).map(id=>catalog[id]?.name||id);
  }

  function modalityNames(ids){
    const catalog=D().conditioningModalities||{};
    return (ids||[]).map(id=>catalog[id]?.name||id);
  }

  function actionEntry(action){
    const data=D(),id=action.id,templates=templatesForAction(id);
    const fields=data.actionDetails?.[id]?.fields||{};
    const anatomy=window.V14Anatomy?.get?.(id)||{};
    const body=data.bodyActionMeta?.[id]||{};
    const conditioning=data.conditioningActionMeta?.[id]||{};
    const haystack=[
      action.name,id,action.pattern,action.tier,action.sourceTier,action.equipment,
      action.zone,action.routeLabel,action.category,action.status,action.loadFamily,
      ...flattenText(fields),
      ...(anatomy.primary||[]),...(anatomy.secondary||[]),...(anatomy.stabilizers||[]),
      ...targetNames(body.directTargets||[]),
      ...modalityNames(conditioning.modalities||[]),
      ...flattenText(body),
      ...flattenText(conditioning),
      ...templates.map(templateLabel),
    ].filter(Boolean).join(' ');
    return {
      kind:'action',
      id,
      title:action.name||id,
      subtitle:[action.pattern,action.tier||action.sourceTier,action.equipment].filter(Boolean).join(' · '),
      templates,
      href:`#/library?focus=${encodeURIComponent(id)}`,
      searchText:lower(haystack),
      meta:{
        pattern:action.pattern||'',
        tier:action.tier||'',
        zone:action.zone||action.routeLabel||'',
        equipment:action.equipment||'',
        category:action.category||'',
        status:action.status||'',
      },
    };
  }

  function f111PresetEntries(){
    const data=D();
    return Object.entries(data.recipes||{}).map(([recipeId,recipe])=>({
      kind:'f111-preset',
      id:`preset:${recipeId}`,
      title:`${recipeId}｜${recipe?.name||recipeId}`,
      subtitle:'F111 官方模板 · L1–L4',
      templates:['f111'],
      href:`#/coach/f111/${recipeId.toLowerCase()}/l1`,
      searchText:lower([
        recipeId,recipe?.name,recipe?.lower,recipe?.upper,
        ...flattenText(recipe),
        'F111 女性综合 1+1+1 预设 模板',
      ].filter(Boolean).join(' ')),
      meta:{recipeId},
    }));
  }

  function f111CombinationEntries(){
    if(!window.V14Composer?.combinations)return [];
    return window.V14Composer.combinations().map(combo=>{
      const query=new URLSearchParams({level:'L1',lower:combo.lowerMode,upper:combo.upperMode}).toString();
      return {
        kind:'f111-combination',
        id:`combo:${combo.id}`,
        title:`${combo.lower} + ${combo.upper}`,
        subtitle:`${combo.id} · F111 自由组合`,
        templates:['f111'],
        href:`#/coach/f111/compose?${query}`,
        searchText:lower([
          combo.id,combo.lowerMode,combo.upperMode,combo.lower,combo.upper,
          'F111 女性综合 1+1+1 自由组合',
        ].join(' ')),
        meta:{compositionId:combo.id,lowerMode:combo.lowerMode,upperMode:combo.upperMode},
      };
    });
  }

  function bodyFamilyEntries(){
    const data=D();
    return (data.bodyFamilyIds||[]).map(familyId=>{
      const family=data.bodyFamilies?.[familyId]||{};
      const roles=unique(Object.values(family.slotPolicy||{}));
      const roleNames=roles.map(role=>data.bodyRoles?.[role]?.name||role);
      const targets=[
        ...targetNames(family.primaryTargets||[]),
        ...targetNames(family.secondaryTargets||[]),
      ];
      return {
        kind:'body-family',
        id:`body:${familyId}`,
        title:family.name||familyId,
        subtitle:`${familyId} · ${roleNames.join(' / ')||'Body'}`,
        templates:['body'],
        href:`#/coach/body/compose?family=${encodeURIComponent(familyId)}&level=L1`,
        searchText:lower([
          familyId,family.name,family.goal,family.description,
          ...roleNames,...targets,...flattenText(family),
          'Body 健美式塑形 Family Role',
        ].filter(Boolean).join(' ')),
        meta:{familyId,roles},
      };
    });
  }

  function conditioningEntries(){
    const data=D(),items=[];
    for(const familyId of data.conditioningFamilyIds||[]){
      const family=data.conditioningFamilies?.[familyId]||{};
      for(const protocolId of family.protocolEligibility||[]){
        const protocol=data.conditioningProtocols?.[protocolId]||{};
        items.push({
          kind:'conditioning-protocol',
          id:`conditioning:${familyId}:${protocolId}`,
          title:`${family.name||familyId}｜${protocol.name||protocolId}`,
          subtitle:`${familyId} · ${protocolId}`,
          templates:['conditioning'],
          href:`#/coach/conditioning/compose?family=${encodeURIComponent(familyId)}&level=L1&protocol=${encodeURIComponent(protocolId)}`,
          searchText:lower([
            familyId,family.name,family.goal,family.description,
            protocolId,protocol.name,protocol.description,
            ...flattenText(family),...flattenText(protocol),
            'Conditioning 体能训练 Protocol',
          ].filter(Boolean).join(' ')),
          meta:{familyId,protocolId},
        });
      }
    }
    return items;
  }

  function buildIndex(){
    const data=D();
    const actions=Object.values(data.actions||{}).map(actionEntry);
    return [
      ...actions,
      ...f111PresetEntries(),
      ...f111CombinationEntries(),
      ...bodyFamilyEntries(),
      ...conditioningEntries(),
    ];
  }

  function kindGroup(kind){
    return kind==='action'?'action':'session';
  }

  function matchesActionFilters(entry,filters){
    if(entry.kind!=='action')return true;
    const meta=entry.meta||{};
    for(const key of ['pattern','tier','zone','equipment','category','status']){
      if(filters[key]&&meta[key]!==filters[key])return false;
    }
    return true;
  }

  function search(options={}){
    const q=lower(options.q||''),templateId=clean(options.templateId||''),kind=clean(options.kind||'');
    const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:240;
    return buildIndex().filter(entry=>{
      if(q&&!entry.searchText.includes(q))return false;
      if(templateId&&!entry.templates.includes(templateId))return false;
      if(kind&&kindGroup(entry.kind)!==kind)return false;
      if(!matchesActionFilters(entry,options))return false;
      return true;
    }).sort((a,b)=>{
      if(q){
        const aTitle=lower(a.title),bTitle=lower(b.title);
        const aExact=aTitle===q?0:aTitle.startsWith(q)?1:2;
        const bExact=bTitle===q?0:bTitle.startsWith(q)?1:2;
        if(aExact!==bExact)return aExact-bExact;
      }
      const kindOrder=(a.kind==='action'?0:1)-(b.kind==='action'?0:1);
      if(kindOrder)return kindOrder;
      return a.title.localeCompare(b.title,'zh-CN')||a.id.localeCompare(b.id);
    }).slice(0,limit);
  }

  function activeTemplateOptions(){
    const data=D();
    return ACTIVE_TEMPLATES.filter(id=>data.templateRegistry?.[id]?.status==='ACTIVE').map(id=>({
      id,label:data.templateRegistry[id]?.name||id,shortName:templateLabel(id),
    }));
  }

  window.V15TemplateSearch={
    buildIndex,
    search,
    templatesForAction,
    activeTemplateOptions,
    kindGroup,
  };
})();
