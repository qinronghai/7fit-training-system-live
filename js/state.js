(function(){
  const KEY='7fit-v14-state';
  const MODE_KEY='7fit-v14-mode';
  let memoryMode='coach';
  let store={selections:{},composerSelections:{}};
  try{store=JSON.parse(sessionStorage.getItem(KEY)||'{"selections":{},"composerSelections":{}}');}catch(_){store={selections:{},composerSelections:{}};}
  store.selections=store.selections||{};store.composerSelections=store.composerSelections||{};
  function persist(){try{sessionStorage.setItem(KEY,JSON.stringify(store));}catch(_){}}
  function session(sessionId){return window.V14_DATA.sessions[sessionId];}
  window.V14State={
    getMode(){try{return sessionStorage.getItem(MODE_KEY)||memoryMode;}catch(_){return memoryMode;}},
    setMode(mode){const v=mode==='system'?'system':'coach';memoryMode=v;try{sessionStorage.setItem(MODE_KEY,v);}catch(_){}document.body.dataset.mode=v;return v;},
    getSelection(sessionId,slotKey){
      const saved=store.selections[sessionId]?.[slotKey];
      if(saved)return saved;
      const slot=session(sessionId)?.slots.find(s=>s.slotKey===slotKey);
      return slot?.baselineId||'';
    },
    getSessionSelections(sessionId){
      const s=session(sessionId); if(!s)return [];
      return s.slots.map(slot=>this.getSelection(sessionId,slot.slotKey));
    },
    setSelection(sessionId,slotKey,actionId){store.selections[sessionId]=store.selections[sessionId]||{};store.selections[sessionId][slotKey]=actionId;persist();},
    resetSession(sessionId){delete store.selections[sessionId];persist();},
    getComposerSelection(compositionKey,slotKey,fallback=''){return store.composerSelections[compositionKey]?.[slotKey]||fallback;},
    getComposerSelections(compositionKey){return {...(store.composerSelections[compositionKey]||{})};},
    setComposerSelection(compositionKey,slotKey,actionId){store.composerSelections[compositionKey]=store.composerSelections[compositionKey]||{};store.composerSelections[compositionKey][slotKey]=actionId;persist();},
    resetComposer(compositionKey){delete store.composerSelections[compositionKey];persist();},
    clear(){store={selections:{},composerSelections:{}};persist();}
  };
})();
