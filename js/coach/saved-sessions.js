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
    if(record.templateId==='conditioning'){
      const blueprint=D().conditioningBlueprints?.[record.familyId]?.[record.level]?.[record.input?.variantId]||{};
      return `${D().conditioningFamilies?.[record.familyId]?.name||record.familyId} · ${record.level}${record.input?.variantId?` · ${record.input.variantId} 变体`:''}${blueprint.label?`｜${blueprint.label}`:''}`;
    }
    if(record.templateId==='hyrox')return record.input?.sessionType==='BENCHMARK'?'Benchmark '+(record.input?.benchmarkProtocolId||record.familyId):(D().hyroxSessionTypes?.[record.input?.sessionType]?.name||record.familyId);
    return record.familyId;
  }
  function conditioningNeedsMigration(record){
    return record.templateId==='conditioning'
      &&(record.resolverVersion!=='conditioning-v2'||!record.input?.variantId||!record.input?.sessionBlueprintId);
  }
  function dateText(value){
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return value||'—';
    const p=n=>String(n).padStart(2,'0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function notice(route){
    const n=Service()?.getLastRestoreNotice?.(),descriptor=Service()?.descriptorFromRoute?.(route||{});
    if(!n||!descriptor||n.templateId!==descriptor.templateId||n.sessionKey!==descriptor.sessionKey)return '';
    if(n.code==='MIGRATED_EXPLICITLY'||n.code==='REPAIRED_EXPLICITLY'){
      const repaired=n.code==='REPAIRED_EXPLICITLY';
      return `<div class="saved-session-notice warn"><b>${repaired?'已修复并生成多区块版本':'已明确升级为多区块版本'}</b><span>${esc(templateLabel(n.templateId))} · ${esc(n.level||descriptor.level||'')}｜${esc(n.name||'')}</span><small>原保存记录仍保留为备份；${repaired?'已保留可识别的变体与合法动作选择，请确认当前课程。':'本次未按位置映射旧动作，请先确认 A 变体的训练段安排。'}</small></div>`;
    }
    const migrated=n.reasons?.length,context=`${templateLabel(n.templateId)} · ${n.level||descriptor.level||''}`;
    return `<div class="saved-session-notice ${migrated?'warn':'ok'}"><b>${migrated?'已恢复并完成兼容处理':'已恢复保存课程'}</b><span>${esc(context)}｜${esc(n.name||'')}</span>${migrated?`<small>${esc(n.reasons.join(' / '))}${n.droppedSelections?.length?`｜动作回退：${esc(n.droppedSelections.join('、'))}`:''}${n.droppedPrepSelections?.length?`｜PREP 回退：${esc(n.droppedPrepSelections.join('、'))}`:''}</small>`:''}</div>`;
  }
  function card(record){
    const migration=conditioningNeedsMigration(record);
    const restoreAction=migration
      ?`<button type="button" data-saved-migrate="${esc(record.savedId)}">升级为多区块版本</button><small class="saved-session-migration-note">旧版单块记录不会自动映射，原记录会保留为备份。</small>`
      :`<button type="button" data-saved-restore="${esc(record.savedId)}">恢复到 ${esc(templateLabel(record.templateId))} ${esc(record.level)}</button>`;
    return `<article class="saved-session-card" data-saved-session-id="${esc(record.savedId)}">
      <div class="saved-session-card-head"><div><span>${esc(templateLabel(record.templateId))} · ${esc(record.level)}</span><h3>${esc(record.name)}</h3></div><small>${esc(dateText(record.updatedAt||record.createdAt))}</small></div>
      <p>${esc(familyLabel(record))}</p>
      <div class="saved-session-actions">
        ${restoreAction}
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
    return `<section class="section-card saved-session-library"><div class="section-head"><div><h2>已保存课程</h2><p>恢复时会重新走当前 Resolver / PREP / Conflict，不直接注入旧 JSON。保存记录仅存在当前浏览器 Session Storage，不代表云端或后端已保存。</p></div><span class="time-badge">LOCAL · 浏览器</span></div><div data-saved-session-status></div>${listHtml()}</section>`;
  }
  function controls(route){
    const descriptor=Service()?.descriptorFromRoute?.(route);
    if(!descriptor)return librarySection();
    const defaultName=Service().defaultName(descriptor);
    return `<section class="section-card saved-session-controls"><div class="section-head"><div><h2>保存 / 恢复当前课程</h2><p>只保存当前模板输入、手动动作与 PREP 选择；训练量、Conflict、Anatomy、Copy 等恢复后重新计算。记录仅存在当前浏览器 Session Storage，不代表云端或后端已保存。</p></div><span class="time-badge">LOCAL · 浏览器</span></div>
      ${notice(route)}
      <div class="saved-session-save-row"><label><span>课程名称</span><input type="text" value="${esc(defaultName)}" data-save-session-name></label><button type="button" data-save-current-session>保存当前 Session</button></div>
      <div data-saved-session-status></div>
      ${listHtml()}
      </section>`;
  }
  function compactControls(route){
    const descriptor=Service()?.descriptorFromRoute?.(route);
    if(!descriptor)return '';
    const defaultName=Service().defaultName(descriptor),latest=(Service()?.list?.()||[])[0];
    const restore=latest
      ?`<button type="button" data-saved-restore="${esc(latest.savedId)}">恢复已保存课程</button>`
      :'<button type="button" disabled>恢复已保存课程</button>';
    return `<div class="f111-inline-save-controls saved-session-controls"><input type="hidden" value="${esc(defaultName)}" data-save-session-name><div class="f111-inline-save-row"><button type="button" data-save-current-session>保存当前课程</button>${restore}</div><div data-saved-session-status></div><details class="f111-inline-saved-list"><summary>已保存课程</summary>${listHtml()}</details></div>`;
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
      let result;
      try{result=Service().restore(button.dataset.savedRestore);}
      catch(error){setStatus(root,error?.message||'恢复失败，原保存记录未删除。','error');return;}
      if(!result.ok){setStatus(root,(result.message||'恢复失败')+'；原保存记录仍保留。','error');return;}
      if(window.location?.hash===result.hash){rerender();return;}
      if(window.V14Router?.navigate)window.V14Router.navigate(result.hash);else window.location.hash=result.hash;
    }));
    root.querySelectorAll('[data-saved-migrate]').forEach(button=>button.addEventListener('click',()=>{
      let result;
      try{result=Service().migrate(button.dataset.savedMigrate);}
      catch(error){setStatus(root,error?.message||'升级失败，原保存记录未修改。','error');return;}
      if(!result.ok){setStatus(root,(result.message||'升级失败')+'；原保存记录仍保留。','error');return;}
      if(window.location?.hash===result.hash){rerender();return;}
      if(window.V14Router?.navigate)window.V14Router.navigate(result.hash);else window.location.hash=result.hash;
    }));
    root.querySelectorAll('[data-saved-rename]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.savedRename,input=root.querySelector(`[data-saved-rename-input="${CSS.escape(id)}"]`);
      try{Service().rename(id,input?.value||'');rerender();}catch(error){setStatus(root,error?.message||'重命名失败','error');}
    }));
    root.querySelectorAll('[data-saved-delete]').forEach(button=>button.addEventListener('click',()=>{
      const id=button.dataset.savedDelete,record=Service().list().find(item=>item.savedId===id);
      if(!record){setStatus(root,'删除失败：保存记录不存在。','error');return;}
      const context=`${templateLabel(record.templateId)} · ${record.level}`;
      if(typeof window.confirm==='function'&&!window.confirm(`确认删除「${record.name}」？\n${context}｜仅删除当前浏览器 LOCAL 保存记录。`)){
        setStatus(root,'已取消删除，保存记录保持不变。');
        return;
      }
      try{
        const removed=Service().remove(id);
        if(!removed){setStatus(root,'删除失败，原保存记录仍保留。','error');return;}
        rerender();
      }catch(error){setStatus(root,error?.message||'删除失败，原保存记录仍保留。','error');}
    }));
  }

  M.SavedSessionsUI={controls,compactControls,librarySection,bind};
})();
