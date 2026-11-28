(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const C=M.Common||{};
  const UI=M.F111ComposeUI||{};
  const esc=C.esc||((value)=>String(value??''));
  const D=C.D||(()=>window.V14_DATA||{});
  let memberContextMemberId=null,memberContextState=null,memberContextRequest=0;

  function resetMemberContextBinding(){
    memberContextRequest++;
    memberContextMemberId=null;
    memberContextState=null;
  }

  function composeHref(current,overrides={}){
    const q={level:current.level,lower:current.lowerMode,upper:current.upperMode,...overrides};
    if(!q.core&&current.explicitCoreDemand)q.core=current.explicitCoreDemand;
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
    const coreDemand=cfg.coreDemands?.[q.core]?q.core:window.V14Composer.defaultCoreDemand(level,lowerMode,upperMode);
    const flags={includeExpandedMain:q.em==='1',includeExpandedSupport:q.es==='1',includeExpandedCore:q.ec==='1'};
    const memberContext=memberContextMemberId===q.memberId&&memberContextState?.status==='ready'?memberContextState.context:null;
    const input={mode:'composer',level,lowerMode,upperMode,coreDemand,recentContext:memberContext,...flags};
    const probeSession=window.V15TemplateResolver.resolve('f111',input);
    const stateKey=`${probeSession.familyId}-${level}`;
    const selections=window.V14State.getComposerSelections(stateKey);
    const resolvedSession=window.V15TemplateResolver.resolve('f111',{...input,selections});
    const resolved=window.V14Composer.resolve({level,lowerMode,upperMode,coreDemand,selections,recentContext:memberContext,...flags});
    return {level,lowerMode,upperMode,coreDemand,explicitCoreDemand:q.core,stateKey,resolved,resolvedSession,memberId:q.memberId||null,memberContext,...flags};
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
        content=`<p class="member-first-context-state">暂无已完成训练</p><a class="member-first-context-empty-return" href="#/coach/members/${encodeURIComponent(memberId)}">返回会员</a>`;
      }else{
        const patterns=Array.isArray(context.recentPatterns)?context.recentPatterns:[];
        const actions=Array.isArray(context.recentActions)?context.recentActions:[];
        const lastPatterns=patterns.filter(item=>item.sessionsAgo===0).slice(0,4);
        const lastActions=actions.filter(item=>item.sessionsAgo===0);
        const allPatterns=patterns.slice(0,6);
        content=`<div class="member-first-context-last"><div><span>最近完成 · ${esc(String(last.sessionDate||'日期未记录').replaceAll('-','.'))}</span><strong>${esc(last.sessionTitle||last.templateKey||'训练课程')}</strong></div><a href="#/coach/members/${encodeURIComponent(memberId)}">返回会员</a></div><div class="member-first-context-columns"><section><h3>上次训练动作</h3>${lastActions.length?`<ul>${lastActions.map(item=>`<li>${esc(item.actionNameSnapshot||item.actionId)}</li>`).join('')}</ul>`:'<p>暂无主要动作记录</p>'}</section><section><h3>近 3 节训练模式</h3>${allPatterns.length?`<ul>${allPatterns.map(item=>`<li><span>${esc(patternLabel(item.pattern))}</span><b>${esc(sessionAgoLabel(item.sessionsAgo))}</b></li>`).join('')}</ul>`:'<p>暂无主要训练模式记录</p>'}</section>${lastPatterns.length?`<p class="member-first-context-latest-patterns">上次训练：${lastPatterns.map(item=>esc(patternLabel(item.pattern))).join(' · ')}</p>`:''}</div>`;
      }
    }
    return content;
  }

  function memberContextPanel(route,state){
    const name=state?.member?.displayName||state?.context?.displayName;
    const heading=`<h2 id="member-first-context-title">${name?`会员 · ${esc(name)}`:'会员'}</h2>`;
    const content=memberContextContentMarkup(route,state);
    if(state?.context?.lastCompletedSession){
      return `<details data-f111-disclosure="history"><summary>${heading}<span>上次实练 <i aria-hidden="true">⌄</i></span></summary><div class="member-first-context-live">${content}</div></details>`;
    }
    return `${heading}<div class="member-first-context-live">${content}</div>`;
  }

  function memberContextMarkup(route){
    const memberId=route.query?.memberId;
    if(!memberId)return '';
    const state=memberContextMemberId===memberId?memberContextState:null;
    return `<section class="member-first-context" data-member-first-context aria-labelledby="member-first-context-title"><div data-member-context-live aria-live="polite">${memberContextPanel(route,state)}</div></section>`;
  }

  function updateMemberContextPanel(route,root){
    const panel=root.querySelector('[data-member-context-live]');
    if(!panel)return;
    const memberId=route.query?.memberId;
    const state=memberContextMemberId===memberId?memberContextState:null;
    panel.innerHTML=memberContextPanel(route,state);
  }

  function bindMemberContext(route,root,rerender){
    if(!isF111ComposerRoute(route)||!route.query?.memberId){resetMemberContextBinding();return;}
    if(root.dataset.memberContextRetryBound!=='1'){
      root.dataset.memberContextRetryBound='1';
      root.addEventListener('click',event=>{
        if(!event.target.closest('[data-member-context-retry]'))return;
        const current=window.V14Router.parseHash(location.hash);
        resetMemberContextBinding();
        updateMemberContextPanel(current,root);
        bindMemberContext(current,root,rerender);
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
        rerender?.({preserveMemberContext:true});
      }).catch(error=>{
        if(requestId!==memberContextRequest||memberContextMemberId!==memberId)return;
        memberContextState={status:'error',errorStatus:error?.status||0};
        updateMemberContextPanel(window.V14Router.parseHash(location.hash),root);
      });
    }
  }

  function isF111ComposerRoute(route){return route?.page==='compose'||(route?.page==='template'&&route.templateId==='f111');}

  function levelSwitch(ctx){
    return `<nav class="f111-level-switch" aria-label="训练等级">${['L1','L2','L3','L4'].map(level=>`<a data-f111-focus="level-${level}"${ctx.level===level?' class="active" aria-current="true"':''} href="${esc(composeHref(ctx,{level}))}">${level}</a>`).join('')}</nav>`;
  }

  function stageSection(ctx){
    return `<div class="f111-builder-section">${levelSwitch(ctx)}<div class="f111-mode-grid">${UI.modeTrigger(ctx,'lower')}${UI.modeTrigger(ctx,'upper')}</div></div>`;
  }

  function composerRecovery(ctx){return D().sessionViews?.[`F111-01-${ctx.level}`]||{};}

  function buildComposerSessionDetails(ctx){
    const resolvedSession=ctx.resolvedSession||window.V15TemplateResolver.resolve('f111',{mode:'composer',level:ctx.level,lowerMode:ctx.lowerMode,upperMode:ctx.upperMode,coreDemand:ctx.coreDemand,selections:window.V14State?.getComposerSelections?.(ctx.stateKey)||{},includeExpandedMain:!!ctx.includeExpandedMain,includeExpandedSupport:!!ctx.includeExpandedSupport,includeExpandedCore:!!ctx.includeExpandedCore});
    const view=composerRecovery(ctx),prepResolved=M.Prep.resolveComposerPrep({...ctx,resolvedSession}),recoveryResult=window.V14RecoveryMatcher.match(resolvedSession);
    return {
      foam:M.Foam.composerFoamItems(ctx).map(item=>({foamId:item.foamId,name:item.name,muscles:item.muscles||[],prescription:item.prescription,safety:item.safety||''})),
      warmups:M.Prep.resolvedItems(prepResolved),
      prepContext:prepResolved.context,
      recovery:window.V14RecoveryMatcher.copyItems(recoveryResult),
      recoveryDetails:(recoveryResult.items||[]).map(({id,region,regionLabel,name,prescription,reason,detail})=>({id,region,regionLabel,name,prescription,reason,detail})),
      recoveryStatus:recoveryResult.status||'unavailable',
      recoveryMessage:recoveryResult.message||'',
      postCardio:view.postCardio||'',
      postCardioPlan:M.PostCardio?.plan?M.PostCardio.plan(ctx.stateKey):null,
    };
  }

  function buildComposerCopyPayload(ctx){
    const resolvedSession=ctx.resolvedSession||window.V15TemplateResolver.resolve('f111',{mode:'composer',level:ctx.level,lowerMode:ctx.lowerMode,upperMode:ctx.upperMode,coreDemand:ctx.coreDemand,selections:window.V14State?.getComposerSelections?.(ctx.stateKey)||{},includeExpandedMain:!!ctx.includeExpandedMain,includeExpandedSupport:!!ctx.includeExpandedSupport,includeExpandedCore:!!ctx.includeExpandedCore});
    const summary=resolvedSession.anatomyContext||{primary:[],secondary:[],stabilizers:[]};
    const result=resolvedSession.conflictContext||{issues:[]},details=buildComposerSessionDetails({...ctx,resolvedSession});
    return {brand:'7Fit',sessionTitle:`自由组合｜${ctx.resolved.lower.name} + ${ctx.resolved.upper.name}`,recipeName:`${ctx.resolved.lower.name} + ${ctx.resolved.upper.name}`,level:ctx.level,summary:'F111 自由组合｜一下肢 + 一上肢 + 一支撑',...details,slots:resolvedSession.main.content.map(x=>({slot:x.label,name:x.name,tier:x.tier,grade:x.grade,prescription:window.V14ModuleCopy?.prescriptionForF111Slot?.(x.key,x.actionId)||x.prescription||window.V14ModuleCopy?.prescriptionForAction?.(x.actionId,{level:ctx.level})||''})),muscles:{primary:summary.primary.slice(0,6),secondary:summary.secondary.slice(0,6),stabilizers:summary.stabilizers.slice(0,6)},conflicts:(result.issues||[]).map(x=>`${x.title}：${x.text}`)};
  }

  function strengthSection(ctx){
    const slotsByKey=new Map(ctx.resolved.slots.map(slot=>[slot.slotKey,slot]));
    const cards=keys=>keys.map(key=>slotsByKey.get(key)).filter(Boolean).map(slot=>M.Slot.composerCard(ctx,slot)).join('');
    return `<section class="f111-strength-section"><div class="f111-section-heading"><h2>1F｜力量训练</h2><span class="time-badge">约 40–43 分钟</span></div><div class="f111-strength-grid">${cards(['A','B'])}</div><div class="f111-accessory-list">${cards(['D2','D1','C','CORE'])}</div></section>`;
  }

  function anatomySection(ctx){
    const allIds=ctx.resolvedSession.main.content.map(x=>x.actionId).filter(Boolean);
    const anatomy=M.Summary?.render?.(allIds)||'';
    return anatomy?`<details class="f111-anatomy-details" data-f111-disclosure="anatomy"><summary>训练肌群概览</summary>${anatomy}</details>`:'';
  }

  function saveAndCopySection(route){
    return M.SavedSessionsUI?.compactControls?.(route)||'';
  }

  function courseOutputSection(ctx){
    return `<footer class="f111-course-output-section${ctx.memberId?' has-member':''}"><div id="copy-session-status" role="status"></div><div class="f111-course-output-actions"><button class="f111-copy-trigger" type="button" data-f111-copy aria-haspopup="dialog">复制课程</button>${M.MemberSelector?.buttonMarkup?.()||''}</div></footer>`;
  }

  function recoverySection(recovery){
    return `<details class="f111-recovery-section f111-disclosure" data-f111-recovery data-f111-disclosure="recovery" open><summary><div><b>训练后拉伸</b><small>约 5–8 分钟</small></div><i aria-hidden="true">⌄</i></summary><div class="f111-disclosure-content">${recovery}</div></details>`;
  }

  function render(route){
    const ctx=composerContext(route),recoveryResult=window.V14RecoveryMatcher.match(ctx.resolvedSession),recovery=window.V14RecoveryMatcher.renderCompact?window.V14RecoveryMatcher.renderCompact(recoveryResult):window.V14RecoveryMatcher.render(recoveryResult);
    return `<div class="f111-workspace">
      <header class="f111-compose-hero"><h1>F111｜女性综合训练</h1>${memberContextMarkup(route)}</header>
      <div class="f111-course-content">
        ${stageSection(ctx)}
        <div class="f111-prep-grid">${M.Prep.composerPrepHtml(ctx)}</div>
        ${M.Bangle?.render?.(ctx.resolved.slots)||''}
        ${strengthSection(ctx)}
        ${M.ConflictView?.render?.(ctx.resolvedSession.conflictContext)||''}
        <div class="f111-after-training">${recoverySection(recovery)}${M.PostCardio?.render?.(ctx.stateKey,{compact:true})||''}</div>
        ${M.F111Energy?.render(ctx.resolvedSession,ctx.memberId)||''}
        ${anatomySection(ctx)}
        ${saveAndCopySection(route)}
        ${courseOutputSection(ctx)}
      </div>
    </div>`;
  }

  function captureUi(root){
    const workspace=root.querySelector('.f111-workspace');
    if(!workspace)return null;
    const open=new Set([...workspace.querySelectorAll('details[open][data-f111-disclosure]')].map(node=>node.dataset.f111Disclosure));
    const focus=workspace.contains(document.activeElement)?document.activeElement.dataset.f111Focus:'';
    return ()=>{
      root.querySelectorAll('details[data-f111-disclosure]').forEach(node=>{node.open=open.has(node.dataset.f111Disclosure);});
      const target=[...root.querySelectorAll('[data-f111-focus]')].find(node=>node.dataset.f111Focus===focus);
      target?.focus({preventScroll:true});
      return !!target;
    };
  }

  function bindCopy(root){
    const status=document.getElementById('copy-session-status');
    const doCopy=async audience=>{
      const formatter=audience==='coach'?window.V14SessionCopy?.formatCoach:window.V14SessionCopy?.formatMember;
      if(typeof formatter!=='function')return;
      try{
        const payload=buildComposerCopyPayload(composerContext(window.V14Router.parseHash(location.hash)));
        await window.V14SessionCopy.copyText(formatter(payload));
        if(status){status.className='success';status.textContent='已复制，可直接发送';}
      }catch(_){
        if(status){status.className='error';status.textContent='复制失败，请重试';}
      }
    };
    const copyTrigger=root.querySelector('[data-f111-copy]');
    copyTrigger?.addEventListener('click',()=>M.F111ActionDrawer?.openCopy(copyTrigger,doCopy));
  }

  M.ComposerView={composeHref,composerContext,buildComposerCopyPayload,buildComposerSessionDetails,render,captureUi,bindMemberContext,resetMemberContextBinding,bindCopy};
})();
