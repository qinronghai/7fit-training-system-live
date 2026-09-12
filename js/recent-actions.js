(function(){
  'use strict';

  const State=()=>window.V15State;
  const D=()=>window.V14_DATA||{};
  const clean=value=>String(value??'').trim();

  function normalizeF111Slot(slotKey){
    const raw=clean(slotKey);
    return raw.includes('__')?raw.split('__').pop():raw;
  }

  function descriptor(templateId,contextKey,context){
    return Object.freeze({templateId,contextKey,context:Object.freeze({...context})});
  }

  function f111Preset(sessionId,slotKey){
    const key=normalizeF111Slot(slotKey);
    return descriptor('f111',`preset:${sessionId}:${key}`,{
      mode:'preset',sessionId,slotKey:key,
    });
  }

  function f111Composer(ctx={},slotKey){
    const key=clean(slotKey);
    const sessionKey=clean(ctx.stateKey);
    return descriptor('f111',`composer:${sessionKey}:${key}`,{
      mode:'composer',
      sessionKey,
      familyId:ctx.resolved?.compositionId||sessionKey.replace(/-L[1-4]$/,''),
      level:ctx.level||'',
      lowerMode:ctx.lowerMode||'',
      upperMode:ctx.upperMode||'',
      coreDemand:ctx.coreDemand||'',
      slotKey:key,
    });
  }

  function body(familyId,level,slotKey){
    const key=clean(slotKey);
    return descriptor('body',`body:${familyId}:${level}:${key}`,{
      familyId,level,slotKey:key,
      role:D().bodyFamilies?.[familyId]?.slotPolicy?.[key]||'',
    });
  }

  function conditioning(familyId,level,protocolId,stationKey){
    const key=clean(stationKey);
    return descriptor('conditioning',`conditioning:${familyId}:${level}:${protocolId}:${key}`,{
      familyId,level,protocolId,stationKey:key,
    });
  }

  function candidateId(candidate){
    if(typeof candidate==='string')return candidate;
    return clean(candidate?.actionId||candidate?.id);
  }

  function record(desc,actionId,options={}){
    if(!desc?.templateId||!desc?.contextKey)throw new Error('Recent action descriptor is required');
    return State().recordRecentAction(desc.templateId,actionId,desc.contextKey,desc.context||{},options);
  }

  function recentRecords(desc,limit=80){
    if(!desc?.templateId||!desc?.contextKey)return [];
    return State()?.listRecentActions?.({
      templateId:desc.templateId,
      contextKey:desc.contextKey,
      limit,
    })||[];
  }

  function rank(desc,candidates=[]){
    const list=Array.isArray(candidates)?candidates.slice():[];
    const positions=new Map(recentRecords(desc).map((item,index)=>[item.actionId,index]));
    return list
      .map((candidate,index)=>({candidate,index,recent:positions.get(candidateId(candidate))}))
      .sort((a,b)=>{
        const ar=Number.isInteger(a.recent)?a.recent:Number.MAX_SAFE_INTEGER;
        const br=Number.isInteger(b.recent)?b.recent:Number.MAX_SAFE_INTEGER;
        return ar-br||a.index-b.index;
      })
      .map(row=>row.candidate);
  }

  function quick(desc,candidates=[],options={}){
    const currentActionId=clean(options.currentActionId);
    const limit=Number.isInteger(options.limit)&&options.limit>0?options.limit:3;
    const byId=new Map((Array.isArray(candidates)?candidates:[]).map(candidate=>[candidateId(candidate),candidate]));
    const out=[];
    for(const recent of recentRecords(desc)){
      if(recent.actionId===currentActionId||!byId.has(recent.actionId))continue;
      out.push({
        actionId:recent.actionId,
        candidate:byId.get(recent.actionId),
        usedAt:recent.usedAt,
        useCount:recent.useCount,
      });
      if(out.length>=limit)break;
    }
    return out;
  }

  window.V15RecentActions={
    f111Preset,
    f111Composer,
    body,
    conditioning,
    record,
    recentRecords,
    rank,
    quick,
    candidateId,
  };
})();
