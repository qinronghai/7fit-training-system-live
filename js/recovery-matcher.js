(function(){
  'use strict';

  const SLOT_WEIGHT=Object.freeze({A:5,B:5,D1:3,D2:3,C:2,CORE:2});
  /**
   * Damping exponent for the protocol breadth normalization (see `score`).
   * Tuned against the 24 Conditioning / HYROX family x level matrix: 1.0 drops
   * 臀部 from most leg-dominant sessions (over-favouring the narrowest
   * candidate), 0.5 lets the broadest candidate win again (upper body collapses
   * to 肩后侧 everywhere). 0.65 keeps 臀部 in 19/24 sessions, keeps 划船 / 滑雪
   * sessions on 上背与腋下, and yields the widest spread of distinct results.
   */
  const PROTOCOL_BREADTH_EXPONENT=0.65;
  const D=()=>window.V14_DATA||{};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const asArray=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'&&item):[];
  const compare=(a,b)=>b.score-a.score||b.priority-a.priority||(a.id<b.id?-1:a.id>b.id?1:0);

  function incomplete(message,items=[]){
    return {status:'incomplete',items:items.slice(0,3),message:String(message||'当前动作库不足以生成 3 个不同部位的拉伸建议，请由教练人工安排。')};
  }

  function inputSignals(resolvedSession){
    const main=resolvedSession?.main;
    // SLOT sessions (F111 1+1+1, Body) carry their work in main.content.
    // PROTOCOL sessions (Conditioning, HYROX) carry it in domainContext.stations;
    // V14RecoveryProtocolAdapter translates those into the same signal shape.
    const content=main?.kind==='SLOT'&&Array.isArray(main.content)
      ?main.content
      :main?.kind==='PROTOCOL'?(window.V14RecoveryProtocolAdapter?.signals?.(resolvedSession)||[]):[];
    const actions=D().actions||{};
    const known=content.map(slot=>{
      const action=actions[slot?.actionId];
      // Adapter-supplied signals win over action metadata: Conditioning stores a
      // modality in `pattern` (稳态 / 间歇) and HYROX has no action row at all.
      const pattern=typeof slot?.pattern==='string'&&slot.pattern?slot.pattern:(action?.pattern||'');
      const loadFamily=typeof slot?.loadFamily==='string'&&slot.loadFamily?slot.loadFamily:(action?.loadFamily||'');
      return {slot,action,pattern,loadFamily};
    }).filter(item=>item.action||item.pattern||item.loadFamily);
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

  /**
   * Weighted rarity of each demand term in this session.
   *
   * Scoring sums over every matching signal, so a candidate that declares many
   * target terms (臀肌拉伸 covers 4 patterns + 3 load families) outranks a
   * specialist even when the session is dominated by the specialist's demand —
   * the same signal saturation that flattens PREP matching. Weighting each term
   * by ln(1 + mass/frequency) makes a ubiquitous demand (蹲 in a leg session)
   * contribute little while a distinctive one (水平拉 in a rowing block) keeps
   * its full weight, so selection follows the session instead of the metadata.
   */
  function demandRarity(known){
    const frequency=new Map();
    let mass=0;
    known.forEach(({slot,pattern,loadFamily})=>{
      const weight=Number.isFinite(Number(slot?.weight))?Number(slot.weight):(SLOT_WEIGHT[slot?.key]||1);
      [pattern,loadFamily].forEach(term=>{
        if(!term)return;
        frequency.set(term,(frequency.get(term)||0)+weight);
        mass+=weight;
      });
    });
    const rarity=new Map();
    frequency.forEach((count,term)=>rarity.set(term,Math.log(1+mass/(1+count))));
    return rarity;
  }

  function score(candidate,known,tuning){
    const action=candidate.action;
    const patternTargets=new Set(asArray(action.recoveryTargetPatterns));
    const loadTargets=new Set(asArray(action.recoveryTargetLoadFamilies));
    const reasons=[];
    let matched=0;
    known.forEach(({slot,pattern,loadFamily})=>{
      // Protocol adapter signals carry an explicit exposure weight (primary
      // mover vs assisting muscle); SLOT entries keep the slot-key weights.
      const weight=Number.isFinite(Number(slot?.weight))?Number(slot.weight):(SLOT_WEIGHT[slot?.key]||1);
      if(patternTargets.has(pattern)){
        matched+=24*weight*(tuning.rarity.get(pattern)??1);
        if(!reasons.some(reason=>reason.type==='pattern'))reasons.push({type:'pattern',value:pattern});
      }
      if(loadTargets.has(loadFamily)){
        matched+=20*weight*(tuning.rarity.get(loadFamily)??1);
        if(!reasons.some(reason=>reason.type==='load'))reasons.push({type:'load',value:loadFamily});
      }
    });
    // `matched` sums over every signal, so a candidate that declares many target
    // terms (臀肌拉伸 covers 4 patterns + 3 loads) outranks a specialist purely on
    // breadth. That is harmless for SLOT sessions — each signal there is a real
    // training action — but the protocol adapter emits several derived demand
    // entries per station, so without normalization every Conditioning / HYROX
    // session collapses onto the same three broadest cards.
    const breadth=patternTargets.size+loadTargets.size||1;
    const contribution=tuning.normalize?matched/Math.pow(breadth,PROTOCOL_BREADTH_EXPONENT):matched;
    let score=(Number.isFinite(Number(action.recoveryPriority))?Number(action.recoveryPriority):0)+contribution;
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
    // SLOT sessions keep the authoritative per-action scoring they shipped with
    // (each entry is a real training slot). Protocol sessions use the derived
    // adapter signals, where term rarity and breadth normalization are what stop
    // every session from collapsing onto the same broadest candidates.
    const tuning=resolvedSession?.main?.kind==='PROTOCOL'
      ?{rarity:demandRarity(known),normalize:true}
      :{rarity:new Map(),normalize:false};
    const ranked=candidates().map(candidate=>score(candidate,known,tuning)).sort(compare);
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
