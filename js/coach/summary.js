(function(){
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc}=C;
  function render(actionIds){
    const summary=window.V14Anatomy?.aggregate(actionIds);
    if(!summary)return '';
    const primary=summary.primary.slice(0,6);
    const pset=new Set(primary);
    const secondary=summary.secondary.filter(x=>!pset.has(x)).slice(0,6);
    const used=new Set([...primary,...secondary]);
    const stabilizers=summary.stabilizers.filter(x=>!used.has(x)).slice(0,6);
    const row=(label,items)=>`<div><small>${label}</small><b>${esc(items.length?items.join(' · '):'—')}</b></div>`;
    return `<section class="session-muscle-summary"><div class="muscle-summary-head"><div><span>ANATOMY</span><h3>本节主要训练肌群</h3></div><small>根据当前 6 个正式训练动作实时汇总；仅表示动作暴露，不等同于有效组数。</small></div><div class="muscle-summary-grid">${row('主要刺激',primary)}${row('协同参与',secondary)}${row('核心 / 稳定',stabilizers)}</div></section>`;
  }
  M.Summary={render};
})();