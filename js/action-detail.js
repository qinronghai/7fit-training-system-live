(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const OG=()=>window.V14_OPENGYM||{};
  let lastFocusedElement=null;
  function splitIds(v){return String(v||'').split(/[、,，\s]+/).map(x=>x.trim()).filter(x=>x&&x!=='—');}
  function fact(label,value){
    const text=String(value??'').trim();
    if(!text||text==='—'||text==='未标'||text==='待映射'||text==='待教练确认')return '';
    return `<div><small>${esc(label)}</small><b>${esc(text)}</b></div>`;
  }
  function closeButton(){return '<button type="button" data-close-drawer aria-label="关闭动作详情">×</button>';}
  function facts(items){return items.map(([label,value])=>fact(label,value)).join('');}
  function actionLinks(ids){const data=window.V14_DATA;return ids.length?ids.map(id=>`<a href="#/library?focus=${encodeURIComponent(id)}">${esc(data.actions[id]?.name||id)}</a>`).join(''):'<span class="empty-inline">—</span>';}
  function listText(items){return Array.isArray(items)&&items.length?items.join(' · '):'—';}
  function copyActionControl(id,a,f){
    const api=window.V14ModuleCopy;if(!api)return '';
    const rec=window.V14Anatomy?.get(id)||{};
    const key=`action-${id}`;
    const tier=api.tierForAction?.(id)||'';
    const grade=!tier?(a.supportGrade||a.coreGrade||a.tier||''):'';
    api.register(key,'action',{
      name:a.name||id,tier,grade,
      prescription:api.prescriptionForAction?.(id)||'',
      primary:rec.primary||[],secondary:rec.secondary||[],stabilizers:rec.stabilizers||[],
      goal:f?.['训练目标']||f?.['训练目的']||'',cue:f?.['教练口令']||''
    });
    return api.button(key,'复制本模块');
  }
  function anatomyHtml(id,systemMode){
    const rec=window.V14Anatomy?.get(id);
    if(!rec)return `<div class="drawer-section anatomy-section"><h3>肌群解剖</h3><p class="anatomy-missing">解剖数据待补齐</p></div>`;
    const labels=window.V14Anatomy.labels(id);
    const role=rec.roleType||'strength';
    let primary=rec.primary||[],secondary=rec.secondary||[],third=rec.stabilizers||[];
    let jointLabel='主要关节',actionLabel='动作功能';
    if(role==='foam_roll'){
      primary=rec.tissueTargets?.length?rec.tissueTargets:rec.primary;
      third=rec.avoidRegions||[];
      jointLabel='相关关节';actionLabel='松解目标';
    }else if(role==='stretch'){
      primary=rec.tissueTargets?.length?rec.tissueTargets:rec.primary;
      third=rec.avoidRegions||[];
      labels[2]='安全边界';
      jointLabel='目标关节';actionLabel='伸展方向';
    }else if(role==='mobility'){
      jointLabel='主要关节';actionLabel='活动方向';
    }else if(role==='activation'){
      jointLabel='主要关节';actionLabel='激活动作功能';
    }else if(role==='support_core'){
      jointLabel='主要关节';actionLabel='核心任务';
    }else if(role==='conditioning'){
      jointLabel='主要关节';actionLabel='动作特点';
    }
    const system=systemMode?`<div class="anatomy-system-meta"><span>Confidence <b>${esc(rec.confidence||'—')}</b></span><span>Source <b>${esc(rec.sourceNote||'—')}</b></span></div>`:'';
    return `<div class="drawer-section anatomy-section"><h3>肌群解剖</h3><div class="anatomy-grid"><div><small>${esc(labels[0])}</small><b>${esc(listText(primary))}</b></div><div><small>${esc(labels[1])}</small><b>${esc(listText(secondary))}</b></div><div><small>${esc(labels[2])}</small><b>${esc(listText(third))}</b></div><div><small>${esc(jointLabel)}</small><b>${esc(listText(rec.joints))}</b></div><div><small>${esc(actionLabel)}</small><b>${esc(listText(rec.movementActions))}</b></div></div>${system}</div>`;
  }
  function workoutGuideHtml(id){
    const item=(window.V14_WORKOUT_GUIDE?.assets||[]).find(asset=>asset.formalActionId===id);
    if(!item)return '';
    const frames=item.frames.map(frame=>`<img class="workout-guide-frame" data-workout-guide-frame="${esc(frame.index)}" src="${esc(frame.path)}" alt="${esc(item.formalActionName)}动作示意第${esc(frame.index)}帧" loading="lazy">`).join('');
    return `<div class="drawer-section workout-guide-media" data-media-source="workout-guide"><div class="workout-guide-head"><div><h3>动作示意</h3><p>统一动作视觉底图；用于快速理解起始位、过程位与回位。</p></div><span class="workout-guide-badge">3 帧动画</span></div><div class="workout-guide-stage" role="img" aria-label="${esc(item.formalActionName)} Workout Guide 动作示意">${frames}</div><p class="workout-guide-attribution"><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · Artwork by <a href="https://bryllim.com" target="_blank" rel="noreferrer">Bryl Lim</a> / <a href="https://github.com/everkinetic/data" target="_blank" rel="noreferrer">Everkinetic</a> · <a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noreferrer">Workout Guide</a></p></div>`;
  }
  function normalDetail(id,systemMode){const d=window.V14_DATA,a=d.actions[id],f=d.actionDetails[id]?.fields||{};if(!a)return '';
    const down=splitIds(f['退阶 ID']),same=splitIds(f['同级替代 ID']),up=splitIds(f['进阶 ID']);
    const system=systemMode?`<div class="system-meta">${facts([['标准 ID',id],['Excel 源层级',a.sourceTier||f['来源层级']],['V1.1 标准层级',a.tier],['Overlay',a.isVenueOverlay?'是':'否']])}</div>`:'';
    const copy=copyActionControl(id,a,f);
    const primary=[['训练目标',f['训练目标']],['处方 / RPE',f['来源处方 / RPE']],['教练口令',f['教练口令']]].filter(([,value])=>value);
    const advanced=[['执行步骤',f['执行步骤']],['常见错误',f['常见错误']],['禁忌 / 限制',f['禁忌 / 限制']]].filter(([,value])=>value);
    const section=items=>items.map(([label,value])=>`<h3>${esc(label)}</h3><p>${esc(value)}</p>`).join('');
    const paths=`<div class="path-columns"><div><small>退阶</small>${actionLinks(down)}</div><div><small>同级替换</small>${actionLinks(same)}</div><div><small>进阶</small>${actionLinks(up)}</div></div>`;
    return `<div class="drawer-head"><div><span>${esc(a.pattern||'动作')}</span><h2>${esc(a.name)}</h2></div><div class="drawer-head-actions">${copy}${closeButton()}</div></div><div class="drawer-body"><div class="action-facts">${facts([['V1.1 层级',a.tier],['器械',a.equipment],['区域 / 路由',[a.zone,a.routeLabel].filter(Boolean).join(' ')],['编排状态',a.status]])}</div>${workoutGuideHtml(id)}${system}${anatomyHtml(id,systemMode)}<div class="drawer-section">${section(primary)}</div>${advanced.length?`<details class="drawer-advanced"><summary>执行与安全细节</summary><div class="drawer-section">${section(advanced)}</div></details>`:''}<details class="drawer-advanced"><summary>动作关系</summary>${paths}</details></div>`;
  }
  function relatedCandidates(candidate){
    const mapping=candidate.mapping||{};
    const target=String(candidate.target||'').toLowerCase();
    const equipmentId=mapping.equipmentId||'';
    const pattern=mapping.pattern||'';
    return (OG().candidates||[])
      .filter(item=>item.id!==candidate.id)
      .map(item=>{
        const itemMapping=item.mapping||{};
        let score=0;
        if(pattern&&itemMapping.pattern===pattern)score+=4;
        if(equipmentId&&itemMapping.equipmentId===equipmentId)score+=2;
        if(target&&String(item.target||'').toLowerCase()===target)score+=3;
        return {item,score};
      })
      .filter(row=>row.score>=4)
      .sort((a,b)=>b.score-a.score||String(a.item.name).localeCompare(String(b.item.name)))
      .slice(0,4)
      .map(row=>row.item);
  }
  function relatedCandidatesHtml(candidate){
    const related=relatedCandidates(candidate);
    if(!related.length)return '';
    return `<div class="drawer-section candidate-related"><h3>相似动作 / 替代候选</h3><p>沿用 OpenGym 的同肌群、同器械相似动作思路；这些条目仍需 7Fit 教练审核。</p><div class="candidate-related-list">${related.map(item=>`<button type="button" data-opengym-related-id="${esc(item.id)}"><b>${esc(item.name||item.id)}</b><span>${esc([item.target,item.equipment].filter(Boolean).join(' · '))}</span></button>`).join('')}</div></div>`;
  }
  function opengymDetail(id){
    const candidate=(OG().candidates||[]).find(item=>item.id===id);
    if(!candidate)return '';
    const mapping=candidate.mapping||{},instructions=Array.isArray(candidate.instructions)?candidate.instructions:[];
    const steps=instructions.length?`<ol class="action-instructions">${instructions.map(step=>`<li>${esc(step)}</li>`).join('')}</ol>`:'<p>暂无步骤</p>';
    const source=candidate.sourceUrl?`<a href="${esc(candidate.sourceUrl)}" target="_blank" rel="noreferrer">查看 OpenGym 原始条目</a>`:'—';
    return `<div class="drawer-head"><div><span>OpenGym 候选 · 待人工验收</span><h2>${esc(candidate.name||id)}</h2></div><div class="drawer-head-actions">${closeButton()}</div></div><div class="drawer-body"><div class="candidate-review-banner"><b>候选资料，不可直接编排</b><span>完成 7Fit 教练审核、中文命名、Anatomy 与器械路由确认后，才可转为正式动作。</span></div><div class="action-facts">${facts([['OpenGym ID',candidate.sourceExerciseId],['身体部位',candidate.bodyPart],['器械',candidate.equipment],['目标肌群',candidate.target],['7Fit 器械映射',mapping.equipmentId],['动作模式建议',(mapping.patterns||[]).join(' / ')]])}</div><div class="drawer-section"><h3>动作简介</h3><p>${esc(candidate.description||'—')}</p><h3>执行步骤</h3>${steps}</div>${relatedCandidatesHtml(candidate)}<div class="drawer-section candidate-media-placeholder" data-media-status="not-imported"><h3>媒体</h3><p><b>未导入 OpenGym 图片/动画。</b>当前仅保留 7Fit 自有照片或示意图的占位；需要 Gym visual 媒体必须先取得针对 7Fit 的书面许可。</p></div><div class="drawer-section"><h3>来源与许可</h3><p>文本来源：ExerciseDB v1 via OpenGym，MIT；OpenGym 媒体不在本候选包内。</p><p>${source}</p></div></div>`;
  }
  function canonDetail(id,systemMode){const d=window.V14_DATA,a=d.actions[id]||{};const source=a.isSupport?d.supportDetails[id]:d.coreDetails[id];const f=source?.fields||{};const copy=copyActionControl(id,a,f);const primary=[['训练目的',f['训练目的']],['教练口令',f['教练口令']]].filter(([,value])=>value);const advanced=[['常见代偿',f['常见代偿']]].filter(([,value])=>value);const section=items=>items.map(([label,value])=>`<h3>${esc(label)}</h3><p>${esc(value)}</p>`).join('');return `<div class="drawer-head"><div><span>${a.isSupport?'SUPPORT':'CORE'}</span><h2>${esc(source?.name||a.name||id)}</h2></div><div class="drawer-head-actions">${copy}${closeButton()}</div></div><div class="drawer-body"><div class="action-facts">${facts([['等级',a.tier||a.supportGrade||a.coreGrade],['Core Demand',a.coreDemand],['场馆路由',a.routeLabel]])}</div>${systemMode?`<div class="system-meta">${facts([['标准 ID',id]])}</div>`:''}${anatomyHtml(id,systemMode)}<div class="drawer-section">${section(primary)}</div>${advanced.length?`<details class="drawer-advanced"><summary>执行与安全细节</summary><div class="drawer-section">${section(advanced)}</div></details>`:''}</div>`;}
  function close(){const drawer=document.getElementById('global-drawer');drawer.hidden=true;drawer.innerHTML='';drawer.removeAttribute('aria-labelledby');document.body.classList.remove('drawer-open');lastFocusedElement?.focus?.();lastFocusedElement=null;}
  function open(actionId,{systemMode,source}={}){const d=window.V14_DATA,a=d.actions[actionId];const isOpenGym=source==='opengym'||String(actionId).startsWith('opengym-');if(!a&&!isOpenGym)return;const drawer=document.getElementById('global-drawer');lastFocusedElement=document.activeElement;drawer.innerHTML=isOpenGym?opengymDetail(actionId):(a.isSupport||a.isCore?canonDetail(actionId,!!systemMode):normalDetail(actionId,!!systemMode));drawer.setAttribute('role','dialog');/* role="dialog" */drawer.setAttribute('aria-modal','true');const title=drawer.querySelector('.drawer-head h2');if(title){title.id='action-detail-title';drawer.setAttribute('aria-labelledby','action-detail-title');}drawer.hidden=false;document.body.classList.add('drawer-open');drawer.querySelector('[data-close-drawer]')?.addEventListener('click',close);window.V14ModuleCopy?.bind?.(drawer);drawer.onclick=e=>{const related=e.target.closest('[data-opengym-related-id]');if(related){open(related.dataset.opengymRelatedId,{systemMode,source:'opengym'});return;}if(e.target===drawer)close();};drawer.onkeydown=e=>{if(e.key==='Escape')close();};drawer.querySelector('[data-close-drawer]')?.focus();}
  window.V14ActionDetail={open,close};
})();
