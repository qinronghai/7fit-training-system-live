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

  function setFormalSelection(familyId,level,slotKey,actionId){
    const S=window.V15State;
    if(!S)throw new Error('Body coach State service is unavailable');
    ensureState(familyId,level);
    const currentSelections=Object.fromEntries(
      Object.entries(S.getSelections('body',sessionKeyFor(familyId,level))||{})
        .map(([key,value])=>[key,value?.actionId||value||''])
    );
    if(!window.V15BodyResolver.isSelectionValid({familyId,level,slotKey,actionId,currentSelections})){
      throw new Error(`Invalid Body selection: ${familyId} ${level} ${slotKey} ${actionId}`);
    }
    return S.setSelection('body',sessionKeyFor(familyId,level),slotKey,actionId,'manual');
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
    });
  }

  function currentCandidate(ctx,slot){
    return (candidateResult(ctx,slot.key).candidates||[]).find(candidate=>candidate.actionId===slot.actionId)||null;
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
    const options=candidates.map(candidate=>`<option value="${esc(candidate.actionId)}" ${candidate.actionId===slot.actionId?'selected':''}>${esc(candidate.name)}</option>`).join('');
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
    const Recent=window.V15RecentActions,contextKey=Recent?.context?.body?.({familyId:ctx.familyId,level:ctx.level,slotKey:slot.key})||'';
    const quick=Recent?.renderButtons?.({templateId:'body',contextKey,candidates,currentActionId:slot.actionId})||'';
    return `<div class="body-slot-swap-zone"><label class="body-slot-swap"><span>替换动作</span><select class="body-slot-select" data-body-session="${esc(ctx.sessionKey)}" data-body-slot="${esc(slot.key)}">${options}</select></label><details class="body-candidate-details"><summary>查看推荐替换与理由</summary><div class="body-candidate-list">${candidateCards}</div></details>${quick}</div>`;
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

  function recovery(){
    if(!M.BodyRecovery?.render)throw new Error('Body Recovery presentation is unavailable');
    return M.BodyRecovery.render();
  }

  function renderEditor(ctx){
    const session=ctx.session;
    const prepHtml=ctx.prep&&M.BodyPrep?.renderResolved?M.BodyPrep.renderResolved(ctx.prep,ctx.sessionKey):'';
    const mainBlock=trainingBlock(ctx,{kind:'main',title:'主训练',caption:'主项 + 次主项｜优先完成今天最重要的高价值动作。',keys:['PRIMARY','SECONDARY']});
    const accessoryBlock=trainingBlock(ctx,{kind:'accessory',title:'辅助训练',caption:'补足主要目标肌群与动作模式，不重复主项动作家族。',keys:['ACCESSORY']});
    const isolationBlock=trainingBlock(ctx,{kind:'isolation',title:'局部塑形',caption:'孤立项 + 可选项｜控制疲劳，用于补足局部训练量。',keys:['ISOLATION-1','ISOLATION-2','OPTIONAL']});
    const structure=`<div class="body-structure-strip"><div><b>01</b><span>主训练</span></div><i>→</i><div><b>02</b><span>辅助训练</span></div><i>→</i><div><b>03</b><span>局部塑形</span></div></div>`;
    const editor=`<section class="section-card body-editor" data-body-session="${esc(ctx.sessionKey)}"><div class="section-head body-editor-head"><div><h2>今日训练安排</h2><p>${esc(session.summary)}｜先主训练，再辅助，再局部塑形。</p></div><span class="time-badge">${esc(ctx.level)}</span></div>${structure}${conflict(session)}${mainBlock}${accessoryBlock}${isolationBlock}<section class="body-session-review"><div class="body-review-head"><span>SESSION REVIEW</span><h3>训练量与肌群覆盖</h3></div>${M.BodyVolumeView.render(session)}${anatomy(session)}</section><div class="session-toolbar"><div></div><div class="session-toolbar-actions"><button data-body-copy="coach" type="button">复制教练版</button><button data-body-copy="member" type="button">复制会员版</button><button id="reset-body-session" type="button">恢复系统推荐</button></div></div></section>`;
    return `${prepHtml}${editor}${recovery()}`;
  }

  function render(route){
    const ctx=context(route),family=ctx.family;
    return `<a class="back-link" href="#/coach/body">← 返回 Body</a>`+
      `<section class="view-hero body-session-hero"><span class="eyebrow">COACH CENTER / BODY</span><h1>${esc(family.name||ctx.familyId)}</h1><p>${esc(ctx.session.summary)}</p><div class="chips"><span class="chip">${esc(ctx.level)}</span><span class="chip">${esc(ctx.session.domainContext.volume.totalWorkingSets)} 个工作组</span><span class="chip">${esc(ctx.session.conflictContext.status)}</span></div></section>`+
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
    return route.templateId==='body'&&(route.page==='template'||route.page==='template-session'||route.page==='template-compose');
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
    root.querySelectorAll('.body-slot-card [data-recent-action]').forEach(button=>button.addEventListener('click',()=>{
      const card=button.closest('.body-slot-card'),slotKey=card?.dataset.bodySlot,select=card?.querySelector('.body-slot-select');
      const actionId=button.dataset.recentAction,candidates=Array.from(select?.options||[]).filter(option=>option.value).map(option=>({actionId:option.value,name:option.textContent||option.value}));
      if(!select||!slotKey||!candidates.some(candidate=>candidate.actionId===actionId))return;
      const contextKey=window.V15RecentActions?.context?.body?.({familyId,level,slotKey});
      window.V15RecentActions?.record?.({templateId:'body',contextKey,actionId,candidates});
      setFormalSelection(familyId,level,slotKey,actionId);
      rerender();
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
      if(route.page==='template-compose')return renderComposer(route);
      return render(route);
    },
    bind,
  };
  M.BodySession={context,render,renderEditor,ensureState,resolveState,setFormalSelection,reset,copyCurrent,adapter};
  M.TemplateUI.register('body',adapter);
})();
