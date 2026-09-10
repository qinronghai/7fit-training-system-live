(function(){
  'use strict';

  const V15_KEY='7fit-v15-state';
  const LEGACY_KEY='7fit-v14-state';
  const MODE_KEY='7fit-v14-mode';
  const SCHEMA_VERSION=1;
  const F111_RESOLVER_VERSION='f111-adapter-v1';
  const FORMAL_SOURCES=new Set(['baseline','auto','manual']);
  const PREP_SOURCES=new Set(['auto','manual']);
  const D=()=>window.V14_DATA||{};
  const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const clone=value=>JSON.parse(JSON.stringify(value));
  let memoryMode='coach';
  let store;
  let loadStatus={code:'FRESH'};

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
    next.savedSessions=isObject(value.savedSessions)?clone(value.savedSessions):{};
    next.recentActions=Array.isArray(value.recentActions)?clone(value.recentActions):[];
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
    let changed=false;
    if(typeof metadata.familyId==='string'&&metadata.familyId&&metadata.familyId!==current.familyId){current.familyId=metadata.familyId;changed=true;}
    if(/^L[1-4]$/.test(metadata.level||'')&&metadata.level!==current.level){current.level=metadata.level;changed=true;}
    if(typeof metadata.resolverVersion==='string'&&metadata.resolverVersion&&metadata.resolverVersion!==current.resolverVersion){current.resolverVersion=metadata.resolverVersion;changed=true;}
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
    if(typeof patch.familyId==='string'&&patch.familyId)current.familyId=patch.familyId;
    if(/^L[1-4]$/.test(patch.level||''))current.level=patch.level;
    if(typeof patch.resolverVersion==='string'&&patch.resolverVersion)current.resolverVersion=patch.resolverVersion;
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
    getLoadStatus(){return clone(loadStatus);},
    snapshot(){return clone(store);},
    serialize(){return JSON.stringify(store);},
    getSession,ensureSession,patchSession,setSelection,getSelections,
    setPrepSelection,getPrepSelections,resetSession,reconcileSession,clear,
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
