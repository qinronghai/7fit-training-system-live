(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const RESOLVER_VERSION='conditioning-v2';
  const BLUEPRINT_VARIANTS=Object.freeze(['A','B','C']);
  const LEVELS=Object.freeze(['L1','L2','L3','L4']);
  const RISK_LABEL=Object.freeze({low:'低',medium:'中',high:'高'});
  const METRIC_LABEL=Object.freeze({time:'时间',distance:'距离',reps:'次数',calories:'卡路里'});

  function defaultVariant(familyId,level){
    const variants=D().conditioningBlueprints?.[familyId]?.[level]||{};
    return variants.A?'A':Object.keys(variants)[0]||'A';
  }

  function variantForProtocol(familyId,level,protocolId){
    const variants=D().conditioningBlueprints?.[familyId]?.[level]||{};
    return Object.entries(variants).find(([,blueprint])=>
      blueprint?.blocks?.some(block=>block.protocolId===protocolId)
    )?.[0]||'';
  }

  function legacyProtocolForRoute(familyId,route={}){
    const protocolId=String(route.query?.protocol||'').toUpperCase();
    const family=D().conditioningFamilies?.[familyId];
    return D().conditioningProtocols?.[protocolId]&&family?.protocolEligibility?.includes(protocolId)
      ?protocolId:'';
  }

  function legacySessionKey(familyId,level,protocolId){
    return `${familyId}-${level}-PROTOCOL-${protocolId}`;
  }

  function normalizeFamilyLevelProtocol(route={}){
    const familyIds=D().conditioningFamilyIds||[];
    const rawFamily=String(route.familyId||route.query?.family||'CON-01').toUpperCase();
    const familyId=familyIds.includes(rawFamily)?rawFamily:'CON-01';
    const rawLevel=String(route.level||route.query?.level||'').toUpperCase();
    const level=/^L[1-4]$/.test(rawLevel)?rawLevel:'L1';
    const rawVariant=String(route.query?.variant||route.variantId||'').toUpperCase();
    const variants=D().conditioningBlueprints?.[familyId]?.[level]||{};
    const explicitVariant=BLUEPRINT_VARIANTS.includes(rawVariant)&&!!variants[rawVariant];
    const requestedProtocol=legacyProtocolForRoute(familyId,route);
    const protocolVariant=!explicitVariant&&requestedProtocol
      ?variantForProtocol(familyId,level,requestedProtocol):'';
    const variantId=explicitVariant?rawVariant:protocolVariant||defaultVariant(familyId,level);
    const legacyProtocolId=!explicitVariant&&!protocolVariant?requestedProtocol:'';
    const blueprint=variants[variantId]||{};
    const protocolId=legacyProtocolId||blueprint.blocks?.find(block=>block.role==='MAIN')?.protocolId||blueprint.blocks?.[0]?.protocolId||'';
    return {
      familyId,level,variantId,legacyProtocolId,
      sessionBlueprintId:blueprint.sessionBlueprintId||`${familyId}-${level}-${variantId}`,
      protocolId,
    };
  }

  function normalizeVariantId(familyId,level,value){
    const variant=String(value||'').toUpperCase();
    return BLUEPRINT_VARIANTS.includes(variant)&&D().conditioningBlueprints?.[familyId]?.[level]?.[variant]
      ?variant:defaultVariant(familyId,level);
  }

  function nextVariantId({familyId,level,currentVariantId,previousVariantId}={}){
    const variants=D().conditioningBlueprints?.[familyId]?.[level]||{};
    const available=BLUEPRINT_VARIANTS.filter(variantId=>variants[variantId]);
    if(!available.length)return 'A';
    const requested=String(currentVariantId||previousVariantId||'').toUpperCase();
    const current=available.includes(requested)?requested:available[0];
    return available[(available.indexOf(current)+1)%available.length];
  }

  function stateMetadata(familyId,level,variantId){
    const variant=normalizeVariantId(familyId,level,variantId);
    return {
      familyId,level,resolverVersion:RESOLVER_VERSION,
      input:{familyId,level,variantId:variant,sessionBlueprintId:`${familyId}-${level}-${variant}`},
    };
  }

  function sessionKeyFor(familyId,level,variantId){
    return `${familyId}-${level}-BLUEPRINT-${normalizeVariantId(familyId,level,variantId)}`;
  }

  function ensureState(familyId,level,variantId){
    const S=window.V15State;
    if(!S)return null;
    const variant=normalizeVariantId(familyId,level,variantId);
    const sessionKey=sessionKeyFor(familyId,level,variant),metadata=stateMetadata(familyId,level,variant);
    if(!S.getSession('conditioning',sessionKey))S.ensureSession('conditioning',sessionKey,metadata);
    const current=S.getSession('conditioning',sessionKey);
    const options={
      resolverVersion:RESOLVER_VERSION,
      isSelectionValid:(stationKey,entry,state)=>window.V15ConditioningResolver.isSelectionValid({
        familyId:state.familyId,
        level:state.level,
        variantId:state.input?.variantId||variant,
        stationKey,
        actionId:entry.actionId,
        currentSelections:state.selections,
      }),
    };
    if(current.resolverVersion!==RESOLVER_VERSION)return S.reconcileSession('conditioning',sessionKey,options).session;
    S.reconcileSession('conditioning',sessionKey,options);
    return S.getSession('conditioning',sessionKey);
  }

  function ensureLegacyState(familyId,level,protocolId){
    const S=window.V15State;
    if(!S)return null;
    const sessionKey=legacySessionKey(familyId,level,protocolId),metadata={
      familyId,level,resolverVersion:'conditioning-v1',input:{familyId,level,protocolId},
    };
    if(!S.getSession('conditioning',sessionKey))S.ensureSession('conditioning',sessionKey,metadata);
    S.reconcileSession('conditioning',sessionKey,{
      resolverVersion:'conditioning-v1',
      isSelectionValid:(stationKey,entry,state)=>window.V15ConditioningResolver.isSelectionValid({
        familyId:state.familyId,level:state.level,protocolId:state.input?.protocolId||protocolId,
        stationKey,actionId:entry.actionId,currentSelections:state.selections,
      }),
    });
    return S.getSession('conditioning',sessionKey);
  }

  function resolveState(familyId,level,variantId,legacyProtocolId=''){
    const S=window.V15State;
    if(legacyProtocolId){
      const sessionKey=legacySessionKey(familyId,level,legacyProtocolId);
      if(!S)return window.V15TemplateResolver.resolve('conditioning',{familyId,level,protocolId:legacyProtocolId,selections:{}});
      ensureLegacyState(familyId,level,legacyProtocolId);
      return window.V15TemplateResolver.resolve('conditioning',{
        familyId,level,protocolId:legacyProtocolId,
        selections:S.getSelections('conditioning',sessionKey),
      });
    }
    const variant=normalizeVariantId(familyId,level,variantId);
    if(!S)return window.V15TemplateResolver.resolve('conditioning',{familyId,level,variantId:variant,selections:{}});
    ensureState(familyId,level,variant);
    return window.V15TemplateResolver.resolve('conditioning',{
      familyId,
      level,
      variantId:variant,
      selections:S.getSelections('conditioning',sessionKeyFor(familyId,level,variant)),
    });
  }

  function setFormalSelection(familyId,level,variantId,stationKey,actionId){
    const S=window.V15State;
    if(!S)throw new Error('Conditioning coach State service is unavailable');
    const variant=normalizeVariantId(familyId,level,variantId);
    ensureState(familyId,level,variant);
    if(!window.V15ConditioningResolver.isSelectionValid({
      familyId,level,variantId:variant,stationKey,actionId,
      currentSelections:S.getSelections('conditioning',sessionKeyFor(familyId,level,variant)),
    })){
      throw new Error(`Invalid Conditioning selection: ${familyId} ${level} ${variant} ${stationKey} ${actionId}`);
    }
    return S.setSelection('conditioning',sessionKeyFor(familyId,level,variant),stationKey,actionId,'manual');
  }

  function reset(familyId,level,variantId){
    const S=window.V15State;
    if(!S)return null;
    const variant=normalizeVariantId(familyId,level,variantId);
    const sessionKey=sessionKeyFor(familyId,level,variant);
    S.resetSession('conditioning',sessionKey);
    return ensureState(familyId,level,variant);
  }

  function context(route={}){
    const normalized=normalizeFamilyLevelProtocol(route);
    const {familyId,level,variantId,sessionBlueprintId,protocolId,legacyProtocolId}=normalized;
    const sessionKey=legacyProtocolId?legacySessionKey(familyId,level,legacyProtocolId):sessionKeyFor(familyId,level,variantId);
    const session=resolveState(familyId,level,variantId,legacyProtocolId);
    const selections=window.V15State?.getSelections?.('conditioning',sessionKey)||{};
    const prep=M.ConditioningPrep?.resolve?.(session,sessionKey)||null;
    return {
      familyId,level,variantId,sessionBlueprintId,protocolId,legacyProtocolId,sessionKey,session,selections,prep,
      family:D().conditioningFamilies?.[familyId]||{},
      protocol:D().conditioningProtocols?.[protocolId]||{},
    };
  }

  function resolvedSelectionMap(session){
    return Object.fromEntries(Object.values(session?.domainContext?.stations||{}).map(station=>[
      station.key,{actionId:station.actionId,source:station.source}
    ]));
  }

  function stationSelect(ctx,station,block){
    const result=window.V15ConditioningResolver.candidates({
      familyId:ctx.familyId,
      level:ctx.level,
      protocolId:block.protocolId,
      stationKey:station.key,
      currentSelections:resolvedSelectionMap(ctx.session),
      allowRepeatedActions:ctx.session.domainContext?.repeatPolicy==='SKILL_VARIATION',
    });
    const candidates=result.candidates||[];
    const options=candidates.map(candidate=>`<option value="${esc(candidate.actionId)}" ${candidate.actionId===station.actionId?'selected':''}>${esc(candidate.name)}</option>`).join('');
    const Recent=window.V15RecentActions,contextKey=Recent?.context?.conditioning?.({
      familyId:ctx.familyId,level:ctx.level,protocolId:`${ctx.variantId}:${block.protocolId}`,stationKey:station.key,
    })||'';
    const quick=Recent?.renderButtons?.({templateId:'conditioning',contextKey,candidates,currentActionId:station.actionId})||'';
    return `<label class="conditioning-station-swap"><span>替换本段动作</span><select class="conditioning-station-select" data-conditioning-session="${esc(ctx.sessionKey)}" data-conditioning-station="${esc(station.key)}" data-conditioning-protocol="${esc(block.protocolId)}">${options}</select></label>${quick}`;
  }

  function stationCard(ctx,station,block,index){
    const source=station.source==='manual'?'手动选择':'系统推荐';
    const modalities=(station.modalities||[]).map(id=>D().conditioningModalities?.[id]?.name||id).join(' · ');
    const displayName=station.source==='manual'?station.name:(station.taskLabel||station.name);
    return `<article class="conditioning-station-card" data-conditioning-station-card="${esc(station.key)}">
      <div class="conditioning-station-head"><div><span>任务 ${index+1}</span><h3>${esc(displayName)}</h3>${station.source==='manual'?`<small>原系统推荐：${esc(station.taskLabel||'本段动作')}</small>`:''}</div><small>${source}</small></div>
      <div class="conditioning-station-prescription">${esc(station.prescription||'—')}</div>
      <div class="conditioning-station-meta">
        <span>Work Metric：${esc(METRIC_LABEL[station.workMetric]||station.workMetric||'—')}</span>
        <span>Modality：${esc(modalities||'—')}</span>
        <span>冲击：${esc(RISK_LABEL[station.impact]||station.impact||'—')}</span>
        <span>协调：${esc(RISK_LABEL[station.coordinationDemand]||station.coordinationDemand||'—')}</span>
        <span>疲劳：${esc(RISK_LABEL[station.fatigueRisk]||station.fatigueRisk||'—')}</span>
        ${station.powerEligible?'<span>Power Eligible</span>':''}
      </div>
      ${station.setup?`<p class="conditioning-station-setup">执行准备：${esc(station.setup)}</p>`:''}
      <div class="conditioning-station-actions"><a href="#/library?focus=${encodeURIComponent(station.actionId)}">查看动作</a>${stationSelect(ctx,station,block)}</div>
    </article>`;
  }

  function blockCard(ctx,block,index){
    const stations=Object.values(block.stations||{});
    const metric=block.metrics||{};
    const role=block.roleLabel||block.role||'训练段';
    return `<article class="conditioning-block-card" data-conditioning-block="${esc(block.key)}">
      <div class="conditioning-block-head"><div><span>训练段 ${index+1} · ${esc(role)}</span><h3>${esc(block.label||block.key)}</h3><p>${esc(block.goal||'')}</p></div><span class="time-badge">约 ${esc(metric.blockMinutes??'—')} 分钟 · RPE ${esc(metric.targetRpe??'—')}</span></div>
      <div class="conditioning-block-prescription">${esc(block.protocolName||'')} · ${esc(metric.prescription||block.prescription||'')}</div>
      <div class="conditioning-block-guidance"><div><b>教练重点</b><span>${esc((block.coachingCues||[]).join('；')||'按动作质量与呼吸执行。')}</span></div><div><b>降阶与停止</b><span>${esc([...(block.scaleRules||[]),...(block.stopCriteria||[])].join('；')||'出现疼痛或动作失控时停止并由教练重新评估。')}</span></div><div><b>完成标准</b><span>${esc(block.completionMetric||'完成本段目标并记录实际表现。')}</span></div></div>
      <div class="conditioning-station-grid">${stations.map((station,stationIndex)=>stationCard(ctx,station,block,stationIndex)).join('')}</div>
    </article>`;
  }

  function stressSummary(session){
    const stations=Object.values(session?.domainContext?.stations||{});
    const rank={low:0,medium:1,high:2};
    const max=field=>stations.reduce((best,item)=>(rank[item?.[field]]??0)>(rank[best]??0)?item[field]:best,'low');
    const modalities=[...new Set(stations.flatMap(station=>station.modalities||[]))];
    return {
      impact:max('impact'),
      coordination:max('coordinationDemand'),
      fatigue:max('fatigueRisk'),
      powerCount:stations.filter(station=>station.powerEligible).length,
      modalityNames:modalities.map(id=>D().conditioningModalities?.[id]?.name||id),
    };
  }

  function protocolMetrics(session){
    const m=session?.domainContext?.metrics||{},timing=session?.timing||{};
    const cells=[
      ['训练段',timing.blockCount??session?.blocks?.length??'—'],
      ['训练任务',timing.taskCount??m.stationCount??'—'],
      ['正式训练',timing.mainTrainingMinutes!==undefined?`${timing.mainTrainingMinutes} 分钟`:'—'],
      ['预计整节',timing.estimatedMinutes!==undefined?`${timing.estimatedMinutes} 分钟`:'—'],
      ['动态准备',timing.prepMinutes!==undefined?`${timing.prepMinutes} 分钟`:'—'],
      ['训练后恢复',timing.recoveryMinutes!==undefined?`${timing.recoveryMinutes} 分钟`:'—'],
    ];
    return cells;
  }

  function protocolPanel(session){
    const stress=stressSummary(session),cells=protocolMetrics(session);
    const phases=['准备',...(session.blocks||[]).map(block=>block.roleLabel||block.label||'训练段'),'恢复'];
    return `<section class="section-card conditioning-protocol-panel"><div class="section-head"><div><h2>今日体能结构</h2><p>${esc(session.domainContext?.blueprintLabel||'多段式 Conditioning')}：${esc(phases.join(' → '))}；每个训练段都来自当前 ResolvedSession。</p></div><span class="time-badge">${esc(session.variantId||'A')} 变体</span></div>
      <div class="conditioning-metric-grid">${cells.map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('')}</div>
      <div class="conditioning-stress-summary">
        <div><small>Impact</small><b>${esc(RISK_LABEL[stress.impact]||stress.impact)}</b></div>
        <div><small>Coordination</small><b>${esc(RISK_LABEL[stress.coordination]||stress.coordination)}</b></div>
        <div><small>Fatigue</small><b>${esc(RISK_LABEL[stress.fatigue]||stress.fatigue)}</b></div>
        <div><small>Power Stations</small><b>${esc(stress.powerCount)}</b></div>
        <div class="conditioning-modality-summary"><small>Modality Mix</small><b>${esc(stress.modalityNames.join(' · ')||'—')}</b></div>
      </div><p class="conditioning-blueprint-change">${esc(session.domainContext?.changeSummary||'教练可按当天状态在 A / B / C 变体间切换；动作替换只在当前训练段的合法候选中进行。')}</p>
    </section>`;
  }

  function anatomy(session){
    const a=session.anatomyContext||{};
    const row=(label,items)=>`<div><small>${label}</small><b>${esc((items||[]).join(' · ')||'—')}</b></div>`;
    return `<section class="session-muscle-summary conditioning-anatomy-summary"><div class="muscle-summary-head"><div><span>ANATOMY</span><h2>动作参与概览</h2></div><small>用于教练观察动作负荷分布；不替代 Protocol / Conflict 规则。</small></div><div class="muscle-summary-grid">${row('主要参与',a.primary)}${row('协同参与',a.secondary)}${row('稳定参与',a.stabilizers)}</div></section>`;
  }

  function conflict(session){
    if(M.ConflictView?.render)return M.ConflictView.render(session.conflictContext);
    const result=session.conflictContext||{status:'PASS',hardCount:0,warnCount:0,issues:[]};
    return `<section class="conflict-box ${String(result.status||'PASS').toLowerCase()}"><b>${esc(result.status||'PASS')}</b><small>${esc(result.hardCount||0)} 硬冲突 · ${esc(result.warnCount||0)} 警告</small></section>`;
  }

  function recovery(){
    if(!M.ConditioningRecovery?.render)throw new Error('Conditioning Recovery presentation is unavailable');
    return M.ConditioningRecovery.render();
  }

  function renderEditor(ctx){
    const session=ctx.session,blocks=session.blocks||[];
    const prepHtml=ctx.prep&&M.ConditioningPrep?.renderResolved
      ?M.ConditioningPrep.renderResolved(ctx.prep,ctx.sessionKey,session):'';
    const main=`<section class="section-card conditioning-editor" data-conditioning-session="${esc(ctx.sessionKey)}" data-conditioning-blueprint="${esc(session.sessionBlueprintId||'')}"><div class="section-head"><div><h2>2F CONDITIONING｜分段执行</h2><p>${esc(session.summary)}</p></div><span class="time-badge">${esc(ctx.level)} · ${esc(ctx.variantId)} 变体</span></div>
      ${anatomy(session)}
      ${conflict(session)}
      <div class="conditioning-block-timeline">${blocks.map((block,index)=>blockCard(ctx,block,index)).join('')}</div>
      <div class="session-toolbar"><div class="conditioning-no-post-cardio-inline">完整 Conditioning：NO POST CARDIO</div><div class="session-toolbar-actions"><button data-conditioning-copy="coach" type="button">复制教练版</button><button data-conditioning-copy="member" type="button">复制会员版</button><button id="reset-conditioning-session" type="button">恢复系统推荐</button></div></div>
    </section>`;
    return `${prepHtml}${protocolPanel(session)}${main}${recovery()}`;
  }

  function renderLegacyEditor(ctx){
    const session=ctx.session,items=session.main?.content?.blocks?.flatMap(block=>block.items||[])||[];
    return `<section class="section-card conditioning-legacy-editor"><div class="saved-session-notice warn"><b>旧 Protocol 兼容入口</b><span>已保留 ${esc(ctx.protocol?.name||ctx.protocolId)} 的原始链接语义；它不会静默改成 A / B / C 蓝图。</span><small>如需使用新的分段课程，请切换到系统推荐的多区块蓝图。</small></div><div class="section-head"><div><h2>Conditioning｜${esc(ctx.protocol?.name||ctx.protocolId)}</h2><p>${esc(session.summary||'旧版 Conditioning Protocol')}</p></div><span class="time-badge">兼容模式</span></div><div class="conditioning-legacy-actions"><a class="section-action-link" href="#/coach/conditioning/compose?family=${encodeURIComponent(ctx.familyId)}&level=${encodeURIComponent(ctx.level)}&variant=A">切换新版多区块蓝图 →</a></div><div class="conditioning-legacy-stations">${items.map((item,index)=>`<article class="conditioning-legacy-station"><span>任务 ${index+1}</span><h3>${esc(item.name||item.actionId)}</h3><p>${esc(item.prescription||'按当前 Protocol 执行')}</p><a href="#/library?focus=${encodeURIComponent(item.actionId||'')}">查看动作</a></article>`).join('')}</div></section>`;
  }

  function variantButton(ctx){
    if(ctx.legacyProtocolId)return '';
    const next=nextVariantId({familyId:ctx.familyId,level:ctx.level,currentVariantId:ctx.variantId});
    return `<button type="button" class="conditioning-next-variant" data-conditioning-next-variant>切换下一变体：${esc(next)}</button>`;
  }

  function sessionHash(route,familyId,level,variantId){
    const next={...route,query:{variant:variantId}};
    return window.V14Router?.canonicalHash?.(next)
      ||`#/coach/conditioning/${familyId.toLowerCase()}/${level.toLowerCase()}?variant=${encodeURIComponent(variantId)}`;
  }

  function render(route){
    const ctx=context(route),family=ctx.family;
    const editor=ctx.legacyProtocolId?renderLegacyEditor(ctx):renderEditor(ctx);
    return `<a class="back-link" href="#/coach/conditioning">← 返回 Conditioning</a>`+
      `<section class="view-hero conditioning-session-hero"><span class="eyebrow">COACH CENTER / CONDITIONING</span><h1>${esc(family.name||ctx.familyId)}</h1><p>${esc(ctx.session.domainContext?.blueprintLabel||family.goal||ctx.session.summary)}</p><div class="chips"><span class="chip">${esc(ctx.level)}</span><span class="chip">${ctx.legacyProtocolId?'兼容 Protocol':`${esc(ctx.variantId)} 变体`}</span><span class="chip">${esc(ctx.session.timing?.blockCount||ctx.session.blocks?.length||1)} 个训练段</span><span class="chip">${esc(ctx.session.timing?.taskCount||ctx.session.main?.content?.blocks?.flatMap(block=>block.items||[]).length||0)} 个任务</span><span class="chip">约 ${esc(ctx.session.timing?.estimatedMinutes||ctx.session.domainContext?.metrics?.estimatedMinutes||'—')} 分钟</span><span class="chip">${esc(ctx.session.conflictContext.status)}</span></div>${variantButton(ctx)}</section>`+
      editor+(M.SavedSessionsUI?.controls?.(route)||'');
  }

  function variantOptions(familyId,level,selected){
    const variants=D().conditioningBlueprints?.[familyId]?.[level]||{};
    return BLUEPRINT_VARIANTS.filter(variantId=>variants[variantId]).map(variantId=>{
      const blueprint=variants[variantId];
      return `<option value="${esc(variantId)}" ${variantId===selected?'selected':''}>${esc(blueprint.label||`${variantId} 训练变体`)}｜${esc(blueprint.changeSummary||'按当天状态调整')}</option>`;
    }).join('');
  }

  function renderComposer(route){
    const ctx=context(route);
    const familyOptions=(D().conditioningFamilyIds||[]).map(familyId=>{
      const family=D().conditioningFamilies?.[familyId]||{};
      return `<option value="${esc(familyId)}" ${familyId===ctx.familyId?'selected':''}>${esc(family.name||familyId)}</option>`;
    }).join('');
    const levelOptions=LEVELS.map(level=>`<option value="${level}" ${level===ctx.level?'selected':''}>${level}</option>`).join('');
    const variantControl=ctx.legacyProtocolId
      ?`<label><span>训练变体</span><div class="conditioning-legacy-control">保留旧 Protocol：${esc(ctx.protocolId)}</div></label>`
      :`<label><span>训练变体</span><select data-conditioning-compose-variant>${variantOptions(ctx.familyId,ctx.level,ctx.variantId)}</select></label>`;
    const editor=ctx.legacyProtocolId?renderLegacyEditor(ctx):renderEditor(ctx);
    return `<a class="back-link" href="#/coach/conditioning">← 返回 Conditioning</a>`+
      `<section class="view-hero conditioning-composer-hero"><span class="eyebrow">COACH CENTER / CONDITIONING COMPOSER</span><h1>Conditioning 课程构建</h1><p>选择体能目标、等级与 A / B / C 训练变体；每个变体都由同一 Resolver、State、PREP、Conflict 与 Copy 生成完整课程。</p><div class="conditioning-compose-controls">
        <label><span>训练 Family</span><select data-conditioning-compose-family>${familyOptions}</select></label>
        <label><span>训练等级</span><select data-conditioning-compose-level>${levelOptions}</select></label>
        ${variantControl}
      </div>${variantButton(ctx)}</section>`+
      editor+(M.SavedSessionsUI?.controls?.(route)||'');
  }

  function canHandle(route={}){
    return route.templateId==='conditioning'&&(route.page==='template'||route.page==='template-session'||route.page==='template-compose');
  }

  function composerHash(route,familyId,level,variantId){
    const next={
      ...route,
      area:'coach',
      page:'template-compose',
      templateId:'conditioning',
      query:{family:familyId,level,variant:variantId},
    };
    return window.V14Router?.canonicalHash?.(next)
      ||`#/coach/conditioning/compose?family=${encodeURIComponent(familyId)}&level=${encodeURIComponent(level)}&variant=${encodeURIComponent(variantId)}`;
  }

  async function copyCurrent(route,kind,button){
    const Shared=window.V14SessionCopy;
    if(!M.ConditioningCopy||!Shared?.copyText)return false;
    const fresh=context(route);
    const payload=M.ConditioningCopy.buildPayload(fresh.session,fresh.prep);
    const text=kind==='member'?M.ConditioningCopy.formatMember(payload):M.ConditioningCopy.formatCoach(payload);
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
    const normalized=normalizeFamilyLevelProtocol(route);
    const {familyId,level,variantId,legacyProtocolId}=normalized;

    if(!legacyProtocolId&&route.page==='template-session'){
      const rawVariant=String(route.query?.variant||'').toUpperCase();
      const variantValid=BLUEPRINT_VARIANTS.includes(rawVariant)
        &&!!D().conditioningBlueprints?.[familyId]?.[level]?.[rawVariant];
      if(rawVariant&&!variantValid){
        const hash=sessionHash(route,familyId,level,variantId);
        if(window.location?.hash!==hash){
          if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
          return;
        }
      }
    }

    if(!legacyProtocolId&&route.page==='template-compose'){
      const rawFamily=String(route.query?.family||'').toUpperCase();
      const rawLevel=String(route.query?.level||'').toUpperCase();
      const rawVariant=String(route.query?.variant||'').toUpperCase();
      const familyValid=(D().conditioningFamilyIds||[]).includes(rawFamily);
      const levelValid=/^L[1-4]$/.test(rawLevel);
      const variantValid=BLUEPRINT_VARIANTS.includes(rawVariant)
        &&!!D().conditioningBlueprints?.[familyId]?.[level]?.[rawVariant];
      const needsCanonical=!familyValid||!levelValid||!variantValid
        ||route.query?.family!==familyId||route.query?.level!==level||route.query?.variant!==variantId;
      if(needsCanonical){
        const hash=composerHash(route,familyId,level,variantId);
        if(window.location?.hash!==hash){
          if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
          return;
        }
      }

      root.querySelector('[data-conditioning-compose-family]')?.addEventListener('change',event=>{
        const nextFamily=String(event.currentTarget.value||'CON-01').toUpperCase();
        const nextVariant=defaultVariant(nextFamily,level);
        const hash=composerHash(route,nextFamily,level,nextVariant);
        if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
      });
      root.querySelector('[data-conditioning-compose-level]')?.addEventListener('change',event=>{
        const nextLevel=String(event.currentTarget.value||'L1').toUpperCase();
        const nextVariant=normalizeVariantId(familyId,nextLevel,variantId);
        const hash=composerHash(route,familyId,nextLevel,nextVariant);
        if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
      });
      root.querySelector('[data-conditioning-compose-variant]')?.addEventListener('change',event=>{
        const nextVariant=normalizeVariantId(familyId,level,event.currentTarget.value);
        const hash=composerHash(route,familyId,level,nextVariant);
        if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
      });
    }

    root.querySelector('[data-conditioning-next-variant]')?.addEventListener('click',()=>{
      const next=nextVariantId({familyId,level,currentVariantId:variantId});
      const hash=route.page==='template-compose'
        ?composerHash(route,familyId,level,next)
        :sessionHash(route,familyId,level,next);
      if(window.V14Router?.navigate)window.V14Router.navigate(hash);else window.location.hash=hash;
    });

    root.querySelectorAll('.conditioning-station-select').forEach(select=>select.addEventListener('change',()=>{
      const stationKey=select.dataset.conditioningStation,candidates=Array.from(select.options).filter(option=>option.value).map(option=>({actionId:option.value,name:option.textContent||option.value}));
      const blockProtocol=select.dataset.conditioningProtocol||'';
      const contextKey=window.V15RecentActions?.context?.conditioning?.({familyId,level,protocolId:`${variantId}:${blockProtocol}`,stationKey});
      window.V15RecentActions?.record?.({templateId:'conditioning',contextKey,actionId:select.value,candidates});
      setFormalSelection(familyId,level,variantId,stationKey,select.value);
      rerender();
    }));
    root.querySelectorAll('.conditioning-station-card [data-recent-action]').forEach(button=>button.addEventListener('click',()=>{
      const card=button.closest('.conditioning-station-card'),stationKey=card?.dataset.conditioningStationCard,select=card?.querySelector('.conditioning-station-select');
      const actionId=button.dataset.recentAction,candidates=Array.from(select?.options||[]).filter(option=>option.value).map(option=>({actionId:option.value,name:option.textContent||option.value}));
      if(!select||!stationKey||!candidates.some(candidate=>candidate.actionId===actionId))return;
      const blockProtocol=select.dataset.conditioningProtocol||'';
      const contextKey=window.V15RecentActions?.context?.conditioning?.({familyId,level,protocolId:`${variantId}:${blockProtocol}`,stationKey});
      window.V15RecentActions?.record?.({templateId:'conditioning',contextKey,actionId,candidates});
      setFormalSelection(familyId,level,variantId,stationKey,actionId);
      rerender();
    }));
    root.querySelectorAll('.conditioning-prep-select').forEach(select=>select.addEventListener('change',()=>{
      M.ConditioningPrep.setSelection(select.dataset.conditioningPrepSession,select.dataset.conditioningPrepSlot,select.value);
      rerender();
    }));
    root.querySelectorAll('[data-conditioning-copy]').forEach(button=>button.addEventListener('click',()=>{
      copyCurrent(route,button.dataset.conditioningCopy,button).catch(error=>console.error('Conditioning copy failed',error));
    }));
    root.querySelector('#reset-conditioning-session')?.addEventListener('click',()=>{
      reset(familyId,level,variantId);
      rerender();
    });
  }

  const adapter={
    canHandle,
    render(route){
      if(route.page==='template')return M.ConditioningHome.render(route);
      if(route.page==='template-compose')return renderComposer(route);
      return render(route);
    },
    bind,
  };
  M.ConditioningSession={
    context,render,renderEditor,renderComposer,ensureState,resolveState,setFormalSelection,reset,copyCurrent,
    sessionKeyFor,normalizeFamilyLevelProtocol,nextVariantId,stressSummary,adapter,
  };
  M.TemplateUI.register('conditioning',adapter);
})();
