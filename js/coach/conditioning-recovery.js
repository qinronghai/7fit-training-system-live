(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const CONTENT=Object.freeze({
    title:'RECOVERY｜训练后恢复 · 约 5–8 分钟',
    note:'主训练结束后进行低强度走动、呼吸整理与必要的轻度活动度恢复；不再叠加额外体能消耗。',
    boundary:'完整 Conditioning Session 默认 NO POST CARDIO。',
  });

  function payload(){return {...CONTENT,noPostCardio:true};}

  function render(){
    return `<section class="section-card conditioning-recovery-section"><div class="section-head"><div><h2>${CONTENT.title}</h2><p>${CONTENT.note}</p></div><span class="time-badge">RECOVERY</span></div><div class="post-cardio-note conditioning-no-cardio"><b>NO POST CARDIO</b><span>${CONTENT.boundary}</span></div></section>`;
  }

  M.ConditioningRecovery={...CONTENT,payload,render};
})();
