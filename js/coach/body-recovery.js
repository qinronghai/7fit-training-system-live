(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const CONTENT=Object.freeze({
    title:'训练后恢复｜约 5–8 分钟',
    note:'力量训练结束后进行低强度恢复与呼吸整理；如需拉伸，按当日训练肌群由教练人工选择。',
    boundary:'恢复内容不计入 Direct Work Sets。',
  });

  function payload(){return {...CONTENT};}

  function render(){
    return `<section class="section-card body-recovery-section"><div class="section-head"><div><h2>${CONTENT.title}</h2><p>${CONTENT.note}</p></div><span class="time-badge">RECOVERY</span></div><div class="post-cardio-note"><b>恢复边界</b><span>${CONTENT.boundary}</span></div></section>`;
  }

  M.BodyRecovery={...CONTENT,payload,render};
})();
