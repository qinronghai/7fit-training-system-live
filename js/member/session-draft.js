(function(){
  'use strict';

  const prefix = '7fit_member_course_draft:';
  let key = null, access = null, version = 0;

  async function open(session){
    const request=++version;
    key=null;access=null;
    try {
      const owner=await window.V14MemberAPI.draftAccess?.();
      if(request!==version || !owner?.isCurrent() || !session.memberId || !session.id)return null;
      const storage=window.localStorage;
      const ownerPrefix=prefix+owner.scope+':';
      const sessionPrefix=ownerPrefix+[session.memberId,session.id].join(':')+':';
      for(const name of Object.keys(storage)){
        if(name.startsWith(prefix) && !name.startsWith(ownerPrefix) ||
           session.status!=='PLANNED' && name.startsWith(sessionPrefix))storage.removeItem(name);
      }
      if(session.status!=='PLANNED')return null;
      access=owner;
      key=sessionPrefix+session.revision;
      return JSON.parse(storage.getItem(key)||'null');
    } catch (_) {
      return null;
    }
  }

  function save(value){
    if(!key||!access?.isCurrent())return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (_) {
      return false;
    }
  }

  function clear(){
    try { if (key) window.localStorage.removeItem(key); } catch (_) {}
    key=null;access=null;version++;
  }

  window.V14SessionDraft = { open, save, clear };
})();
