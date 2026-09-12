(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const S=()=>window.V15State;
  const SLOT_ORDER=Object.freeze(['A','B','C','D1','D2','CORE']);
  let idSequence=0;

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}
  function manualMap(value){
    const out={};
    if(!isObject(value))return out;
    for(const [key,entry] of Object.entries(value)){
      if(entry&&entry.source==='manual'&&typeof entry.actionId==='string'&&entry.actionId){
        out[key]={actionId:entry.actionId,source:'manual'};
      }
    }
    return out;
  }
  function normalizeSlotKey(slotKey){
    const raw=String(slotKey||'');
    return raw.includes('__')?raw.split('__').pop():raw;
  }
  function nowIso(now){
    const date=now===undefined?new Date():new Date(now);
    if(Number.isNaN(date.getTime()))return new Date().toISOString();
    return date.toISOString();
  }
  function makeId(templateId,now){
    const base=String(templateId||'session').replace(/[^a-z0-9_-]+/gi,'-').toLowerCase();
    const stamp=new Date(now===undefined?Date.now():now).getTime();
    let id;
    do{id=`saved-${base}-${stamp}-${idSequence++}`;}while(S()?.getSavedSession?.(id));
    return id;
  }

  function currentRecord(templateId,sessionKey){
    const state=S();
    if(!state?.getSession)fail('SAVED_SESSION_STATE_UNAVAILABLE','V15 State is unavailable');
    const session=state.getSession(templateId,sessionKey);
    if(!session)fail('SESSION_NOT_FOUND',`Cannot save missing session: ${templateId} / ${sessionKey}`,{templateId,sessionKey});
    return session;
  }

  function saveCurrent({templateId,sessionKey,name='',now}={}){
    const state=S(),session=currentRecord(templateId,sessionKey),stamp=nowIso(now);
    const record={
      id:makeId(templateId,now===undefined?Date.now():now),
      schemaVersion:state.getSchemaVersion(),
      resolverVersion:session.resolverVersion,
      templateId:session.templateId,
      familyId:session.familyId,
      level:session.level,
      input:clone(session.input||{}),
      selections:manualMap(session.selections),
      prepSelections:manualMap(session.prepSelections),
      createdAt:stamp,
      updatedAt:stamp,
      name:String(name||'').trim()||`${session.familyId} ${session.level}`,
      sessionKey,
    };
    return state.putSavedSession(record);
  }

  function list(options={}){
    const templateId=String(options.templateId||'');
    const records=S()?.listSavedSessions?.()||[];
    return templateId?records.filter(record=>record.templateId===templateId):records;
  }
  function get(savedId){return S()?.getSavedSession?.(savedId)||null;}
  function rename(savedId,name,now){return S().renameSavedSession(savedId,name,nowIso(now));}
  function remove(savedId){return S().deleteSavedSession(savedId);}

  function resolverVersionFrom(session,templateId){
    const version=String(session?.resolverVersion||'');
    if(!version)fail('SAVED_SESSION_RESOLVER_UNAVAILABLE',`Current resolver version unavailable for ${templateId}`,{templateId});
    return version;
  }

  function f111Preset(record){
    const data=D(),level=record.level,recipeId=String(record.input?.recipeId||record.familyId||'').toUpperCase();
    const sessionId=`${recipeId}-${level}`,session=data.sessions?.[sessionId];
    if(!session||!data.recipes?.[recipeId])fail('SAVED_SESSION_INPUT_INVALID',`Unknown F111 preset: ${sessionId}`,{savedId:record.id});
    const slots=session.slots||[],view=data.sessionViews?.[sessionId]||{};

    function legal(key,actionId){
      const slot=slots.find(item=>normalizeSlotKey(item.slotKey)===key);
      if(!slot||!data.actions?.[actionId])return false;
      if(actionId===slot.baselineId)return true;
      const options=view.slotOptions?.[slot.slotKey]||[];
      return options.some(option=>option?.id===actionId);
    }
    function resolve(selections){
      const array=slots.map(slot=>selections[normalizeSlotKey(slot.slotKey)]?.actionId||slot.baselineId);
      return window.V15TemplateResolver.resolve('f111',{mode:'preset',recipeId,level,selections:array});
    }
    const probe=resolve({});
    return {
      templateId:'f111',familyId:recipeId,level,
      input:{mode:'preset',recipeId,level},
      sessionKey:sessionId,
      currentResolverVersion:resolverVersionFrom(probe,'f111'),
      legal,
      resolve,
      routeHash:`#/coach/f111/${recipeId.toLowerCase()}/${level.toLowerCase()}`,
      reasons:[],
    };
  }

  function composerModesFromFamily(familyId){
    const cfg=D().composer||{},parts=String(familyId||'').split('-'),lowerCode=parts[2]||'',upperCode=parts[3]||'';
    const lowerMode=Object.entries(cfg.lowerModes||{}).find(([,value])=>value?.code===lowerCode)?.[0]||'';
    const upperMode=Object.entries(cfg.upperModes||{}).find(([,value])=>value?.code===upperCode)?.[0]||'';
    return {lowerMode,upperMode};
  }

  function f111Composer(record){
    const data=D(),cfg=data.composer||{},savedInput=isObject(record.input)?record.input:{},reasons=[];
    const level=/^L[1-4]$/.test(record.level||'')?record.level:'L1';
    const inferred=composerModesFromFamily(record.familyId);
    const lowerMode=cfg.lowerModes?.[savedInput.lowerMode]?savedInput.lowerMode:(inferred.lowerMode||Object.keys(cfg.lowerModes||{})[0]);
    const upperMode=cfg.upperModes?.[savedInput.upperMode]?savedInput.upperMode:(inferred.upperMode||Object.keys(cfg.upperModes||{})[0]);
    const coreDemand=cfg.coreDemands?.[savedInput.coreDemand]?savedInput.coreDemand:'anti_extension';
    if(savedInput.lowerMode!==lowerMode||savedInput.upperMode!==upperMode||savedInput.coreDemand!==coreDemand)reasons.push('INPUT_MIGRATED');
    const input={
      mode:'composer',level,lowerMode,upperMode,coreDemand,
      includeExpandedMain:savedInput.includeExpandedMain===true,
      includeExpandedSupport:savedInput.includeExpandedSupport===true,
      includeExpandedCore:savedInput.includeExpandedCore===true,
    };
    const base=window.V14Composer.resolve(input),sessionKey=`${base.compositionId}-${level}`;
    input.legacyCompositionKey=sessionKey;

    function legal(key,actionId,accepted={}){
      if(!SLOT_ORDER.includes(key)||!data.actions?.[actionId])return false;
      const trial=Object.fromEntries(Object.entries(accepted).map(([k,entry])=>[k,entry.actionId]));
      trial[key]=actionId;
      const resolved=window.V14Composer.resolve({...input,selections:trial});
      return resolved.slots.find(slot=>slot.slotKey===key)?.actionId===actionId;
    }
    function resolve(selections){
      const map=Object.fromEntries(Object.entries(selections||{}).map(([key,entry])=>[key,entry.actionId]));
      return window.V15TemplateResolver.resolve('f111',{...input,selections:map});
    }
    const probe=resolve({});
    const query=new URLSearchParams({lower:lowerMode,upper:upperMode,core:coreDemand,level});
    if(input.includeExpandedMain)query.set('em','1');
    if(input.includeExpandedSupport)query.set('es','1');
    if(input.includeExpandedCore)query.set('ec','1');
    return {
      templateId:'f111',familyId:base.compositionId,level,input,sessionKey,
      currentResolverVersion:resolverVersionFrom(probe,'f111'),
      legal,resolve,
      routeHash:`#/coach/f111/compose?${query.toString()}`,
      reasons,
    };
  }

  function body(record){
    const data=D(),familyId=record.familyId,level=record.level;
    if(!data.bodyFamilyIds?.includes(familyId)||!/^L[1-4]$/.test(level||'')){
      fail('SAVED_SESSION_INPUT_INVALID',`Invalid Body saved input: ${familyId} / ${level}`,{savedId:record.id});
    }
    const input={familyId,level},sessionKey=`${familyId}-${level}`;
    function legal(key,actionId){
      return window.V15BodyResolver.isSelectionValid({familyId,level,slotKey:key,actionId});
    }
    function resolve(selections){
      return window.V15TemplateResolver.resolve('body',{familyId,level,selections});
    }
    const probe=resolve({});
    return {
      templateId:'body',familyId,level,input,sessionKey,
      currentResolverVersion:resolverVersionFrom(probe,'body'),
      legal,resolve,
      routeHash:`#/coach/body/${familyId.toLowerCase()}/${level.toLowerCase()}`,
      reasons:[],
    };
  }

  function conditioning(record){
    const data=D(),familyId=record.familyId,level=record.level,reasons=[];
    if(!data.conditioningFamilyIds?.includes(familyId)||!/^L[1-4]$/.test(level||'')){
      fail('SAVED_SESSION_INPUT_INVALID',`Invalid Conditioning saved input: ${familyId} / ${level}`,{savedId:record.id});
    }
    const legalProtocols=data.conditioningFamilies?.[familyId]?.protocolEligibility||[];
    const savedProtocol=String(record.input?.protocolId||'').toUpperCase();
    let protocolId=savedProtocol;
    if(!legalProtocols.includes(protocolId)){
      protocolId=window.V15ConditioningProtocol.selectProtocol(familyId,level,'');
      reasons.push('STALE_PROTOCOL');
    }
    const input={familyId,level,protocolId},sessionKey=`${familyId}-${level}-${protocolId}`;
    function legal(key,actionId){
      return window.V15ConditioningResolver.isSelectionValid({familyId,level,protocolId,stationKey:key,actionId});
    }
    function resolve(selections){
      return window.V15TemplateResolver.resolve('conditioning',{familyId,level,protocolId,selections});
    }
    const probe=resolve({}),defaultProtocol=window.V15ConditioningProtocol.selectProtocol(familyId,level,'');
    const routeHash=protocolId===defaultProtocol
      ?`#/coach/conditioning/${familyId.toLowerCase()}/${level.toLowerCase()}`
      :`#/coach/conditioning/compose?${new URLSearchParams({family:familyId,level,protocol:protocolId}).toString()}`;
    return {
      templateId:'conditioning',familyId,level,input,sessionKey,
      currentResolverVersion:resolverVersionFrom(probe,'conditioning'),
      legal,resolve,routeHash,reasons,
    };
  }

  function prepare(record){
    if(!record||typeof record!=='object')fail('SAVED_SESSION_NOT_FOUND','SavedSession record not found');
    if(record.schemaVersion!==S().getSchemaVersion()){
      fail('SAVED_SESSION_SCHEMA_UNSUPPORTED',`Unsupported SavedSession schemaVersion: ${record.schemaVersion}`,{savedId:record.id,observedVersion:record.schemaVersion});
    }
    if(record.templateId==='f111'){
      return record.input?.mode==='composer'?f111Composer(record):f111Preset(record);
    }
    if(record.templateId==='body')return body(record);
    if(record.templateId==='conditioning')return conditioning(record);
    fail('SAVED_SESSION_TEMPLATE_UNSUPPORTED',`Unsupported SavedSession template: ${record.templateId}`,{savedId:record.id,templateId:record.templateId});
  }

  function cleanFormal(record,prepared){
    const requested=manualMap(record.selections),accepted={},dropped=[];
    const keys=record.templateId==='f111'&&prepared.input.mode==='composer'
      ?SLOT_ORDER
      :Object.keys(requested).sort();
    for(const key of keys){
      const entry=requested[key];
      if(!entry)continue;
      const valid=prepared.legal(key,entry.actionId,accepted);
      if(valid)accepted[key]=entry;
      else dropped.push(key);
    }
    for(const key of Object.keys(requested)){
      if(keys.includes(key))continue;
      if(prepared.legal(key,requested[key].actionId,accepted))accepted[key]=requested[key];
      else dropped.push(key);
    }
    return {accepted,dropped:[...new Set(dropped)]};
  }

  function cleanPrep(record,resolvedSession){
    const requested=manualMap(record.prepSelections),accepted={},dropped=[];
    const resolver=window.V14PrepResolver;
    if(!resolver?.resolve||!resolvedSession?.prepContext){
      return {accepted:{},dropped:Object.keys(requested)};
    }
    const order=Array.isArray(resolver.SLOT_ORDER)?resolver.SLOT_ORDER:Object.keys(requested);
    for(const slotKey of order){
      const entry=requested[slotKey];
      if(!entry)continue;
      const trial={...accepted,[slotKey]:entry};
      const resolved=resolver.resolve(resolvedSession.prepContext,{selections:trial});
      const slot=resolved.slots?.find(item=>item.slotKey===slotKey);
      if(slot?.source==='manual'&&slot.actionId===entry.actionId)accepted[slotKey]=entry;
      else dropped.push(slotKey);
    }
    for(const slotKey of Object.keys(requested)){
      if(order.includes(slotKey))continue;
      dropped.push(slotKey);
    }
    return {accepted,dropped:[...new Set(dropped)]};
  }

  function install(prepared,selections,prepSelections){
    const state=S(),metadata={
      familyId:prepared.familyId,
      level:prepared.level,
      resolverVersion:prepared.currentResolverVersion,
      input:prepared.input,
    };
    state.resetSession(prepared.templateId,prepared.sessionKey);
    state.ensureSession(prepared.templateId,prepared.sessionKey,metadata);
    state.patchSession(prepared.templateId,prepared.sessionKey,{selections,prepSelections});
    if(prepared.templateId==='f111'&&prepared.input.mode==='composer'&&window.V14State?.setComposerContext){
      window.V14State.setComposerContext(prepared.sessionKey,prepared.input);
    }
    return state.getSession(prepared.templateId,prepared.sessionKey);
  }

  function restore(savedId){
    const record=get(savedId);
    if(!record)fail('SAVED_SESSION_NOT_FOUND',`Unknown saved session: ${savedId}`,{savedId});
    const prepared=prepare(record),reasons=[...(prepared.reasons||[])];
    if(record.resolverVersion!==prepared.currentResolverVersion)reasons.push('RESOLVER_VERSION_MIGRATED');

    const formal=cleanFormal(record,prepared);
    if(formal.dropped.length)reasons.push('STALE_SELECTION');
    const formalSession=prepared.resolve(formal.accepted);
    const prep=cleanPrep(record,formalSession);
    if(prep.dropped.length)reasons.push('STALE_PREP_SELECTION');

    install(prepared,formal.accepted,prep.accepted);
    const resolvedSession=prepared.resolve(formal.accepted);
    return {
      savedId,
      record:clone(record),
      templateId:prepared.templateId,
      sessionKey:prepared.sessionKey,
      routeHash:prepared.routeHash,
      state:S().getSession(prepared.templateId,prepared.sessionKey),
      resolvedSession,
      reasons:[...new Set(reasons)],
      droppedSelections:formal.dropped,
      droppedPrepSelections:prep.dropped,
      migrated:reasons.length>0,
    };
  }

  window.V15SavedSessions={saveCurrent,list,get,rename,remove,restore,prepare};
})();
