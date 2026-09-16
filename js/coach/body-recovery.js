(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const Matcher=()=>window.V14RecoveryMatcher;
  const CONTENT=Object.freeze({
    title:'完成拉伸｜约 5–8 分钟',
    note:'训练结束后完成 3 个主要部位拉伸；动作按本节实际训练肌群匹配。',
    boundary:'恢复内容不计入 Direct Work Sets。',
  });

  /** Match this session, degrading to the matcher's explicit coach fallback. */
  function match(session){
    if(!session||!Matcher()?.match)return null;
    return Matcher().match(session);
  }

  function payload(session){
    const matched=match(session);
    return {
      ...CONTENT,
      status:matched?.status||'unavailable',
      message:matched?.message||'',
      items:Matcher()?.copyItems?.(matched)||[],
    };
  }

  function render(session){
    const matched=match(session);
    const cards=matched&&Matcher()?.render?Matcher().render(matched):'';
    return `<section class="section-card body-recovery-section" data-body-recovery><div class="section-head"><div><h2>${CONTENT.title}</h2><p>${CONTENT.note}</p></div><span class="time-badge">RECOVERY</span></div>${cards}<div class="post-cardio-note"><b>恢复边界</b><span>${CONTENT.boundary}</span></div></section>`;
  }

  M.BodyRecovery={...CONTENT,payload,render};
})();
