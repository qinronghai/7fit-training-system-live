(function(){
  'use strict';

  const API_BASE=String(window.V14_MEMBER_API_BASE||'https://ynsodlyanpmixbbxblqh.supabase.co/functions/v1/member-api').replace(/\/+$/,'');
  const STAFF_SESSION_KEY='7fit_case_admin_session';
  const DEVICE_SESSION_KEY='7fit_member_device_session';
  const PENDING_DEVICE_KEY='7fit_member_pending_device';
  const scriptUrl=typeof document==='undefined'?null:document.currentScript?.src;
  const apiUrl=new URL(API_BASE);
  const localPreview=apiUrl.pathname==='/__dev/member-api'&&apiUrl.hostname==='127.0.0.1'&&apiUrl.origin===window.location.origin;
  const publishedSite=!!scriptUrl&&!window.V14_MEMBER_API_BASE;
  const browserDemo=publishedSite&&new URL(window.location.href).searchParams.get('member-demo')==='1';
  let pendingDevice=publishedSite&&!browserDemo?readPendingDevice():null;
  let deviceSession=publishedSite?readStoredSession(DEVICE_SESSION_KEY):null;
  let deviceRedemption=null;
  const demoUrl=browserDemo?new URL('./demo-api.mjs',scriptUrl):null;
  if(demoUrl)demoUrl.search=new URL(scriptUrl).search;
  let demoRuntime=null;

  class MemberApiError extends Error{
    constructor(code,status,fields=[]){super(code);this.name='MemberApiError';this.code=code;this.status=status;this.fields=fields;}
  }

  function readStoredSession(key){
    try{
      const value=JSON.parse(window.localStorage.getItem(key)||'null');
      return value&&typeof value.token==='string'&&value.token?value:null;
    }catch(_){return null;}
  }

  function readPendingDevice(){
    const pageUrl=new URL(window.location.href);
    const [route,query]=pageUrl.hash.split('?');
    const parameters=new URLSearchParams(query);
    const code=route==='#/coach/members'?parameters.get('device-access'):null;
    if(code!==null){
      parameters.delete('device-access');
      pageUrl.searchParams.delete('activate-device');
      pageUrl.hash=route+(parameters.size?'?'+parameters.toString():'');
      history.replaceState(history.state,'',pageUrl);
    }
    try{
      const pending=JSON.parse(sessionStorage.getItem(PENDING_DEVICE_KEY)||'null');
      if(pending&&(!code||pending.code===code))return pending;
    }catch(_){}
    if(!/^menroll_[A-Za-z0-9_-]{43}$/.test(code||''))return null;
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const token='mdev_'+btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const pending={code,token};
    try{sessionStorage.setItem(PENDING_DEVICE_KEY,JSON.stringify(pending));}catch(_){}
    return pending;
  }

  function clearPendingDevice(){
    pendingDevice=null;
    try{sessionStorage.removeItem(PENDING_DEVICE_KEY);}catch(_){}
  }

  async function redeemDevice(){
    const url=new URL(API_BASE);
    url.searchParams.set('action','redeem-device');
    let response;
    try{
      response=await fetch(url.href,{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify(pendingDevice),cache:'no-store',
      });
    }catch(_){throw new MemberApiError('network_error',0);}
    if(response.status===401){
      clearPendingDevice();
      throw new MemberApiError('invalid_device_enrollment',401);
    }
    if(!response.ok)throw new MemberApiError('internal_error',response.status);
    const {expiresAt}=await response.json();
    if(!(Date.parse(expiresAt)>Date.now()))throw new MemberApiError('internal_error',500);
    deviceSession={token:pendingDevice.token,expiresAt};
    try{window.localStorage.setItem(DEVICE_SESSION_KEY,JSON.stringify(deviceSession));}catch(_){}
    clearPendingDevice();
    return deviceSession;
  }

  function redeemPendingDevice(){
    deviceRedemption ||= redeemDevice().finally(()=>{deviceRedemption=null;});
    return deviceRedemption;
  }

  function getSession(){
    if(deviceSession&&Date.parse(deviceSession.expiresAt)>Date.now())return deviceSession;
    return readStoredSession(STAFF_SESSION_KEY);
  }

  function clearSession(session){
    const isDevice=session===deviceSession;
    if(isDevice)deviceSession=null;
    const key=isDevice?DEVICE_SESSION_KEY:STAFF_SESSION_KEY;
    if(readStoredSession(key)?.token!==session.token)return;
    try{window.localStorage.removeItem(key);}catch(_){}
  }

  async function request(action,{method='GET',query={},body,signal}={}){
    const url=browserDemo?new URL('./member-demo',scriptUrl):new URL(API_BASE);
    const session=localPreview||browserDemo?null:pendingDevice?await redeemPendingDevice():getSession();
    if(!localPreview&&!browserDemo&&!session)throw new MemberApiError('staff_session_required',401);
    url.searchParams.set('action',action);
    for(const [key,value] of Object.entries(query)){
      if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
    }
    const headers=session?{authorization:`Bearer ${session.token}`}:{};
    const init={method,headers,signal,cache:'no-store'};
    if(body!==undefined){headers['content-type']='application/json';init.body=JSON.stringify(body);}
    let response;
    try{
      if(browserDemo){
        demoRuntime ||= import(demoUrl.href).catch(error=>{demoRuntime=null;throw error;});
        response=await (await demoRuntime).requestDemo(url,init);
      }else response=await fetch(url.href,init);
    }catch(_){throw new MemberApiError('network_error',0);}
    const payload=await response.json().catch(()=>({}));
    if(response.status===401&&session)clearSession(session);
    if(!response.ok)throw new MemberApiError(payload.error||'internal_error',response.status,payload.fields||[]);
    return payload;
  }

  function listMemberDirectory({search='',status='',includeArchived=false,includeCounts=false,limit=100,offset=0}={}){
    return request('list-members',{query:{search,status:status||'',includeArchived:includeArchived?'true':'',includeCounts:includeCounts?'true':'',limit,offset}});
  }

  const api={
    isDemo:localPreview||browserDemo,
    request,
    listMembers(options){return listMemberDirectory(options).then(value=>value.members||[]);},
    listMemberDirectory,
    getMember(memberId){return request('get-member',{query:{memberId}}).then(value=>value.member);},
    saveMember(member){return request('save-member',{method:'POST',body:member}).then(value=>value.member);},
    archiveMember(id){return request('archive-member',{method:'POST',body:{id}}).then(value=>value.member);},
    restoreMember(id){return request('restore-member',{method:'POST',body:{id}}).then(value=>value.member);},
    listSessions(memberId,{status='',limit=30,offset=0}={}){return request('list-sessions',{query:{memberId,status,limit,offset}}).then(value=>value.sessions||[]);},
    getSession(sessionId){return request('get-session',{query:{sessionId}});},
    savePlannedSession(snapshot){return request('save-planned-session',{method:'POST',body:{snapshot}});},
    updateSession(sessionId,expectedRevision,patch){return request('update-session',{method:'POST',body:{sessionId,expectedRevision,patch}}).then(value=>value.session);},
    completeSession(sessionId,expectedRevision,items){
      const body={sessionId,expectedRevision};
      if(Array.isArray(items)&&items.length)body.items=items;
      else body.completeAsPlanned=true;
      return request('complete-session',{method:'POST',body});
    },
    cancelSession(sessionId,expectedRevision){return request('cancel-session',{method:'POST',body:{sessionId,expectedRevision}});},
    deletePlannedSession(sessionId,expectedRevision){return request('delete-planned-session',{method:'POST',body:{sessionId,expectedRevision}});},
    getMemberTrainingContext(memberId){return request('get-member-training-context',{query:{memberId}}).then(value=>value.context);},
  };

  window.V14MemberAPI=api;
})();
