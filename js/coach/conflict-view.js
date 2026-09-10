(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc}=C;
  function render(result){
    const items=result.issues.length?result.issues.map(i=>`<div class="issue ${i.severity}"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div>`).join(''):`<p class="conflict-empty">当前方案未发现替换后冲突。</p>`;
    return `<section class="conflict-box ${result.status.toLowerCase()}"><div class="conflict-top"><div><span>LIVE CHECK</span><b>${result.status}</b></div><small>${result.hardCount} 硬冲突 · ${result.warnCount} 警告</small></div><div class="issue-list">${items}</div></section>`;
  }
  M.ConflictView={render};
})();