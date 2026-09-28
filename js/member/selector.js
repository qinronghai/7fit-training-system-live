(function(){
  'use strict';

  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  let dialog=null,current=null,members=[],previousFocus=null,busy=false,excludedMemberId='',selectionVersion=0,memberSearchVersion=0,memberSearchTimer=null,directoryLoading=false;

  function buttonMarkup(){
    return '<button class="f111-save-member-trigger" type="button" data-save-member-session>保存到会员</button>';
  }

  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='member-save-dialog';
    dialog.setAttribute('data-member-save-dialog','');
    dialog.setAttribute('aria-labelledby','member-save-title');
    dialog.innerHTML=`
      <form class="member-save-panel" method="dialog">
        <header class="member-save-head"><div><h2 id="member-save-title">保存训练课到会员</h2><p>选择会员后，会将课程计划保存为一节待训练课程。</p></div><button type="button" class="member-save-close" data-member-save-close aria-label="关闭">×</button></header>
        <div class="member-save-body">
          <label class="member-save-search"><span>搜索会员</span><input type="search" data-member-save-search placeholder="输入会员姓名" autocomplete="off"></label>
          <label class="member-save-member"><span>选择会员</span><select data-member-save-select><option value="">选择会员</option></select></label>
          <div class="member-save-status" data-member-save-status role="status" aria-live="polite"></div>
          <p class="member-save-auth-note" data-member-save-auth hidden>教练登录已失效。请在新标签页完成馆主管理 PIN 验证后再试。 <a href="assets/real-results/index.html?admin=1" target="_blank" rel="noopener">打开教练验证</a></p>
        </div>
        <footer class="member-save-actions"><button type="button" data-member-save-cancel>取消</button><button type="button" class="primary" data-member-save-submit disabled>保存训练课</button><button type="button" data-member-save-new-intent hidden>另存给其他会员</button></footer>
      </form>`;
    document.body.appendChild(dialog);
    dialog.querySelector('[data-member-save-close]').addEventListener('click',close);
    dialog.querySelector('[data-member-save-cancel]').addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{if(event.target===dialog&&!busy)close();});
    dialog.querySelector('[data-member-save-select]').addEventListener('change',()=>{
      if(current){current.intent=null;current.selectedIntent=null;current.allowNewAfterPendingIntentKey=null;current.pendingCrossDateIntent=null;}
      void refreshSelectionState();
    });
    dialog.querySelector('[data-member-save-search]').addEventListener('input',scheduleDirectorySearch);
    dialog.querySelector('[data-member-save-new-intent]').addEventListener('click',()=>{
      const existingIntent=current?.selectedIntent||current?.intent;
      if(existingIntent?.status==='PENDING'&&existingIntent.sessionDate!==current.sessionDate){
        current.pendingCrossDateIntent=existingIntent;
        current.allowNewAfterPendingIntentKey=existingIntent.key;
        current.intent=null;
        current.selectedIntent=null;
        dialog.querySelector('[data-member-save-new-intent]').hidden=true;
        setStatus(`上次 ${existingIntent.sessionDate} 的保存结果仍未确认；若它已保存，另存会多出一节训练记录。点击“保存新训练课”继续。`,'warn');
        void refreshSelectionState();
        return;
      }
      excludedMemberId=current?.intent?.memberId||'';
      current.intent=null;
      current.selectedIntent=null;
      dialog.querySelector('[data-member-save-select]').value='';
      dialog.querySelector('[data-member-save-new-intent]').hidden=true;
      setStatus(excludedMemberId?'请选择另一位会员，重新开始保存。':'请选择会员开始新的保存。');
      refreshSelectionState();
      dialog.querySelector('[data-member-save-select]').focus();
    });
    dialog.querySelector('[data-member-save-submit]').addEventListener('click',submit);
    dialog.addEventListener('close',()=>{if(previousFocus?.isConnected)previousFocus.focus();});
    return dialog;
  }

  function setStatus(message,kind=''){
    const node=dialog?.querySelector('[data-member-save-status]');
    if(!node)return;
    node.className=`member-save-status ${kind}`.trim();
    node.textContent=message||'';
  }

  function renderOptions({refresh=true}={}){
    if(!dialog)return;
    const select=dialog.querySelector('[data-member-save-select]');
    const selected=select.value;
    const active=members.filter(member=>member.status==='ACTIVE'&&!member.archivedAt&&member.id!==excludedMemberId);
    select.innerHTML='<option value="">选择会员</option>'+active.map(member=>`<option value="${esc(member.id)}">${esc(member.displayName)}</option>`).join('');
    if(active.some(member=>member.id===selected))select.value=selected;
    if(!active.length&&!busy)setStatus(excludedMemberId?'没有其他可选的有效会员。':'没有找到有效会员。','info');
    if(refresh)void refreshSelectionState();
  }

  async function restoreIntentSelection(version){
    const intent=current?.intent,select=dialog?.querySelector('[data-member-save-select]');
    if(!select||version!==memberSearchVersion||directoryLoading)return;
    if(current.memberId){
      const selectionAtStart=selectionVersion,searchInput=dialog.querySelector('[data-member-save-search]'),searchAtStart=searchInput?.value.trim()||'';
      const routedMemberId=current.memberId;
      let member=members.find(value=>value.id===current.memberId);
      if(!member){
        try{member=await window.V14MemberAPI.getMember(current.memberId);}
        catch(error){if(version===memberSearchVersion&&error?.status===401)showError(error);return;}
        if(version!==memberSearchVersion||selectionAtStart!==selectionVersion||!current||current.memberId!==routedMemberId||dialog?.querySelector('[data-member-save-select]')!==select)return;
        if(member&&searchAtStart&&!String(member.displayName||'').toLocaleLowerCase().includes(searchAtStart.toLocaleLowerCase()))return;
        if(member&&member.status==='ACTIVE'&&!member.archivedAt){
          members=[...members,member].sort((left,right)=>String(left.displayName||'').localeCompare(String(right.displayName||''),'zh-Hans-CN'));
          renderOptions({refresh:false});
        }
      }
      if(version!==memberSearchVersion||selectionAtStart!==selectionVersion||!current||current.memberId!==routedMemberId||select.value&&select.value!==routedMemberId)return;
      if(!member||member.status!=='ACTIVE'||member.archivedAt){
        setStatus('当前会员已停用或归档，请从有效会员入口开始新课程。','error');
        return;
      }
      select.value=member.id;
      await refreshSelectionState();
      return;
    }
    if(!intent)return;
    if(members.some(member=>member.id===intent.memberId)){
      select.value=intent.memberId;
      await refreshSelectionState();
      return;
    }
    if(intent.status==='SAVED'){
      dialog.querySelector('[data-member-save-submit]').hidden=true;
      dialog.querySelector('[data-member-save-new-intent]').hidden=false;
      setStatus('这节课已保存。选择“另存给其他会员”可以启动新的保存请求。','success');
      return;
    }
    if(intent.status!=='PENDING'||!intent.memberId)return;
    const query=dialog.querySelector('[data-member-save-search]').value.trim().toLocaleLowerCase();
    try{
      const member=await window.V14MemberAPI.getMember(intent.memberId);
      if(version!==memberSearchVersion||!current||current.intent?.memberId!==intent.memberId)return;
      if(!member||member.status!=='ACTIVE'||member.archivedAt|| (query&&!String(member.displayName||'').toLocaleLowerCase().includes(query)))return;
      members=[...members,member].sort((left,right)=>String(left.displayName||'').localeCompare(String(right.displayName||''),'zh-Hans-CN'));
      renderOptions({refresh:false});
      select.value=member.id;
      await refreshSelectionState();
    }catch(_){/* the member can still be found by directory search */}
  }

  function scheduleDirectorySearch(delay=180){
    if(!dialog||!current)return;
    current.allowNewAfterPendingIntentKey=null;
    current.pendingCrossDateIntent=null;
    const query=dialog.querySelector('[data-member-save-search]').value.trim();
    const version=++memberSearchVersion;
    clearTimeout(memberSearchTimer);
    members=[];
    current.selectedIntent=null;
    const select=dialog.querySelector('[data-member-save-select]');
    directoryLoading=true;
    select.disabled=true;select.innerHTML=`<option value="">${query?'正在搜索…':'正在加载会员中…'}</option>`;
    dialog.querySelector('[data-member-save-submit]').disabled=true;
    setStatus(query?`正在搜索“${query}”…`:'正在加载有效会员…','info');
    memberSearchTimer=setTimeout(async()=>{
      try{
        const result=await window.V14MemberAPI.listMembers({search:query,limit:100});
        if(version!==memberSearchVersion||!current||!dialog?.open)return;
        directoryLoading=false;
        members=Array.isArray(result)?result:[];
        select.disabled=false;
        renderOptions();
        await restoreIntentSelection(version);
      }catch(error){
        if(version!==memberSearchVersion||!current||!dialog?.open)return;
        directoryLoading=false;
        members=[];select.disabled=false;select.innerHTML='<option value="">无法加载会员</option>';
        showError(error);dialog.querySelector('[data-member-save-submit]').disabled=true;
      }
    },delay);
  }

  function loadDirectoryImmediately(){
    if(!dialog||!current)return;
    const search=dialog.querySelector('[data-member-save-search]');
    search.value='';
    scheduleDirectorySearch(0);
  }

  async function refreshSelectionState(){
    if(!current||!dialog)return;
    const version=++selectionVersion;
    const select=dialog.querySelector('[data-member-save-select]'),submitButton=dialog.querySelector('[data-member-save-submit]'),newIntentButton=dialog.querySelector('[data-member-save-new-intent]'),authNote=dialog.querySelector('[data-member-save-auth]');
    const selectedMember=members.find(member=>member.id===select.value);
    submitButton.disabled=busy||!selectedMember;
    authNote.hidden=true;
    if(!selectedMember){
      current.selectedIntent=null;
      if(current.intent?.status==='SAVED'){
        newIntentButton.hidden=false;submitButton.hidden=true;
        const savedMember=members.find(member=>member.id===current.intent.memberId);
        select.value=savedMember?.id||'';
        setStatus(`已保存到${savedMember?.displayName?` ${savedMember.displayName}`:''} · PLANNED`,'success');
        submitButton.disabled=true;
        return;
      }
      newIntentButton.hidden=true;submitButton.hidden=false;submitButton.textContent=current.intent?'重试保存':'保存训练课';
      return;
    }
    submitButton.hidden=false;newIntentButton.hidden=true;
    if(current.allowNewAfterPendingIntentKey){
      submitButton.disabled=busy;submitButton.textContent='保存新训练课';
      const oldDate=current.pendingCrossDateIntent?.sessionDate||'之前日期';
      setStatus(`将新建 ${current.sessionDate} 的训练课；${oldDate} 的保存结果仍未确认。如果当时已保存，会员记录中会出现两节课程。`,'warn');
      return;
    }
    try{
      const intent=await window.V14MemberSnapshots.findIntentForResolvedSession(current.resolvedSession,{memberId:selectedMember.id,sessionDate:current.sessionDate,plannedItems:current.plannedItems,sessionDetails:current.sessionDetails});
      if(version!==selectionVersion||!current||select.value!==selectedMember.id)return;
      current.selectedIntent=intent;
      if(intent?.status==='SAVED'){
        submitButton.disabled=true;submitButton.hidden=true;newIntentButton.hidden=false;
        newIntentButton.textContent='另存给其他会员';
        setStatus(`已保存到 ${selectedMember.displayName} · PLANNED`,'success');
      }else if(intent?.status==='PENDING'){
        submitButton.disabled=busy;submitButton.textContent='重试保存';
        if(intent.sessionDate!==current.sessionDate){
          newIntentButton.hidden=false;newIntentButton.textContent='另建今天的课程';
          setStatus(`上次 ${intent.sessionDate} 的提交结果未确认。重试会复用原训练课编号；若今天需要新课程，可明确另建一节。`,'warn');
        }else{
          newIntentButton.hidden=true;
          setStatus('上次提交结果未确认。重试会复用同一训练课编号，不会重复创建。','warn');
        }
      }else{
        submitButton.disabled=busy;submitButton.textContent='保存训练课';
        setStatus('确认会员后保存；课程会先进入“待训练”。','info');
      }
    }catch(_){if(version===selectionVersion){submitButton.disabled=true;setStatus('课程信息暂不可用，请关闭窗口后重试。','error');}}
  }

  function showError(error){
    const code=error?.code||'';
    if(error?.status===401||code==='staff_session_required'||code==='unauthorized'){
      dialog.querySelector('[data-member-save-auth]').hidden=false;
      setStatus('需要有效的教练登录会话才能读取会员并保存训练课。','error');
      return;
    }
    if(code==='network_error'||error?.status===0){setStatus('暂时无法连接会员服务。重试会继续使用同一保存请求。','error');return;}
    if(error?.status===409){setStatus('这节课的保存请求已发生冲突。请关闭窗口并刷新后确认会员训练记录。','error');return;}
    setStatus('保存失败，当前课程仍保留。检查网络后可以重试。','error');
  }

  async function submit(){
    if(busy||!current)return;
    const memberId=dialog.querySelector('[data-member-save-select]').value;
    if(!memberId)return;
    busy=true;
    const button=dialog.querySelector('[data-member-save-submit]');button.disabled=true;button.textContent='正在保存…';
    dialog.querySelectorAll('[data-member-save-close],[data-member-save-cancel],[data-member-save-select],[data-member-save-search],[data-member-save-new-intent]').forEach(control=>{control.disabled=true;});
    setStatus('正在保存到会员训练记录…','info');
    try{
      const intent=current.selectedIntent||await window.V14MemberSnapshots.prepareIntent(current.resolvedSession,{memberId,sessionDate:current.sessionDate,allowNewAfterPendingIntentKey:current.allowNewAfterPendingIntentKey,plannedItems:current.plannedItems,sessionDetails:current.sessionDetails});
      current.intent=intent;
      current.selectedIntent=intent;
      current.allowNewAfterPendingIntentKey=null;
      current.pendingCrossDateIntent=null;
      const result=await window.V14MemberSnapshots.send(intent);
      current.intent={...intent,status:'SAVED',savedSessionId:result.sessionId||intent.snapshot.session.id,revision:result.revision||1};
      await refreshSelectionState();
      if(current.intent.status==='SAVED')setStatus(`已保存到 ${members.find(member=>member.id===memberId)?.displayName||'会员'} · PLANNED`,'success');
    }catch(error){
      current.intent=current.selectedIntent||current.intent;
      showError(error);
      const submitButton=dialog.querySelector('[data-member-save-submit]');submitButton.hidden=false;submitButton.textContent=current.intent?.status==='PENDING'?'重试保存':'保存训练课';
    }finally{
      busy=false;
      dialog.querySelectorAll('[data-member-save-close],[data-member-save-cancel],[data-member-save-select],[data-member-save-search],[data-member-save-new-intent]').forEach(control=>{control.disabled=false;});
      const submitButton=dialog.querySelector('[data-member-save-submit]');
      if(!submitButton.hidden)submitButton.disabled=!dialog.querySelector('[data-member-save-select]').value;
    }
  }

  function close(){if(busy)return;selectionVersion++;memberSearchVersion++;clearTimeout(memberSearchTimer);directoryLoading=false;if(dialog?.open)dialog.close();current=null;excludedMemberId='';}

  async function open(trigger,resolvedSession,memberId=null,options={}){
    selectionVersion++;previousFocus=trigger||document.activeElement;excludedMemberId=typeof options?.excludeMemberId==='string'?options.excludeMemberId:'';busy=false;
    directoryLoading=false;
    current={resolvedSession,memberId:typeof memberId==='string'&&memberId?memberId:null,sessionDate:window.V14MemberSnapshots.localDate(),intent:null,selectedIntent:null,plannedItems:Array.isArray(options?.plannedItems)?options.plannedItems:null,sessionDetails:options?.sessionDetails&&typeof options.sessionDetails==='object'?options.sessionDetails:null};
    const opening=current;
    const root=ensureDialog();root.querySelector('[data-member-save-search]').value='';root.querySelector('[data-member-save-select]').innerHTML='<option value="">加载会员中…</option>';
    root.querySelector('[data-member-save-submit]').hidden=false;root.querySelector('[data-member-save-new-intent]').hidden=true;
    setStatus('正在加载有效会员…','info');
    if(!root.open)root.showModal();
    loadDirectoryImmediately();
    if(options?.deferIntentLookup===true)return;
    try{
      const intent=await window.V14MemberSnapshots.findIntentForResolvedSession(resolvedSession,{memberId:current.memberId||undefined,sessionDate:current.sessionDate,plannedItems:current.plannedItems,sessionDetails:current.sessionDetails});
      if(current!==opening)return;
      current.intent=intent;
      await restoreIntentSelection(memberSearchVersion);
    }catch(error){showError(error);}
  }

  function bind(root,getResolvedSession,getMemberId,getSessionDetails){
    if(!root)return;
    root.querySelectorAll('[data-save-member-session]').forEach(button=>button.addEventListener('click',()=>{
      try{void open(button,getResolvedSession(),getMemberId?.()||null,{sessionDetails:getSessionDetails?.()||null});}
      catch(_){button.focus();}
    }));
  }

  const selector={buttonMarkup,bind,open,close};
  window.V14MemberSelector=selector;
  window.V14CoachModules=window.V14CoachModules||{};
  window.V14CoachModules.MemberSelector=selector;
})();
