(function(){
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const LIMIT=100;
  const SESSION_PAGE_SIZE=30;
  let route=null,routeVersion=0,query='',filter='ACTIVE',listVersion=0,detailVersion=0,listTimer=null,formReturnFocus=null,archiveTarget=null,membersById=new Map(),listRows=[],listHasMore=false,listLoadingMore=false,listMoreError=false,listMoreAuthError=false,currentMember=null,currentContext=null,currentSessions=[],timelineHasMore=false,timelineLoading=false,timelineLoadError=false;

  function dateLabel(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.replaceAll('-','.'):esc(value||'日期未记录');}
  function statusLabel(status){return ({ACTIVE:'有效会员',INACTIVE:'已停用',PLANNED:'待训练',COMPLETED:'已完成',CANCELLED:'已取消'})[status]||'状态未知';}
  function nextSessionHref(context){const level=/^L[1-4]$/.test(context?.trainingLevel||'')?context.trainingLevel:'L1';return `#/coach/f111?memberId=${encodeURIComponent(context?.memberId||'')}&amp;level=${level}`;}
  function formMarkup(){return `<dialog class="member-form-dialog" data-member-form-dialog aria-labelledby="member-form-title"><form class="member-form-panel" data-member-form><header class="member-form-head"><div><h2 id="member-form-title">新增会员</h2><p>只记录编排和回看训练所需的信息。</p></div><button type="button" data-member-form-cancel>取消</button></header><div class="member-form-fields"><label>会员姓名<input name="displayName" required maxlength="120" autocomplete="name"></label><label>训练等级<select name="trainingLevel"><option value="">未设置</option><option value="L1">L1</option><option value="L2">L2</option><option value="L3">L3</option><option value="L4">L4</option></select></label><label>主要训练目标<input name="primaryGoal" maxlength="240" placeholder="例如：提升下肢力量"></label><label>训练经验<select name="experienceLevel"><option value="">未设置</option><option value="BEGINNER">初级</option><option value="INTERMEDIATE">中级</option><option value="ADVANCED">进阶</option></select></label><label>动作限制<textarea name="movementConstraints" rows="2" placeholder="每行一项，例如：膝关节屈曲受限"></textarea></label><label>常用器械<textarea name="preferredEquipment" rows="2" placeholder="每行一项，例如：哑铃"></textarea></label><label>训练备注<textarea name="profileNotes" rows="2" maxlength="2000"></textarea></label><label>教练备注<textarea name="coachNotes" rows="3" maxlength="4000"></textarea></label><p class="member-form-error" data-member-form-error role="alert" hidden></p></div><footer class="member-form-actions"><button type="button" data-member-form-cancel>取消</button><button class="primary" type="submit" data-member-form-submit>保存资料</button></footer></form></dialog>`;}
  function archiveMarkup(){return `<dialog class="member-archive-dialog" data-member-archive-dialog aria-labelledby="member-archive-title"><section><h2 id="member-archive-title">归档会员</h2><p data-member-archive-copy>归档后，历史训练记录仍会保留。</p><div class="member-archive-actions"><button type="button" data-member-archive-cancel>取消</button><button type="button" class="danger" data-member-archive-confirm>确认归档</button></div></section></dialog>`;}

  function renderListShell(){
    return `<section class="member-center-page" data-member-center-page="list"><header class="member-center-heading"><div><h1>会员训练</h1><p>从最近完成训练查看会员进展，也可以继续查看课程记录。</p></div><button class="member-primary-action" type="button" data-member-create>新增会员</button></header><section class="member-directory" aria-labelledby="member-directory-title"><div class="member-directory-heading"><div><h2 id="member-directory-title">会员</h2><p>会员信息仅服务于课程编排与训练回看。</p></div><div class="member-filter-tabs" role="group" aria-label="会员状态">${[['ACTIVE','有效会员'],['ARCHIVED','已归档'],['INACTIVE','已停用']].map(([value,label])=>`<button type="button" data-member-filter="${value}" aria-pressed="${filter===value}">${label}</button>`).join('')}</div></div><label class="member-directory-search"><span>搜索会员</span><input type="search" data-member-search value="${esc(query)}" placeholder="输入姓名" autocomplete="off"></label><div class="member-results" data-member-results aria-live="polite"><p class="member-state-loading" data-member-loading>正在加载会员…</p></div></section>${formMarkup()}${archiveMarkup()}</section>`;
  }

  function memberRow(member){
    const meta=[member.trainingLevel||'等级未设置',member.primaryGoal||'训练目标未设置'].filter(Boolean);
    return `<article class="member-directory-row" data-member-row="${esc(member.id)}"><div class="member-row-main"><a data-member-open="${esc(member.id)}" href="#/coach/members/${encodeURIComponent(member.id)}">${esc(member.displayName)}</a><p>${meta.map(esc).join(' · ')}</p></div><span class="member-row-status ${member.archivedAt?'archived':''}">${member.archivedAt?'已归档':statusLabel(member.status)}</span><div class="member-row-actions">${member.archivedAt?`<button type="button" data-member-restore="${esc(member.id)}">恢复会员</button>`:`<button type="button" data-member-edit="${esc(member.id)}">编辑资料</button><button type="button" data-member-archive="${esc(member.id)}">归档</button>`}</div></article>`;
  }

  function renderListResults(rows,hasMore=listHasMore){
    const visible=rows.filter(member=>filter==='ACTIVE'?member.status==='ACTIVE'&&!member.archivedAt:filter==='ARCHIVED'?!!member.archivedAt:member.status==='INACTIVE'&&!member.archivedAt);
    visible.forEach(member=>membersById.set(member.id,member));
    if(!visible.length){
      const title=query?'没有找到匹配的会员':filter==='ARCHIVED'?'还没有归档会员':filter==='INACTIVE'?'没有停用会员':'还没有会员记录';
      return `<div class="member-state-empty" data-member-empty><h3>${title}</h3><p>${query?'试试输入完整姓名或减少搜索条件。':'创建会员后，可以从这里进入她的训练记录。'}</p>${filter==='ACTIVE'?'<button type="button" data-member-create>新增会员</button>':''}</div>`;
    }
    const moreError=listMoreError?`<p class="member-load-more-error" role="alert">${listMoreAuthError?staffRecoveryMarkup():'更多会员暂时无法读取，请重试。'}</p>`:'';
    const moreButton=hasMore?`<button class="member-load-more" type="button" data-member-load-more-members${listLoadingMore?' disabled':''}>${listLoadingMore?'正在加载…':listMoreError?'重试加载':'加载更多会员'}</button>`:'';
    return `<div class="member-directory-list">${visible.map(memberRow).join('')}</div><p class="member-list-count">显示 ${visible.length} 位会员</p>${moreError}${moreButton}`;
  }

  function staffRecoveryMarkup(){
    return '<span class="member-auth-recovery" data-member-auth-recovery>教练登录已失效。请在新标签页完成馆主管理 PIN 验证，然后返回此页重试。 <a data-member-auth-link href="assets/real-results/index.html?admin=1" target="_blank" rel="noopener">打开教练验证</a></span>';
  }

  function showListError(error){
    const target=document.querySelector('[data-member-results]');
    if(target)target.innerHTML=`<div class="member-state-error" data-member-error role="alert">${error?.status===401?staffRecoveryMarkup():'<p>会员列表暂时无法读取。</p>'}<button type="button" data-member-retry>重试</button></div>`;
  }

  async function loadMemberListPage(version,{append=false}={}){
    try{
      const offset=append?listRows.length:0;
      const rows=await window.V14MemberAPI.listMembers({search:query,status:filter,limit:LIMIT,offset});
      if(version!==listVersion||route?.page!=='member-list')return;
      const pageRows=Array.isArray(rows)?rows:[];
      if(append){
        const known=new Set(listRows.map(member=>member.id));
        listRows.push(...pageRows.filter(member=>!known.has(member.id)));
      }else listRows=pageRows;
      listHasMore=pageRows.length===LIMIT;
      listLoadingMore=false;listMoreError=false;listMoreAuthError=false;
      const result=document.querySelector('[data-member-results]');
      if(result)result.innerHTML=renderListResults(listRows,listHasMore);
    }catch(error){
      if(version!==listVersion||route?.page!=='member-list')return;
      listLoadingMore=false;
      if(append){
        listMoreError=true;listMoreAuthError=error?.status===401;
        const result=document.querySelector('[data-member-results]');
        if(result)result.innerHTML=renderListResults(listRows,listHasMore);
      }else showListError(error);
    }
  }

  function loadMoreMembers(){
    if(listLoadingMore||!listHasMore||route?.page!=='member-list')return;
    listLoadingMore=true;listMoreError=false;listMoreAuthError=false;
    const result=document.querySelector('[data-member-results]');
    if(result)result.innerHTML=renderListResults(listRows,listHasMore);
    void loadMemberListPage(listVersion,{append:true});
  }

  function scheduleListLoad(delay=160){
    const search=document.querySelector('[data-member-search]');
    if(!search)return;
    query=search.value.trim();
    const version=++listVersion;
    clearTimeout(listTimer);
    listRows=[];listHasMore=false;listLoadingMore=false;listMoreError=false;listMoreAuthError=false;
    const target=document.querySelector('[data-member-results]');
    if(target)target.innerHTML='<p class="member-state-loading" data-member-loading>正在加载会员…</p>';
    listTimer=setTimeout(()=>{void loadMemberListPage(version);},delay);
  }

  function contextMarkup(context){
    const last=context?.lastCompletedSession;
    if(!last)return `<section class="member-recent-empty" data-member-recent-empty><h2>最近训练重点</h2><p>暂无已完成训练。待训练和已取消的课程不会计入训练情况。</p><a class="member-next-session" data-member-next-session href="${nextSessionHref(context)}">为她编下一节 F111</a></section>`;
    const patterns=Array.isArray(context.recentPatterns)?context.recentPatterns:[];
    const actions=Array.isArray(context.recentActions)?context.recentActions:[];
    const muscles=Array.isArray(context.recentPrimaryMuscles)?context.recentPrimaryMuscles:[];
    return `<section class="member-recent-context" data-member-recent-context aria-labelledby="member-recent-title"><div class="member-context-heading"><div><h2 id="member-recent-title">最近训练重点</h2><p>基于最近三次已完成训练</p></div><span class="member-context-date">${dateLabel(last.sessionDate)}</span></div><div class="member-context-last"><span>最近完成</span><strong>${esc(last.sessionTitle||last.templateKey)}</strong></div><div class="member-context-columns"><section><h3>训练模式</h3>${patterns.length?`<ul>${patterns.map(value=>`<li><span>${esc(value.pattern)}</span><b>${value.countLast3} 次</b></li>`).join('')}</ul>`:'<p>暂无模式记录</p>'}</section><section><h3>主要动作</h3>${actions.length?`<ul>${actions.slice(0,4).map(value=>`<li><span>${esc(value.actionNameSnapshot||value.actionId)}</span><b>${value.countLast3} 次</b></li>`).join('')}</ul>`:'<p>暂无动作记录</p>'}</section><section><h3>主要肌群</h3>${muscles.length?`<ul>${muscles.slice(0,4).map(value=>`<li><span>${esc(value.muscle)}</span><b>${value.countLast3} 次</b></li>`).join('')}</ul>`:'<p>暂无肌群记录</p>'}</section></div><a class="member-next-session" data-member-next-session href="${nextSessionHref(context)}">为她编下一节 F111</a></section>`;
  }

  function profileMarkup(member){
    const profile=member.trainingProfile||{};
    const list=value=>Array.isArray(value)&&value.length?value.map(esc).join('、'):'未记录';
    return `<section class="member-profile" data-member-profile aria-labelledby="member-profile-title"><div class="member-section-heading"><div><h2 id="member-profile-title">训练资料</h2><p>为教练编排课程提供参考。</p></div><button type="button" data-member-edit="${esc(member.id)}">编辑资料</button></div><dl><div><dt>训练等级</dt><dd>${esc(member.trainingLevel||'未设置')}</dd></div><div><dt>训练目标</dt><dd>${esc(member.primaryGoal||'未记录')}</dd></div><div><dt>动作限制</dt><dd>${list(profile.movementConstraints)}</dd></div><div><dt>常用器械</dt><dd>${list(profile.preferredEquipment)}</dd></div>${profile.notes?`<div><dt>训练备注</dt><dd>${esc(profile.notes)}</dd></div>`:''}${member.coachNotes?`<div><dt>教练备注</dt><dd>${esc(member.coachNotes)}</dd></div>`:''}</dl></section>`;
  }

  function timelineMarkup(sessions){
    const rows=Array.isArray(sessions)?sessions:[];
    return `<section class="member-timeline" data-member-timeline aria-labelledby="member-timeline-title" aria-busy="${timelineLoading}"><div class="member-section-heading"><div><h2 id="member-timeline-title">训练记录</h2><p>待训练、已完成与已取消的课程都保留在时间线上。</p></div></div>${rows.length?`<ol>${rows.map(session=>`<li data-timeline-session="${esc(session.id)}"><span class="member-timeline-mark ${String(session.status||'').toLowerCase()}" aria-hidden="true"></span><div class="member-timeline-row"><div><span class="member-session-status ${String(session.status||'').toLowerCase()}" data-session-status="${esc(session.status)}">${statusLabel(session.status)}</span><time datetime="${esc(session.sessionDate)}">${dateLabel(session.sessionDate)}</time><h3>${esc(session.sessionTitle||session.templateKey||'训练课程')}</h3><p>${esc(session.templateKey||'课程')}${session.levelSnapshot?` · ${esc(session.levelSnapshot)}`:''}</p></div><button type="button" data-open-session-detail data-session-id="${esc(session.id)}" aria-label="查看 ${esc(session.sessionTitle||session.templateKey||'训练课程')} 课程详情">查看课程</button></div></li>`).join('')}</ol>`:'<p class="member-state-note">还没有课程记录。</p>'}${timelineLoadError?'<p class="member-load-more-error" role="alert">更早的课程记录暂时无法读取，请重试。</p>':''}${timelineHasMore?`<button class="member-load-more" type="button" data-member-load-more ${timelineLoading?'disabled':''}>${timelineLoading?'正在加载…':'加载更早记录'}</button>`:''}</section>`;
  }

  function renderMemberDetail(member,context,sessions){
    const archived=!!member.archivedAt;
    return `<section class="member-center-page member-detail-page" data-member-center-page="detail"><a class="member-back-link" href="#/coach/members">返回会员训练</a><header class="member-detail-heading"><div><h1>${esc(member.displayName)}</h1><p>${archived?'已归档':statusLabel(member.status)}${member.trainingLevel?` · ${esc(member.trainingLevel)}`:''}</p></div><div class="member-detail-actions">${archived?`<button type="button" data-member-restore="${esc(member.id)}">恢复会员</button>`:`<button type="button" data-member-edit="${esc(member.id)}">编辑资料</button><button type="button" class="member-archive-action" data-member-archive="${esc(member.id)}">归档</button>`}</div></header>${contextMarkup(context)}${profileMarkup(member)}${timelineMarkup(sessions)}${formMarkup()}${archiveMarkup()}</section>`;
  }

  function renderDetailShell(){
    return `<section class="member-center-page member-detail-page" data-member-center-page="detail"><a class="member-back-link" href="#/coach/members">返回会员训练</a><div class="member-state-loading" data-member-loading>正在读取会员训练记录…</div>${formMarkup()}${archiveMarkup()}</section>`;
  }

  function loadSessions(memberId){
    return window.V14MemberAPI.listSessions(memberId,{limit:SESSION_PAGE_SIZE,offset:0});
  }

  async function loadDetail(root){
    const version=++detailVersion,memberId=route?.memberId;
    try{
      const [member,context,sessions]=await Promise.all([
        window.V14MemberAPI.getMember(memberId),
        window.V14MemberAPI.getMemberTrainingContext(memberId),
        loadSessions(memberId),
      ]);
      if(version!==detailVersion||route?.page!=='member-detail'||route.memberId!==memberId)return;
      currentMember=member;currentContext=context;currentSessions=sessions;timelineHasMore=sessions.length===SESSION_PAGE_SIZE;timelineLoading=false;timelineLoadError=false;
      root.innerHTML=renderMemberDetail(member,context,sessions);
      bindDialogClose(root);
    }catch(error){
      if(version!==detailVersion)return;
      const loading=root.querySelector('[data-member-loading]');
      if(loading)loading.outerHTML=`<div class="member-state-error" data-member-detail-error role="alert">${error?.status===401?staffRecoveryMarkup():`<p>${error?.status===404?'没有找到这位会员。':'会员训练记录暂时无法读取。'}</p>`}<button type="button" data-member-detail-retry>重试</button></div>`;
    }
  }

  function memberFor(id){return currentMember?.id===id?currentMember:membersById.get(id)||null;}

  async function loadMoreSessions(root){
    if(timelineLoading||!timelineHasMore||route?.page!=='member-detail')return;
    const memberId=route.memberId,version=detailVersion,section=root.querySelector('[data-member-timeline]');
    if(!section)return;
    timelineLoading=true;timelineLoadError=false;
    section.outerHTML=timelineMarkup(currentSessions);
    try{
      const batch=await window.V14MemberAPI.listSessions(memberId,{limit:SESSION_PAGE_SIZE,offset:currentSessions.length});
      if(version!==detailVersion||route?.page!=='member-detail'||route.memberId!==memberId)return;
      currentSessions.push(...batch);timelineHasMore=batch.length===SESSION_PAGE_SIZE;timelineLoading=false;timelineLoadError=false;
      const current=root.querySelector('[data-member-timeline]');
      if(current)current.outerHTML=timelineMarkup(currentSessions);
    }catch(_){
      if(version!==detailVersion||route?.page!=='member-detail'||route.memberId!==memberId)return;
      timelineLoading=false;timelineLoadError=true;
      const current=root.querySelector('[data-member-timeline]');
      if(current)current.outerHTML=timelineMarkup(currentSessions);
    }
  }

  function bindDialogClose(root){
    const formDialog=root.querySelector('[data-member-form-dialog]');
    if(formDialog&&!formDialog.dataset.bound){
      formDialog.dataset.bound='1';
      formDialog.addEventListener('close',()=>{if(formReturnFocus?.isConnected)formReturnFocus.focus();});
      formDialog.addEventListener('click',event=>{if(event.target===formDialog)formDialog.close();});
    }
    const archiveDialog=root.querySelector('[data-member-archive-dialog]');
    if(archiveDialog&&!archiveDialog.dataset.bound){
      archiveDialog.dataset.bound='1';
      archiveDialog.addEventListener('click',event=>{if(event.target===archiveDialog)archiveDialog.close();});
    }
  }

  function openForm(member,trigger,root){
    const dialog=root.querySelector('[data-member-form-dialog]'),form=dialog?.querySelector('[data-member-form]');
    if(!dialog||!form)return;
    formReturnFocus=trigger||document.activeElement;
    form.reset();
    dialog.querySelector('#member-form-title').textContent=member?'编辑训练资料':'新增会员';
    dialog.querySelector('[data-member-form-submit]').textContent=member?'保存修改':'保存资料';
    const profile=member?.trainingProfile||{};
    form.elements.displayName.value=member?.displayName||'';
    form.elements.trainingLevel.value=member?.trainingLevel||'';
    form.elements.primaryGoal.value=member?.primaryGoal||'';
    form.elements.experienceLevel.value=profile.experienceLevel||'';
    form.elements.movementConstraints.value=(profile.movementConstraints||[]).join('\n');
    form.elements.preferredEquipment.value=(profile.preferredEquipment||[]).join('\n');
    form.elements.profileNotes.value=profile.notes||'';
    form.elements.coachNotes.value=member?.coachNotes||'';
    form.dataset.memberId=member?.id||'';
    dialog.querySelector('[data-member-form-error]').hidden=true;
    dialog.showModal();
    form.elements.displayName.focus();
  }

  function splitLines(value){return String(value||'').split(/\r?\n/).map(item=>item.trim()).filter(Boolean);}

  async function saveForm(form,root,rerender){
    const dialog=root.querySelector('[data-member-form-dialog]'),errorNode=dialog.querySelector('[data-member-form-error]'),button=dialog.querySelector('[data-member-form-submit]');
    const movementConstraints=splitLines(form.elements.movementConstraints.value),preferredEquipment=splitLines(form.elements.preferredEquipment.value);
    const invalidList=movementConstraints.length>40||movementConstraints.some(value=>value.length>240)||preferredEquipment.length>80||preferredEquipment.some(value=>value.length>120);
    if(invalidList){errorNode.textContent='动作限制最多 40 项且每项不超过 240 字；常用器械最多 80 项且每项不超过 120 字。';errorNode.hidden=false;return;}
    const payload={
      id:form.dataset.memberId||undefined,
      displayName:form.elements.displayName.value.trim(),
      trainingLevel:form.elements.trainingLevel.value||null,
      primaryGoal:form.elements.primaryGoal.value.trim()||null,
      trainingProfile:{schemaVersion:1,experienceLevel:form.elements.experienceLevel.value||null,movementConstraints,preferredEquipment,notes:form.elements.profileNotes.value.trim()||null},
      coachNotes:form.elements.coachNotes.value.trim()||null,
    };
    button.disabled=true;button.textContent='正在保存…';errorNode.hidden=true;
    try{
      await window.V14MemberAPI.saveMember(payload);
      dialog.close();
      if(route?.page==='member-detail')rerender();else scheduleListLoad(0);
    }catch(error){
      if(error?.status===401)errorNode.innerHTML=`${staffRecoveryMarkup()}<span>验证完成后返回此页，再次保存资料。</span>`;
      else errorNode.textContent=error?.code==='invalid_member'?'会员资料未通过校验，请检查姓名和每项信息的长度。':'保存失败，请检查网络后重试。';
      errorNode.hidden=false;
    }finally{button.disabled=false;button.textContent=form.dataset.memberId?'保存修改':'保存资料';}
  }

  function openArchive(member,root){
    const dialog=root.querySelector('[data-member-archive-dialog]');
    if(!dialog)return;
    archiveTarget=member;
    dialog.querySelector('[data-member-archive-copy]').textContent=`归档 ${member.displayName} 后，她的历史训练记录仍会保留。`;
    dialog.showModal();
  }

  async function archiveMember(root,rerender){
    if(!archiveTarget)return;
    const startedRouteVersion=routeVersion,startedInMemberView=route?.area==='coach'&&['member-list','member-detail'].includes(route.page);
    const dialog=root.querySelector('[data-member-archive-dialog]'),button=dialog.querySelector('[data-member-archive-confirm]');
    button.disabled=true;button.textContent='正在归档…';
    try{
      await window.V14MemberAPI.archiveMember(archiveTarget.id);
      dialog.close();archiveTarget=null;
      if(startedInMemberView&&startedRouteVersion===routeVersion&&route?.area==='coach'&&['member-list','member-detail'].includes(route.page))rerender();
    }catch(error){
      const copy=dialog.querySelector('[data-member-archive-copy]');
      if(error?.status===401)copy.innerHTML=`${staffRecoveryMarkup()}<span>验证后返回此页，再次归档。</span>`;
      else copy.textContent='归档失败，历史记录未变更。请检查网络后重试。';
    }
    finally{button.disabled=false;button.textContent='确认归档';}
  }

  async function restoreMember(id,rerender){
    const startedRouteVersion=routeVersion,startedInMemberView=route?.area==='coach'&&['member-list','member-detail'].includes(route.page);
    try{
      await window.V14MemberAPI.restoreMember(id);
      if(startedInMemberView&&startedRouteVersion===routeVersion&&route?.area==='coach'&&['member-list','member-detail'].includes(route.page))rerender();
    }
    catch(error){
      const target=document.querySelector(`[data-member-restore="${CSS.escape(id)}"]`);
      if(target)target.insertAdjacentHTML('afterend',error?.status===401?`<span class="member-inline-error" role="alert">${staffRecoveryMarkup()}</span>`:'<span class="member-inline-error" role="alert">恢复失败，请重试。</span>');
    }
  }

  function handleClick(event,root,rerender){
    const target=event.target.closest('button,a');
    if(!target)return;
    if(target.matches('[data-member-filter]')){
      filter=target.dataset.memberFilter;
      root.querySelectorAll('[data-member-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button===target)));
      scheduleListLoad(0);return;
    }
    if(target.matches('[data-member-create]')){openForm(null,target,root);return;}
    if(target.matches('[data-member-edit]')){const member=memberFor(target.dataset.memberEdit);if(member)openForm(member,target,root);return;}
    if(target.matches('[data-member-archive]')){const member=memberFor(target.dataset.memberArchive);if(member)openArchive(member,root);return;}
    if(target.matches('[data-member-archive-cancel]')||target.matches('[data-member-form-cancel]')){target.closest('dialog')?.close();return;}
    if(target.matches('[data-member-archive-confirm]')){void archiveMember(root,rerender);return;}
    if(target.matches('[data-member-restore]')){void restoreMember(target.dataset.memberRestore,rerender);return;}
    if(target.matches('[data-member-retry]')){scheduleListLoad(0);return;}
    if(target.matches('[data-member-load-more-members]')){loadMoreMembers();return;}
    if(target.matches('[data-member-detail-retry]')){void loadDetail(root);return;}
    if(target.matches('[data-member-load-more]')){void loadMoreSessions(root);return;}
    if(target.matches('[data-open-session-detail]')){window.V14MemberSessionUI?.open?.(target.dataset.sessionId,target,()=>{if(route?.page==='member-detail')void loadDetail(root);});return;}
  }

  function bind(routeValue,root,rerender){
    route=routeValue;
    if(!root.dataset.memberCenterBound){
      root.dataset.memberCenterBound='1';
      root.addEventListener('click',event=>handleClick(event,root,rerender));
      root.addEventListener('input',event=>{if(event.target.matches('[data-member-search]'))scheduleListLoad();});
      root.addEventListener('submit',event=>{
        const form=event.target.closest('[data-member-form]');
        if(!form)return;
        event.preventDefault();void saveForm(form,root,rerender);
      });
    }
    bindDialogClose(root);
    if(route.page==='member-list')scheduleListLoad(0);
    if(route.page==='member-detail')void loadDetail(root);
  }

  function render(routeValue){
    route=routeValue;
    if(routeValue.page==='member-list')return renderListShell();
    currentMember=null;currentContext=null;currentSessions=[];timelineHasMore=false;timelineLoading=false;timelineLoadError=false;
    return renderDetailShell();
  }

  function routeChanged(nextRoute){
    const next=nextRoute||null;
    const currentRouteKey=route?[route.area,route.page,route.memberId||''].join('|'):'';
    const nextRouteKey=next?[next.area,next.page,next.memberId||''].join('|'):'';
    if(currentRouteKey!==nextRouteKey)routeVersion++;
    const leavingList=route?.page==='member-list'&&nextRoute?.page!=='member-list';
    const leavingDetail=route?.page==='member-detail'
      &&(nextRoute?.page!=='member-detail'||nextRoute.memberId!==route.memberId);
    if(leavingList){listVersion++;clearTimeout(listTimer);listTimer=null;}
    if(leavingDetail)detailVersion++;
    route=next;
  }

  const module={render,bind,routeChanged};
  window.V14CoachModules=window.V14CoachModules||{};
  window.V14CoachModules.MemberCenter=module;
})();
