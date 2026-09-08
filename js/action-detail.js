(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function splitIds(v){return String(v||'').split(/[、,，\s]+/).map(x=>x.trim()).filter(x=>x&&x!=='—');}
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
  function normalDetail(id,systemMode){const d=window.V14_DATA,a=d.actions[id],f=d.actionDetails[id]?.fields||{};if(!a)return '';
    const down=splitIds(f['退阶 ID']),same=splitIds(f['同级替代 ID']),up=splitIds(f['进阶 ID']);
    const system=systemMode?`<div class="system-meta"><div><small>标准 ID</small><b>${esc(id)}</b></div><div><small>Excel 源层级</small><b>${esc(a.sourceTier||f['来源层级']||'—')}</b></div><div><small>V1.1 标准层级</small><b>${esc(a.tier||'—')}</b></div><div><small>Overlay</small><b>${a.isVenueOverlay?'是':'否'}</b></div></div>`:'';
    const copy=copyActionControl(id,a,f);
    return `<div class="drawer-head"><div><span>${esc(a.pattern||'动作')}</span><h2>${esc(a.name)}</h2></div><div class="drawer-head-actions">${copy}<button data-close-drawer>×</button></div></div><div class="drawer-body"><div class="action-facts"><div><small>V1.1 层级</small><b>${esc(a.tier||'未标')}</b></div><div><small>器械</small><b>${esc(a.equipment||'—')}</b></div><div><small>区域 / 路由</small><b>${esc((a.zone||'')+' '+(a.routeLabel||''))}</b></div><div><small>编排状态</small><b>${esc(a.status||'—')}</b></div></div>${system}${anatomyHtml(id,systemMode)}<div class="drawer-section"><h3>训练目标</h3><p>${esc(f['训练目标']||'—')}</p><h3>处方 / RPE</h3><p>${esc(f['来源处方 / RPE']||'—')}</p><h3>教练口令</h3><p>${esc(f['教练口令']||'—')}</p><h3>执行步骤</h3><p>${esc(f['执行步骤']||'—')}</p><h3>常见错误</h3><p>${esc(f['常见错误']||'—')}</p><h3>禁忌 / 限制</h3><p>${esc(f['禁忌 / 限制']||'—')}</p></div><div class="path-columns"><div><small>退阶</small>${actionLinks(down)}</div><div><small>同级替换</small>${actionLinks(same)}</div><div><small>进阶</small>${actionLinks(up)}</div></div></div>`;
  }
  function canonDetail(id,systemMode){const d=window.V14_DATA,a=d.actions[id]||{};const source=a.isSupport?d.supportDetails[id]:d.coreDetails[id];const f=source?.fields||{};const copy=copyActionControl(id,a,f);return `<div class="drawer-head"><div><span>${a.isSupport?'SUPPORT':'CORE'}</span><h2>${esc(source?.name||a.name||id)}</h2></div><div class="drawer-head-actions">${copy}<button data-close-drawer>×</button></div></div><div class="drawer-body"><div class="action-facts"><div><small>等级</small><b>${esc(a.tier||a.supportGrade||a.coreGrade||'—')}</b></div><div><small>Core Demand</small><b>${esc(a.coreDemand||'—')}</b></div><div><small>场馆路由</small><b>${esc(a.routeLabel||'—')}</b></div></div>${systemMode?`<div class="system-meta"><div><small>标准 ID</small><b>${esc(id)}</b></div></div>`:''}${anatomyHtml(id,systemMode)}<div class="drawer-section"><h3>训练目的</h3><p>${esc(f['训练目的']||'—')}</p><h3>教练口令</h3><p>${esc(f['教练口令']||'—')}</p><h3>常见代偿</h3><p>${esc(f['常见代偿']||'—')}</p></div></div>`;}
  function close(){const drawer=document.getElementById('global-drawer');drawer.hidden=true;drawer.innerHTML='';document.body.classList.remove('drawer-open');}
  function open(actionId,{systemMode}={}){const d=window.V14_DATA,a=d.actions[actionId];if(!a)return;const drawer=document.getElementById('global-drawer');drawer.innerHTML=a.isSupport||a.isCore?canonDetail(actionId,!!systemMode):normalDetail(actionId,!!systemMode);drawer.hidden=false;document.body.classList.add('drawer-open');drawer.querySelector('[data-close-drawer]')?.addEventListener('click',close);window.V14ModuleCopy?.bind?.(drawer);drawer.addEventListener('click',e=>{if(e.target===drawer)close();});}
  window.V14ActionDetail={open,close};
})();
