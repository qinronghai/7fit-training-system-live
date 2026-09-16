(function(){
  'use strict';

  const SLOT_WEIGHT=Object.freeze({A:5,B:5,D1:3,D2:3,C:2,CORE:2});
  const D=()=>window.V14_DATA||{};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const asArray=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'&&item):[];
  const compare=(a,b)=>b.score-a.score||b.priority-a.priority||(a.id<b.id?-1:a.id>b.id?1:0);

  function incomplete(message,items=[]){
    return {status:'incomplete',items:items.slice(0,3),message:String(message||'当前动作库不足以生成 3 个不同部位的拉伸建议，请由教练人工安排。')};
  }

  function inputSignals(resolvedSession){
    const content=resolvedSession?.main?.kind==='SLOT'&&Array.isArray(resolvedSession.main.content)
      ?resolvedSession.main.content:[];
    const actions=D().actions||{};
    const known=content.map(slot=>({slot,action:actions[slot?.actionId]})).filter(item=>item.action);
    return {content,known};
  }

  function candidates(){
    return Object.entries(D().actions||{}).map(([id,action])=>({id,action})).filter(({action})=>
      action?.route==='RECOVERY_2F'&&action.status==='可自动编排'&&action.recoveryEligible===true&&
      typeof action.recoveryRegion==='string'&&action.recoveryRegion&&
      typeof action.recoveryRegionLabel==='string'&&action.recoveryRegionLabel&&
      (action.recoveryRegionGroup==='upper'||action.recoveryRegionGroup==='lower')&&
      Array.isArray(action.recoveryTargetPatterns)&&Array.isArray(action.recoveryTargetLoadFamilies)
    );
  }

  function score(candidate,known){
    const action=candidate.action;
    const patternTargets=new Set(asArray(action.recoveryTargetPatterns));
    const loadTargets=new Set(asArray(action.recoveryTargetLoadFamilies));
    const reasons=[];
    let score=Number.isFinite(Number(action.recoveryPriority))?Number(action.recoveryPriority):0;
    known.forEach(({slot,action:source})=>{
      const weight=SLOT_WEIGHT[slot?.key]||1;
      if(patternTargets.has(source.pattern)){
        score+=24*weight;
        if(!reasons.some(reason=>reason.type==='pattern'))reasons.push({type:'pattern',value:source.pattern});
      }
      if(loadTargets.has(source.loadFamily)){
        score+=20*weight;
        if(!reasons.some(reason=>reason.type==='load'))reasons.push({type:'load',value:source.loadFamily});
      }
    });
    const reason=reasons.find(item=>item.type==='load')||reasons[0];
    return {
      id:candidate.id,
      name:action.name||candidate.id,
      region:action.recoveryRegion,
      regionLabel:action.recoveryRegionLabel,
      regionGroup:action.recoveryRegionGroup,
      prescription:action.recoveryPrescription||'45 秒',
      reason:reason?`匹配本节的${reason.value}负荷`:'作为训练后主要部位恢复建议',
      detail:D().actionDetails?.[candidate.id]?.fields?.['训练目标']||`训练后完成${action.recoveryRegionLabel}轻柔拉伸。`,
      score,
      priority:Number.isFinite(Number(action.recoveryPriority))?Number(action.recoveryPriority):0,
    };
  }

  function match(resolvedSession){
    const {content,known}=inputSignals(resolvedSession);
    if(!content.length||!known.length)return incomplete('当前训练动作无法映射到动作库，请由教练人工安排。');
    const ranked=candidates().map(candidate=>score(candidate,known)).sort(compare);
    const bestByRegion=new Map();
    ranked.forEach(item=>{
      if(!bestByRegion.has(item.region))bestByRegion.set(item.region,item);
    });
    const rankedRegions=[...bestByRegion.values()].sort(compare),itemsByGroup={
      upper:rankedRegions.filter(item=>item.regionGroup==='upper'),
      lower:rankedRegions.filter(item=>item.regionGroup==='lower'),
    };
    const selected=[];
    if(itemsByGroup.upper[0])selected.push(itemsByGroup.upper[0]);
    itemsByGroup.lower.slice(0,2).forEach(item=>selected.push(item));
    if(!selected.length)itemsByGroup.upper.slice(0,2).forEach(item=>selected.push(item));
    rankedRegions.forEach(item=>{if(selected.length<3&&!selected.some(current=>current.region===item.region))selected.push(item);});
    const items=selected.slice(0,3).map(item=>{
      const {score:internalScore,priority,...publicItem}=item;
      return publicItem;
    });
    if(items.length<3)return incomplete('当前动作库不足以生成 3 个不同部位的拉伸建议，请由教练人工安排。',items);
    return {status:'complete',items,message:'已根据本节当前动作匹配 3 个主要部位。'};
  }

  function render(result){
    if(!result||result.status!=='complete')return `<div class="recovery-empty" data-recovery-empty><b>暂时无法自动生成完整拉伸方案</b><span>${esc(result?.message||'当前动作库不足以生成 3 个不同部位的拉伸建议。')}</span><strong>请由教练人工安排恢复动作。</strong></div>`;
    return `<div class="flow-grid recovery-grid">${result.items.map(item=>`<article class="flow-item recovery-card" data-recovery-card="${esc(item.region)}" data-recovery-action="${esc(item.id)}"><div class="recovery-card-region"><small>主要部位</small><b>${esc(item.regionLabel)}</b></div><strong>${esc(item.name)}</strong><span class="recovery-prescription">${esc(item.prescription)}</span><p>${esc(item.reason)}</p><a class="recovery-detail-link" href="#/library?focus=${encodeURIComponent(item.id)}">查看动作详情</a></article>`).join('')}</div>`;
  }

  function copyItems(result){return result?.status==='complete'?result.items.map(item=>`${item.name} · ${item.prescription}`):[];}

  window.V14RecoveryMatcher={match,render,copyItems};
})();
