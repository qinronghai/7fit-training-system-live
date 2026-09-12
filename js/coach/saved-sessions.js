(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc}=C;
  let lastNotice=null;

  const REASON_LABELS=Object.freeze({
    INPUT_MIGRATED:'已按当前 F111 Composer 输入规则补全旧组合参数',
    STALE_PROTOCOL:'原 Protocol 已不合法，已切换到当前合法默认 Protocol',
    RESOLVER_VERSION_MIGRATED:'已使用当前 Resolver 重新解析',
    STALE_SELECTION:'部分正式训练选择已失效，已恢复当前合法推荐',
    STALE_PREP_SELECTION:'部分 PREP 选择已失效，已恢复当前合法推荐',
  });

  function service(){
    const value=window.V15SavedSessions;
    if(!value)throw new Error('SavedSession service is unavailable');
    return value;
  }

  function templateName(templateId){
    return window.V14_DATA?.templateRegistry?.[templateId]?.name||templateId||'未知模板';
  }

  function timeText(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return String(value||'—');
    const pad=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function reasonText(result){
    const labels=(result?.reasons||[]).map(code=>REASON_LABELS[code]||code);
    const dropped=[];
    if(result?.droppedSelections?.length)dropped.push(`训练选择：${result.droppedSelections.join(' / ')}`);
    if(result?.droppedPrepSelections?.length)dropped.push(`PREP：${result.droppedPrepSelections.join(' / ')}`);
    return [...labels,...dropped].join('；');
  }

  function noticeHtml(){
    if(!lastNotice)return '';
    return `<div class="saved-session-notice ${lastNotice.type==='error'?'error':'success'}" role="status"><b>${esc(lastNotice.title)}</b><span>${esc(lastNotice.text)}</span></div>`;
  }

  function recordCard(record){
    const unsupported=record.schemaVersion!==window.V15State?.getSchemaVersion?.();
    return `<article class="saved-session-card" data-saved-session="${esc(record.id)}">
      <div class="saved-session-card-main">
        <div class="saved-session-name-row">
          <input type="text" value="${esc(record.name||'未命名 Session')}" data-saved-rename-input="${esc(record.id)}" aria-label="保存名称"/>
          ${unsupported?'<span class="saved-session-warning">旧 Schema</span>':''}
        </div>
        <div class="saved-session-meta">
          <span>${esc(templateName(record.templateId))}</span>
          <span>${esc(record.familyId)}</span>
          <span>${esc(record.level)}</span>
          <span>${esc(timeText(record.updatedAt))}</span>
        </div>
      </div>
      <div class="saved-session-card-actions">
        <button type="button" data-saved-restore="${esc(record.id)}">恢复</button>
        <button type="button" data-saved-rename="${esc(record.id)}">重命名</button>
        <button type="button" data-saved-delete="${esc(record.id)}">删除</button>
      </div>
    </article>`;
  }

  function render({templateId,sessionKey,defaultName=''}={}){
    if(!templateId||!sessionKey)return '';
    const records=service().list();
    return `<section class="section-card saved-sessions-section" data-saved-current-template="${esc(templateId)}" data-saved-current-session="${esc(sessionKey)}">
      <div class="section-head"><div><h2>保存的 Session</h2><p>只保存 Family / Level / Input / 手动训练选择 / PREP 选择；恢复时始终使用当前 Resolver、Conflict、Anatomy 与 Copy 重新计算。</p></div><span class="time-badge">LOCAL</span></div>
      ${noticeHtml()}
      <div class="saved-session-create">
        <label><span>保存名称</span><input type="text" data-saved-name value="${esc(defaultName||'')}" placeholder="例如：梦影｜臀腿 L3"/></label>
        <button type="button" data-save-current-session>保存当前 Session</button>
      </div>
      <div class="saved-session-list">
        ${records.length?records.map(recordCard).join(''):'<div class="saved-session-empty">还没有保存的 Session。</div>'}
      </div>
    </section>`;
  }

  function setNotice(type,title,text){
    lastNotice={type,title,text};
  }

  function navigate(hash,rerender){
    const current=window.location?.hash||'';
    if(hash&&hash!==current){
      if(window.V14Router?.navigate)window.V14Router.navigate(hash);
      else window.location.hash=hash;
      return;
    }
    if(typeof rerender==='function')rerender();
  }

  function bind(root,{rerender}={}){
    const section=root?.querySelector?.('.saved-sessions-section');
    if(!section)return;

    section.querySelector('[data-save-current-session]')?.addEventListener('click',()=>{
      try{
        const templateId=section.dataset.savedCurrentTemplate,sessionKey=section.dataset.savedCurrentSession;
        const name=section.querySelector('[data-saved-name]')?.value||'';
        const record=service().saveCurrent({templateId,sessionKey,name});
        setNotice('success','已保存',`${record.name} 已保存；恢复时会重新经过当前 Resolver。`);
        if(typeof rerender==='function')rerender();
      }catch(error){
        setNotice('error','保存失败',error?.message||String(error));
        if(typeof rerender==='function')rerender();
      }
    });

    section.querySelectorAll('[data-saved-restore]').forEach(button=>button.addEventListener('click',()=>{
      try{
        const result=service().restore(button.dataset.savedRestore);
        const migration=reasonText(result);
        setNotice('success',result.migrated?'已恢复并迁移':'已恢复',
          migration||'已使用当前 Resolver 恢复训练与 PREP 选择。');
        navigate(result.routeHash,rerender);
      }catch(error){
        setNotice('error','恢复失败',error?.message||String(error));
        if(typeof rerender==='function')rerender();
      }
    }));

    section.querySelectorAll('[data-saved-rename]').forEach(button=>button.addEventListener('click',()=>{
      const savedId=button.dataset.savedRename,input=section.querySelector(`[data-saved-rename-input="${savedId}"]`);
      try{
        service().rename(savedId,input?.value||'');
        setNotice('success','已重命名','保存记录名称已更新。');
      }catch(error){
        setNotice('error','重命名失败',error?.message||String(error));
      }
      if(typeof rerender==='function')rerender();
    }));

    section.querySelectorAll('[data-saved-delete]').forEach(button=>button.addEventListener('click',()=>{
      service().remove(button.dataset.savedDelete);
      setNotice('success','已删除','保存记录已删除。');
      if(typeof rerender==='function')rerender();
    }));
  }

  M.SavedSessions={render,bind,setNotice,reasonText};
})();
