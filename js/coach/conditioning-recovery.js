(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const Matcher=()=>window.V14RecoveryMatcher;
  const CONTENT=Object.freeze({
    title:'完成拉伸｜约 5–8 分钟',
    note:'主训练结束后进行低强度走动、呼吸整理，并完成 3 个主要部位拉伸；动作按本节 Station 的实际负荷匹配。',
    boundary:'完整 Conditioning Session 默认 NO POST CARDIO。',
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
      noPostCardio:true,
      status:matched?.status||'unavailable',
      message:matched?.message||'',
      items:Matcher()?.copyItems?.(matched)||[],
    };
  }

  function render(session){
    const matched=match(session);
    const cards=matched&&Matcher()?.render?Matcher().render(matched):'';
    return `<section class="section-card conditioning-recovery-section"><div class="section-head"><div><h2>${CONTENT.title}</h2><p>${CONTENT.note}</p></div><span class="time-badge">RECOVERY</span></div>${cards}<div class="post-cardio-note conditioning-no-cardio"><b>NO POST CARDIO</b><span>${CONTENT.boundary}</span></div></section>`;
  }

  M.ConditioningRecovery={...CONTENT,payload,render};
})();
