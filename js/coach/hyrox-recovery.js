(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common,esc=C.esc;
  function payload(session){
    const ids=new Set(session?.domainContext?.orderedStations||[]),items=[];
    items.push('2–3 分钟低强度走动或轻松器械输出，让心率逐步下降。');
    items.push('2–4 组缓慢呼吸：吸气肋骨扩张，呼气回收肋骨与骨盆。');
    if(['H2','H4','H7','H8'].some(function(id){return ids.has(id);})){
      items.push('下肢恢复：髋屈肌、臀部、小腿与踝活动各 30–45 秒。');
    }
    if(['H1','H3','H5','H8'].some(function(id){return ids.has(id);})){
      items.push('上肢恢复：背阔肌、胸椎与肩带轻度活动，不做强力拉伸。');
    }
    if(['H3','H5','H6'].some(function(id){return ids.has(id);})){
      items.push('握力暴露较高时，加入前臂放松与手指开合恢复。');
    }
    return {title:'RECOVERY｜训练后恢复',items,boundary:'HYROX Mixed / Benchmark 已包含较高体能负荷，课后不再额外叠加高强度有氧。'};
  }
  function render(session){
    const p=payload(session);
    return '<section class="section-card hyrox-recovery"><div class="section-head"><div><h2>'+esc(p.title)+'</h2><p>恢复内容按本节实际 Station 暴露动态生成。</p></div><span class="time-badge">约 5–8 分钟</span></div>'+
      '<ul class="hyrox-recovery-list">'+p.items.map(function(item){return '<li>'+esc(item)+'</li>';}).join('')+'</ul><small>'+esc(p.boundary)+'</small></section>';
  }
  M.HyroxRecovery={payload,render};
})();