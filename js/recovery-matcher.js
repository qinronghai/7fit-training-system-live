(function(){
  'use strict';

  const SLOT_WEIGHT=Object.freeze({A:5,B:5,D1:3,D2:3,C:2,CORE:2});
  /**
   * Regions this gym recovers with the foam roller during PREP rather than with a
   * post-training stretch. 小腿后侧拉伸 exists in the action table but must not
   * take one of the three stretch cards.
   */
  const FOAM_ROLL_ONLY_REGIONS=Object.freeze(new Set(['calf']));
  /** Score a protocol card earns per unit of exposure in its own region. */
  const REGION_WEIGHT=24;
  const D=()=>window.V14_DATA||{};
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const asArray=value=>Array.isArray(value)?value.filter(item=>typeof item==='string'&&item):[];
  const compare=(a,b)=>b.score-a.score||b.priority-a.priority||(a.id<b.id?-1:a.id>b.id?1:0);

  function incomplete(message,items=[]){
    return {status:'incomplete',items:items.slice(0,3),message:String(message||'当前动作库不足以生成 3 个不同部位的拉伸建议，请由教练人工安排。')};
  }

  function inputSignals(resolvedSession){
    // V14RecoveryProtocolAdapter reports the recovery regions a session trained —
    // from the session's own anatomy context for SLOT sessions (F111 1+1+1, Body)
    // and per station for PROTOCOL sessions (Conditioning, HYROX). Recovery is
    // chosen from that, because the coach's rule is "stretch the major muscle
    // groups you trained hardest", not "stretch whatever movement pattern
    // looks similar".
    const regions=window.V14RecoveryProtocolAdapter?.signals?.(resolvedSession)||[];
    if(regions.length)return {regions,known:[]};
    // Fallback for a session whose anatomy layer is unavailable: match the slot
    // actions by their own pattern / loadFamily metadata.
    const content=resolvedSession?.main?.kind==='SLOT'&&Array.isArray(resolvedSession.main.content)
      ?resolvedSession.main.content:[];
    const actions=D().actions||{};
    const known=content.map(slot=>{
      const action=actions[slot?.actionId];
      return {slot,action,pattern:action?.pattern||'',loadFamily:action?.loadFamily||''};
    }).filter(item=>item.action);
    return {regions:[],known};
  }

  function candidates(){
    return Object.entries(D().actions||{}).map(([id,action])=>({id,action})).filter(({action})=>
      action?.route==='RECOVERY_2F'&&action.status==='可自动编排'&&action.recoveryEligible===true&&
      typeof action.recoveryRegion==='string'&&action.recoveryRegion&&
      typeof action.recoveryRegionLabel==='string'&&action.recoveryRegionLabel&&
      (action.recoveryRegionGroup==='upper'||action.recoveryRegionGroup==='lower')&&
      !FOAM_ROLL_ONLY_REGIONS.has(action.recoveryRegion)&&
      Array.isArray(action.recoveryTargetPatterns)&&Array.isArray(action.recoveryTargetLoadFamilies)
    );
  }

  function score(candidate,regions,known){
    const action=candidate.action;
    const reasons=[];
    let exposure=0;
    // Region signals: the card is scored on the muscle group actually trained.
    regions.forEach(({region,weight})=>{
      if(region!==action.recoveryRegion)return;
      exposure+=Number(weight)||0;
    });
    if(exposure>0)reasons.push({type:'region',value:action.recoveryRegionLabel});
    if(!regions.length){
      const patternTargets=new Set(asArray(action.recoveryTargetPatterns));
      const loadTargets=new Set(asArray(action.recoveryTargetLoadFamilies));
      known.forEach(({slot,pattern,loadFamily})=>{
        const weight=SLOT_WEIGHT[slot?.key]||1;
        if(patternTargets.has(pattern)){
          exposure+=24*weight;
          if(!reasons.some(reason=>reason.type==='pattern'))reasons.push({type:'pattern',value:pattern});
        }
        if(loadTargets.has(loadFamily)){
          exposure+=20*weight;
          if(!reasons.some(reason=>reason.type==='load'))reasons.push({type:'load',value:loadFamily});
        }
      });
    }
    const reason=reasons.find(item=>item.type==='load')||reasons.find(item=>item.type==='pattern')||reasons[0];
    return {
      id:candidate.id,
      name:action.name||candidate.id,
      region:action.recoveryRegion,
      regionLabel:action.recoveryRegionLabel,
      regionGroup:action.recoveryRegionGroup,
      prescription:action.recoveryPrescription||'45 秒',
      reason:exposure>0?`本节练到较多${reason?.value||action.recoveryRegionLabel}`:'作为训练后主要部位恢复建议',
      detail:D().actionDetails?.[candidate.id]?.fields?.['训练目标']||`训练后完成${action.recoveryRegionLabel}轻柔拉伸。`,
      priority:Number.isFinite(Number(action.recoveryPriority))?Number(action.recoveryPriority):0,
      exposure,
    };
  }

  function match(resolvedSession){
    const {regions,known}=inputSignals(resolvedSession);
    if(!regions.length&&!known.length)return incomplete('当前训练动作无法映射到动作库，请由教练人工安排。');
    // Rank the trained regions by exposure: the session's hardest-worked muscle
    // groups take the cards, whatever their upper / lower group. Pinning one
    // upper and two lower cards forced a lat stretch onto a legs-only Body day
    // and a hamstring stretch onto a back-and-shoulders day.
    const ranked=candidates()
      .map(candidate=>score(candidate,regions,known))
      .sort((a,b)=>b.exposure-a.exposure||b.priority-a.priority||(a.id<b.id?-1:a.id>b.id?1:0));
    const bestByRegion=new Map();
    ranked.forEach(item=>{
      if(!bestByRegion.has(item.region))bestByRegion.set(item.region,item);
    });
    const byExposure=[...bestByRegion.values()].filter(item=>item.exposure>0);
    // Only regions this session actually trained earn a stretch card. Stand-ins
    // are used only when fewer than three regions were trained at all.
    const pool=byExposure.length>=3?byExposure:[...bestByRegion.values()].sort((a,b)=>b.priority-a.priority);
    const items=pool.slice(0,3).map(item=>{
      const {exposure,priority,...publicItem}=item;
      return publicItem;
    });
    if(items.length<3)return incomplete('当前动作库不足以生成 3 个不同部位的拉伸建议，请由教练人工安排。',items);
    return {status:'complete',items,message:'已根据本节主要训练肌群匹配 3 个部位的拉伸。'};
  }

  function render(result){
    if(!result||result.status!=='complete')return `<div class="recovery-empty" data-recovery-empty><b>暂时无法自动生成完整拉伸方案</b><span>${esc(result?.message||'当前动作库不足以生成 3 个不同部位的拉伸建议。')}</span><strong>请由教练人工安排恢复动作。</strong></div>`;
    return `<div class="flow-grid recovery-grid">${result.items.map(item=>`<article class="flow-item recovery-card" data-recovery-card="${esc(item.region)}" data-recovery-action="${esc(item.id)}"><div class="recovery-card-region"><small>主要部位</small><b>${esc(item.regionLabel)}</b></div><strong>${esc(item.name)}</strong><span class="recovery-prescription">${esc(item.prescription)}</span><p>${esc(item.reason)}</p><a class="recovery-detail-link" href="#/library?focus=${encodeURIComponent(item.id)}">查看动作详情</a></article>`).join('')}</div>`;
  }

  // F111's mobile composer keeps the same matched items and detail route, but
  // presents them as compact full-row links so the recovery module does not
  // dominate the end of a long course page.
  function renderCompact(result){
    if(!result||result.status!=='complete')return `<div class="recovery-empty" data-recovery-empty><b>暂时无法自动生成完整拉伸方案</b><span>${esc(result?.message||'当前动作库不足以生成 3 个不同部位的拉伸建议。')}</span><strong>请由教练人工安排恢复动作。</strong></div>`;
    return `<div class="recovery-list" role="list">${result.items.map(item=>`<a class="recovery-row" role="listitem" data-recovery-card="${esc(item.region)}" data-recovery-action="${esc(item.id)}" href="#/library?focus=${encodeURIComponent(item.id)}"><span class="recovery-row-region">${esc(item.regionLabel)}</span><span class="recovery-row-main"><b>${esc(item.name)}</b><small>${esc(item.reason)}</small></span><span class="recovery-prescription">${esc(item.prescription)}</span></a>`).join('')}</div>`;
  }

  function copyItems(result){return result?.status==='complete'?result.items.map(item=>`${item.name} · ${item.prescription}`):[];}

  window.V14RecoveryMatcher={match,render,renderCompact,copyItems};
})();
