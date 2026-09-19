(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const RESOLVER_VERSION='body-v1';

  function normalizeFamilyLevel(route={}){
    const rawFamily=String(route.familyId||route.query?.family||'BODY-01').toUpperCase();
    const familyIds=D().bodyFamilyIds||[];
    const familyId=familyIds.includes(rawFamily)?rawFamily:'BODY-01';
    const rawLevel=String(route.level||route.query?.level||'').toUpperCase();
    const level=/^L[1-4]$/.test(rawLevel)?rawLevel:'L1';
    return {familyId,level};
  }

  function stateMetadata(familyId,level){
    return {familyId,level,resolverVersion:RESOLVER_VERSION,input:{familyId,level}};
  }

  function sessionKeyFor(familyId,level){return `${familyId}-${level}`;}

  function ensureState(familyId,level){
    const S=window.V15State;
    if(!S)return null;
    const sessionKey=sessionKeyFor(familyId,level),metadata=stateMetadata(familyId,level);
    if(!S.getSession('body',sessionKey))S.ensureSession('body',sessionKey,metadata);
    const current=S.getSession('body',sessionKey);
    const options={
      resolverVersion:RESOLVER_VERSION,
      isSelectionValid:(slotKey,entry,state)=>window.V15BodyResolver.isSelectionValid({
        familyId:state.familyId,
        level:state.level,
        slotKey,
        actionId:entry.actionId,
        venueOverrideReason:entry.venueOverrideReason,
        currentSelections:Object.fromEntries(
          Object.entries(state.selections||{}).map(([key,value])=>[key,value?.actionId||''])
        ),
      }),
    };
    if(current.resolverVersion!==RESOLVER_VERSION)return S.reconcileSession('body',sessionKey,options).session;
    S.reconcileSession('body',sessionKey,options);
    return S.getSession('body',sessionKey);
  }

  function resolveState(familyId,level){
    const S=window.V15State;
    if(!S)return window.V15TemplateResolver.resolve('body',{familyId,level,selections:{}});
    ensureState(familyId,level);
    return window.V15TemplateResolver.resolve('body',{
      familyId,
      level,
      selections:S.getSelections('body',sessionKeyFor(familyId,level)),
    });
  }

  function setFormalSelection(familyId,level,slotKey,actionId,venueOverrideReason=''){
    const S=window.V15State;
    if(!S)throw new Error('Body coach State service is unavailable');
    ensureState(familyId,level);
    const currentSelections=Object.fromEntries(
      Object.entries(S.getSelections('body',sessionKeyFor(familyId,level))||{})
        .map(([key,value])=>[key,value?.actionId||value||''])
    );
    const reason=typeof venueOverrideReason==='string'?venueOverrideReason.trim():'';
    if(!window.V15BodyResolver.isSelectionValid({familyId,level,slotKey,actionId,venueOverrideReason:reason,currentSelections})){
      throw new Error(`Invalid Body selection: ${familyId} ${level} ${slotKey} ${actionId}`);
    }
    return S.setSelection('body',sessionKeyFor(familyId,level),slotKey,actionId,'manual',
      reason?{venueOverrideReason:reason}:{});
  }

  function reset(familyId,level){
    const S=window.V15State;
    if(!S)return null;
    const sessionKey=sessionKeyFor(familyId,level);
    S.resetSession('body',sessionKey);
    return ensureState(familyId,level);
  }

  function context(route={}){
    const {familyId,level}=normalizeFamilyLevel(route);
    const sessionKey=sessionKeyFor(familyId,level);
    const session=resolveState(familyId,level);
    const selections=window.V15State?.getSelections?.('body',sessionKey)||{};
    const prep=M.BodyPrep?.resolve?.(session,sessionKey)||null;
    return {familyId,level,sessionKey,session,selections,prep,family:D().bodyFamilies?.[familyId]||{}};
  }

  function rangeText(values,suffix=''){
    const list=Array.isArray(values)?values:[];
    if(!list.length)return '—';
    const text=list.length===1?String(list[0]):list.join('–');
    return text+suffix;
  }

  function roleName(role){return D().bodyRoles?.[role]?.name||role||'动作';}
  function targetNames(ids){
    const catalog=D().bodyTargetCatalog||{};
    return (ids||[]).map(id=>catalog[id]?.name||id).filter(Boolean);
  }
  function slotKind(slotKey){
    if(slotKey==='PRIMARY'||slotKey==='SECONDARY')return 'main';
    if(slotKey==='ACCESSORY')return 'accessory';
    return 'isolation';
  }
  function resolvedSelectionMap(session){
    return Object.fromEntries((session?.main?.content||[]).map(slot=>[slot.key,{actionId:slot.actionId,source:slot.source}]));
  }

  function coachRoleLabel(slotKey){
    return ({
      PRIMARY:'今日主项',
      SECONDARY:'第二训练方向',
      ACCESSORY:'辅助塑形',
      'ISOLATION-1':'局部补充',
      'ISOLATION-2':'局部补充',
      OPTIONAL:'可选补充',
    })[slotKey]||'训练动作';
  }

  function candidateResult(ctx,slotKey){
    return window.V15BodyResolver.candidates({
      familyId:ctx.familyId,
      level:ctx.level,
      slotKey,
      currentSelections:resolvedSelectionMap(ctx.session),
      includeVenueBlocked:true,
    });
  }

  function currentCandidate(ctx,slot){
    const result=candidateResult(ctx,slot.key);
    return [...(result.candidates||[]),...(result.blockedCandidates||[])].find(candidate=>candidate.actionId===slot.actionId)||null;
  }

  function slotDuty(ctx,slot){
    const action=D().actions?.[slot.actionId]||{},meta=D().bodyActionMeta?.[slot.actionId]||{};
    const targets=targetNames(meta.directTargets);
    const lead=targets[0]||action.pattern||'目标肌群';
    if(slot.key==='PRIMARY')return `${lead}主项`;
    if(slot.key==='SECONDARY')return `${action.pattern||lead}第二训练方向`;
    if(slot.key==='ACCESSORY')return `${lead}辅助塑形`;
    if(slot.key==='OPTIONAL')return `${lead}可选补充`;
    return `${lead}局部补充`;
  }

  function focusSummary(ctx){
    const family=ctx.family||{},primary=targetNames(family.primaryTargets).slice(0,2),secondary=targetNames(family.secondaryTargets).slice(0,2);
    const items=[
      primary.length?`${primary.join(' / ')}主导`:'',
      secondary.length?`${secondary.join(' / ')}补充`:'',
      `${ctx.level} 能力阶段`,
    ].filter(Boolean);
    return `<section class="body-coach-focus" data-body-coach-focus><div><span>今日重点</span><h2>${esc(items.join(' · '))}</h2><p>先保证主项质量，再完成第二训练方向与局部塑形；替换动作按当前 Session 推荐排序。</p></div></section>`;
  }

  function primarySpotlight(ctx){
    const slot=(ctx.session.main.content||[]).find(item=>item.key==='PRIMARY');
    if(!slot)return '';
    const domain=ctx.session.domainContext?.slots?.PRIMARY||{},candidate=currentCandidate(ctx,slot);
    const reason=(candidate?.reasons||[])[0]?.text||'承担今天最重要的主要刺激';
    const targets=targetNames(D().bodyActionMeta?.[slot.actionId]?.directTargets).join(' · ')||'主要目标未标';
    return `<section class="body-primary-spotlight" data-body-primary-spotlight><div class="body-primary-kicker"><span>今日主项</span><small>${esc(slot.source==='manual'?'手动选择':'系统推荐')}</small></div><div class="body-primary-main"><div><h2>${esc(slot.name)}</h2><p>主要刺激：${esc(targets)}</p></div><a href="#/library?focus=${encodeURIComponent(slot.actionId)}">查看动作</a></div><div class="body-primary-prescription"><b>${esc(domain.workingSets??'—')} × ${esc(rangeText(domain.repRange))}</b><span>RIR ${esc(rangeText(domain.rirRange))}</span><span>休息 ${esc(rangeText(domain.restSecondsRange,' 秒'))}</span></div><p class="body-primary-why"><b>为什么是今天的主项：</b>${esc(reason)}</p></section>`;
  }

  function recommendationForSlot(ctx,slotKey){
    const result=candidateResult(ctx,slotKey);
    return result.candidates?.[0]||null;
  }

  function conflictSuggestion(ctx,issue){
    const slotByCode={
      BODY_PRIMARY_SECONDARY_TOO_SIMILAR:'SECONDARY',
      BODY_ACCESSORY_ROLE_COLLAPSE:'ACCESSORY',
      BODY_SLOT_INTENT_MISMATCH:'SECONDARY',
    };
    const slotKey=slotByCode[issue?.code]||'';
    if(slotKey){
      const candidate=recommendationForSlot(ctx,slotKey);
      if(candidate)return `建议调整${coachRoleLabel(slotKey)}：优先考虑 ${candidate.name}。`;
    }
    if(issue?.code==='BODY_LOCAL_FATIGUE_CHAIN')return '建议先保证主项质量，再决定是否保留后续局部补充。';
    if(issue?.code==='BODY_TARGET_DISTRIBUTION_IMBALANCE')return '建议优先查看能补足主要目标的高分候选。';
    if(issue?.code==='BODY_EXCESSIVE_TARGET_SHARE')return '建议减少同一目标的重复局部动作，给其他主要目标留出训练预算。';
    if(issue?.code==='BODY_SEQUENCE_SUBOPTIMAL')return '建议先完成高价值主项，再安排局部补充。';
    return issue?.severity==='hard'?'请先处理此问题后再继续带课。':'结合会员当日状态决定是否调整。';
  }

  function coachRisk(ctx){
    const result=ctx.session.conflictContext||{status:'PASS',issues:[]};
    const issues=(result.issues||[]).slice(0,3);
    if(!issues.length){
      return `<section class="body-coach-risk pass" data-body-risk><div><span>今日风险</span><b>可以继续</b></div><p>当前结构无明显冲突，按计划执行即可。</p></section>`;
    }
    const items=issues.map(issue=>`<article class="body-risk-item ${esc(issue.severity||'warn')}"><div><b>${esc(issue.title||'需要调整')}</b><span>${esc(issue.severity==='hard'?'必须处理':'提醒')}</span></div><p>${esc(issue.text||'')}</p><small>${esc(conflictSuggestion(ctx,issue))}</small></article>`).join('');
    return `<section class="body-coach-risk ${esc(String(result.status||'WARN').toLowerCase())}" data-body-risk><div class="body-risk-head"><span>今日风险</span><b>${esc(result.status==='FAIL'?'需要先调整':'注意以下提醒')}</b></div><div class="body-risk-list">${items}</div></section>`;
  }

  function compatibilityDebug(ctx){
    const rows=(ctx.session.main.content||[]).map(slot=>{
      const candidate=currentCandidate(ctx,slot);
      if(!candidate)return '';
      const components=Object.entries(candidate.components||{}).map(([key,value])=>`${key} ${Number(value)>=0?'+':''}${value}`).join(' · ');
      return `<article class="body-score-row"><div><b>${esc(coachRoleLabel(slot.key))}｜${esc(slot.name)}</b><span>${esc(candidate.recommendationScore)} 分</span></div><p>${esc(components)}</p></article>`;
    }).join('');
    return `<section class="body-score-debug"><div class="body-review-head"><span>SCORE / DEBUG</span><h3>Compatibility Score 分项</h3></div>${rows||'<p>当前没有可显示的评分信息。</p>'}</section>`;
  }

  function slotSelect(ctx,slot){
    const result=candidateResult(ctx,slot.key);
    const candidates=result.candidates||[];
    const blockedCandidates=result.blockedCandidates||[];
    const stationBlockedCandidates=result.stationBlockedCandidates||[];
    const currentBlocked=blockedCandidates.find(candidate=>candidate.actionId===slot.actionId);
    const selectCandidates=currentBlocked?[currentBlocked,...candidates]:candidates;
    const options=selectCandidates.map(candidate=>{
      const reasons=(candidate.reasons||[]).map(item=>item.text).filter(Boolean).join('；');
      const tradeoffs=(candidate.tradeoffs||[]).map(item=>item.text).filter(Boolean).join('；');
      const targets=targetNames(candidate.directTargets).slice(0,3).join(' · ');
      return `<option value="${esc(candidate.actionId)}" ${candidate.actionId===slot.actionId?'selected':''} data-score="${esc(candidate.recommendationScore??'')}" data-family="${esc(targets)}" data-role="${esc(coachRoleLabel(slot.key))}" data-reasons="${esc(reasons)}" data-tradeoffs="${esc(tradeoffs)}">${esc(candidate.name)}${candidate.requiresVenueOverride?'｜场馆 Gate 已覆盖':''}</option>`;
    }).join('');
    const current=candidates.find(candidate=>candidate.actionId===slot.actionId)||null;
    const currentScore=Number(current?.recommendationScore||0);
    const candidateCards=candidates.slice(0,4).map((candidate,index)=>{
      const status=index===0?'推荐':candidate.tradeoffs?.length?'有代价':'可选';
      const reasons=(candidate.reasons||[]).slice(0,2).map(item=>item.text).filter(Boolean);
      const tradeoffs=(candidate.tradeoffs||[]).slice(0,1).map(item=>item.text).filter(Boolean);
      const targets=targetNames(candidate.directTargets).slice(0,3);
      const better=Number(candidate.recommendationScore)>currentScore&&candidate.actionId!==slot.actionId;
      return `<article class="body-candidate-card ${esc(status==='推荐'?'recommended':status==='有代价'?'tradeoff':'optional')}" data-body-candidate-card data-action-id="${esc(candidate.actionId)}"><div class="body-candidate-top"><div><span>${esc(status)}</span><b>${esc(candidate.name)}</b></div><strong>${esc(candidate.recommendationScore)} 分</strong></div><p>主要刺激：${esc(targets.join(' · ')||'目标未标')}</p><small>${esc(reasons.join('；')||'符合当前槽位的合法候选')}</small>${better&&reasons[0]?`<em>为什么更合适：${esc(reasons[0])}</em>`:''}${tradeoffs.length?`<em class="warning">注意：${esc(tradeoffs.join('；'))}</em>`:''}<button type="button" data-body-candidate data-body-slot="${esc(slot.key)}" data-action-id="${esc(candidate.actionId)}" ${candidate.actionId===slot.actionId?'disabled':''}>${candidate.actionId===slot.actionId?'当前动作':'换成此动作'}</button></article>`;
    }).join('');
    const stationBlockedHtml=stationBlockedCandidates.length?`<details class="body-station-gate-details" data-body-station-gate><summary>器械站点 Gate：${stationBlockedCandidates.length} 个动作默认不允许重复占用</summary><p>以下替换会与本节已占用的同一台物理器械冲突。系统按已确认的 stationId 拦截；未确认站点不会擅自猜测。</p><div class="body-station-gate-list">${stationBlockedCandidates.map(candidate=>{
      const station=candidate.equipmentStation||{};
      const peers=(station.conflicts||[]).map(peer=>`${peer.slotKey}｜${peer.actionName}`).join('、')||'当前正式动作';
      const stationLabel=station.stationName||station.stationGroupName||station.stationId||'已确认站点';
      return `<article class="body-station-blocked-card" data-body-station-blocked data-action-id="${esc(candidate.actionId)}"><div class="body-station-blocked-head"><b>${esc(candidate.name)}</b><span>默认拦截</span></div><p>${esc(station.reason||'该动作会复用本节已经占用的同一台物理器械。')}</p><small>冲突站点：${esc(stationLabel)} · 当前占用：${esc(peers)}</small></article>`;
    }).join('')}</div></details>`:'';
    const blockedHtml=blockedCandidates.length?`<details class="body-venue-gate-details" data-body-venue-gate><summary>场馆 Gate：${blockedCandidates.length} 个动作需要教练确认</summary><p>这些动作未通过当前场馆能力 Gate，系统不会静默推荐；如教练现场确认会员能力，可留下理由后覆盖。</p><div class="body-venue-gate-list">${blockedCandidates.map(candidate=>{
      const venue=candidate.venueEligibility||{};
      const reason=venue.reason||'当前动作未通过场馆最低负重 Gate。';
      const reasonLength=Number(venue.minimumReasonLength)||8;
      const minimumLoad=venue.minimumSystemLoadKg===null||venue.minimumSystemLoadKg===undefined?'未核验':`${venue.minimumSystemLoadKg}kg`;
      const levelCeiling=venue.levelCeilingKg===null||venue.levelCeilingKg===undefined?'未核验':`${venue.levelCeilingKg}kg`;
      const override=venue.overrideAllowed?`<label class="body-venue-reason"><span>教练覆盖理由（至少 ${esc(reasonLength)} 个字）</span><input type="text" minlength="${esc(reasonLength)}" maxlength="300" data-body-venue-reason data-body-venue-action="${esc(candidate.actionId)}" placeholder="例如：已现场确认会员具备当前器械负荷能力"></label><button type="button" data-body-venue-override data-body-slot="${esc(slot.key)}" data-action-id="${esc(candidate.actionId)}">确认使用并记录</button>`:'<small>当前动作只可在规则允许的等级与场馆条件下使用，不能通过人工覆盖绕过基础资格。</small>';
      return `<article class="body-venue-blocked-card" data-body-venue-blocked data-action-id="${esc(candidate.actionId)}"><div class="body-venue-blocked-head"><b>${esc(candidate.name)}</b><span>需要处理</span></div><p>${esc(reason)}</p><small>场馆最低系统负重：${esc(minimumLoad)} · 当前等级门槛：${esc(levelCeiling)}</small>${override}</article>`;
    }).join('')}</div></details>`:'';
    const venueAudit=ctx.session.domainContext?.venue?.slots?.[slot.key]||{};
    const venueStatus=venueAudit.status==='OVERRIDDEN'
      ?`<p class="body-venue-current override">场馆 Gate：已覆盖 · 已记录理由：${esc(venueAudit.overrideReason||'')}</p>`
      :venueAudit.status==='FALLBACK'
        ?`<p class="body-venue-current fallback">场馆 Gate：已回退到安全候选（原请求：${esc(venueAudit.requestedActionId||'—')}）。</p>`:'';
    const stationAudit=ctx.session.domainContext?.equipmentStations?.slots?.[slot.key]||{};
    const stationAuditHtml=stationAudit.status==='UNVERIFIED'
      ?`<p class="body-station-audit unverified">器械站点：未核验；系统不按 equipmentId 猜测冲突。</p>`
      :stationAudit.status==='EXPLICIT_REUSE'
        ?`<p class="body-station-audit explicit">器械站点：已按明确复用 policy 放行，请确认 protocol 与会员体验。</p>`:'';
    const Recent=window.V15RecentActions,contextKey=Recent?.context?.body?.({familyId:ctx.familyId,level:ctx.level,slotKey:slot.key})||'';
    const quick=Recent?.renderButtons?.({templateId:'body',contextKey,candidates,currentActionId:slot.actionId})||'';
    const lowerCatalogIds=new Set((window.V15LowerAssistance?.catalog?.().entries||[]).map(entry=>entry.id));
    const hasLowerAssistance=slot.key!=='PRIMARY'&&candidates.some(candidate=>lowerCatalogIds.has(candidate.actionId));
    const lowerBrowse=hasLowerAssistance?`<a class="lower-assistance-browse" href="#/system/patterns?focus=aux-lower&template=body&family=${encodeURIComponent(ctx.familyId)}&level=${encodeURIComponent(ctx.level)}&slotKey=${encodeURIComponent(slot.key)}">查看全部下肢辅助与容量动作 →</a>`:'';
    const lowerDrawer=hasLowerAssistance?`<button type="button" class="lower-assistance-drawer-open" data-replacement-drawer data-replacement-select=".body-slot-select" data-replacement-title="${esc(coachRoleLabel(slot.key))}｜下肢替换" data-replacement-subtitle="${esc(ctx.familyId)} · ${esc(ctx.level)} · 仅显示 Body Resolver 通过 Gate 的候选">打开替换抽屉</button>`:'';
    return `<div class="body-slot-swap-zone"><label class="body-slot-swap"><span>替换动作</span><select class="body-slot-select" data-body-session="${esc(ctx.sessionKey)}" data-body-slot="${esc(slot.key)}">${options}</select></label>${venueStatus}${stationAuditHtml}${lowerDrawer}${lowerBrowse}<details class="body-candidate-details"><summary>查看推荐替换与理由</summary><div class="body-candidate-list">${candidateCards}</div></details>${stationBlockedHtml}${blockedHtml}${quick}</div>`;
  }

  function slotCard(ctx,slot){
    const session=ctx.session,domain=session.domainContext?.slots?.[slot.key]||{};
    const action=D().actions?.[slot.actionId]||{},meta=D().bodyActionMeta?.[slot.actionId]||{};
    const targets=targetNames(meta.directTargets);
    const duty=slotDuty(ctx,slot);
    return `<article class="body-slot-card body-slot-${slotKind(slot.key)} ${slot.key==='PRIMARY'?'body-slot-primary':''}" data-body-slot="${esc(slot.key)}">
      <div class="body-slot-head"><div><span class="body-coach-role">${esc(coachRoleLabel(slot.key))}</span><span class="body-system-role">${esc(slot.key)}</span></div><small>${slot.source==='manual'?'手动选择':'系统推荐'}</small></div>
      <div class="body-slot-action"><div><h3>${esc(slot.name)}</h3><p class="body-slot-duty">今日职责：${esc(duty)}</p><div class="body-action-tags"><span>${esc(action.pattern||'动作模式未标')}</span><span>主要刺激：${esc(targets.join(' · ')||'目标肌群未标')}</span></div></div><a href="#/library?focus=${encodeURIComponent(slot.actionId)}">查看动作</a></div>
      <div class="body-prescription-compact"><b>${esc(domain.workingSets??'—')} × ${esc(rangeText(domain.repRange))}</b><span>RIR ${esc(rangeText(domain.rirRange))}</span><span>休息 ${esc(rangeText(domain.restSecondsRange,' 秒'))}</span></div>
      ${slotSelect(ctx,slot)}
    </article>`;
  }

  function trainingBlock(ctx,{kind,title,caption,keys}){
    const cards=(ctx.session.main.content||[]).filter(slot=>keys.includes(slot.key)).map(slot=>slotCard(ctx,slot)).join('');
    if(!cards)return '';
    return `<section class="body-training-block body-training-${esc(kind)}" data-body-block="${esc(kind)}"><div class="body-training-head"><div><span>${esc(kind==='main'?'01':kind==='accessory'?'02':'03')}</span><div><h3>${esc(title)}</h3><p>${esc(caption)}</p></div></div></div><div class="body-slot-grid body-slot-grid-${esc(kind)}">${cards}</div></section>`;
  }

  function anatomy(session){
    const a=session.anatomyContext||{};
    const row=(label,items)=>`<div><small>${label}</small><b>${esc((items||[]).join(' · ')||'—')}</b></div>`;
    return `<section class="session-muscle-summary body-anatomy-summary"><div class="muscle-summary-head"><div><span>ANATOMY</span><h2>ANATOMY｜动作涉及肌群</h2></div><small>表示本节动作中的主要 / 协同 / 稳定参与，不等同于有效工作组数。</small></div><div class="muscle-summary-grid">${row('主要参与',a.primary)}${row('协同参与',a.secondary)}${row('稳定参与',a.stabilizers)}</div></section>`;
  }

  function conflict(session){
    if(M.ConflictView?.render)return M.ConflictView.render(session.conflictContext);
    const result=session.conflictContext||{status:'PASS',hardCount:0,warnCount:0,issues:[]};
    return `<section class="conflict-box ${String(result.status||'PASS').toLowerCase()}"><b>${esc(result.status||'PASS')}</b><small>${esc(result.hardCount||0)} 硬冲突 · ${esc(result.warnCount||0)} 警告</small></section>`;
  }

  function advancedInfo(ctx){
    const session=ctx.session;
    return `<details class="body-advanced" data-body-advanced><summary><div><span>高级训练信息</span><b>有效工作组 · 肌群 · Conflict · Score</b></div><small>默认折叠</small></summary><div class="body-advanced-content"><section class="body-advanced-block"><div class="body-review-head"><span>CONFLICT DETAIL</span><h3>完整风险与冲突详情</h3></div>${conflict(session)}</section>${M.BodyVolumeView.render(session)}${anatomy(session)}${compatibilityDebug(ctx)}</div></details>`;
  }

  function coachOverview(ctx){
    return `<section class="body-coach-overview" data-body-coach-overview>${focusSummary(ctx)}${primarySpotlight(ctx)}${coachRisk(ctx)}</section>`;
  }

  function recovery(ctx){
    if(!M.BodyRecovery?.render)throw new Error('Body Recovery presentation is unavailable');
    return M.BodyRecovery.render(ctx?.session);
  }

  function renderEditor(ctx){
    const session=ctx.session;
    const prepHtml=ctx.prep&&M.BodyPrep?.renderResolved?M.BodyPrep.renderResolved(ctx.prep,ctx.sessionKey,ctx.session):'';
    const mainBlock=trainingBlock(ctx,{kind:'main',title:'主训练',caption:'先完成今日主项，再进入第二训练方向。',keys:['PRIMARY','SECONDARY']});
    const accessoryBlock=trainingBlock(ctx,{kind:'accessory',title:'辅助塑形',caption:'补足目标刺激，不和主项抢同一训练职责。',keys:['ACCESSORY']});
    const isolationBlock=trainingBlock(ctx,{kind:'isolation',title:'局部补充',caption:'在主训练质量完成后，用孤立项补足局部训练量。',keys:['ISOLATION-1','ISOLATION-2','OPTIONAL']});
    const structure=`<div class="body-structure-strip"><div><b>01</b><span>今日主项</span></div><i>→</i><div><b>02</b><span>第二方向</span></div><i>→</i><div><b>03</b><span>辅助 / 局部</span></div></div>`;
    const editor=`<section class="section-card body-editor" data-body-session="${esc(ctx.sessionKey)}"><div class="section-head body-editor-head"><div><span class="eyebrow">TODAY'S SESSION</span><h2>今日训练安排</h2><p>按教练执行顺序展示；系统字段与审计信息已收进高级训练信息。</p></div><span class="time-badge">${esc(ctx.level)}</span></div>${structure}${mainBlock}${accessoryBlock}${isolationBlock}${advancedInfo(ctx)}<div class="session-toolbar"><div></div><div class="session-toolbar-actions"><button data-body-copy="coach" type="button">复制教练版</button><button data-body-copy="member" type="button">复制会员版</button><button id="reset-body-session" type="button">恢复系统推荐</button></div></div></section>`;
    return `${coachOverview(ctx)}${prepHtml}${editor}${recovery(ctx)}`;
  }

  function levelSwitch(familyId,currentLevel){
    return `<nav class="body-session-level-switch" aria-label="Body 训练等级">${['L1','L2','L3','L4'].map(level=>`<a class="${level===currentLevel?'active':''}" href="#/coach/body/${familyId.toLowerCase()}/${level.toLowerCase()}">${level}</a>`).join('')}</nav>`;
  }

  function render(route){
    const ctx=context(route),family=ctx.family;
    return `<a class="back-link" href="#/coach/body/${ctx.familyId.toLowerCase()}">← 返回 ${esc(family.name||'Family')} 选择等级</a>`+
      `<section class="view-hero body-session-hero"><span class="eyebrow">COACH CENTER / BODY</span><h1>${esc(family.name||ctx.familyId)}</h1><p>${esc(ctx.session.summary)}</p><div class="chips"><span class="chip">${esc(ctx.level)}</span><span class="chip">${esc(ctx.session.domainContext.volume.totalWorkingSets)} 个工作组</span><span class="chip">${esc(ctx.session.conflictContext.status)}</span></div>${levelSwitch(ctx.familyId,ctx.level)}</section>`+
      renderEditor(ctx)+(M.SavedSessionsUI?.controls?.(route)||'');
  }

  function renderComposer(route){
    const ctx=context(route);
    const familyOptions=(D().bodyFamilyIds||[]).map(familyId=>{
      const family=D().bodyFamilies?.[familyId]||{};
      return `<option value="${esc(familyId)}" ${familyId===ctx.familyId?'selected':''}>${esc(family.name||familyId)}</option>`;
    }).join('');
    const levelOptions=['L1','L2','L3','L4'].map(level=>`<option value="${level}" ${level===ctx.level?'selected':''}>${level}</option>`).join('');
    return `<a class="back-link" href="#/coach/body">← 返回 Body</a>`+
      `<section class="view-hero body-composer-hero"><span class="eyebrow">COACH CENTER / BODY COMPOSER</span><h1>Body 自由编课</h1><p>选择训练 Family 与等级；下方与正式 Body Session 共用同一个编辑器、状态和 ResolvedSession。</p><div class="body-compose-controls"><label><span>训练 Family</span><select data-body-compose-family>${familyOptions}</select></label><label><span>训练等级</span><select data-body-compose-level>${levelOptions}</select></label></div></section>`+
      renderEditor(ctx)+(M.SavedSessionsUI?.controls?.(route)||'');
  }

  function canHandle(route={}){
    return route.templateId==='body'&&(route.page==='template'||route.page==='template-family'||route.page==='template-session'||route.page==='template-compose');
  }

  function composerHash(route,familyId,level){
    const next={
      ...route,
      area:'coach',
      page:'template-compose',
      templateId:'body',
      query:{family:familyId,level},
    };
    return window.V14Router?.canonicalHash?.(next)||`#/coach/body/compose?family=${encodeURIComponent(familyId)}&level=${encodeURIComponent(level)}`;
  }

  async function copyCurrent(route,kind,button){
    const Shared=window.V14SessionCopy;
    if(!M.BodyCopy||!Shared?.copyText)return false;
    const fresh=context(route);
    const payload=M.BodyCopy.buildPayload(fresh.session,fresh.prep);
    const text=kind==='member'?M.BodyCopy.formatMember(payload):M.BodyCopy.formatCoach(payload);
    const original=button?.textContent||'';
    try{
      await Shared.copyText(text);
      if(button)button.textContent='已复制';
      return true;
    }finally{
      if(button&&original)setTimeout(()=>{button.textContent=original;},1200);
    }
  }

  function bind(route,root,rerender){
    if(route.page!=='template-session'&&route.page!=='template-compose')return;
    const {familyId,level}=normalizeFamilyLevel(route);

    if(route.page==='template-compose'){
      const rawFamily=String(route.query?.family||'').toUpperCase();
      const rawLevel=String(route.query?.level||'').toUpperCase();
      const familyValid=(D().bodyFamilyIds||[]).includes(rawFamily);
      const levelValid=/^L[1-4]$/.test(rawLevel);
      const needsCanonicalQuery=!familyValid||!levelValid||route.query?.family!==familyId||route.query?.level!==level;
      if(needsCanonicalQuery){
        const hash=composerHash(route,familyId,level);
        if(window.location?.hash!==hash){
          if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
          return;
        }
      }
      root.querySelector('[data-body-compose-family]')?.addEventListener('change',event=>{
        const nextFamily=String(event.currentTarget.value||'BODY-01').toUpperCase();
        const hash=composerHash(route,nextFamily,level);
        if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
      });
      root.querySelector('[data-body-compose-level]')?.addEventListener('change',event=>{
        const nextLevel=String(event.currentTarget.value||'L1').toUpperCase();
        const hash=composerHash(route,familyId,nextLevel);
        if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
      });
    }

    root.querySelectorAll('.body-slot-select').forEach(select=>select.addEventListener('change',()=>{
      const slotKey=select.dataset.bodySlot,candidates=Array.from(select.options).filter(option=>option.value).map(option=>({actionId:option.value,name:option.textContent||option.value}));
      const contextKey=window.V15RecentActions?.context?.body?.({familyId,level,slotKey});
      window.V15RecentActions?.record?.({templateId:'body',contextKey,actionId:select.value,candidates});
      setFormalSelection(familyId,level,slotKey,select.value);
      rerender();
    }));
    root.querySelectorAll('[data-body-candidate]').forEach(button=>button.addEventListener('click',()=>{
      const slotKey=button.dataset.bodySlot,actionId=button.dataset.actionId;
      if(!slotKey||!actionId||button.disabled)return;
      const card=button.closest('.body-slot-card'),select=card?.querySelector('.body-slot-select');
      const candidates=Array.from(select?.options||[]).filter(option=>option.value).map(option=>({actionId:option.value,name:option.textContent||option.value}));
      if(!candidates.some(candidate=>candidate.actionId===actionId))return;
      const contextKey=window.V15RecentActions?.context?.body?.({familyId,level,slotKey});
      window.V15RecentActions?.record?.({templateId:'body',contextKey,actionId,candidates});
      setFormalSelection(familyId,level,slotKey,actionId);
      rerender();
    }));
    root.querySelectorAll('.body-slot-card [data-recent-action]').forEach(button=>button.addEventListener('click',()=>{
      const card=button.closest('.body-slot-card'),slotKey=card?.dataset.bodySlot,select=card?.querySelector('.body-slot-select');
      const actionId=button.dataset.recentAction,candidates=Array.from(select?.options||[]).filter(option=>option.value).map(option=>({actionId:option.value,name:option.textContent||option.value}));
      if(!select||!slotKey||!candidates.some(candidate=>candidate.actionId===actionId))return;
      const contextKey=window.V15RecentActions?.context?.body?.({familyId,level,slotKey});
      window.V15RecentActions?.record?.({templateId:'body',contextKey,actionId,candidates});
      setFormalSelection(familyId,level,slotKey,actionId);
      rerender();
    }));
    root.querySelectorAll('[data-body-venue-override]').forEach(button=>button.addEventListener('click',()=>{
      const slotKey=button.dataset.bodySlot,actionId=button.dataset.actionId;
      const card=button.closest('[data-body-venue-blocked]'),input=card?.querySelector('[data-body-venue-reason]');
      const reason=input?.value?.trim()||'';
      try{
        setFormalSelection(familyId,level,slotKey,actionId,reason);
        rerender();
      }catch(error){
        const message=error?.message||'请补充教练现场确认理由后再试。';
        let status=card?.querySelector('[data-body-venue-error]');
        if(!status){status=document.createElement('small');status.dataset.bodyVenueError='';status.className='body-venue-error';card?.appendChild(status);}
        status.textContent=message;
        input?.focus();
      }
    }));
    root.querySelectorAll('.body-prep-select').forEach(select=>select.addEventListener('change',()=>{
      M.BodyPrep.setSelection(select.dataset.bodyPrepSession,select.dataset.bodyPrepSlot,select.value);
      rerender();
    }));
    root.querySelectorAll('[data-body-copy]').forEach(button=>button.addEventListener('click',()=>{
      copyCurrent(route,button.dataset.bodyCopy,button).catch(error=>console.error('Body copy failed',error));
    }));
    root.querySelector('#reset-body-session')?.addEventListener('click',()=>{
      reset(familyId,level);
      rerender();
    });
  }

  const adapter={
    canHandle,
    render(route){
      if(route.page==='template')return M.BodyHome.render(route);
      if(route.page==='template-family')return M.BodyHome.renderFamily(route);
      if(route.page==='template-compose')return renderComposer(route);
      return render(route);
    },
    bind,
  };
  M.BodySession={context,render,renderEditor,ensureState,resolveState,setFormalSelection,reset,copyCurrent,adapter};
  M.TemplateUI.register('body',adapter);
})();
