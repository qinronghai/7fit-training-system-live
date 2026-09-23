(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const C=M.Common||{};
  const UI=M.F111ComposeUI||{};
  const esc=C.esc||((value)=>String(value??''));
  const D=C.D||(()=>window.V14_DATA||{});
  const copyToolbar=()=>'<div class="session-copy-actions"><button id="copy-coach-session" type="button">复制给教练</button><button id="copy-member-session" type="button">复制给会员</button><span id="copy-session-status" role="status" aria-live="polite"></span></div>';

  function composeHref(current,overrides={}){
    const q={level:current.level,lower:current.lowerMode,upper:current.upperMode,core:current.coreDemand,...overrides};
    if(current.includeExpandedMain)q.em='1';
    if(current.includeExpandedSupport)q.es='1';
    if(current.includeExpandedCore)q.ec='1';
    for(const key of ['em','es','ec'])if(overrides[key]===null)delete q[key];
    return '#/coach/f111/compose?'+new URLSearchParams(q).toString();
  }

  function composerContext(route){
    const cfg=D().composer||{},q=route.query||{};
    const level=/^L[1-4]$/.test(q.level||'')?q.level:'L1';
    const lowerMode=cfg.lowerModes?.[q.lower]?q.lower:'squat';
    const upperMode=cfg.upperModes?.[q.upper]?q.upper:'horizontal_pull';
    const coreDemand=cfg.coreDemands?.[q.core]?q.core:'anti_extension';
    const flags={includeExpandedMain:q.em==='1',includeExpandedSupport:q.es==='1',includeExpandedCore:q.ec==='1'};
    const input={mode:'composer',level,lowerMode,upperMode,coreDemand,...flags};
    const probeSession=window.V15TemplateResolver.resolve('f111',input);
    const stateKey=`${probeSession.familyId}-${level}`;
    const selections=window.V14State.getComposerSelections(stateKey);
    const resolvedSession=window.V15TemplateResolver.resolve('f111',{...input,selections});
    const resolved=window.V14Composer.resolve({level,lowerMode,upperMode,coreDemand,selections,...flags});
    return {level,lowerMode,upperMode,coreDemand,stateKey,resolved,resolvedSession,...flags};
  }

  function levelSwitch(ctx){
    return `<div class="f111-level-switch" aria-label="选择训练阶段">${['L1','L2','L3','L4'].map(level=>`<a class="${ctx.level===level?'active':''}" href="${composeHref(ctx,{level})}">${level}</a>`).join('')}</div>`;
  }

  function modeSection(ctx){
    return `<section class="f111-mode-section"><div class="f111-section-title"><div><h2>选择训练模式</h2></div></div><div class="f111-mode-grid">${UI.modeTrigger(ctx,'lower')}${UI.modeTrigger(ctx,'upper')}</div><div class="f111-current-combination"><small>当前组合</small><b>${esc(UI.currentLabel(ctx))}</b></div></section>`;
  }

  function courseHero(){
    return `<section class="view-hero f111-compose-hero"><span class="eyebrow">F111 课程说明</span><h1>F111｜女性综合训练</h1><p>围绕女性常见的下肢力量、体态改善与核心稳定需求，把下肢、上肢和核心训练灵活组合。每次训练既能强化臀腿、改善体态，也能提升身体稳定与整体力量，适合循序渐进地塑形和建立长期训练习惯。</p><div class="chips"><span class="chip">强化臀腿</span><span class="chip">改善体态</span><span class="chip">提升核心稳定</span></div></section>`;
  }

  function stageSection(ctx){
    return `<section class="section-card f111-builder-section"><div class="f111-section-title"><div><h2>① 选择训练阶段</h2><p>先选择课程阶段，系统会匹配相应难度的动作。</p></div></div>${levelSwitch(ctx)}${modeSection(ctx)}</section>`;
  }

  function demandSwitch(ctx){
    const cfg=D().composer||{};
    const items=Object.entries(cfg.coreDemands||{}).slice(0,3).map(([key,value])=>`<a class="${ctx.coreDemand===key?'active':''}" aria-current="${ctx.coreDemand===key?'true':'false'}" href="${composeHref(ctx,{core:key})}">${esc(value.name)}</a>`).join('');
    return `<div class="f111-demand-switch"><div><b>核心功能</b><small>选择训练方向</small></div><nav aria-label="核心功能">${items}</nav></div>`;
  }

  function composerRecovery(ctx){return D().sessionViews?.[`F111-01-${ctx.level}`]||{};}

  function buildComposerCopyPayload(ctx){
    const resolvedSession=ctx.resolvedSession||window.V15TemplateResolver.resolve('f111',{mode:'composer',level:ctx.level,lowerMode:ctx.lowerMode,upperMode:ctx.upperMode,coreDemand:ctx.coreDemand,selections:window.V14State?.getComposerSelections?.(ctx.stateKey)||{},includeExpandedMain:!!ctx.includeExpandedMain,includeExpandedSupport:!!ctx.includeExpandedSupport,includeExpandedCore:!!ctx.includeExpandedCore});
    const summary=resolvedSession.anatomyContext||{primary:[],secondary:[],stabilizers:[]};
    const result=resolvedSession.conflictContext||{issues:[]};
    const recoveryResult=window.V14RecoveryMatcher.match(resolvedSession),view=composerRecovery(ctx),prepResolved=M.Prep.resolveComposerPrep(ctx);
    return {brand:'7Fit',sessionTitle:`自由组合｜${ctx.resolved.lower.name} + ${ctx.resolved.upper.name}`,recipeName:`${ctx.resolved.lower.name} + ${ctx.resolved.upper.name}`,level:ctx.level,summary:'F111 自由组合｜一下肢 + 一上肢 + 一支撑',foam:M.Foam.composerFoamItems(ctx).map(x=>({name:x.name,prescription:x.prescription})),warmups:M.Prep.resolvedItems(prepResolved).map(x=>({name:x.name,prescription:x.prescription,sequencePhase:x.sequencePhase})),slots:resolvedSession.main.content.map(x=>({slot:x.label,name:x.name,tier:x.tier,grade:x.grade,prescription:x.prescription||window.V14ModuleCopy?.prescriptionForAction?.(x.actionId,{level:ctx.level})||''})),muscles:{primary:summary.primary.slice(0,6),secondary:summary.secondary.slice(0,6),stabilizers:summary.stabilizers.slice(0,6)},recovery:window.V14RecoveryMatcher.copyItems(recoveryResult),postCardio:view.postCardio||'',postCardioPlan:M.PostCardio?.plan?M.PostCardio.plan(ctx.stateKey):null,conflicts:(result.issues||[]).map(x=>`${x.title}：${x.text}`)};
  }

  function strengthSection(ctx){
    const slotsByKey=new Map(ctx.resolved.slots.map(slot=>[slot.slotKey,slot]));
    const slots=['A','B','D2','D1','C','CORE'].map(key=>slotsByKey.get(key)).filter(Boolean);
    const cardHtml=key=>slots.filter(slot=>slot.slotKey===key).map(slot=>M.Slot.composerCard(ctx,slot,'')).join('');
    return `<section class="section-card f111-strength-section"><div class="section-head"><div><h2>1F｜力量训练</h2><p>主项、支撑、辅助和核心动作组成完整课程。</p></div><span class="time-badge">约 40–43 分钟</span></div><div class="f111-strength-grid">${['A','B','D2','D1'].map(cardHtml).join('')}</div><div class="f111-strength-grid f111-support-grid">${['C','CORE'].map(cardHtml).join('')}</div></section>`;
  }

  function anatomySection(ctx){
    const allIds=ctx.resolvedSession.main.content.map(x=>x.actionId).filter(Boolean);
    const anatomy=M.Summary?.render?.(allIds)||'';
    return anatomy?`<details class="f111-anatomy-details" open><summary>训练肌群概览</summary>${anatomy}</details>`:'';
  }

  function saveAndCopySection(route){
    return M.SavedSessionsUI?.compactControls?.(route)||'';
  }

  function courseOutputSection(){
    return `<section class="section-card f111-course-output-section"><div class="section-head"><div><h2>课程输出</h2><p>复制完整课程：热身、力量训练、训练后拉伸与课后有氧设置。</p></div></div><div class="session-toolbar-actions f111-course-output-actions">${copyToolbar()}</div></section>`;
  }

  function render(route){
    const ctx=composerContext(route),view=composerRecovery(ctx),recoveryResult=window.V14RecoveryMatcher.match(ctx.resolvedSession),recovery=window.V14RecoveryMatcher.renderCompact?window.V14RecoveryMatcher.renderCompact(recoveryResult):window.V14RecoveryMatcher.render(recoveryResult);
    return courseHero(ctx)+`<div class="f111-compose-step-wrap">${UI.stepper('select')}</div>`+stageSection(ctx)+`<div class="f111-prep-grid">${M.Prep.composerPrepHtml(ctx)}</div>`+strengthSection(ctx)+anatomySection(ctx)+(M.ConflictView?.render?.(ctx.resolvedSession.conflictContext)||'')+saveAndCopySection(route)+`<section class="section-card f111-recovery-section" data-f111-recovery><div class="section-head"><div><h2>训练后拉伸｜约 5–8 分钟</h2><p>训练结束后完成 3 个主要部位拉伸。</p></div><span class="time-badge">训练后</span></div>${recovery}</section>${M.PostCardio?M.PostCardio.render(ctx.stateKey):''}${courseOutputSection()}`;
  }

  M.ComposerView={composeHref,composerContext,buildComposerCopyPayload,render};
})();
