(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;

  function targetName(id){return D().bodyTargetCatalog?.[id]?.name||id;}
  function targetRows(map){
    const entries=Object.entries(map||{}).filter(([,value])=>Number(value)>0);
    return entries.length?entries.map(([id,value])=>`<div><small>${esc(targetName(id))}</small><b>${esc(value)} 组</b></div>`).join(''):'<div><small>—</small><b>0 组</b></div>';
  }

  function render(session){
    const volume=session?.domainContext?.volume||{};
    const ratio=Number(volume.isolationRatio||0);
    return `<section class="session-volume-summary"><div class="section-head"><div><h2>Direct Work Sets｜有效工作组</h2><p>只统计 Body 正式训练工作组；Anatomy 暴露与协同参与不会自动换算为有效组。</p></div><span class="time-badge">约 ${esc(volume.estimatedMinutes??'—')} 分钟</span></div>`+
      `<div class="body-volume-overview"><div><small>总工作组</small><b>${esc(volume.totalWorkingSets??0)}</b></div><div><small>孤立工作组</small><b>${esc(volume.isolationWorkingSets??0)}</b></div><div><small>孤立占比</small><b>${esc(Math.round(ratio*100))}%</b></div><div><small>高疲劳复合动作</small><b>${esc(volume.highFatigueCompoundCount??0)}</b></div></div>`+
      `<div class="body-volume-targets"><div><h3>Direct Sets</h3><div class="detail-facts">${targetRows(volume.directSetsByTarget)}</div></div><div><h3>协同暴露（不计入 Direct Work Sets）</h3><div class="detail-facts">${targetRows(volume.secondaryExposureByTarget)}</div></div></div></section>`;
  }

  M.BodyVolumeView={render};
})();
