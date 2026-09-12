(function(){
  'use strict';

  const state=()=>window.V15State;
  const clean=value=>String(value??'').trim();
  const candidateId=candidate=>typeof candidate==='string'?candidate:(candidate?.actionId||candidate?.id||'');
  const candidateName=candidate=>{
    const id=candidateId(candidate);
    return candidate?.name||candidate?.label||window.V14_DATA?.actions?.[id]?.name||id;
  };

  const context={
    f111Preset({sessionId,slotKey}={}){
      return `preset|${clean(sessionId)}|${clean(slotKey).split('__').pop()}`;
    },
    f111Composer({lowerMode,upperMode,level,coreDemand,slotKey}={}){
      return `composer|${clean(lowerMode)}|${clean(upperMode)}|${clean(level)}|${clean(coreDemand)}|${clean(slotKey)}`;
    },
    body({familyId,level,slotKey}={}){
      return `body|${clean(familyId)}|${clean(level)}|${clean(slotKey)}`;
    },
    conditioning({familyId,level,protocolId,stationKey}={}){
      return `conditioning|${clean(familyId)}|${clean(level)}|${clean(protocolId)}|${clean(stationKey)}`;
    },
  };

  function legalMap(candidates){
    const map=new Map();
    for(const candidate of Array.isArray(candidates)?candidates:[]){
      const id=candidateId(candidate);
      if(id&&!map.has(id))map.set(id,{actionId:id,name:candidateName(candidate),raw:candidate});
    }
    return map;
  }

  function record({templateId,contextKey,actionId,candidates,now}={}){
    const legal=legalMap(candidates);
    if(!legal.has(actionId))return false;
    state()?.recordRecentAction?.(templateId,contextKey,actionId,{now});
    return true;
  }

  function quickCandidates({templateId,contextKey,candidates,currentActionId,limit=3}={}){
    const legal=legalMap(candidates);
    if(!legal.size)return [];
    const recent=state()?.listRecentActions?.(templateId,contextKey,{limit:Math.max(20,limit*4)})||[];
    const out=[];
    for(const item of recent){
      if(item.actionId===currentActionId)continue;
      const candidate=legal.get(item.actionId);
      if(!candidate)continue;
      out.push({...candidate,usedAt:item.usedAt});
      if(out.length>=limit)break;
    }
    return out;
  }

  function renderButtons(args={}){
    const items=quickCandidates(args);
    if(!items.length)return '';
    const esc=window.V14CoachModules?.Common?.esc||((value)=>String(value??''));
    return `<div class="recent-quick-swap"><span>最近使用</span><div class="recent-quick-actions">${items.map(item=>
      `<button type="button" data-recent-action="${esc(item.actionId)}" data-recent-context="${esc(args.contextKey)}" data-recent-template="${esc(args.templateId)}">最近：${esc(item.name)}</button>`
    ).join('')}</div></div>`;
  }

  window.V15RecentActions={state,context,record,quickCandidates,renderButtons};
})();