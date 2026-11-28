(function(){
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalCategories=new Set(['主训练','T1','T2','T3','T4']);
  const excludedCategories=new Set(['热身','激活','活动','放松','体能']);
  let dialog=null,returnFocus=null,returnFocusSessionId='',requestVersion=0,currentSessionId='',currentSession=null,currentItems=[],mutationInFlight=false,onSessionChanged=null;

  function dateLabel(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.replaceAll('-','.'):esc(value||'日期未记录');}
  function statusLabel(status){return ({PLANNED:'待训练',COMPLETED:'已完成',CANCELLED:'已取消'})[status]||'状态未知';}
  function doseUnit(dose){
    return /秒/.test(dose||'')?'秒':/米/.test(dose||'')?'米':'';
  }
  function unitLabel(unit){return ({秒:'时间（秒）',米:'距离（米）'})[unit]||'次数';}
  function actualSummary(item){
    return [
      item.sets!==null&&item.sets!==undefined?`${item.sets} 组`:null,
      item.reps!==null&&item.reps!==undefined&&item.reps!==''?(/(?:秒|米|次)(?:\s*\/\s*侧)?$/.test(String(item.reps))?String(item.reps):`${item.reps} 次`):null,
      item.loadKg!==null&&item.loadKg!==undefined?`${item.loadKg} kg`:null,
      item.rir!==null&&item.rir!==undefined?`RIR ${item.rir}`:null,
      item.rpe!==null&&item.rpe!==undefined?`RPE ${item.rpe}`:null,
    ].filter(Boolean).join(' × ');
  }
  function catalog(){return window.V14_DATA?.actions||{};}
  function anatomy(){return window.V14_ANATOMY?.records||{};}
  function plannedName(item){return item.plannedActionSnapshot?.name||item.plannedActionId||'未记录动作';}
  function performedName(item){return item.performedActionSnapshot?.name||item.performedActionId||plannedName(item);}
  function memberDetails(){return currentSession?.resolvedSessionSnapshot?.memberDetails||{};}
  function prepSlotKey(item){return String(item?.slotKey||'').replace(/^PREP:/,'');}
  function warmupFamily(warmup){
    const detail=window.V14_DATA?.warmupDetails?.[warmup?.prepId]||{};
    return warmup?.movementFamily||detail.movementFamily||`action:${warmup?.actionId||''}`;
  }
  function itemPhaseLabel(item,index){
    if(item.phase==='PREP')return `热身 · ${window.V14PrepResolver?.SLOT_META?.[prepSlotKey(item)]?.name||`动作 ${index+1}`}`;
    return `${item.phase||'UNKNOWN'} · ${item.slotKey||`动作 ${index+1}`}`;
  }

  function prepReplacementCandidates(item){
    const resolver=window.V14PrepResolver,details=memberDetails(),slotKey=prepSlotKey(item);
    if(!resolver?.SLOT_ORDER?.includes(slotKey))return [];
    const context=details.prepContext||currentSession?.resolvedSessionSnapshot?.prepContext;
    if(!context)return [];
    const saved=Array.isArray(details.warmups)?details.warmups:[];
    const usedFamilies=new Set(currentItems.filter(other=>other.phase==='PREP'&&other.id!==item.id).map(other=>{
      const otherSlot=prepSlotKey(other),row=Array.from(dialog?.querySelectorAll('[data-session-item]')||[]).find(node=>node.dataset.sessionItem===other.id);
      const selectedId=row?.querySelector('[data-session-prep-replacement]')?.value;
      if(selectedId){
        const candidate=resolver.rankSlotCandidates(otherSlot,resolver.normalizeContext(context),{limit:100}).find(value=>value.actionId===selectedId);
        if(candidate)return warmupFamily(candidate);
      }
      const original=saved.find(value=>value.slotKey===otherSlot);
      return warmupFamily(original||{actionId:other.plannedActionId});
    }));
    return resolver.rankSlotCandidates(slotKey,resolver.normalizeContext(context),{limit:100})
      .filter(candidate=>candidate.actionId!==item.plannedActionId&&!usedFamilies.has(warmupFamily(candidate)));
  }

  function refreshPrepReplacementOptions(){
    let rejected=false;
    dialog?.querySelectorAll('[data-session-prep-replacement]').forEach(select=>{
      const item=currentItems.find(value=>value.id===select.closest('[data-session-item]')?.dataset.sessionItem);
      if(!item)return;
      const priorValue=select.value,candidates=prepReplacementCandidates(item),valid=candidates.some(candidate=>candidate.actionId===priorValue);
      if(priorValue&&!valid)rejected=true;
      const options=candidates.map(candidate=>`<option value="${esc(candidate.actionId)}">${esc(candidate.name)}</option>`).join('');
      select.innerHTML=`<option value="">按计划：${esc(plannedName(item))}</option>${options}`;
      if(priorValue&&valid)select.value=priorValue;
    });
    if(rejected){
      const message=dialog?.querySelector('[data-session-mutation-error]');
      if(message){message.textContent='该热身替换与其他热身重复或不符合槽位规则，请重新选择。';message.hidden=false;}
    }
  }

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

  function prepActionSnapshot(candidate){
    const action=catalog()[candidate.actionId]||{};
    return actionSnapshot({...action,...candidate,id:candidate.actionId,name:candidate.name||action.name,pattern:action.pattern||candidate.targetPatterns?.join(' / ')||'PREP',tier:action.tier||action.grade||candidate.prepGrade});
  }

  function actualField(item,key,label,{type='text',step,max,min,inputmode}={}){
    const id=`session-${item.id}-${key}`;
    return `<label for="${esc(id)}"><span${key==='reps'?' data-session-dose-label':''}>${label}</span><input id="${esc(id)}" type="${type}" data-session-actual="${key}"${type==='number'?' min="'+min+'" max="'+max+'" step="'+step+'"':''}${inputmode?` inputmode="${inputmode}"`:''}${type==='text'?' maxlength="80"':''}></label>`;
  }

  // Bead bucket for the Violet Bangle rows; the same hues as the composer.
  function bucketFor(item){
    if(item.phase==='PREP')return 'prep';
    const key=String(item.slotKey||'').split('__').pop();
    if(['A','D1','2'].includes(key))return 'lower';
    if(['B','D2','3'].includes(key))return 'upper';
    if(['C','SUPPORT'].includes(key))return 'support';
    if(key==='CORE')return 'core';
    return '';
  }
  function executionItemMarkup(item,index){
    const prep=item.phase==='PREP',candidates=prep?prepReplacementCandidates(item):replacementCandidates(item);
    const options=candidates.map(action=>`<option value="${esc(prep?action.actionId:action.id)}">${esc(action.name)}${action.equipment?` · ${esc(action.equipment)}`:''}</option>`).join('');
    const replacement=candidates.length
      ?`<label class="member-session-replacement">${prep?'热身替换':'临场替换'}（可选）<select ${prep?'data-session-prep-replacement':'data-session-replacement'} aria-label="${esc(plannedName(item))} ${prep?'热身':'临场'}替换（可选）"><option value="">按计划：${esc(plannedName(item))}</option>${options}</select></label>`
      :`<p class="member-session-no-replacements">${prep?'没有找到符合此热身槽位规则的替换动作':'没有找到同训练模式的可选动作'}，仍可按计划完成。</p>`;
    const plannedPrescription=item.plannedPrescriptionSnapshot?.rawText;
    const unit=doseUnit(plannedPrescription);
    const plannedPrescriptionMarkup=plannedPrescription?`<p class="member-session-planned-prescription" data-session-planned-prescription>计划处方：${esc(plannedPrescription)}</p>`:'';
    return `<li class="member-session-execution-item" data-session-item="${esc(item.id)}" data-vb-bucket="${bucketFor(item)}"><div class="member-session-execution-heading"><div><span>${esc(itemPhaseLabel(item,index))}</span><strong>计划：${esc(plannedName(item))}</strong></div></div>${plannedPrescriptionMarkup}${replacement}<details class="member-session-actual"><summary>添加实际数据（可选）</summary><div class="member-session-actual-grid">${actualField(item,'sets','组数',{type:'number',min:0,max:100,step:1,inputmode:'numeric'})}${actualField(item,'reps',unitLabel(unit))}${actualField(item,'loadKg','负重 kg',{type:'number',min:0,max:2000,step:0.1,inputmode:'decimal'})}${actualField(item,'rir','RIR',{type:'number',min:0,max:10,step:0.5,inputmode:'decimal'})}${actualField(item,'rpe','RPE',{type:'number',min:0,max:10,step:0.5,inputmode:'decimal'})}<label class="member-session-actual-note">备注（可选）<textarea data-session-actual="note" rows="2" maxlength="2000"></textarea></div></details></li>`;
  }

  function actualItemMarkup(item,compact=false){
    const recorded=item.completed===true;
    const name=recorded?performedName(item):'实练明细未记录';
    const changed=recorded&&item.performedActionId&&item.performedActionId!==item.plannedActionId;
    const amount=actualSummary(item);
    const equipment=item.performedActionSnapshot?.equipment||item.plannedActionSnapshot?.equipment||'';
    const missingLoad=recorded&&item.loadKg==null&&(amount||/杠铃|哑铃|壶铃|配重|器械|绳索/.test(equipment));
    const metrics=[amount||'实练明细未记录',missingLoad?'重量未记录':''].filter(Boolean).join(' · ');
    const plan=item.plannedPrescriptionSnapshot?.rawText;
    const original=`<details class="member-original"><summary>原计划</summary><p>计划：${esc(plannedName(item))}${plan?' · '+esc(plan):''}</p></details>`;
    return `<li class="member-session-item"><strong>${esc(changed?'实际：'+name:name)}</strong>${recorded?`<p>${esc(metrics)}</p>`:''}${compact&&!changed?'':original}${item.note?`<small>${esc(item.note)}</small>`:''}</li>`;
  }

  async function lastPractice(context){
    const id=context?.lastCompletedSession?.id;
    if(!id)return [];
    const {session,items}=await window.V14MemberAPI.getSession(id);
    if(session?.id!==id||session.memberId!==context.memberId||session.status!=='COMPLETED')throw new Error('课程记录已变更');
    return (items||[]).slice().sort((a,b)=>a.sortOrder-b.sortOrder);
  }

  function practiceMarkup(items,limit=items.length){
    const rows=items.filter(item=>item.completed===true&&item.phase!=='PREP').slice(0,limit);
    return rows.length?`<ul class="member-practice-items">${rows.map(item=>actualItemMarkup(item,true)).join('')}</ul>`:'<p>实练明细未记录</p>';
  }

  function readOnlyItemMarkup(item,session){
    if(session.status==='COMPLETED')return actualItemMarkup(item);
    const amount=item.plannedPrescriptionSnapshot?.rawText||'训练处方未记录';
    return `<li class="member-session-item"><div><strong>${session.status==='CANCELLED'?'原计划':'计划'}：${esc(plannedName(item))}</strong><span>${esc(itemPhaseLabel(item,item.sortOrder||0))}</span></div><p>${esc(amount)}</p></li>`;
  }

  function executionActions(){
    if(currentSession?.status!=='PLANNED')return '';
    return `${copyStatusMarkup()}<div class="member-session-cancel-confirmation" data-session-cancel-confirmation hidden role="group" aria-label="确认取消计划课程"><p>取消后，这节课会保留在训练记录中，但不会计入最近训练情况。</p><div><button type="button" data-session-cancel-dismiss>返回记录</button><button type="button" class="danger" data-session-cancel-confirm data-session-mutation>确认取消课程</button></div></div><div class="member-session-actions">${copyButtonMarkup()}<button type="button" data-session-cancel-request data-session-mutation>取消计划课程</button><button type="submit" class="primary" data-session-complete data-session-mutation>完成本节课</button></div>`;
  }

  function copyButtonMarkup(){
    if(!['PLANNED','COMPLETED'].includes(currentSession?.status)||!window.V14CoachModules?.MemberCenter?.canCopySessionToCurrentMember?.())return '';
    return `<button type="button" data-session-copy-to-member data-session-id="${esc(currentSession.id)}">复制给会员</button>`;
  }

  function copyStatusMarkup(){
    return '<p class="member-copy-inline-status" data-member-copy-status role="status" aria-live="polite"></p>';
  }

  function readOnlyActions(){
    if(!['PLANNED','COMPLETED'].includes(currentSession?.status)||!window.V14CoachModules?.MemberCenter?.canCopySessionToCurrentMember?.())return '';
    return `<div class="member-session-actions">${copyButtonMarkup()}</div>${copyStatusMarkup()}`;
  }

  function renderSession(data){
    currentSession=data?.session||{};
    currentItems=Array.isArray(data?.items)?data.items.slice().sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)):[];
    const editable=currentSession.status==='PLANNED'&&window.V14CoachModules.MemberCenter.canCopySessionToCurrentMember();
    const details=memberDetails(),prepItems=currentItems.filter(item=>item.phase==='PREP'),mainItems=currentItems.filter(item=>item.phase!=='PREP');
    const summary=`${dateLabel(currentSession.sessionDate)} · ${statusLabel(currentSession.status)}`;
    dialog.querySelector('[data-session-detail-subtitle]').textContent=summary;
    const foamRows=(Array.isArray(details.foam)?details.foam:[]).map(item=>`<li><strong>${esc(item.name||'泡沫轴动作')}</strong>${item.prescription?`<span>${esc(item.prescription)}</span>`:''}</li>`).join('');
    const prepRows=prepItems.map(executionItemMarkup).join('')||((details.warmups||[]).map(item=>`<li class="member-session-item"><div><strong>${esc(item.name||'热身动作')}</strong><span>${esc(item.role||'课前热身')}</span></div><p>${esc(item.prescription||'剂量未记录')}</p></li>`).join(''));
    const prepFallback=prepRows?`<ol class="${editable?'member-session-execution-list':'member-session-items'}">${editable?prepRows:prepItems.map(item=>readOnlyItemMarkup(item,currentSession)).join('')||prepRows}</ol>`:'<p class="member-state-note">此历史记录未保存热身动作快照。</p>';
    const prepSection=`<section class="member-session-section" data-member-session-prep><h4>课前准备 · 热身</h4>${foamRows?`<div class="member-session-foam"><b>泡沫轴放松</b><ul>${foamRows}</ul></div>`:''}${prepSectionLabel(prepItems,details)}${prepFallback}</section>`;
    const mainRows=mainItems.length
      ?editable?`<ol class="member-session-execution-list">${mainItems.map(executionItemMarkup).join('')}</ol>`:`<ol class="member-session-items">${mainItems.map(item=>readOnlyItemMarkup(item,currentSession)).join('')}</ol>`
      :'<p class="member-state-note">这节课没有主要训练动作记录。</p>';
    const trainingSection=`<section class="member-session-section"><h4>主要训练</h4>${mainRows}</section>`;
    const recoverySource=Array.isArray(details.recoveryDetails)&&details.recoveryDetails.length?details.recoveryDetails:Array.isArray(details.recovery)?details.recovery.map((text,index)=>({id:`recovery-${index}`,name:String(text)})):[];
    const recoveryRows=recoverySource.map(item=>`<li><strong>${esc(item.name||'训练后拉伸')}</strong>${item.prescription?`<span>${esc(item.prescription)}</span>`:''}${item.regionLabel?`<small>${esc(item.regionLabel)}</small>`:''}</li>`).join('');
    const recoverySection=`<section class="member-session-section" data-member-session-recovery><h4>训练后恢复 · 拉伸</h4>${recoveryRows?`<ul class="member-session-recovery-list">${recoveryRows}</ul>`:'<p class="member-state-note">此历史记录未保存训练后拉伸快照。</p>'}</section>`;
    const actions=editable?executionActions():readOnlyActions();
    const content=editable?`<form data-session-execution novalidate>${prepSection}${trainingSection}${recoverySection}${actions}</form>`:`${prepSection}${trainingSection}${recoverySection}${actions}`;
    dialog.querySelector('[data-session-detail-content]').innerHTML=`<div class="member-session-summary"><h3>${esc(currentSession.sessionTitle||currentSession.templateKey||'训练课程')}</h3><p>${esc(currentSession.templateKey||'课程')} · ${esc(currentSession.levelSnapshot||'等级未记录')}</p>${currentSession.coachNote?`<p>${esc(currentSession.coachNote)}</p>`:''}</div>${content}<div class="member-session-mutation-error" data-session-mutation-error role="alert" hidden></div>`;
  }

  function prepSectionLabel(){return '<h5>动态热身与激活</h5>';}

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
      if(target.matches('[data-session-copy-to-member]')){window.V14CoachModules?.MemberCenter?.copySessionToCurrentMember?.(target);return;}
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
    dialog.addEventListener('change',event=>{
      if(event.target.matches('[data-session-prep-replacement]'))refreshPrepReplacementOptions();
      if(event.target.matches('[data-session-prep-replacement],[data-session-replacement]')){
        const row=event.target.closest('[data-session-item]');
        const item=currentItems.find(entry=>entry.id===row?.dataset.sessionItem);
        const label=row?.querySelector('[data-session-dose-label]');
        if(item&&label)label.textContent=unitLabel(executionUnit(item,event.target.value));
      }
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

  function executionUnit(item,replacementId){
    if(!replacementId)return doseUnit(item.plannedPrescriptionSnapshot?.rawText);
    const dose=item.phase==='PREP'?prepReplacementCandidates(item).find(candidate=>candidate.actionId===replacementId)?.prescription:
      window.V14Composer?.f111Prescription?.(replacementId,item.slotKey);
    return doseUnit(dose);
  }

  function executionPatches(form){
    const patches=[];
    for(const row of form.querySelectorAll('[data-session-item]')){
      const original=currentItems.find(item=>item.id===row.dataset.sessionItem);
      if(!original)continue;
      const patch={id:original.id};
      const prep=original.phase==='PREP',select=row.querySelector('[data-session-prep-replacement], [data-session-replacement]');
      if(select?.value){
        const candidates=prep?prepReplacementCandidates(original):replacementCandidates(original);
        const action=candidates.find(candidate=>candidate.actionId===select.value||candidate.id===select.value);
        if(!action)throw new TypeError('请选择列表中的替换动作。');
        patch.performedActionId=prep?action.actionId:action.id;
        patch.performedActionSnapshot=prep?prepActionSnapshot(action):actionSnapshot(action);
      }
      for(const key of ['sets','reps','loadKg','rir','rpe','note']){
        const input=row.querySelector(`[data-session-actual="${key}"]`),value=input?.value.trim()||'';
        if(!value)continue;
        const unit=key==='reps'?executionUnit(original,select?.value):'';
        patch[key]=key==='reps'&&unit&&/^\d+(?:\.\d+)?$/.test(value)?`${value} ${unit}`:
          key==='reps'||key==='note'?value:Number(value);
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

  window.V14MemberSessionUI={open,lastPractice,practiceMarkup};
  window.V14CoachModules=window.V14CoachModules||{};
  window.V14CoachModules.MemberSessionUI=window.V14MemberSessionUI;
})();
