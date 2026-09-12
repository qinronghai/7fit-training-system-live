(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const S=()=>window.V15State||null;
  const LEVELS=new Set(['L1','L2','L3','L4']);
  let lastRestoreNotice=null;

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function manualMap(value,prep=false){
    const out={};
    if(!value||typeof value!=='object'||Array.isArray(value))return out;
    for(const [key,entry] of Object.entries(value)){
      if(!entry||typeof entry!=='object'||entry.source!=='manual'||typeof entry.actionId!=='string'||!entry.actionId)continue;
      out[key]={actionId:entry.actionId,source:'manual'};
    }
    return out;
  }
  function normalizeSlotKey(slot,index){
    const raw=String(slot?.slotKey||'');
    if(raw.includes('__'))return raw.split('__').pop();
    const label=String(slot?.slotName||'');
    if(label.includes('｜'))return label.split('｜')[0];
    return raw||`S${index+1}`;
  }
  function addReason(reasons,code){
    if(code&&!reasons.includes(code))reasons.push(code);
  }
  function routeSurface(route){
    return route?.page==='template-compose'||route?.page==='compose'?'compose':'session';
  }

  function failResult(code,message,record=null){
    return {ok:false,code,message,record:record?clone(record):null,reasons:[code],droppedSelections:[],droppedPrepSelections:[]};
  }

  function f111ComposerInput(route={}){
    const cfg=D().composer||{},q=route.query||{};
    const level=LEVELS.has(q.level)?q.level:'L1';
    const lowerMode=cfg.lowerModes?.[q.lower]?q.lower:Object.keys(cfg.lowerModes||{})[0];
    const upperMode=cfg.upperModes?.[q.upper]?q.upper:Object.keys(cfg.upperModes||{})[0];
    const coreDemand=cfg.coreDemands?.[q.core]?q.core:'anti_extension';
    const flags={
      includeExpandedMain:q.em==='1',
      includeExpandedSupport:q.es==='1',
      includeExpandedCore:q.ec==='1',
    };
    const resolved=window.V14Composer.resolve({level,lowerMode,upperMode,coreDemand,...flags});
    return {
      templateId:'f111',
      sessionKey:`${resolved.compositionId}-${level}`,
      familyId:resolved.compositionId,
      level,
      resolverVersion:'f111-adapter-v1',
      input:{
        mode:'composer',
        legacyCompositionKey:`${resolved.compositionId}-${level}`,
        level,lowerMode,upperMode,coreDemand,...flags,
        surface:'compose',
      },
    };
  }

  function descriptorFromRoute(route={}){
    const data=D();
    if(route.templateId==='f111'||route.page==='compose'||route.page==='preset'){
      if(route.page==='compose'){
        return f111ComposerInput(route);
      }
      const recipeId=String(route.recipeId||'').toUpperCase(),level=String(route.level||'').toUpperCase();
      if(!data.recipes?.[recipeId]||!LEVELS.has(level))return null;
      const sessionKey=`${recipeId}-${level}`;
      return {
        templateId:'f111',sessionKey,familyId:recipeId,level,resolverVersion:'f111-adapter-v1',
        input:{mode:'preset',recipeId,level,sessionId:sessionKey,surface:'session'},
      };
    }

    if(route.templateId==='body'){
      const ids=data.bodyFamilyIds||[];
      const rawFamily=String(route.familyId||route.query?.family||'BODY-01').toUpperCase();
      const familyId=ids.includes(rawFamily)?rawFamily:'BODY-01';
      const rawLevel=String(route.level||route.query?.level||'L1').toUpperCase();
      const level=LEVELS.has(rawLevel)?rawLevel:'L1';
      return {
        templateId:'body',sessionKey:`${familyId}-${level}`,familyId,level,resolverVersion:'body-v1',
        input:{familyId,level,surface:routeSurface(route)},
      };
    }

    if(route.templateId==='conditioning'){
      const ids=data.conditioningFamilyIds||[];
      const rawFamily=String(route.familyId||route.query?.family||'CON-01').toUpperCase();
      const familyId=ids.includes(rawFamily)?rawFamily:'CON-01';
      const rawLevel=String(route.level||route.query?.level||'L1').toUpperCase();
      const level=LEVELS.has(rawLevel)?rawLevel:'L1';
      const family=data.conditioningFamilies?.[familyId]||{};
      const requested=route.page==='template-compose'?String(route.query?.protocol||'').toUpperCase():'';
      const protocolId=requested&&family.protocolEligibility?.includes(requested)
        ?requested
        :window.V15ConditioningProtocol.selectProtocol(familyId,level,'');
      return {
        templateId:'conditioning',
        sessionKey:`${familyId}-${level}-${protocolId}`,
        familyId,level,resolverVersion:'conditioning-v1',
        input:{familyId,level,protocolId,surface:routeSurface(route)},
      };
    }
    return null;
  }

  function ensureDescriptorSession(descriptor){
    const state=S();
    if(!state)throw new Error('V15State is unavailable');
    let current=state.getSession(descriptor.templateId,descriptor.sessionKey);
    if(!current){
      return state.ensureSession(descriptor.templateId,descriptor.sessionKey,{
        familyId:descriptor.familyId,
        level:descriptor.level,
        resolverVersion:descriptor.resolverVersion,
        input:descriptor.input,
      });
    }
    if(current.resolverVersion!==descriptor.resolverVersion){
      current=state.reconcileSession(descriptor.templateId,descriptor.sessionKey,{resolverVersion:descriptor.resolverVersion}).session;
    }
    return state.ensureSession(descriptor.templateId,descriptor.sessionKey,{
      familyId:descriptor.familyId,
      level:descriptor.level,
      resolverVersion:descriptor.resolverVersion,
      input:descriptor.input,
    });
  }

  function defaultName(descriptor){
    const data=D(),template=data.templateRegistry?.[descriptor.templateId];
    if(descriptor.templateId==='f111'){
      if(descriptor.input.mode==='preset')return `${data.recipes?.[descriptor.familyId]?.name||descriptor.familyId} · ${descriptor.level}`;
      const r=window.V14Composer.resolve(descriptor.input);
      return `${r.lower?.name||''} + ${r.upper?.name||''} · ${descriptor.level}`;
    }
    if(descriptor.templateId==='body')return `${data.bodyFamilies?.[descriptor.familyId]?.name||descriptor.familyId} · ${descriptor.level}`;
    if(descriptor.templateId==='conditioning'){
      const family=data.conditioningFamilies?.[descriptor.familyId]?.name||descriptor.familyId;
      const protocol=data.conditioningProtocols?.[descriptor.input.protocolId]?.name||descriptor.input.protocolId;
      return `${family} · ${descriptor.level} · ${protocol}`;
    }
    return `${template?.shortName||descriptor.templateId} · ${descriptor.level}`;
  }

  function saveRoute(route,name='',options={}){
    const state=S(),descriptor=descriptorFromRoute(route);
    if(!state)throw new Error('V15State is unavailable');
    if(!descriptor)throw new Error('Current route cannot be saved');
    ensureDescriptorSession(descriptor);
    return state.createSavedSession(descriptor.templateId,descriptor.sessionKey,{
      name:typeof name==='string'&&name.trim()?name.trim():defaultName(descriptor),
      input:descriptor.input,
      now:options.now,
      savedId:options.savedId,
    });
  }

  function validatePrep(prepContext,savedPrep){
    const resolver=window.V14PrepResolver,requested=manualMap(savedPrep,true);
    const accepted={},dropped=[];
    if(!resolver?.resolve||!prepContext)return {accepted,dropped:Object.keys(requested)};
    const resolved=resolver.resolve(prepContext,{selections:requested});
    const byKey=Object.fromEntries((resolved.slots||[]).map(slot=>[slot.slotKey,slot]));
    for(const [slotKey,entry] of Object.entries(requested)){
      const slot=byKey[slotKey];
      if(slot?.source==='manual'&&slot.actionId===entry.actionId)accepted[slotKey]=entry;
      else dropped.push(slotKey);
    }
    return {accepted,dropped};
  }

  function applyRestoredState({templateId,sessionKey,familyId,level,resolverVersion,input,selections,prepSelections}){
    const state=S();
    state.resetSession(templateId,sessionKey);
    state.ensureSession(templateId,sessionKey,{familyId,level,resolverVersion,input});
    state.patchSession(templateId,sessionKey,{input,selections,prepSelections});
    return state.getSession(templateId,sessionKey);
  }

  function presetRestore(record,reasons){
    const data=D(),recipeId=data.recipes?.[record.input?.recipeId]?record.input.recipeId:record.familyId,level=record.level;
    if(!data.recipes?.[recipeId]||!LEVELS.has(level))return failResult('UNRESTORABLE_F111_PRESET','Saved F111 preset identity is no longer available',record);
    const sessionId=`${recipeId}-${level}`,session=data.sessions?.[sessionId],view=data.sessionViews?.[sessionId]||{};
    if(!session)return failResult('UNRESTORABLE_F111_PRESET','Saved F111 preset session is no longer available',record);

    const requested=manualMap(record.selections),accepted={},dropped=[];
    const selectedArray=(session.slots||[]).map((slot,index)=>{
      const key=normalizeSlotKey(slot,index),entry=requested[key];
      if(!entry)return slot.baselineId;
      const options=view.slotOptions?.[slot.slotKey]||[];
      const allowed=new Set(options.map(x=>x.id).filter(Boolean));
      allowed.add(slot.baselineId);
      if(data.actions?.[entry.actionId]&&allowed.has(entry.actionId)){
        accepted[key]=entry;
        return entry.actionId;
      }
      dropped.push(key);
      return slot.baselineId;
    });
    if(dropped.length)addReason(reasons,'STALE_SELECTION');

    const resolved=window.V15TemplateResolver.resolve('f111',{mode:'preset',recipeId,level,selections:selectedArray});
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');

    const input={mode:'preset',recipeId,level,sessionId,surface:'session'};
    applyRestoredState({
      templateId:'f111',sessionKey:sessionId,familyId:recipeId,level,
      resolverVersion:resolved.resolverVersion,input,selections:accepted,prepSelections:prep.accepted,
    });
    return {
      ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',
      hash:`#/coach/f111/${recipeId.toLowerCase()}/${level.toLowerCase()}`,
      templateId:'f111',sessionKey:sessionId,reasons,
      droppedSelections:dropped,droppedPrepSelections:prep.dropped,
    };
  }

  function composerRestore(record,reasons){
    const data=D(),cfg=data.composer||{},saved=record.input||{},level=LEVELS.has(record.level)?record.level:'L1';
    const lowerMode=cfg.lowerModes?.[saved.lowerMode]?saved.lowerMode:Object.keys(cfg.lowerModes||{})[0];
    const upperMode=cfg.upperModes?.[saved.upperMode]?saved.upperMode:Object.keys(cfg.upperModes||{})[0];
    const coreDemand=cfg.coreDemands?.[saved.coreDemand]?saved.coreDemand:'anti_extension';
    if(lowerMode!==saved.lowerMode||upperMode!==saved.upperMode||coreDemand!==saved.coreDemand)addReason(reasons,'STALE_INPUT');
    const flags={
      includeExpandedMain:!!saved.includeExpandedMain,
      includeExpandedSupport:!!saved.includeExpandedSupport,
      includeExpandedCore:!!saved.includeExpandedCore,
    };
    const base={mode:'composer',level,lowerMode,upperMode,coreDemand,...flags};
    const initial=window.V14Composer.resolve(base),sessionKey=`${initial.compositionId}-${level}`;
    const requested=manualMap(record.selections),acceptedPlain={},accepted={},dropped=[];
    for(const key of ['A','B','C','D1','D2','CORE']){
      const entry=requested[key];
      if(!entry)continue;
      const probe=window.V14Composer.resolve({...base,selections:acceptedPlain});
      const legal=(probe.slotOptions?.[key]||[]).some(option=>option.id===entry.actionId);
      if(legal&&data.actions?.[entry.actionId]){
        acceptedPlain[key]=entry.actionId;
        accepted[key]=entry;
      }else dropped.push(key);
    }
    if(dropped.length)addReason(reasons,'STALE_SELECTION');
    const resolved=window.V15TemplateResolver.resolve('f111',{...base,selections:acceptedPlain});
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');

    const input={
      ...base,
      legacyCompositionKey:sessionKey,
      surface:'compose',
    };
    applyRestoredState({
      templateId:'f111',sessionKey,familyId:resolved.familyId,level,
      resolverVersion:resolved.resolverVersion,input,selections:accepted,prepSelections:prep.accepted,
    });
    const q={level,lower:lowerMode,upper:upperMode,core:coreDemand};
    if(flags.includeExpandedMain)q.em='1';
    if(flags.includeExpandedSupport)q.es='1';
    if(flags.includeExpandedCore)q.ec='1';
    return {
      ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',
      hash:'#/coach/f111/compose?'+new URLSearchParams(q).toString(),
      templateId:'f111',sessionKey,reasons,
      droppedSelections:dropped,droppedPrepSelections:prep.dropped,
    };
  }

  function acceptedResolvedSelections(record,resolved){
    const requested=manualMap(record.selections),accepted={},dropped=[];
    const actual=Object.fromEntries((resolved.resolvedSelections||[]).map(item=>[item.key,item]));
    for(const [key,entry] of Object.entries(requested)){
      const current=actual[key];
      if(current?.source==='manual'&&current.actionId===entry.actionId)accepted[key]=entry;
      else dropped.push(key);
    }
    return {accepted,dropped};
  }

  function bodyRestore(record,reasons){
    const data=D(),familyId=record.familyId,level=record.level;
    if(!(data.bodyFamilyIds||[]).includes(familyId)||!LEVELS.has(level))return failResult('UNRESTORABLE_BODY_SESSION','Saved Body Family / Level is no longer available',record);
    const requested=manualMap(record.selections);
    const resolved=window.V15TemplateResolver.resolve('body',{familyId,level,selections:requested});
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const formal=acceptedResolvedSelections(record,resolved);
    if(formal.dropped.length)addReason(reasons,'STALE_SELECTION');
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');
    const surface=record.input?.surface==='compose'?'compose':'session';
    const input={familyId,level,surface};
    const sessionKey=`${familyId}-${level}`;
    applyRestoredState({
      templateId:'body',sessionKey,familyId,level,resolverVersion:resolved.resolverVersion,input,
      selections:formal.accepted,prepSelections:prep.accepted,
    });
    const hash=surface==='compose'
      ?`#/coach/body/compose?family=${encodeURIComponent(familyId)}&level=${encodeURIComponent(level)}`
      :`#/coach/body/${familyId.toLowerCase()}/${level.toLowerCase()}`;
    return {
      ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',
      hash,templateId:'body',sessionKey,reasons,
      droppedSelections:formal.dropped,droppedPrepSelections:prep.dropped,
    };
  }

  function conditioningRestore(record,reasons){
    const data=D(),familyId=record.familyId,level=record.level;
    if(!(data.conditioningFamilyIds||[]).includes(familyId)||!LEVELS.has(level))return failResult('UNRESTORABLE_CONDITIONING_SESSION','Saved Conditioning Family / Level is no longer available',record);
    const family=data.conditioningFamilies?.[familyId]||{},savedProtocol=record.input?.protocolId;
    let protocolId=savedProtocol;
    if(!protocolId||!family.protocolEligibility?.includes(protocolId)){
      protocolId=window.V15ConditioningProtocol.selectProtocol(familyId,level,'');
      addReason(reasons,'STALE_PROTOCOL');
    }
    const requested=manualMap(record.selections);
    const resolved=window.V15TemplateResolver.resolve('conditioning',{familyId,level,protocolId,selections:requested});
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const formal=acceptedResolvedSelections(record,resolved);
    if(formal.dropped.length)addReason(reasons,'STALE_SELECTION');
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');
    const surface=record.input?.surface==='compose'?'compose':'session';
    const input={familyId,level,protocolId,surface};
    const sessionKey=`${familyId}-${level}-${protocolId}`;
    applyRestoredState({
      templateId:'conditioning',sessionKey,familyId,level,resolverVersion:resolved.resolverVersion,input,
      selections:formal.accepted,prepSelections:prep.accepted,
    });
    const hash=surface==='compose'
      ?`#/coach/conditioning/compose?family=${encodeURIComponent(familyId)}&level=${encodeURIComponent(level)}&protocol=${encodeURIComponent(protocolId)}`
      :`#/coach/conditioning/${familyId.toLowerCase()}/${level.toLowerCase()}`;
    return {
      ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',
      hash,templateId:'conditioning',sessionKey,reasons,
      droppedSelections:formal.dropped,droppedPrepSelections:prep.dropped,
    };
  }

  function restore(savedId){
    const state=S(),record=state?.getSavedSession?.(savedId);
    if(!record)return failResult('SAVED_SESSION_NOT_FOUND','Saved session does not exist');
    if(record.schemaVersion!==state.getSavedSessionSchemaVersion()){
      return failResult('UNSUPPORTED_SAVED_SCHEMA',`Saved session schema ${record.schemaVersion} is not supported`,record);
    }
    const registry=D().templateRegistry?.[record.templateId];
    if(!registry||registry.status!=='ACTIVE')return failResult('UNRESTORABLE_TEMPLATE','Saved template is not active',record);
    const reasons=[];
    let result;
    if(record.templateId==='f111'){
      result=record.input?.mode==='composer'?composerRestore(record,reasons):presetRestore(record,reasons);
    }else if(record.templateId==='body'){
      result=bodyRestore(record,reasons);
    }else if(record.templateId==='conditioning'){
      result=conditioningRestore(record,reasons);
    }else{
      result=failResult('UNRESTORABLE_TEMPLATE','Saved template is not supported',record);
    }
    if(result.ok){
      lastRestoreNotice={
        code:result.code,
        savedId,
        name:record.name,
        reasons:[...result.reasons],
        droppedSelections:[...result.droppedSelections],
        droppedPrepSelections:[...result.droppedPrepSelections],
        hash:result.hash,
      };
    }
    return result;
  }

  function list(){return S()?.listSavedSessions?.()||[];}
  function rename(savedId,name,options={}){return S().renameSavedSession(savedId,name,options);}
  function remove(savedId){return S().deleteSavedSession(savedId);}
  function getLastRestoreNotice(){return lastRestoreNotice?clone(lastRestoreNotice):null;}
  function clearRestoreNotice(){lastRestoreNotice=null;}

  window.V15SavedSessions={
    descriptorFromRoute,defaultName,saveRoute,restore,list,rename,remove,
    getLastRestoreNotice,clearRestoreNotice,
  };
})();
