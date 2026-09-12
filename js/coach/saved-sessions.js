(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;
  const Service=()=>window.V15SavedSessions;

  function templateLabel(id){return D().templateRegistry?.[id]?.shortName||id;}
  function familyLabel(record){
    if(record.templateId==='f111'){
      if(record.input?.mode==='preset')return D().recipes?.[record.familyId]?.name||record.familyId;
      try{
        const r=window.V14Composer.resolve(record.input||{});
        return [r.lower?.name,r.upper?.name].filter(Boolean).join(' + ')||record.familyId;
      }catch(_){return record.familyId;}
    }
    if(record.templateId==='body')return D().bodyFamilies?.[record.familyId]?.name||record.familyId;
    if(record.templateId==='conditioning')return D().conditioningFamilies?.[record.familyId]?.name||record.familyId;
    return record.familyId;
  }
  function dateText(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return value||'—';
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function notice(){
    const n=Service()?.getLastRestoreNotice?.();
    if(!n)return '';
    const migrated=n.reasons?.length;
    return `<div class="saved-session-notice ${migrated?'warn':'ok'}"><b>${migrated?'已恢复并完成兼容处理':'已恢复保存课程'}</b><span>${esc(n.name||'')}</span>${migrated?`<small>${esc(n.reasons.join(' / '))}${n.droppedSelections?.length?`｜动作回退：${esc(n.droppedSelections.join('、'))}`:''}${n.droppedPrepSelections?.length?`｜PREP 回退：${esc(n.droppedPrepSelections.join('、'))}`:''}</small>`:''}</div>`;
  }
  function card(record){
    return `<article class="saved-session-card" data-saved-session-id="${esc(record.savedId)}">
      <div class="saved-session-card-head"><div><span>${esc(templateLabel(record.templateId))} · ${esc(record.level)}</span><h3>${esc(record.name)}</h3></div><small>${esc(dateText(record.updatedAt||record.createdAt))}</small></div>
      <p>${esc(familyLabel(record))}</p>
      <div class="saved-session-actions">
        <button type="button" data-saved-restore="${esc(record.savedId)}">恢复</button>
        <label><span>名称</span><input type="text" value="${esc(record.name)}" data-saved-rename-input="${esc(record.savedId)}"></label>
        <button type="button" data-saved-rename="${esc(record.savedId)}">重命名</button>
        <button class="danger" type="button" data-saved-delete="${esc(record.savedId)}">删除</button>
      </div>
    </article>`;
  }
  function listHtml(){
    const items=Service()?.list?.()||[];
    return items.length
      ?`<div class="saved-session-list">${items.map(card).join('')}</div>`
      :'<div class="saved-session-empty">还没有保存的课程。</div>';
  }
  function librarySection(){
    return `<section class="section-card saved-session-library"><div class="section-head"><div><h2>已保存课程</h2><p>恢复时会重新走当前 Resolver / PREP / Conflict，不直接注入旧 JSON。</p></div><span class="time-badge">SAVE / RESTORE</span></div>${notice()}<div data-saved-session-status></div>${listHtml()}</section>`;
  }
  function controls(route){
    const descriptor=Service()?.descriptorFromRoute?.(route);
    if(!descriptor)return librarySection();
    const defaultName=Service().defaultName(descriptor);
    return `<section class="section-card saved-session-controls"><div class="section-head"><div><h2>保存 / 恢复当前课程</h2><p>只保存当前模板输入、手动动作与 PREP 选择；训练量、Conflict、Anatomy、Copy 等恢复后重新计算。</p></div><span class="time-badge">LOCAL</span></div>
      ${notice()}
      <div class="saved-session-save-row"><label><span>课程名称</span><input type="text" value="${esc(defaultName)}" data-save-session-name></label><button type="button" data-save-current-session>保存当前 Session</button></div>
      <div data-saved-session-status></div>
      ${listHtml()}
    </section>`;
  }
  function setStatus(root,text,kind=''){
    const el=root.querySelector('[data-saved-session-status]');
    if(!el)return;
    el.className=`saved-session-status ${kind}`.trim();
    el.textContent=text||'';
  }
  function bind(route,root,rerender){
    if(!root||!Service())return;
    root.querySelector('[data-save-current-session]')?.addEventListener('click',()=>{
      try{
        const name=root.querySelector('[data-save-session-name]')?.value||'';
        Service().saveRoute(route,name);
        setStatus(root,'已保存当前课程。','success');
        rerender();
      }catch(error){setStatus(root,error?.message||'保存失败','error');}
    });
    root.querySelectorAll('[data-saved-restore]').forEach(button=>button.addEventListener('click',()=>{
      const result=Service().restore(button.dataset.savedRestore);
      if(!result.ok){setStatus(root,result.message||'恢复失败','error');return;}
      if(window.location?.hash===result.hash){rerender();return;}
      if(window.V14Router?.navigate)window.V14Router.navigate(result.hash);else window.location.hash=result.hash;
    }));
    root.querySelectorAll('[data-saved-rename]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.savedRename,input=root.querySelector(`[data-saved-rename-input="${CSS.escape(id)}"]`);
      try{Service().rename(id,input?.value||'');rerender();}catch(error){setStatus(root,error?.message||'重命名失败','error');}
    }));
    root.querySelectorAll('[data-saved-delete]').forEach(button=>button.addEventListener('click',()=>{
      Service().remove(button.dataset.savedDelete);
      rerender();
    }));
  }

  M.SavedSessionsUI={controls,librarySection,bind};
})();
