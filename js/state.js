(function(){
  'use strict';

  const V15_KEY='7fit-v15-state';
  const LEGACY_KEY='7fit-v14-state';
  const MODE_KEY='7fit-v14-mode';
  const SCHEMA_VERSION=1;
  const SAVED_SESSION_SCHEMA_VERSION=1;
  const F111_RESOLVER_VERSION='f111-adapter-v1';
  const FORMAL_SOURCES=new Set(['baseline','auto','manual']);
  const PREP_SOURCES=new Set(['auto','manual']);
  const RECENT_ACTION_LIMIT=80;
  const D=()=>window.V14_DATA||{};
  const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const clone=value=>JSON.parse(JSON.stringify(value));
  let memoryMode='coach';
  let store;
  let loadStatus={code:'FRESH'};
  let saveSequence=0;

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function readStorage(key){
    try{return sessionStorage.getItem(key);}catch(_){return null;}
  }

  function writeStorage(key,value){
    try{sessionStorage.setItem(key,value);}catch(_){}
  }

  function removeStorage(key){
    try{sessionStorage.removeItem(key);}catch(_){}
  }

  function activeTemplateIds(){
    const data=D();
    const ids=(Array.isArray(data.templateIds)?data.templateIds:[])
      .filter(id=>data.templateRegistry?.[id]?.status==='ACTIVE');
    return ids.length?ids:['f111','body','conditioning'];
  }

  function freshStore(){
    return {
      schemaVersion:SCHEMA_VERSION,
      templates:Object.fromEntries(activeTemplateIds().map(templateId=>[templateId,{sessions:{}}])),
      savedSessions:{},
      recentActions:[],
      favorites:{},
    };
  }

  function normalizeSelectionMap(value,prep=false){
    const allowed=prep?PREP_SOURCES:FORMAL_SOURCES;
    const out={};
    if(!isObject(value))return out;
    for(const [key,entry] of Object.entries(value)){
      if(!isObject(entry)||typeof entry.actionId!=='string'||!entry.actionId)continue;
      if(!allowed.has(entry.source))continue;
      out[key]={actionId:entry.actionId,source:entry.source};
    }
    return out;
  }

  function normalizeSession(templateId,value={}){
    return {
      templateId,
      familyId:typeof value.familyId==='string'?value.familyId:'',
      level:/^L[1-4]$/.test(value.level||'')?value.level:'',
      resolverVersion:typeof value.resolverVersion==='string'?value.resolverVersion:'',
      input:isObject(value.input)?clone(value.input):{},
      selections:normalizeSelectionMap(value.selections,false),
      prepSelections:normalizeSelectionMap(value.prepSelections,true),
    };
  }

  function normalizeSavedSession(savedId,value={}){
    if(!isObject(value))return null;
    const templateId=typeof value.templateId==='string'?value.templateId:'';
    const familyId=typeof value.familyId==='string'?value.familyId:'';
    const level=/^L[1-4]$/.test(value.level||'')?value.level:'';
    const resolverVersion=typeof value.resolverVersion==='string'?value.resolverVersion:'';
    if(!templateId||!familyId||!level||!resolverVersion)return null;
    const createdAt=typeof value.createdAt==='string'&&value.createdAt?value.createdAt:'';
    const updatedAt=typeof value.updatedAt==='string'&&value.updatedAt?value.updatedAt:createdAt;
    return {
      savedId,
      schemaVersion:Number.isInteger(value.schemaVersion)?value.schemaVersion:SAVED_SESSION_SCHEMA_VERSION,
      resolverVersion,
      templateId,
      familyId,
      level,
      input:isObject(value.input)?clone(value.input):{},
      selections:normalizeSelectionMap(value.selections,false),
      prepSelections:normalizeSelectionMap(value.prepSelections,true),
      createdAt,
      updatedAt,
      name:typeof value.name==='string'&&value.name.trim()?value.name.trim():`${familyId} · ${level}`,
    };
  }

  function normalizeRecentAction(value){
    if(!isObject(value))return null;
    const templateId=typeof value.templateId==='string'?value.templateId:'';
    const actionId=typeof value.actionId==='string'?value.actionId:'';
    const contextKey=typeof value.contextKey==='string'?value.contextKey:'';
    if(!templateId||!activeTemplateIds().includes(templateId)||!actionId||!D().actions?.[actionId]||!contextKey)return null;
    return {
      templateId,
      actionId,
      contextKey,
      context:isObject(value.context)?clone(value.context):{},
      usedAt:typeof value.usedAt==='string'?value.usedAt:'',
      useCount:Number.isInteger(value.useCount)&&value.useCount>0?value.useCount:1,
    };
  }

  function normalizeRoot(value){
    const next=freshStore();
    if(!isObject(value))return next;
    for(const templateId of Object.keys(next.templates)){
      const sessions=value.templates?.[templateId]?.sessions;
      if(!isObject(sessions))continue;
      for(const [sessionKey,sessionValue] of Object.entries(sessions)){
        if(!isObject(sessionValue))continue;
        next.templates[templateId].sessions[sessionKey]=normalizeSession(templateId,sessionValue);
      }
    }
    if(isObject(value.savedSessions)){
      for(const [savedId,savedValue] of Object.entries(value.savedSessions)){
        const normalized=normalizeSavedSession(savedId,savedValue);
        if(normalized)next.savedSessions[savedId]=normalized;
      }
    }
    if(Array.isArray(value.recentActions)){
      const seen=new Set();
      for(const recentValue of value.recentActions){
        const normalized=normalizeRecentAction(recentValue);
        if(!normalized)continue;
        const key=`${normalized.templateId}::${normalized.contextKey}::${normalized.actionId}`;
        if(seen.has(key))continue;
        seen.add(key);
        next.recentActions.push(normalized);
        if(next.recentActions.length>=RECENT_ACTION_LIMIT)break;
      }
    }
    next.favorites=isObject(value.favorites)?clone(value.favorites):{};
    return next;
  }

  function persist(){writeStorage(V15_KEY,JSON.stringify(store));}

  function normalizeLegacySlotKey(slotKey){
    const raw=String(slotKey||'');
    return raw.includes('__')?raw.split('__').pop():raw;
  }

  function migrateLegacy(value){
    const next=freshStore(),data=D(),f111=next.templates.f111;
    if(!f111||!isObject(value))return next;

    if(isObject(value.selections)){
      for(const [sessionId,legacySelections] of Object.entries(value.selections)){
        if(!data.sessions?.[sessionId]||!isObject(legacySelections))continue;
        const match=sessionId.match(/-(L[1-4])$/),level=match?.[1]||'';
        if(!level)continue;
        const familyId=sessionId.slice(0,-3);
        const session={
          templateId:'f111',familyId,level,resolverVersion:F111_RESOLVER_VERSION,
          input:{mode:'preset',recipeId:familyId,level},selections:{},prepSelections:{},
        };
        for(const [slotKey,actionId] of Object.entries(legacySelections)){
          if(typeof actionId!=='string'||!data.actions?.[actionId])continue;
          const key=normalizeLegacySlotKey(slotKey);
          if(key)session.selections[key]={actionId,source:'manual'};
        }
        f111.sessions[sessionId]=session;
      }
    }

    if(isObject(value.composerSelections)){
      for(const [compositionKey,legacySelections] of Object.entries(value.composerSelections)){
        if(!isObject(legacySelections))continue;
        const match=compositionKey.match(/-(L[1-4])$/),level=match?.[1]||'';
        if(!level)continue;
        const familyId=compositionKey.slice(0,-3);
        const session={
          templateId:'f111',familyId,level,resolverVersion:F111_RESOLVER_VERSION,
          input:{mode:'composer',legacyCompositionKey:compositionKey,level},selections:{},prepSelections:{},
        };
        for(const [slotKey,actionId] of Object.entries(legacySelections)){
          if(typeof actionId!=='string'||!data.actions?.[actionId])continue;
          session.selections[slotKey]={actionId,source:'manual'};
        }
        f111.sessions[compositionKey]=session;
      }
    }
    return next;
  }

  function load(){
    const raw=readStorage(V15_KEY);
    if(raw!==null){
      let parsed;
      try{parsed=JSON.parse(raw);}catch(_){
        store=freshStore();
        loadStatus={code:'RESET_INVALID_JSON'};
        persist();
        return;
      }
      if(parsed?.schemaVersion!==SCHEMA_VERSION){
        store=freshStore();
        loadStatus={code:'RESET_UNSUPPORTED_SCHEMA_VERSION',observedVersion:parsed?.schemaVersion??null};
        persist();
        return;
      }
      store=normalizeRoot(parsed);
      loadStatus={code:'LOADED'};
      persist();
      return;
    }

    const legacyRaw=readStorage(LEGACY_KEY);
    if(legacyRaw!==null){
      try{
        store=migrateLegacy(JSON.parse(legacyRaw));
        loadStatus={code:'MIGRATED_V14'};
      }catch(_){
        store=freshStore();
        loadStatus={code:'RESET_INVALID_LEGACY_JSON'};
      }
      persist();
      return;
    }

    store=freshStore();
    loadStatus={code:'FRESH'};
    persist();
  }

  function namespace(templateId){
    const value=store.templates?.[templateId];
    if(!value)fail('UNKNOWN_TEMPLATE',`Unknown active state template: ${templateId}`,{templateId});
    return value;
  }

  function sessionRef(templateId,sessionKey){
    const ns=namespace(templateId);
    return ns.sessions?.[sessionKey]||null;
  }

  function validateNewMetadata(templateId,metadata){
    if(!isObject(metadata))fail('INVALID_SESSION_METADATA','Session metadata must be an object',{templateId});
    if(typeof metadata.familyId!=='string'||!metadata.familyId)fail('INVALID_SESSION_METADATA','familyId is required',{templateId});
    if(!/^L[1-4]$/.test(metadata.level||''))fail('INVALID_SESSION_METADATA','level must be L1-L4',{templateId});
    if(typeof metadata.resolverVersion!=='string'||!metadata.resolverVersion)fail('INVALID_SESSION_METADATA','resolverVersion is required',{templateId});
    if(!isObject(metadata.input))fail('INVALID_SESSION_METADATA','input must be an object',{templateId});
  }

  function guardResolverVersion(current,nextVersion,templateId,sessionKey){
    if(typeof nextVersion!=='string'||!nextVersion||nextVersion===current.resolverVersion)return;
    fail(
      'RESOLVER_VERSION_CHANGE_REQUIRES_RECONCILE',
      `Resolver version change requires reconcileSession: ${current.resolverVersion} → ${nextVersion}`,
      {templateId,sessionKey,currentResolverVersion:current.resolverVersion,requestedResolverVersion:nextVersion}
    );
  }

  function ensureSession(templateId,sessionKey,metadata={}){
    const ns=namespace(templateId);
    if(typeof sessionKey!=='string'||!sessionKey)fail('INVALID_SESSION_KEY','sessionKey is required',{templateId});
    let current=ns.sessions[sessionKey];
    if(!current){
      validateNewMetadata(templateId,metadata);
      current=normalizeSession(templateId,metadata);
      ns.sessions[sessionKey]=current;
      persist();
      return clone(current);
    }
    guardResolverVersion(current,metadata.resolverVersion,templateId,sessionKey);
    let changed=false;
    if(typeof metadata.familyId==='string'&&metadata.familyId&&metadata.familyId!==current.familyId){current.familyId=metadata.familyId;changed=true;}
    if(/^L[1-4]$/.test(metadata.level||'')&&metadata.level!==current.level){current.level=metadata.level;changed=true;}
    if(isObject(metadata.input)){
      const merged={...current.input,...clone(metadata.input)};
      if(JSON.stringify(merged)!==JSON.stringify(current.input)){current.input=merged;changed=true;}
    }
    if(changed)persist();
    return clone(current);
  }

  function patchSession(templateId,sessionKey,patch={}){
    const current=sessionRef(templateId,sessionKey);
    if(!current)fail('SESSION_NOT_FOUND',`Unknown session: ${sessionKey}`,{templateId,sessionKey});
    guardResolverVersion(current,patch.resolverVersion,templateId,sessionKey);
    if(typeof patch.familyId==='string'&&patch.familyId)current.familyId=patch.familyId;
    if(/^L[1-4]$/.test(patch.level||''))current.level=patch.level;
    if(isObject(patch.input))current.input={...current.input,...clone(patch.input)};
    if(isObject(patch.selections))current.selections=normalizeSelectionMap(patch.selections,false);
    if(isObject(patch.prepSelections))current.prepSelections=normalizeSelectionMap(patch.prepSelections,true);
    persist();
    return clone(current);
  }

  function getSession(templateId,sessionKey){
    const current=sessionRef(templateId,sessionKey);
    return current?clone(current):null;
  }

  function getSelections(templateId,sessionKey){return clone(sessionRef(templateId,sessionKey)?.selections||{});}
  function getPrepSelections(templateId,sessionKey){return clone(sessionRef(templateId,sessionKey)?.prepSelections||{});}

  function setSelection(templateId,sessionKey,key,actionId,source='manual'){
    const current=sessionRef(templateId,sessionKey);
    if(!current)fail('SESSION_NOT_FOUND',`Unknown session: ${sessionKey}`,{templateId,sessionKey});
    if(typeof key!=='string'||!key||typeof actionId!=='string'||!actionId)fail('INVALID_SELECTION','Selection key and actionId are required',{templateId,sessionKey,key});
    if(!FORMAL_SOURCES.has(source))fail('INVALID_SELECTION_SOURCE',`Invalid selection source: ${source}`,{source});
    current.selections[key]={actionId,source};
    persist();
    return clone(current.selections[key]);
  }

  function setPrepSelection(templateId,sessionKey,slotKey,actionId,source='manual'){
    const current=sessionRef(templateId,sessionKey);
    if(!current)fail('SESSION_NOT_FOUND',`Unknown session: ${sessionKey}`,{templateId,sessionKey});
    if(typeof slotKey!=='string'||!slotKey||typeof actionId!=='string'||!actionId)fail('INVALID_PREP_SELECTION','PREP slotKey and actionId are required',{templateId,sessionKey,slotKey});
    if(!PREP_SOURCES.has(source))fail('INVALID_PREP_SELECTION_SOURCE',`Invalid PREP source: ${source}`,{source});
    current.prepSelections[slotKey]={actionId,source};
    persist();
    return clone(current.prepSelections[slotKey]);
  }

  function resetSession(templateId,sessionKey){
    const ns=namespace(templateId);
    delete ns.sessions[sessionKey];
    persist();
  }

  function nowIso(value){
    if(typeof value==='string'&&value)return value;
    if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString();
    return new Date().toISOString();
  }

  function savedSessionId(now){
    const stamp=String(Date.parse(now)||Date.now()).toString(36);
    let id;
    do{
      saveSequence+=1;
      id=`saved-${stamp}-${saveSequence.toString(36)}`;
    }while(store.savedSessions[id]);
    return id;
  }

  function createSavedSession(templateId,sessionKey,options={}){
    const current=sessionRef(templateId,sessionKey);
    if(!current)fail('SESSION_NOT_FOUND',`Unknown session: ${sessionKey}`,{templateId,sessionKey});
    const now=nowIso(options.now);
    const savedId=typeof options.savedId==='string'&&options.savedId.trim()
      ?options.savedId.trim()
      :savedSessionId(now);
    if(store.savedSessions[savedId])fail('SAVED_SESSION_EXISTS',`Saved session already exists: ${savedId}`,{savedId});
    const name=typeof options.name==='string'&&options.name.trim()
      ?options.name.trim()
      :`${current.familyId} · ${current.level}`;
    const record={
      savedId,
      schemaVersion:SAVED_SESSION_SCHEMA_VERSION,
      resolverVersion:current.resolverVersion,
      templateId,
      familyId:current.familyId,
      level:current.level,
      input:isObject(options.input)?clone(options.input):clone(current.input),
      selections:normalizeSelectionMap(current.selections,false),
      prepSelections:normalizeSelectionMap(current.prepSelections,true),
      createdAt:now,
      updatedAt:now,
      name,
    };
    store.savedSessions[savedId]=record;
    persist();
    return clone(record);
  }

  function getSavedSession(savedId){
    const record=store.savedSessions?.[savedId];
    return record?clone(record):null;
  }

  function listSavedSessions(){
    return Object.values(store.savedSessions||{})
      .map(clone)
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))||String(a.savedId).localeCompare(String(b.savedId)));
  }

  function renameSavedSession(savedId,name,options={}){
    const record=store.savedSessions?.[savedId];
    if(!record)fail('SAVED_SESSION_NOT_FOUND',`Unknown saved session: ${savedId}`,{savedId});
    const next=typeof name==='string'?name.trim():'';
    if(!next)fail('INVALID_SAVED_SESSION_NAME','Saved session name is required',{savedId});
    record.name=next;
    record.updatedAt=nowIso(options.now);
    persist();
    return clone(record);
  }

  function deleteSavedSession(savedId){
    if(!store.savedSessions?.[savedId])return false;
    delete store.savedSessions[savedId];
    persist();
    return true;
  }

  function recordRecentAction(templateId,actionId,contextKey,context={},options={}){
    namespace(templateId);
    if(typeof actionId!=='string'||!D().actions?.[actionId])fail('INVALID_RECENT_ACTION','Recent actionId must exist',{templateId,actionId});
    if(typeof contextKey!=='string'||!contextKey.trim())fail('INVALID_RECENT_CONTEXT','Recent contextKey is required',{templateId,actionId});
    if(!isObject(context))fail('INVALID_RECENT_CONTEXT','Recent context must be an object',{templateId,actionId,contextKey});
    const key=contextKey.trim(),index=store.recentActions.findIndex(item=>
      item.templateId===templateId&&item.contextKey===key&&item.actionId===actionId
    );
    const previous=index>=0?store.recentActions.splice(index,1)[0]:null;
    const usedAt=nowIso(options.now);
    const entry={
      templateId,
      actionId,
      contextKey:key,
      context:clone(context),
      usedAt,
      useCount:(previous?.useCount||0)+1,
    };
    store.recentActions.unshift(entry);
    if(store.recentActions.length>RECENT_ACTION_LIMIT)store.recentActions.length=RECENT_ACTION_LIMIT;
    persist();
    return clone(entry);
  }

  function listRecentActions(options={}){
    const templateId=typeof options.templateId==='string'?options.templateId:'';
    const contextKey=typeof options.contextKey==='string'?options.contextKey:'';
    const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:RECENT_ACTION_LIMIT;
    return store.recentActions
      .filter(item=>(!templateId||item.templateId===templateId)&&(!contextKey||item.contextKey===contextKey))
      .slice(0,limit)
      .map(clone);
  }

  function clearRecentActions(options={}){
    const templateId=typeof options.templateId==='string'?options.templateId:'';
    const contextKey=typeof options.contextKey==='string'?options.contextKey:'';
    if(!templateId&&!contextKey){
      const count=store.recentActions.length;
      store.recentActions=[];
      persist();
      return count;
    }
    const before=store.recentActions.length;
    store.recentActions=store.recentActions.filter(item=>
      !((!templateId||item.templateId===templateId)&&(!contextKey||item.contextKey===contextKey))
    );
    if(store.recentActions.length!==before)persist();
    return before-store.recentActions.length;
  }

  function reconcileSession(templateId,sessionKey,options={}){
    const current=sessionRef(templateId,sessionKey);
    if(!current)fail('SESSION_NOT_FOUND',`Unknown session: ${sessionKey}`,{templateId,sessionKey});
    const reasons=[],droppedSelections=[],droppedPrepSelections=[];
    const requestedVersion=typeof options.resolverVersion==='string'?options.resolverVersion:'';
    if(requestedVersion&&requestedVersion!==current.resolverVersion){
      current.resolverVersion=requestedVersion;
      current.selections={};
      current.prepSelections={};
      reasons.push('RESOLVER_VERSION_MISMATCH');
      persist();
      return {session:clone(current),reasons,droppedSelections,droppedPrepSelections};
    }

    for(const [key,entry] of Object.entries(current.selections)){
      const exists=!!D().actions?.[entry.actionId];
      const valid=exists&&(typeof options.isSelectionValid!=='function'||options.isSelectionValid(key,clone(entry),clone(current))!==false);
      if(valid)continue;
      delete current.selections[key];
      droppedSelections.push(key);
      if(!reasons.includes('STALE_SELECTION'))reasons.push('STALE_SELECTION');
    }
    for(const [slotKey,entry] of Object.entries(current.prepSelections)){
      const exists=!!D().actions?.[entry.actionId];
      const valid=exists&&(typeof options.isPrepSelectionValid!=='function'||options.isPrepSelectionValid(slotKey,clone(entry),clone(current))!==false);
      if(valid)continue;
      delete current.prepSelections[slotKey];
      droppedPrepSelections.push(slotKey);
      if(!reasons.includes('STALE_PREP_SELECTION'))reasons.push('STALE_PREP_SELECTION');
    }
    if(droppedSelections.length||droppedPrepSelections.length)persist();
    return {session:clone(current),reasons,droppedSelections,droppedPrepSelections};
  }

  function clear(){
    store=freshStore();
    loadStatus={code:'CLEARED'};
    removeStorage(V15_KEY);
    removeStorage(LEGACY_KEY);
  }

  load();

  window.V15State={
    getSchemaVersion(){return SCHEMA_VERSION;},
    getSavedSessionSchemaVersion(){return SAVED_SESSION_SCHEMA_VERSION;},
    getLoadStatus(){return clone(loadStatus);},
    snapshot(){return clone(store);},
    serialize(){return JSON.stringify(store);},
    getSession,ensureSession,patchSession,setSelection,getSelections,
    setPrepSelection,getPrepSelections,resetSession,reconcileSession,
    createSavedSession,getSavedSession,listSavedSessions,renameSavedSession,deleteSavedSession,
    recordRecentAction,listRecentActions,clearRecentActions,
    clear,
  };

  function v14Session(sessionId){return D().sessions?.[sessionId];}
  function v14PresetMetadata(sessionId){
    const match=String(sessionId||'').match(/-(L[1-4])$/),level=match?.[1]||'';
    const familyId=level?sessionId.slice(0,-3):sessionId;
    return {familyId,level,resolverVersion:F111_RESOLVER_VERSION,input:{mode:'preset',recipeId:familyId,level}};
  }
  function v14ComposerMetadata(compositionKey){
    const match=String(compositionKey||'').match(/-(L[1-4])$/),level=match?.[1]||'';
    const familyId=level?compositionKey.slice(0,-3):compositionKey;
    return {familyId,level:level||'L1',resolverVersion:F111_RESOLVER_VERSION,input:{mode:'composer',legacyCompositionKey:compositionKey,...(level?{level}:{})}};
  }
  function ensureV14Preset(sessionId){
    const current=getSession('f111',sessionId);
    if(current)return current;
    const metadata=v14PresetMetadata(sessionId);
    if(!v14Session(sessionId)||!metadata.level)return null;
    return ensureSession('f111',sessionId,metadata);
  }
  function ensureV14Composer(compositionKey){
    const current=getSession('f111',compositionKey);
    return current||ensureSession('f111',compositionKey,v14ComposerMetadata(compositionKey));
  }
  function validActionId(actionId){return typeof actionId==='string'&&!!D().actions?.[actionId];}

  window.V14State={
    getMode(){try{return sessionStorage.getItem(MODE_KEY)||memoryMode;}catch(_){return memoryMode;}},
    setMode(mode){
      const value=mode==='system'?'system':'coach';
      memoryMode=value;
      try{sessionStorage.setItem(MODE_KEY,value);}catch(_){}
      if(typeof document!=='undefined'&&document.body)document.body.dataset.mode=value;
      return value;
    },
    getSelection(sessionId,slotKey){
      const current=ensureV14Preset(sessionId),key=normalizeLegacySlotKey(slotKey);
      const saved=current?.selections?.[key];
      if(saved&&validActionId(saved.actionId))return saved.actionId;
      if(saved)reconcileSession('f111',sessionId,{resolverVersion:F111_RESOLVER_VERSION});
      const slot=v14Session(sessionId)?.slots.find(item=>item.slotKey===slotKey||normalizeLegacySlotKey(item.slotKey)===key);
      return slot?.baselineId||'';
    },
    getSessionSelections(sessionId){
      const current=v14Session(sessionId);
      if(!current)return [];
      return current.slots.map(slot=>this.getSelection(sessionId,slot.slotKey));
    },
    setSelection(sessionId,slotKey,actionId){
      const current=ensureV14Preset(sessionId);
      if(!current)return;
      setSelection('f111',sessionId,normalizeLegacySlotKey(slotKey),actionId,'manual');
    },
    resetSession(sessionId){resetSession('f111',sessionId);},
    getComposerSelection(compositionKey,slotKey,fallback=''){
      const current=getSession('f111',compositionKey);
      const saved=current?.selections?.[slotKey];
      if(saved&&validActionId(saved.actionId))return saved.actionId;
      if(saved)reconcileSession('f111',compositionKey,{resolverVersion:F111_RESOLVER_VERSION});
      return fallback;
    },
    getComposerSelections(compositionKey){
      const current=getSession('f111',compositionKey);
      if(!current)return {};
      const reconciled=reconcileSession('f111',compositionKey,{resolverVersion:F111_RESOLVER_VERSION}).session;
      return Object.fromEntries(Object.entries(reconciled.selections).map(([key,entry])=>[key,entry.actionId]));
    },
    setComposerSelection(compositionKey,slotKey,actionId){
      ensureV14Composer(compositionKey);
      setSelection('f111',compositionKey,slotKey,actionId,'manual');
    },
    setComposerContext(compositionKey,metadata={}){
      ensureV14Composer(compositionKey);
      return patchSession('f111',compositionKey,{input:{mode:'composer',legacyCompositionKey:compositionKey,...metadata},...(metadata.level?{level:metadata.level}:{})});
    },
    resetComposer(compositionKey){resetSession('f111',compositionKey);},
    clear,
  };
})();
