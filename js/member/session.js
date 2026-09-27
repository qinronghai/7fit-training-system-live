(function(){
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalCategories=new Set(['主训练','T1','T2','T3','T4']);
  const excludedCategories=new Set(['热身','激活','活动','放松','体能']);
  let dialog=null,returnFocus=null,returnFocusSessionId='',requestVersion=0,currentSessionId='',currentSession=null,currentItems=[],mutationInFlight=false,onSessionChanged=null;

  function dateLabel(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.replaceAll('-','.'):esc(value||'日期未记录');}
  function statusLabel(status){return ({PLANNED:'待训练',COMPLETED:'已完成',CANCELLED:'已取消'})[status]||'状态未知';}
  function actualSummary(item){
    return [
      item.sets!==null&&item.sets!==undefined?`${item.sets} 组`:null,
      item.reps!==null&&item.reps!==undefined&&item.reps!==''?`${item.reps} 次`:null,
      item.loadKg!==null&&item.loadKg!==undefined?`${item.loadKg} kg`:null,
      item.rir!==null&&item.rir!==undefined?`RIR ${item.rir}`:null,
      item.rpe!==null&&item.rpe!==undefined?`RPE ${item.rpe}`:null,
    ].filter(Boolean).join(' × ');
  }
  function catalog(){return window.V14_DATA?.actions||{};}
  function anatomy(){return window.V14_ANATOMY?.records||{};}
  function plannedName(item){return item.plannedActionSnapshot?.name||item.plannedActionId||'未记录动作';}
  function performedName(item){return item.performedActionSnapshot?.name||item.performedActionId||plannedName(item);}

  function replacementCandidates(item){
    const planned=catalog()[item.plannedActionId]||{};
    const snapshot=item.plannedActionSnapshot||{};
    const support=planned.isSupport===true||snapshot.pattern==='支撑模式'||String(item.plannedActionId||'').startsWith('SUP-');
    const core=planned.isCore===true||snapshot.pattern==='核心模式'||String(item.plannedActionId||'').startsWith('CORE-');
    return Object.values(catalog()).filter(action=>{
      if(!action?.id||action.id===item.plannedActionId||!action.name||!action.pattern)return false;
      if(support)return action.isSupport===true&&action.status==='SUPPORT_CANON';
      if(core)return action.isCore===true&&action.status==='CORE_CANON';
      return action.status==='可自动编排'
        &&!action.isSupport&&!action.isCore
        &&action.pattern===snapshot.pattern
        &&!excludedCategories.has(action.category)
        &&(!action.category||normalCategories.has(action.category));
    }).sort((left,right)=>left.name.localeCompare(right.name,'zh-CN'));
  }

  function actionSnapshot(action){
    const record=anatomy()[action.id]||{};
    const strings=value=>[...new Set((Array.isArray(value)?value:[]).filter(item=>typeof item==='string'&&item.trim()))];
    return {
      schemaVersion:1,
      actionId:action.id,
      name:action.name,
      pattern:action.pattern,
      level:action.tier||action.grade||null,
      primaryMuscles:strings(record.primary),
      secondaryMuscles:strings(record.secondary),
      equipment:action.equipment||null,
      stationId:action.stationId||null,
    };
  }

  function actualField(item,key,label,{type='text',step,max,min,inputmode}={}){
    const id=`session-${item.id}-${key}`;
    return `<label for="${esc(id)}">${label}<input id="${esc(id)}" type="${type}" data-session-actual="${key}"${type==='number'?' min="'+min+'" max="'+max+'" step="'+step+'"':''}${inputmode?` inputmode="${inputmode}"`:''}${type==='text'?' maxlength="80"':''}></label>`;
  }

  function executionItemMarkup(item,index){
    const candidates=replacementCandidates(item);
    const options=candidates.map(action=>`<option value="${esc(action.id)}">${esc(action.name)}${action.equipment?` · ${esc(action.equipment)}`:''}</option>`).join('');
    const replacement=candidates.length
      ?`<label class="member-session-replacement">临场替换（可选）<select data-session-replacement aria-label="${esc(plannedName(item))} 临场替换（可选）"><option value="">按计划：${esc(plannedName(item))}</option>${options}</select></label>`
      :'<p class="member-session-no-replacements">没有找到同训练模式的可选动作，仍可按计划完成。</p>';
    const plannedPrescription=item.plannedPrescriptionSnapshot?.rawText;
    const plannedPrescriptionMarkup=plannedPrescription?`<p class="member-session-planned-prescription" data-session-planned-prescription>计划处方：${esc(plannedPrescription)}</p>`:'';
    return `<li class="member-session-execution-item" data-session-item="${esc(item.id)}"><div class="member-session-execution-heading"><div><span>${esc(item.phase||'UNKNOWN')} · ${esc(item.slotKey||`动作 ${index+1}`)}</span><strong>计划：${esc(plannedName(item))}</strong></div></div>${plannedPrescriptionMarkup}${replacement}<details class="member-session-actual"><summary>添加实际数据（可选）</summary><div class="member-session-actual-grid">${actualField(item,'sets','组数',{type:'number',min:0,max:100,step:1,inputmode:'numeric'})}${actualField(item,'reps','次数')}${actualField(item,'loadKg','负重 kg',{type:'number',min:0,max:2000,step:0.1,inputmode:'decimal'})}${actualField(item,'rir','RIR',{type:'number',min:0,max:10,step:0.5,inputmode:'decimal'})}${actualField(item,'rpe','RPE',{type:'number',min:0,max:10,step:0.5,inputmode:'decimal'})}<label class="member-session-actual-note">备注（可选）<textarea data-session-actual="note" rows="2" maxlength="2000"></textarea></label></div></details></li>`;
  }

  function readOnlyItemMarkup(item,session){
    const completed=session.status==='COMPLETED';
    const plan=plannedName(item),actual=performedName(item);
    const changed=completed&&item.performedActionId&&item.plannedActionId&&item.performedActionId!==item.plannedActionId;
    const prescription=completed?(item.performedPrescription||item.plannedPrescriptionSnapshot):(item.plannedPrescriptionSnapshot||item.performedPrescription);
    const amount=actualSummary(item)||prescription?.rawText||'训练处方未记录';
    const actionText=completed
      ?changed?`计划：${plan} · 实际：${actual}`:`按计划完成：${actual}`
      :session.status==='CANCELLED'?`原计划：${plan}`:`计划：${plan}`;
    return `<li class="member-session-item"><div><strong>${esc(actionText)}</strong><span>${esc(item.phase||'UNKNOWN')} · ${esc(item.slotKey||'训练动作')}</span></div><p>${esc(amount)}</p>${item.note?`<small>${esc(item.note)}</small>`:''}</li>`;
  }

  function executionActions(){
    if(currentSession?.status!=='PLANNED')return '';
    return `<div class="member-session-actions"><button type="button" data-session-cancel-request data-session-mutation>取消计划课程</button><button type="submit" class="primary" data-session-complete data-session-mutation>完成本节课</button></div><div class="member-session-cancel-confirmation" data-session-cancel-confirmation hidden role="group" aria-label="确认取消计划课程"><p>取消后，这节课会保留在训练记录中，但不会计入最近训练情况。</p><div><button type="button" data-session-cancel-dismiss>返回记录</button><button type="button" class="danger" data-session-cancel-confirm data-session-mutation>确认取消课程</button></div></div>`;
  }

  function renderSession(data){
    currentSession=data?.session||{};
    currentItems=Array.isArray(data?.items)?data.items.slice().sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)):[];
    const summary=`${dateLabel(currentSession.sessionDate)} · ${statusLabel(currentSession.status)}`;
    dialog.querySelector('[data-session-detail-subtitle]').textContent=summary;
    const itemRows=currentSession.status==='PLANNED'
      ?`<form data-session-execution novalidate><ol class="member-session-execution-list">${currentItems.map(executionItemMarkup).join('')}</ol>${executionActions()}</form>`
      :currentItems.length?`<ol class="member-session-items">${currentItems.map(item=>readOnlyItemMarkup(item,currentSession)).join('')}</ol>`:'<p class="member-state-note">这节课没有动作记录。</p>';
    dialog.querySelector('[data-session-detail-content]').innerHTML=`<div class="member-session-summary"><h3>${esc(currentSession.sessionTitle||currentSession.templateKey||'训练课程')}</h3><p>${esc(currentSession.templateKey||'课程')} · ${esc(currentSession.levelSnapshot||'等级未记录')}</p>${currentSession.coachNote?`<p>${esc(currentSession.coachNote)}</p>`:''}</div>${currentItems.length?itemRows:itemRows}<div class="member-session-mutation-error" data-session-mutation-error role="alert" hidden></div>`;
  }

  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='member-session-dialog';
    dialog.dataset.memberSessionDetail='';
    dialog.setAttribute('aria-labelledby','member-session-detail-title');
    dialog.innerHTML='<section class="member-session-panel"><header class="member-session-head"><div><h2 id="member-session-detail-title">课程记录</h2><p data-session-detail-subtitle></p></div><button type="button" data-session-detail-close data-session-mutation>关闭</button></header><div class="member-session-content" data-session-detail-content></div></section>';
    document.body.appendChild(dialog);
    dialog.querySelector('[data-session-detail-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{
      if(event.target===dialog){if(!mutationInFlight)dialog.close();return;}
      const target=event.target.closest('button');
      if(!target)return;
      if(target.matches('[data-session-detail-retry]'))void loadSession(currentSessionId,requestVersion);
      if(target.matches('[data-session-cancel-request]')){
        const confirmation=dialog.querySelector('[data-session-cancel-confirmation]');
        if(confirmation){confirmation.hidden=false;confirmation.querySelector('[data-session-cancel-confirm]')?.focus();}
      }
      if(target.matches('[data-session-cancel-dismiss]')){
        const confirmation=dialog.querySelector('[data-session-cancel-confirmation]');
        if(confirmation)confirmation.hidden=true;
        dialog.querySelector('[data-session-cancel-request]')?.focus();
      }
      if(target.matches('[data-session-cancel-confirm]'))void cancelCurrentSession();
    });
    dialog.addEventListener('submit',event=>{
      const form=event.target.closest('[data-session-execution]');
      if(!form)return;
      event.preventDefault();void completeCurrentSession(form);
    });
    dialog.addEventListener('cancel',event=>{if(mutationInFlight)event.preventDefault();});
    dialog.addEventListener('close',()=>{
      requestVersion++;
      const stableTrigger=Array.from(document.querySelectorAll('[data-open-session-detail]'))
        .find(trigger=>trigger.dataset.sessionId===returnFocusSessionId);
      const focusTarget=returnFocus?.isConnected?returnFocus:stableTrigger;
      if(focusTarget)focusTarget.focus();
      else{
        const fallback=document.querySelector('[data-member-timeline]')||document.querySelector('[data-member-center-page="detail"]');
        if(fallback){fallback.setAttribute('tabindex','-1');fallback.focus();}
      }
      returnFocus=null;returnFocusSessionId='';
      onSessionChanged=null;
    });
    return dialog;
  }

  function mutationError(error){
    if(error?.status===401)return '教练登录已失效，请重新验证后再操作。';
    if(error?.code==='stale_update')return '这节课已被其他人更新。请关闭后重新打开记录，再继续操作。';
    if(error?.code==='invalid_status_transition')return '这节课的状态已改变，请重新打开记录查看。';
    if(error?.code==='network_error')return '暂时没有收到保存结果。可以重试，服务会识别重复提交。';
    return '暂时无法确认这次操作的结果。请重试，或重新打开这节课查看状态。';
  }

  function showMutationError(error){
    const target=dialog?.querySelector('[data-session-mutation-error]');
    if(target){target.textContent=mutationError(error);target.hidden=false;}
  }

  function setMutationState(busy){
    dialog?.querySelectorAll('[data-session-mutation], [data-session-execution] input, [data-session-execution] select, [data-session-execution] textarea').forEach(control=>{control.disabled=busy;});
    const submit=dialog?.querySelector('[data-session-complete]');
    if(submit)submit.textContent=busy?'正在保存…':'完成本节课';
  }

  function executionPatches(form){
    const actions=catalog(),patches=[];
    for(const row of form.querySelectorAll('[data-session-item]')){
      const original=currentItems.find(item=>item.id===row.dataset.sessionItem);
      if(!original)continue;
      const patch={id:original.id};
      const select=row.querySelector('[data-session-replacement]');
      if(select?.value){
        const action=replacementCandidates(original).find(candidate=>candidate.id===select.value);
        if(!action)throw new TypeError('请选择列表中的替换动作。');
        patch.performedActionId=action.id;
        patch.performedActionSnapshot=actionSnapshot(action);
      }
      for(const key of ['sets','reps','loadKg','rir','rpe','note']){
        const input=row.querySelector(`[data-session-actual="${key}"]`),value=input?.value.trim()||'';
        if(!value)continue;
        patch[key]=key==='reps'||key==='note'?value:Number(value);
      }
      if(Object.keys(patch).length>1){patch.completed=true;patches.push(patch);}
    }
    return patches;
  }

  async function loadSession(sessionId,version){
    if(!sessionId||!dialog)return;
    try{
      const data=await window.V14MemberAPI.getSession(sessionId);
      if(version!==requestVersion||!dialog.open)return;
      renderSession(data);
    }catch(_){
      if(version!==requestVersion||!dialog.open)return;
      dialog.querySelector('[data-session-detail-content]').innerHTML='<div class="member-state-error"><p>课程记录暂时无法读取。</p><button type="button" data-session-detail-retry>重试</button></div>';
    }
  }

  async function completeCurrentSession(form){
    if(mutationInFlight||currentSession?.status!=='PLANNED')return;
    if(!form.checkValidity()){form.reportValidity();return;}
    let patches;
    try{patches=executionPatches(form);}catch(error){showMutationError(error);return;}
    mutationInFlight=true;setMutationState(true);
    const version=requestVersion,sessionId=currentSession.id;
    try{
      const result=await window.V14MemberAPI.completeSession(sessionId,currentSession.revision,patches);
      if(version!==requestVersion||!dialog.open)return;
      currentSession={...currentSession,...result,status:'COMPLETED'};
      await loadSession(sessionId,version);
      await onSessionChanged?.(currentSession);
    }catch(error){if(version===requestVersion&&dialog.open)showMutationError(error);}
    finally{mutationInFlight=false;if(version===requestVersion&&dialog.open)setMutationState(false);}
  }

  async function cancelCurrentSession(){
    if(mutationInFlight||currentSession?.status!=='PLANNED')return;
    mutationInFlight=true;setMutationState(true);
    const version=requestVersion,sessionId=currentSession.id;
    try{
      const result=await window.V14MemberAPI.cancelSession(sessionId,currentSession.revision);
      if(version!==requestVersion||!dialog.open)return;
      currentSession={...currentSession,...result,status:'CANCELLED'};
      await loadSession(sessionId,version);
      await onSessionChanged?.(currentSession);
    }catch(error){if(version===requestVersion&&dialog.open)showMutationError(error);}
    finally{mutationInFlight=false;if(version===requestVersion&&dialog.open)setMutationState(false);}
  }

  function open(sessionId,trigger,sessionChanged){
    const root=ensureDialog(),version=++requestVersion;
    currentSessionId=sessionId;currentSession=null;currentItems=[];returnFocus=trigger||document.activeElement;returnFocusSessionId=sessionId;onSessionChanged=sessionChanged||null;
    root.querySelector('[data-session-detail-subtitle]').textContent='正在读取课程记录…';
    root.querySelector('[data-session-detail-content]').innerHTML='<p class="member-state-loading">正在读取课程记录…</p>';
    if(!root.open)root.showModal();
    void loadSession(sessionId,version);
  }

  window.V14MemberSessionUI={open};
  window.V14CoachModules=window.V14CoachModules||{};
  window.V14CoachModules.MemberSessionUI=window.V14MemberSessionUI;
})();
