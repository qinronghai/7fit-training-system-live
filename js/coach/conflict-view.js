(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc}=C;
  function render(result,options={}){
    const status=String(result.status||'PASS').toUpperCase();
    const label=status==='PASS'?'通过':status==='FAIL'?'未通过':'需确认';
    const items=result.issues.length?result.issues.map(i=>`<div class="issue ${i.severity}"><b>${esc(i.title)}</b><span>${esc(i.text)}</span></div>`).join(''):`<p class="conflict-empty">当前课程符合编排要求。</p>`;
    const details=status==='PASS'
      ?`<details class="f111-check-details"><summary>查看检查详情</summary><div class="issue-list">${items}</div></details>`
      :`<button type="button" class="f111-check-details-trigger" data-f111-check-details>查看未通过原因</button><div class="f111-check-reasons" data-f111-check-reasons hidden>${items}</div>`;
    const compact=options.composer===true;
    if(!compact)return `<section class="conflict-box f111-course-check ${status.toLowerCase()}"><div class="f111-course-check-head"><span class="f111-course-check-status">${status==='PASS'?'✓':'×'} ${label}</span><small>课程检查</small></div>${details}</section>`;
    const content=status==='PASS'
      ?`<p class="f111-course-check-message">当前课程符合编排要求。</p>${details}`
      :details;
    return `<section class="conflict-box f111-course-check f111-compose-course-check ${status.toLowerCase()}"><h2 class="f111-course-check-title">课程检查</h2><div class="f111-course-check-row"><span class="f111-course-check-status">${status==='PASS'?'✓':'×'} ${label}</span>${content}</div></section>`;
  }
  M.ConflictView={render};
})();
