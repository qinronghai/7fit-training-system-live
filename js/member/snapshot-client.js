(function(){
  'use strict';

  const STORAGE_KEY='7fit_member_save_intents_v1';
  const MAX_INTENTS=24;
  const pendingSends=new Map();
  let domainPromise=window.V14MemberDomainPromise||null;

  function getDomain(){
    if(window.V14MemberDomain)return Promise.resolve(window.V14MemberDomain);
    if(!domainPromise){
      const script=document.querySelector('script[src*="member/snapshot-client.js"]');
      const source=script?.src||document.baseURI;
      const url=new URL('./member-domain.mjs',source);
      const buildId=document.querySelector('meta[name="7fit-build"]')?.content||'dev';
      url.searchParams.set('v',buildId);
      domainPromise=import(url.href);
      window.V14MemberDomainPromise=domainPromise;
    }
    return domainPromise;
  }

  function readStore(){
    try{
      const value=JSON.parse(window.localStorage.getItem(STORAGE_KEY)||'{}');
      return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    }catch(_){return {};}
  }

  function writeStore(store){
    const entries=Object.entries(store);
    const pending=entries.filter(([,value])=>value?.status==='PENDING');
    const saved=entries.filter(([,value])=>value?.status==='SAVED')
      .sort((left,right)=>String(right[1]?.updatedAt||'').localeCompare(String(left[1]?.updatedAt||'')))
      .slice(0,Math.max(0,MAX_INTENTS-pending.length));
    const keep=new Set([...pending,...saved].map(([key])=>key));
    const bounded=Object.fromEntries(entries.filter(([key])=>keep.has(key)));
    try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(bounded));}
    catch(_){throw Object.assign(new Error('save_intent_storage_failed'),{code:'save_intent_storage_failed'});}
  }

  function clone(value){return JSON.parse(JSON.stringify(value));}

  function localDate(value=new Date()){
    const date=value instanceof Date?value:new Date(value);
    const pad=number=>String(number).padStart(2,'0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }

  function makeUuid(){
    const cryptoApi=window.crypto||globalThis.crypto;
    if(typeof cryptoApi?.randomUUID==='function')return cryptoApi.randomUUID();
    if(typeof cryptoApi?.getRandomValues!=='function')throw Object.assign(new Error('secure_random_unavailable'),{code:'secure_random_unavailable'});
    const bytes=new Uint8Array(16);cryptoApi.getRandomValues(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }

  function normalizePlannedItems(resolvedSession,plannedItems){
    if(plannedItems===undefined||plannedItems===null)return null;
    const slots=resolvedSession?.main?.content;
    if(!Array.isArray(plannedItems)||!Array.isArray(slots)||plannedItems.length!==slots.length)throw Object.assign(new TypeError('source planned items do not match the resolved session'),{code:'invalid_source_plan'});
    const ordered=plannedItems.slice().sort((left,right)=>(left?.sortOrder??0)-(right?.sortOrder??0));
    return ordered.map((item,index)=>{
      const slot=slots[index],expectedSlotKey=typeof slot?.key==='string'?slot.key:null;
      if(!item||item.sortOrder!==index||item.slotKey!==expectedSlotKey||item.plannedActionId!==slot?.actionId||!item.plannedActionSnapshot||item.plannedActionSnapshot.actionId!==item.plannedActionId||!item.plannedPrescriptionSnapshot||typeof item.plannedPrescriptionSnapshot!=='object'){
        throw Object.assign(new TypeError('source planned item snapshot is incomplete'),{code:'invalid_source_plan'});
      }
      return {
        phase:item.phase,
        slotKey:item.slotKey,
        sortOrder:index,
        plannedActionId:item.plannedActionId,
        plannedActionSnapshot:clone(item.plannedActionSnapshot),
        plannedPrescriptionSnapshot:clone(item.plannedPrescriptionSnapshot),
      };
    });
  }

  function normalizeSessionDetails(value){
    if(value===undefined||value===null)return null;
    if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new TypeError('session details must be an object'),{code:'invalid_session_details'});
    const details=clone(value),warmups=Array.isArray(details.warmups)?details.warmups:[];
    if(warmups.length>20||warmups.some(item=>!item||typeof item!=='object'||!item.slotKey||!item.prepId||!item.actionId||!item.name||!item.prescription)){
      throw Object.assign(new TypeError('session warm-up snapshots are incomplete'),{code:'invalid_session_details'});
    }
    if(new Set(warmups.map(item=>item.slotKey)).size!==warmups.length)throw Object.assign(new TypeError('session warm-up slots must be unique'),{code:'invalid_session_details'});
    return {...details,warmups};
  }

  function prepItemSnapshot(warmup,{sessionId,id,sortOrder}){
    const action=window.V14_DATA?.actions?.[warmup.actionId]||{},anatomy=window.V14_ANATOMY?.records?.[warmup.actionId]||{};
    const strings=value=>[...new Set((Array.isArray(value)?value:[]).filter(item=>typeof item==='string'&&item.trim()))];
    return {
      schemaVersion:1,id,sessionId,phase:'PREP',slotKey:`PREP:${warmup.slotKey}`,sortOrder,
      plannedActionId:warmup.actionId,
      plannedActionSnapshot:{
        schemaVersion:1,actionId:warmup.actionId,name:warmup.name,
        pattern:action.pattern||strings(warmup.targetPatterns).join(' / ')||'PREP',
        level:action.tier||action.grade||warmup.grade||warmup.prepGrade||null,
        primaryMuscles:strings(anatomy.primary),secondaryMuscles:strings(anatomy.secondary),
        equipment:action.equipment||warmup.equipment||null,stationId:action.stationId||null,
      },
      performedActionId:null,performedActionSnapshot:null,
      plannedPrescriptionSnapshot:{schemaVersion:1,sets:null,reps:null,rir:null,restSeconds:null,tempo:null,loadPrescription:null,rawText:warmup.prescription},
      performedPrescription:null,sets:null,reps:null,loadKg:null,rir:null,rpe:null,completed:false,note:null,
    };
  }

  async function fingerprint(resolvedSession,sessionDate,plannedItems=null,copyFromSessionId=null,sessionDetails=null){
    const payload={schemaVersion:1,sessionDate,resolvedSession};
    if(plannedItems)payload.plannedItems=plannedItems;
    if(typeof copyFromSessionId==='string'&&copyFromSessionId)payload.copyFromSessionId=copyFromSessionId;
    if(sessionDetails)payload.sessionDetails=sessionDetails;
    const bytes=new TextEncoder().encode(JSON.stringify(payload));
    const digest=await (window.crypto||globalThis.crypto).subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  }

  async function contentFingerprint(resolvedSession,plannedItems=null,copyFromSessionId=null,sessionDetails=null){
    const payload={schemaVersion:1,resolvedSession};
    if(plannedItems)payload.plannedItems=plannedItems;
    if(typeof copyFromSessionId==='string'&&copyFromSessionId)payload.copyFromSessionId=copyFromSessionId;
    if(sessionDetails)payload.sessionDetails=sessionDetails;
    const bytes=new TextEncoder().encode(JSON.stringify(payload));
    const digest=await (window.crypto||globalThis.crypto).subtle.digest('SHA-256',bytes);
    return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
  }

  async function findPendingIntent(store,expectedContentFingerprint,memberId,preferredSessionDate,legacyContentFingerprint=null){
    const matches=[];
    for(const intent of Object.values(store)){
      if(intent?.status!=='PENDING'||(memberId&&intent.memberId!==memberId))continue;
      let savedContentFingerprint=intent.contentFingerprint;
      if(typeof savedContentFingerprint!=='string'&&intent.snapshot?.session?.resolvedSessionSnapshot){
        const resolved=intent.snapshot.session.resolvedSessionSnapshot;
        let savedPlan=null;
        try{savedPlan=normalizePlannedItems(resolved,intent.snapshot.items);}catch(_){/* legacy or incomplete save intent */}
        savedContentFingerprint=await contentFingerprint(resolved,savedPlan,intent.copyFromSessionId||null,intent.snapshot.session.resolvedSessionSnapshot?.memberDetails||null);
      }
      const hasDetailsSnapshot=Boolean(intent.snapshot?.session?.resolvedSessionSnapshot?.memberDetails);
      if(savedContentFingerprint===expectedContentFingerprint||(!hasDetailsSnapshot&&legacyContentFingerprint&&savedContentFingerprint===legacyContentFingerprint))matches.push(intent);
    }
    matches.sort((left,right)=>{
      const leftPreferred=left.sessionDate===preferredSessionDate,rightPreferred=right.sessionDate===preferredSessionDate;
      if(leftPreferred!==rightPreferred)return leftPreferred?-1:1;
      return String(right.updatedAt||'').localeCompare(String(left.updatedAt||''));
    });
    return matches[0]||null;
  }

  async function intentKey(resolvedSession,memberId,sessionDate,plannedItems=null,copyFromSessionId=null,sessionDetails=null){
    const baseFingerprint=await fingerprint(resolvedSession,sessionDate,plannedItems,copyFromSessionId,sessionDetails);
    return {baseFingerprint,key:`${baseFingerprint}:${memberId}`};
  }

  async function prepareIntent(resolvedSession,{memberId,sessionDate,now=new Date(),createId=makeUuid,allowNewAfterPendingIntentKey=null,plannedItems=null,copyFromSessionId=null,sessionDetails=null}={}){
    if(typeof memberId!=='string'||!memberId)throw Object.assign(new TypeError('memberId is required'),{code:'invalid_member'});
    const preservedPlan=normalizePlannedItems(resolvedSession,plannedItems),normalizedDetails=normalizeSessionDetails(sessionDetails);
    const date=sessionDate||localDate(now),contentFingerprintValue=await contentFingerprint(resolvedSession,preservedPlan,copyFromSessionId,normalizedDetails),legacyContentFingerprint=normalizedDetails?await contentFingerprint(resolvedSession,preservedPlan,copyFromSessionId,null):null,{baseFingerprint,key}=await intentKey(resolvedSession,memberId,date,preservedPlan,copyFromSessionId,normalizedDetails),store=readStore();
    if(store[key])return clone(store[key]);
    const pendingIntent=await findPendingIntent(store,contentFingerprintValue,memberId,date,legacyContentFingerprint);
    if(pendingIntent){
      const explicitlyStartingNewDateSession=pendingIntent.sessionDate!==date&&pendingIntent.key===allowNewAfterPendingIntentKey;
      if(explicitlyStartingNewDateSession){
        // Keep the unresolved prior-date request for safe retry while allowing
        // an explicit, separate session for a later training date.
      }else if(typeof pendingIntent.contentFingerprint!=='string'){
        const hasDetailsSnapshot=Boolean(pendingIntent.snapshot?.session?.resolvedSessionSnapshot?.memberDetails);
        pendingIntent.contentFingerprint=normalizedDetails&&!hasDetailsSnapshot?legacyContentFingerprint:contentFingerprintValue;
        store[pendingIntent.key]=pendingIntent;
        writeStore(store);
        return clone(pendingIntent);
      }else{
        return clone(pendingIntent);
      }
    }
    const domain=await getDomain(),timestamp=(now instanceof Date?now:new Date(now)).toISOString();
    const slotCount=resolvedSession?.main?.content?.length||0;
    const snapshot=domain.buildTrainingSessionSnapshot(resolvedSession,{
      sessionId:createId(),memberId,sessionDate:date,createdAt:timestamp,updatedAt:timestamp,
      idempotencyKey:createId(),itemIds:Array.from({length:slotCount},()=>createId()),
      actionsById:window.V14_DATA?.actions||{},anatomyById:window.V14_ANATOMY?.records||{},
      prescriptionForSlot:slot=>{
        if(resolvedSession.templateId!=='f111')return slot.prescription;
        return window.V14ModuleCopy?.prescriptionForF111Slot?.(slot.key)
          ||slot.prescription
          ||window.V14ModuleCopy?.prescriptionForAction?.(slot.actionId,{level:resolvedSession.level})
          ||'';
      },
    });
    if(normalizedDetails){
      snapshot.session.resolvedSessionSnapshot.memberDetails=normalizedDetails;
      const existingSlots=new Set(snapshot.items.filter(item=>item.phase==='PREP').map(item=>item.slotKey));
      const warmups=normalizedDetails.warmups.filter(item=>!existingSlots.has(`PREP:${item.slotKey}`));
      const firstPrepOrder=snapshot.items.length;
      warmups.forEach((item,index)=>snapshot.items.push(prepItemSnapshot(item,{
        sessionId:snapshot.session.id,id:createId(),sortOrder:firstPrepOrder+index,
      })));
    }
    if(preservedPlan){
      snapshot.items=snapshot.items.map((item,index)=>({...item,...clone(preservedPlan[index])}));
    }
    const intent={key,baseFingerprint,contentFingerprint:contentFingerprintValue,memberId,sessionDate:date,copyFromSessionId:typeof copyFromSessionId==='string'&&copyFromSessionId?copyFromSessionId:null,status:'PENDING',snapshot,createdAt:timestamp,updatedAt:timestamp,savedSessionId:null};
    store[key]=intent;writeStore(store);
    return clone(intent);
  }

  async function findIntentForResolvedSession(resolvedSession,{memberId,sessionDate,now=new Date(),plannedItems=null,copyFromSessionId=null,sessionDetails=null}={}){
    const preservedPlan=normalizePlannedItems(resolvedSession,plannedItems),normalizedDetails=normalizeSessionDetails(sessionDetails);
    const date=sessionDate||localDate(now),contentFingerprintValue=await contentFingerprint(resolvedSession,preservedPlan,copyFromSessionId,normalizedDetails),legacyContentFingerprint=normalizedDetails?await contentFingerprint(resolvedSession,preservedPlan,copyFromSessionId,null):null,store=readStore();
    const baseFingerprint=await fingerprint(resolvedSession,date,preservedPlan,copyFromSessionId,normalizedDetails);
    const matches=Object.values(store).filter(value=>value?.baseFingerprint===baseFingerprint&&value?.sessionDate===date&&(!memberId||value.memberId===memberId));
    matches.sort((left,right)=>String(right.updatedAt||'').localeCompare(String(left.updatedAt||'')));
    if(matches.length)return clone(matches[0]);
    const pendingIntent=await findPendingIntent(store,contentFingerprintValue,memberId,date,legacyContentFingerprint);
    if(pendingIntent)return clone(pendingIntent);
    return null;
  }

  function saveIntent(intent){
    if(!intent||typeof intent.key!=='string'||!intent.snapshot)throw Object.assign(new TypeError('save intent is invalid'),{code:'invalid_save_intent'});
    const stored=readStore()[intent.key];
    if(stored?.status==='SAVED')return Promise.resolve({sessionId:stored.savedSessionId,status:'PLANNED',revision:stored.revision,idempotentReplay:true});
    if(pendingSends.has(intent.key))return pendingSends.get(intent.key);
    const sending=(async()=>{
      const result=await window.V14MemberAPI.savePlannedSession(intent.snapshot);
      const store=readStore(),previous=store[intent.key]||intent;
      store[intent.key]={...previous,status:'SAVED',savedSessionId:result.sessionId||intent.snapshot.session.id,revision:result.revision||1,updatedAt:new Date().toISOString()};
      writeStore(store);
      return result;
    })();
    pendingSends.set(intent.key,sending);
    return sending.finally(()=>pendingSends.delete(intent.key));
  }

  window.V14MemberSnapshots={STORAGE_KEY,localDate,prepareIntent,findIntentForResolvedSession,send:saveIntent};
})();
