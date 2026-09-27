(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const C=M.Common||{};
  const UI=M.F111ComposeUI||{};
  const esc=C.esc||((value)=>String(value??''));
  const D=C.D||(()=>window.V14_DATA||{});
  const copyToolbar=()=>'<div class="session-copy-actions"><button id="copy-coach-session" type="button">复制给教练</button><button id="copy-member-session" type="button">复制给会员</button><span id="copy-session-status" role="status" aria-live="polite"></span></div>';
  let memberContextMemberId=null,memberContextState=null,memberContextRequest=0;

  function resetMemberContextBinding(){
    memberContextRequest++;
    memberContextMemberId=null;
    memberContextState=null;
  }

  function composeHref(current,overrides={}){
    const q={level:current.level,lower:current.lowerMode,upper:current.upperMode,core:current.coreDemand,...overrides};
    if(current.memberId)q.memberId=current.memberId;
    if(current.includeExpandedMain)q.em='1';
    if(current.includeExpandedSupport)q.es='1';
    if(current.includeExpandedCore)q.ec='1';
    for(const key of ['em','es','ec'])if(overrides[key]===null)delete q[key];
    return '#/coach/f111?'+new URLSearchParams(q).toString();
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
    return {level,lowerMode,upperMode,coreDemand,stateKey,resolved,resolvedSession,memberId:q.memberId||null,...flags};
  }

  function sessionAgoLabel(sessionsAgo){
    if(sessionsAgo===0)return '上次';
    if(Number.isInteger(sessionsAgo)&&sessionsAgo>0)return `${sessionsAgo} 节前`;
    return '';
  }

  function patternLabel(pattern){
    return ({SQUAT:'Squat',HIP_HINGE:'Hip Hinge',HORIZONTAL_PUSH:'Horizontal Push',VERTICAL_PUSH:'Vertical Push',HORIZONTAL_PULL:'Horizontal Pull',VERTICAL_PULL:'Vertical Pull',LUNGE:'Lunge',CARRY:'Carry',ROTATION:'Rotation',ANTI_ROTATION:'Anti-rotation',ANTI_EXTENSION:'Anti-extension',CONDITIONING:'Conditioning'})[pattern]||pattern||'训练模式';
  }

  function memberContextContentMarkup(route,state){
    const memberId=route.query?.memberId;
    if(!memberId)return '';
    const context=state?.context;
    let content='<p class="member-first-context-state" role="status">正在读取会员训练上下文…</p>';
    if(state?.status==='error')content=`<div class="member-first-context-state error" role="alert"><p>${state.errorStatus===401?'教练登录已失效。请完成馆主管理 PIN 验证，再返回此页重试。':'会员训练上下文暂时无法读取，请检查网络。'}${state.errorStatus===401?' <a data-member-auth-link href="assets/real-results/index.html?admin=1" target="_blank" rel="noopener">打开教练验证</a>':''}</p><button type="button" data-member-context-retry>重试</button></div>`;
    if(state?.status==='ready'){
      const last=context?.lastCompletedSession;
      if(!last){
        content=`<p class="member-first-context-state">暂无已完成训练。待训练和已取消的课程不会计入训练上下文。</p><a class="member-first-context-empty-return" href="#/coach/members/${encodeURIComponent(memberId)}">返回会员</a>`;
      }else{
        const patterns=Array.isArray(context.recentPatterns)?context.recentPatterns:[];
        const actions=Array.isArray(context.recentActions)?context.recentActions:[];
        const lastPatterns=patterns.filter(item=>item.sessionsAgo===0).slice(0,4);
        const lastActions=actions.filter(item=>item.sessionsAgo===0).slice(0,4);
        const allPatterns=patterns.slice(0,6);
        content=`<div class="member-first-context-last"><div><span>最近完成 · ${esc(String(last.sessionDate||'日期未记录').replaceAll('-','.'))}</span><strong>${esc(last.sessionTitle||last.templateKey||'训练课程')}</strong></div><a href="#/coach/members/${encodeURIComponent(memberId)}">返回会员</a></div><div class="member-first-context-columns"><section><h3>上次训练动作</h3>${lastActions.length?`<ul>${lastActions.map(item=>`<li>${esc(item.actionNameSnapshot||item.actionId)}</li>`).join('')}</ul>`:'<p>暂无主要动作记录</p>'}</section><section><h3>近 3 节训练模式</h3>${allPatterns.length?`<ul>${allPatterns.map(item=>`<li><span>${esc(patternLabel(item.pattern))}</span><b>${esc(sessionAgoLabel(item.sessionsAgo))}</b></li>`).join('')}</ul>`:'<p>暂无主要训练模式记录</p>'}</section>${lastPatterns.length?`<p class="member-first-context-latest-patterns">上次训练：${lastPatterns.map(item=>esc(patternLabel(item.pattern))).join(' · ')}</p>`:''}</div>`;
      }
    }
    return content;
  }

  function memberContextMarkup(route){
    const memberId=route.query?.memberId;
    if(!memberId)return '';
    const ctx=composerContext(route),state=memberContextMemberId===memberId?memberContextState:null;
    const member=state?.member,context=state?.context;
    const name=member?.displayName||context?.displayName||'会员';
    const title=`正在为${name} · ${ctx.level} 编排训练`;
    return `<section class="member-first-context" data-member-first-context aria-labelledby="member-first-context-title"><div class="member-first-context-heading"><div><span>会员训练上下文 · 仅作编排提示</span><h2 id="member-first-context-title">${esc(title)}</h2><p>训练记录帮助回看近期安排，动作选择仍由教练决定。</p></div></div><div class="member-first-context-live" data-member-context-live aria-live="polite" aria-atomic="true">${memberContextContentMarkup(route,state)}</div></section>`;
  }

  function updateMemberContextPanel(route,root){
    const panel=root.querySelector('[data-member-first-context]');
    if(!panel)return;
    const memberId=route.query?.memberId;
    const state=memberContextMemberId===memberId?memberContextState:null;
    const ctx=composerContext(route),name=state?.member?.displayName||state?.context?.displayName||'会员';
    const heading=panel.querySelector('#member-first-context-title');
    const liveRegion=panel.querySelector('[data-member-context-live]');
    if(heading)heading.textContent=`正在为${name} · ${ctx.level} 编排训练`;
    if(liveRegion)liveRegion.innerHTML=memberContextContentMarkup(route,state);
  }

  function bindMemberContext(route,root){
    if(!isF111ComposerRoute(route)||!route.query?.memberId){resetMemberContextBinding();return;}
    if(root.dataset.memberContextRetryBound!=='1'){
      root.dataset.memberContextRetryBound='1';
      root.addEventListener('click',event=>{
        if(!event.target.closest('[data-member-context-retry]'))return;
        const current=window.V14Router.parseHash(location.hash);
        resetMemberContextBinding();
        const panel=root.querySelector('[data-member-first-context]');
        const liveRegion=panel?.querySelector('[data-member-context-live]');
        if(liveRegion)liveRegion.innerHTML=memberContextContentMarkup(current,null);
        bindMemberContext(current,root);
      });
    }
    const memberId=route.query.memberId;
    if(memberContextMemberId!==memberId){
      memberContextRequest++;
      const requestId=memberContextRequest;
      memberContextMemberId=memberId;
      memberContextState={status:'loading'};
      Promise.all([window.V14MemberAPI.getMember(memberId),window.V14MemberAPI.getMemberTrainingContext(memberId)]).then(([member,context])=>{
        if(requestId!==memberContextRequest||memberContextMemberId!==memberId)return;
        memberContextState={status:'ready',member,context};
        updateMemberContextPanel(window.V14Router.parseHash(location.hash),root);
      }).catch(error=>{
        if(requestId!==memberContextRequest||memberContextMemberId!==memberId)return;
        memberContextState={status:'error',errorStatus:error?.status||0};
        updateMemberContextPanel(window.V14Router.parseHash(location.hash),root);
      });
    }
  }

  function isF111ComposerRoute(route){return route?.page==='compose'||(route?.page==='template'&&route.templateId==='f111');}

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
    return {brand:'7Fit',sessionTitle:`自由组合｜${ctx.resolved.lower.name} + ${ctx.resolved.upper.name}`,recipeName:`${ctx.resolved.lower.name} + ${ctx.resolved.upper.name}`,level:ctx.level,summary:'F111 自由组合｜一下肢 + 一上肢 + 一支撑',foam:M.Foam.composerFoamItems(ctx).map(x=>({name:x.name,prescription:x.prescription})),warmups:M.Prep.resolvedItems(prepResolved).map(x=>({name:x.name,prescription:x.prescription,sequencePhase:x.sequencePhase})),slots:resolvedSession.main.content.map(x=>({slot:x.label,name:x.name,tier:x.tier,grade:x.grade,prescription:window.V14ModuleCopy?.prescriptionForF111Slot?.(x.key)||x.prescription||window.V14ModuleCopy?.prescriptionForAction?.(x.actionId,{level:ctx.level})||''})),muscles:{primary:summary.primary.slice(0,6),secondary:summary.secondary.slice(0,6),stabilizers:summary.stabilizers.slice(0,6)},recovery:window.V14RecoveryMatcher.copyItems(recoveryResult),postCardio:view.postCardio||'',postCardioPlan:M.PostCardio?.plan?M.PostCardio.plan(ctx.stateKey):null,conflicts:(result.issues||[]).map(x=>`${x.title}：${x.text}`)};
  }

  function strengthSection(ctx){
    const slotsByKey=new Map(ctx.resolved.slots.map(slot=>[slot.slotKey,slot]));
    const slots=['A','B','D2','D1','C','CORE'].map(key=>slotsByKey.get(key)).filter(Boolean);
    const cardHtml=key=>slots.filter(slot=>slot.slotKey===key).map(slot=>M.Slot.composerCard(ctx,slot,'')).join('');
    return `<section class="section-card f111-strength-section"><div class="section-head"><div><h2>1F｜力量训练</h2><p>各级剂量相同；组数、次数见卡片。</p></div><span class="time-badge">约 40–43 分钟</span></div><div class="f111-strength-grid">${['A','B','D2','D1'].map(cardHtml).join('')}</div><div class="f111-strength-grid f111-support-grid">${['C','CORE'].map(cardHtml).join('')}</div></section>`;
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
    return `<section class="section-card f111-course-output-section"><div class="section-head"><div><h2>课程输出</h2><p>复制完整课程：热身、力量训练、训练后拉伸与课后有氧设置。</p></div></div><div class="session-toolbar-actions f111-course-output-actions">${copyToolbar()}${M.MemberSelector?.buttonMarkup?.()||''}</div></section>`;
  }

  function recoverySection(recovery){
    return `<section class="section-card f111-recovery-section" data-f111-recovery><div class="section-head f111-recovery-head"><div><div class="f111-recovery-title-row"><h2>训练后拉伸｜约 5–8 分钟</h2><span class="time-badge">训练后</span></div><p>训练结束后完成 3 个主要部位拉伸。</p></div></div>${recovery}</section>`;
  }

  function render(route){
    const ctx=composerContext(route),view=composerRecovery(ctx),recoveryResult=window.V14RecoveryMatcher.match(ctx.resolvedSession),recovery=window.V14RecoveryMatcher.renderCompact?window.V14RecoveryMatcher.renderCompact(recoveryResult):window.V14RecoveryMatcher.render(recoveryResult);
    return memberContextMarkup(route)+courseHero(ctx)+`<div class="f111-compose-step-wrap">${UI.stepper('select')}</div>`+stageSection(ctx)+`<div class="f111-prep-grid">${M.Prep.composerPrepHtml(ctx)}</div>`+strengthSection(ctx)+anatomySection(ctx)+(M.ConflictView?.render?.(ctx.resolvedSession.conflictContext)||'')+saveAndCopySection(route)+recoverySection(recovery)+(M.PostCardio?M.PostCardio.render(ctx.stateKey):'')+courseOutputSection();
  }

  M.ComposerView={composeHref,composerContext,buildComposerCopyPayload,render,bindMemberContext,resetMemberContextBinding};
})();
