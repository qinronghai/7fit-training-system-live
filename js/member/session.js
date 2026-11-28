(function(){
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const normalCategories=new Set(['主训练','T1','T2','T3','T4']);
  const excludedCategories=new Set(['热身','激活','活动','放松','体能']);
  let dialog=null,returnFocus=null,returnFocusSessionId='',requestVersion=0,currentSessionId='',currentSession=null,currentItems=[],mutationInFlight=false,onSessionChanged=null,coachPanel=null,memberContext=null,retryPatches=null;

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

  function prepReplacementCandidates(item,activeId,includeOriginal=false){
    const resolver=window.V14PrepResolver,details=memberDetails(),slotKey=prepSlotKey(item);
    if(!resolver?.SLOT_ORDER?.includes(slotKey))return [];
    const context=details.prepContext||currentSession?.resolvedSessionSnapshot?.prepContext;
    if(!context)return [];
    const saved=Array.isArray(details.warmups)?details.warmups:[];
    const usedFamilies=new Set(currentItems.filter(other=>other.phase==='PREP'&&other.id!==item.id).map(other=>{
      const otherSlot=prepSlotKey(other),row=Array.from(dialog?.querySelectorAll('[data-session-item]')||[]).find(node=>node.dataset.sessionItem===other.id);
      const active=activeId?.(other.id);
      const selectedId=active&&active!==other.plannedActionId?active:row?.querySelector('[data-session-prep-replacement]')?.value;
      if(selectedId){
        const candidate=resolver.rankSlotCandidates(otherSlot,resolver.normalizeContext(context),{limit:100}).find(value=>value.actionId===selectedId);
        if(candidate)return warmupFamily(candidate);
      }
      const original=saved.find(value=>value.slotKey===otherSlot);
      return warmupFamily(original||{actionId:other.plannedActionId});
    }));
    return resolver.rankSlotCandidates(slotKey,resolver.normalizeContext(context),{limit:100})
      .filter(candidate=>(includeOriginal||candidate.actionId!==item.plannedActionId)&&!usedFamilies.has(warmupFamily(candidate)));
  }

  function refreshPrepReplacementOptions(){
    const activeId=id=>coachPanel?.model.forItem(id).active?.actionId;
    let rejected=false;
    dialog?.querySelectorAll('[data-session-prep-replacement]').forEach(select=>{
      const item=currentItems.find(value=>value.id===select.closest('[data-session-item]')?.dataset.sessionItem);
      if(!item)return;
      const priorValue=select.value,candidates=prepReplacementCandidates(item,activeId),valid=candidates.some(candidate=>candidate.actionId===priorValue);
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

  function replacementOptions(item,activeId){
    const prep=item.phase==='PREP', id=item.plannedActionId;
    const existing=prep?prepReplacementCandidates(item,activeId,true):replacementCandidates(item);
    const data=window.V14_DATA, original=catalog()[id]||{};
    const template=String(currentSession.templateKey||currentSession.resolvedSessionSnapshot?.templateId||'').toLowerCase();
    const level=currentSession.levelSnapshot||currentSession.resolvedSessionSnapshot?.level;
    const composer=window.V14Composer;
    const graded=template==='f111' && /^L[1-4]$/.test(level);
    const mainRole=/(^|__)[AB]$/.test(item.slotKey||'');
    const profile=prep?null:original.isSupport||id?.startsWith('SUP-')?composer?.supportWindow(level):
      original.isCore||id?.startsWith('CORE-')?composer?.coreWindow(level):composer?.mainTierWindow(level);
    const allowed=new Set(existing.map(value=>prep?value.actionId:value.id));
    const reason=action=>{
      if(!action.id)return '候选资料，尚不可编排';
      if(!allowed.has(action.id))return prep?'不符合当前热身槽位要求':
        action.pattern!==item.plannedActionSnapshot?.pattern?'动作模式不匹配':'动作类型或编排状态不适用';
      if(!prep && template==='f111' && (mainRole||['1F_ONLY','FLEX_1F_2F'].includes(original.route)) &&
          action.route==='2F_ONLY')return '器械位于 2F，与当前力量环节不匹配';
      const grade=action.supportGrade||action.coreGrade||action.tier||action.grade;
      if(graded && mainRole && !grade)return '未定义此动作的主项训练等级';
      if(graded && grade && profile?.normal && ![...profile.normal,...(profile.expanded||[])].includes(grade))return '超出当前训练等级';
      const equipment=[...(Array.isArray(action.requiresEquipmentId)?action.requiresEquipmentId:[]),...String(action.equipmentId||'').split(/[、,]/)].filter(Boolean);
      if(equipment.some(key=>['UNAVAILABLE','NOT_AVAILABLE'].includes(data?.venueCapabilityPolicy?.equipment?.[key]?.venueAvailability)))return '场馆器械不可用';
      return '';
    };
    const byId=new Map();
    if(item.plannedActionSnapshot&&(!prep||allowed.has(id)||id===activeId(item.id)))byId.set(id,item.plannedActionSnapshot);
    for(const action of existing){
      const key=prep?action.actionId:action.id;
      if(prep||!reason(action))byId.set(key,prep?prepActionSnapshot(action):actionSnapshot(action));
    }
    const related=String(data?.actionDetails?.[id]?.fields?.['同级替代 ID']||'').split(/[、,，\s]+/).filter(Boolean);
    const recommended=(prep?existing.map(value=>value.actionId):related.length?related:existing.map(value=>value.id))
      .filter(key=>byId.has(key) && key!==activeId(item.id)).slice(0,6);
    if(byId.has(id)&&id!==activeId(item.id)&&!recommended.includes(id))recommended.push(id);
    return {byId,recommended,reason};
  }

  function actualField(item,key,label,{type='text',step,max,min,inputmode}={}){
    const id=`session-${item.id}-${key}`;
    return `<label for="${esc(id)}">${label}<input id="${esc(id)}" type="${type}" data-session-actual="${key}"${type==='number'?' min="'+min+'" max="'+max+'" step="'+step+'"':''}${inputmode?` inputmode="${inputmode}"`:''}${type==='text'?' maxlength="80"':''}></label>`;
  }

  function executionItemMarkup(item){
    const prep=item.phase==='PREP',available=replacementOptions(item,()=>null).byId;
    const candidates=[...available.values()].filter(action=>action.actionId!==item.plannedActionId);
    const options=candidates.map(action=>`<option value="${esc(action.actionId)}">${esc(action.name)}${action.equipment?` · ${esc(action.equipment)}`:''}</option>`).join('');
    const replacement=candidates.length
      ?`<label class="member-session-replacement">${prep?'热身替换':'临场替换'}（可选）<select ${prep?'data-session-prep-replacement':'data-session-replacement'} aria-label="${esc(plannedName(item))} ${prep?'热身':'临场'}替换（可选）"><option value="">按计划：${esc(plannedName(item))}</option>${options}</select></label>`
      :`<p class="member-session-no-replacements">${prep?'没有找到符合此热身槽位规则的替换动作':'没有找到同训练模式的可选动作'}，仍可按计划完成。</p>`;
    const plannedPrescription=item.plannedPrescriptionSnapshot?.rawText;
    const plannedPrescriptionMarkup=plannedPrescription?`<p class="member-session-planned-prescription" data-session-planned-prescription>计划处方：${esc(plannedPrescription)}</p>`:'';
    return `<li class="member-session-execution-item" data-session-item="${esc(item.id)}"><div class="member-session-execution-heading"><div><strong>${esc(plannedName(item))}</strong>${plannedPrescriptionMarkup}</div>${item.plannedActionSnapshot ? `<button type="button" data-session-tool="record" data-value="${esc(item.id)}" aria-label="记录 ${esc(plannedName(item))}">记录</button>` : ''}</div><details class="member-session-batch"><summary>补记整项</summary>${replacement}<button type="button" data-session-tool="clear-batch" data-value="${esc(item.id)}">清空补记</button><details class="member-session-actual"><summary>添加实际数据（可选）</summary><div class="member-session-actual-grid">${actualField(item,'sets','组数',{type:'number',min:0,max:100,step:1,inputmode:'numeric'})}${actualField(item,'reps','次数')}${actualField(item,'loadKg','负重 kg',{type:'number',min:0,max:2000,step:0.1,inputmode:'decimal'})}${actualField(item,'rir','RIR',{type:'number',min:0,max:10,step:0.5,inputmode:'decimal'})}${actualField(item,'rpe','RPE',{type:'number',min:0,max:10,step:0.5,inputmode:'decimal'})}<label class="member-session-actual-note">备注（可选）<textarea data-session-actual="note" rows="2" maxlength="2000"></textarea></div></details></li>`;
  }

  function readOnlyItemMarkup(item,session){
    const completed=session.status==='COMPLETED';
    const plan=plannedName(item),actual=performedName(item);
    const changed=completed&&item.performedActionId&&item.plannedActionId&&item.performedActionId!==item.plannedActionId;
    if(completed && item.execution){
      const recorded=window.V14SessionPanel.segmentsMarkup(item.execution.segments);
      return `<li class="member-session-item session-coach-completed"><div><strong>${esc(plan)}</strong></div>${window.V14SessionPanel.prescriptions(item)}${recorded||'<p>实练未记录</p>'}</li>`;
    }
    if(completed && !item.completed)return `<li class="member-session-item"><div><strong>${esc(plan)}</strong></div><p>实练未记录</p></li>`;
    const prescription=completed?(item.performedPrescription||item.plannedPrescriptionSnapshot):(item.plannedPrescriptionSnapshot||item.performedPrescription);
    const amount=actualSummary(item)||prescription?.rawText||'训练处方未记录';
    const actionText=completed
      ?changed?`计划：${plan} · 实际：${actual}`:`按计划完成：${actual}`
      :session.status==='CANCELLED'?`原计划：${plan}`:`计划：${plan}`;
    return `<li class="member-session-item"><div><strong>${esc(actionText)}</strong><span>${esc(itemPhaseLabel(item,item.sortOrder||0))}</span></div><p>${esc(amount)}</p>${item.note?`<small>${esc(item.note)}</small>`:''}</li>`;
  }

  function executionActions(){
    return `${copyStatusMarkup()}<div class="member-session-cancel-confirmation" data-session-cancel-confirmation hidden role="group" aria-label="确认取消计划课程"><p>取消后，这节课会保留在训练记录中。</p><div><button type="button" data-session-cancel-dismiss>返回记录</button><button type="button" class="danger" data-session-cancel-confirm data-session-mutation>确认取消课程</button></div></div><div class="member-session-other-actions">${copyButtonMarkup()}<button type="button" data-session-cancel-request data-session-mutation>取消计划课程</button></div>`;
  }

  function executionFooter(){
    return `<div class="member-session-actions"><button type="button" data-session-tool="save-draft" data-session-mutation>保存草稿</button><button type="submit" form="member-session-execution" class="primary" data-session-complete data-session-mutation>完成本节课</button></div>`;
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

  function renderSession(data,draft){
    dialog.querySelector('[data-session-footer]').hidden=false;
    coachPanel=null;
    currentSession=data?.session||{};
    currentItems=Array.isArray(data?.items)?data.items.slice().sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0)):[];
    const details=memberDetails(),prepItems=currentItems.filter(item=>item.phase==='PREP'),mainItems=currentItems.filter(item=>item.phase!=='PREP');
    const planned=currentSession.status==='PLANNED';
    const title=currentSession.sessionTitle||currentSession.templateKey||'训练课程';
    dialog.querySelector('#member-session-detail-title').textContent=title;
    dialog.querySelector('[data-session-detail-subtitle]').textContent=[memberContext?.displayName,
      currentSession.templateKey?.toUpperCase(),currentSession.levelSnapshot,dateLabel(currentSession.sessionDate),statusLabel(currentSession.status)].filter(Boolean).join(' · ');
    dialog.querySelector('[data-session-tool="browse"]').hidden=false;
    const foamRows=(Array.isArray(details.foam)?details.foam:[]).map(item=>`<li><strong>${esc(item.name||'泡沫轴动作')}</strong>${item.prescription?`<span>${esc(item.prescription)}</span>`:''}${item.safety?`<small>${esc(item.safety)}</small>`:''}</li>`).join('');
    const itemMarkup=planned?executionItemMarkup:item=>readOnlyItemMarkup(item,currentSession);
    const savedWarmups=Array.isArray(details.warmups)?details.warmups:[];
    const prepRows=prepItems.length?prepItems.map(itemMarkup).join(''):savedWarmups.map(item=>`<li class="member-session-item"><div><strong>${esc(item.name||'热身动作')}</strong>${item.role?`<span>${esc(item.role)}</span>`:''}</div><p>${esc(item.prescription||'剂量未记录')}</p></li>`).join('');
    const listClass=planned?'member-session-execution-list':'member-session-items';
    const prepSection=`<section class="member-session-section" data-member-session-prep data-session-stage="prep"><h4>课前准备 · 热身</h4>${foamRows?`<div class="member-session-foam"><b>泡沫轴放松</b><ul>${foamRows}</ul></div>`:''}${prepSectionLabel()}${prepRows?`<ol class="${listClass}">${prepRows}</ol>`:'<p class="member-state-note">此历史记录未保存热身动作快照。</p>'}</section>`;
    const mainRows=mainItems.length?`<ol class="${listClass}">${mainItems.map(itemMarkup).join('')}</ol>`:'<p class="member-state-note">这节课没有主要训练动作记录。</p>';
    const trainingSection=`<section class="member-session-section" data-session-stage="main"><h4>主要训练</h4>${mainRows}</section>`;
    const recoverySource=Array.isArray(details.recoveryDetails)&&details.recoveryDetails.length?details.recoveryDetails:Array.isArray(details.recovery)?details.recovery.map(text=>({name:String(text)})):[];
    const recoveryRows=recoverySource.map(item=>`<li><strong>${esc(item.name||'训练后拉伸')}</strong>${item.prescription?`<span>${esc(item.prescription)}</span>`:''}${item.regionLabel?`<small>${esc(item.regionLabel)}</small>`:''}${item.detail&&typeof item.detail==='string'?`<small>${esc(item.detail)}</small>`:''}</li>`).join('');
    const cardio=details.postCardioPlan||currentSession.resolvedSessionSnapshot?.postCardioPlan;
    const cardioText=cardio?[cardio.equipment,cardio.minutes!=null?`${cardio.minutes} 分钟`:'',cardio.heartRateMin!=null&&cardio.heartRateMax!=null?`心率 ${cardio.heartRateMin}–${cardio.heartRateMax} 次/分钟`:'',cardio.detail].filter(Boolean).join(' · '):details.postCardio||currentSession.resolvedSessionSnapshot?.postCardio;
    const recoverySection=`<section class="member-session-section" data-member-session-recovery data-session-stage="recovery"><h4>训练后恢复 · 拉伸</h4>${recoveryRows?`<ul class="member-session-recovery-list">${recoveryRows}</ul>`:'<p class="member-state-note">此历史记录未保存训练后拉伸快照。</p>'}
      ${cardioText?`<h4>课后有氧</h4><p class="member-session-cardio">${esc(cardioText)}</p>`:''}</section>`;
    const overview=`<div class="session-coach-overview"><h3>课程总览</h3>${memberContext?.primaryGoal?`<p>训练目标 · ${esc(memberContext.primaryGoal)}</p>`:''}${currentSession.coachNote?`<p>本节备注 · ${esc(currentSession.coachNote)}</p>`:''}
      <nav class="session-coach-navigation" aria-label="课程环节"><button type="button" data-session-tool="section" data-value="prep">课前准备</button><button type="button" data-session-tool="section" data-value="main">主训练</button><button type="button" data-session-tool="section" data-value="recovery">恢复与有氧</button></nav>
      ${planned&&currentItems.some(item=>item.plannedActionSnapshot)?'<button type="button" class="primary" data-session-tool="record">开始带课</button>':''}</div>`;
    const content=`<div data-session-course-view>${overview}${prepSection}${trainingSection}${recoverySection}${planned?executionActions():readOnlyActions()}</div><div class="session-coach-view" data-session-coach-view hidden></div>`;
    dialog.querySelector('[data-session-detail-content]').innerHTML=planned?`<form id="member-session-execution" data-session-execution novalidate>${content}</form>`:content;
    dialog.querySelector('[data-session-footer]').innerHTML=planned?executionFooter():'';
    dialog.querySelector('[data-session-mutation-error]').hidden=true;
    restoreBatch(draft?.batch);
    coachPanel=window.V14SessionPanel.create(dialog,currentSession,currentItems,{draft,replacements:replacementOptions,batchValues,onOverview:refreshPrepReplacementOptions});
    coachPanel.restore();
  }

  function prepSectionLabel(){return '<h5>动态热身与激活</h5>';}

  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='member-session-dialog';
    dialog.dataset.memberSessionDetail='';
    dialog.setAttribute('aria-labelledby','member-session-detail-title');
    dialog.innerHTML='<section class="member-session-panel"><header class="member-session-head"><div><h2 id="member-session-detail-title">课程记录</h2><p data-session-detail-subtitle></p></div><div class="member-session-head-actions"><button type="button" data-session-tool="browse" hidden>动作库</button><button type="button" data-session-detail-close data-session-mutation>关闭</button></div></header><div class="member-session-content" data-session-detail-content></div><div data-session-footer></div><p class="member-session-mutation-error" data-session-mutation-error role="alert" hidden></p><p class="session-coach-status" data-session-coach-status role="status"></p><dialog class="session-coach-overlay" data-session-coach-overlay aria-label="课程操作确认"></dialog></section>';
    document.body.appendChild(dialog);
    function closeCourse(){if(!mutationInFlight && !coachPanel?.requestClose())dialog.close();}
    dialog.querySelector('[data-session-detail-close]').addEventListener('click',closeCourse);
    dialog.addEventListener('click',event=>{
      if(event.target===dialog){closeCourse();return;}
      const target=event.target.closest('button');
      if(!target)return;
      if(['complete-confirm','complete-as-planned'].includes(target.dataset.sessionTool)){
        coachPanel?.closeOverlay();
        void completeCurrentSession(dialog.querySelector('[data-session-execution]'),true,target.dataset.sessionTool==='complete-as-planned');
        return;
      }
      if(target.dataset.sessionTool&&coachPanel?.handle(target))return;
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
      coachPanel?.modeChange(event.target);
      if(event.target.matches('[data-session-prep-replacement]'))refreshPrepReplacementOptions();
    });
    dialog.addEventListener('input',event=>coachPanel?.input(event.target));
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Enter'||event.isComposing||event.repeat)return;
      const input=event.target;
      if(input.matches('[data-coach-search]'))event.preventDefault();
      if(!input.matches('[data-log-load], [data-log-amount]'))return;
      event.preventDefault();
      const scope=input.closest('[data-session-coach-overlay]')||input.closest('[data-session-coach-view]');
      scope?.querySelector('[data-session-tool="log"], [data-session-tool="save-edit"]')?.click();
    });
    const overlay=dialog.querySelector('[data-session-coach-overlay]');
    overlay.addEventListener('close',event=>{event.stopPropagation();coachPanel?.overlayClosed();});
    overlay.addEventListener('cancel',event=>event.stopPropagation());
    dialog.addEventListener('submit',event=>{
      const form=event.target.closest('[data-session-execution]');
      if(!form)return;
      event.preventDefault();void completeCurrentSession(form);
    });
    dialog.addEventListener('cancel',event=>{event.preventDefault();closeCourse();});
    dialog.addEventListener('close',()=>{
      requestVersion++;
      coachPanel=null;
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
    if(target){target.textContent=error instanceof TypeError ? error.message : mutationError(error);target.hidden=false;}
  }

  function setMutationState(busy){
    const retry=!busy && retryPatches!==null;
    const submit=dialog?.querySelector('[data-session-complete]');
    for(const control of dialog?.querySelectorAll('[data-session-mutation], [data-session-tool], [data-session-execution] input, [data-session-execution] select, [data-session-execution] textarea')||[]){
      const staysAvailable=control===submit||control.matches('[data-session-detail-close], [data-session-tool="save-draft"]');
      if(busy||retry&&!staysAvailable){
        if(!control.disabled){control.disabled=true;control.dataset.sessionTemporarilyDisabled='';}
      }else if(control.hasAttribute('data-session-temporarily-disabled')){
        control.disabled=false;delete control.dataset.sessionTemporarilyDisabled;
      }
    }
    if(submit)submit.textContent=busy?'正在保存…':retry?'重试完成':'完成本节课';
  }

  function batchValues(){
    const result={};
    for(const row of dialog.querySelectorAll('[data-session-item]')){
      const fields={};
      for(const input of row.querySelectorAll('[data-session-actual], [data-session-prep-replacement], [data-session-replacement]')){
        const value=input.value.trim();
        if(value)fields[input.dataset.sessionActual||'replacement']=value;
      }
      if(Object.keys(fields).length)result[row.dataset.sessionItem]=fields;
    }
    return result;
  }

  function restoreBatch(batch){
    if(!batch)return;
    for(const row of dialog.querySelectorAll('[data-session-item]')){
      const fields=batch[row.dataset.sessionItem];
      if(!fields)continue;
      for(const input of row.querySelectorAll('[data-session-actual], [data-session-prep-replacement], [data-session-replacement]')){
        const value=fields[input.dataset.sessionActual||'replacement'];
        if(value)input.value=value;
      }
    }
    refreshPrepReplacementOptions();
  }

  function executionPatches(){
    const patches=coachPanel?.model.patches()||[];
    const logged=new Set(patches.map(patch=>patch.id));
    const batch=batchValues();
    for(const original of currentItems){
      if(logged.has(original.id)){
        if(batch[original.id])throw new TypeError('同一个动作已有逐组记录和补记，请保留其中一种。');
        continue;
      }
      const fields=batch[original.id];
      if(!fields){
        patches.push({id:original.id,execution:{schemaVersion:1,segments:[]}});
        continue;
      }
      const patch={id:original.id,completed:true};
      if(fields.replacement){
        const snapshot=replacementOptions(original,id=>coachPanel?.model.forItem(id).active?.actionId).byId.get(fields.replacement);
        if(!snapshot)throw new TypeError('替换动作已不适用，请重新选择。');
        patch.performedActionId=snapshot.actionId;
        patch.performedActionSnapshot=snapshot;
      }
      for(const key of ['sets','reps','loadKg','rir','rpe','note']){
        if(!fields[key])continue;
        patch[key]=key==='reps'||key==='note'?fields[key]:Number(fields[key]);
      }
      patches.push(patch);
    }
    return patches;
  }

  async function loadSession(sessionId,version){
    if(!sessionId||!dialog)return;
    try{
      const data=await window.V14MemberAPI.getSession(sessionId);
      if(version!==requestVersion||!dialog.open)return;
      const draft=await window.V14SessionDraft.open(data.session||{});
      if(version!==requestVersion||!dialog.open)return;
      renderSession(data,draft);
      const previous=memberContext?.sessions?.find(value=>value.status==='COMPLETED'&&value.id!==sessionId&&value.sessionDate<=currentSession.sessionDate);
      if(currentSession.status==='PLANNED'&&previous){
        window.V14MemberAPI.getSession(previous.id).then(prior=>{
          if(version===requestVersion&&dialog.open)coachPanel?.setPrevious(prior.items);
        }).catch(()=>{});
      }
    }catch(_){
      if(version!==requestVersion||!dialog.open)return;
      dialog.querySelector('[data-session-detail-content]').innerHTML='<div class="member-state-error"><p>课程记录暂时无法读取。</p><button type="button" data-session-detail-retry>重试</button></div>';
    }
  }

  async function completeCurrentSession(form,confirmed=false,asPlanned=false){
    if(mutationInFlight||currentSession?.status!=='PLANNED')return;
    if(!retryPatches && !confirmed && coachPanel?.confirmCompletion())return;
    if(!retryPatches && !form.checkValidity()){
      coachPanel?.showCourse();
      for(const input of form.querySelectorAll(':invalid'))for(let parent=input.closest('details');parent;parent=parent.parentElement.closest('details'))parent.open=true;
      form.reportValidity();return;
    }
    let patches=retryPatches;
    try{if(!patches)patches=asPlanned?[]:executionPatches();}catch(error){showMutationError(error);return;}
    retryPatches=JSON.parse(JSON.stringify(patches));
    mutationInFlight=true;setMutationState(true);
    const version=requestVersion,sessionId=currentSession.id;
    try{
      const result=await window.V14MemberAPI.completeSession(sessionId,currentSession.revision,retryPatches);
      if(version!==requestVersion||!dialog.open)return;
      window.V14SessionDraft.clear();
      retryPatches=null;
      currentSession={...currentSession,...result,status:'COMPLETED'};
      await loadSession(sessionId,version);
      await onSessionChanged?.(currentSession);
    }catch(error){
      if(error?.status>=400 && error?.status<500)retryPatches=null;
      if(version===requestVersion&&dialog.open)showMutationError(error);
    }
    finally{mutationInFlight=false;if(version===requestVersion&&dialog.open)setMutationState(false);}
  }

  async function cancelCurrentSession(){
    if(mutationInFlight||currentSession?.status!=='PLANNED')return;
    mutationInFlight=true;setMutationState(true);
    const version=requestVersion,sessionId=currentSession.id;
    try{
      const result=await window.V14MemberAPI.cancelSession(sessionId,currentSession.revision);
      if(version!==requestVersion||!dialog.open)return;
      window.V14SessionDraft.clear();
      currentSession={...currentSession,...result,status:'CANCELLED'};
      await loadSession(sessionId,version);
      await onSessionChanged?.(currentSession);
    }catch(error){if(version===requestVersion&&dialog.open)showMutationError(error);}
    finally{mutationInFlight=false;if(version===requestVersion&&dialog.open)setMutationState(false);}
  }

  function open(sessionId,trigger,sessionChanged,member){
    const root=ensureDialog(),version=++requestVersion;
    currentSessionId=sessionId;currentSession=null;currentItems=[];returnFocus=trigger||document.activeElement;returnFocusSessionId=sessionId;onSessionChanged=sessionChanged||null;
    coachPanel=null;memberContext=member||null;retryPatches=null;
    root.querySelector('#member-session-detail-title').textContent='课程记录';
    root.querySelector('[data-session-tool="browse"]').hidden=true;
    root.querySelector('[data-session-footer]').replaceChildren();
    root.querySelector('[data-session-mutation-error]').hidden=true;
    root.querySelector('[data-session-coach-status]').textContent='';
    root.querySelector('[data-session-detail-subtitle]').textContent='';
    root.querySelector('[data-session-detail-content]').innerHTML='<p class="member-state-loading">正在读取课程记录…</p>';
    if(!root.open)root.showModal();
    void loadSession(sessionId,version);
  }

  window.V14MemberSessionUI={open};
  window.V14CoachModules=window.V14CoachModules||{};
  window.V14CoachModules.MemberSessionUI=window.V14MemberSessionUI;
})();
