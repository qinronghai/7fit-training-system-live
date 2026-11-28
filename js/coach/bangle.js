(function(){
  // The bangle: an 18 pt hoop cut into round-capped beads in true proportion to each bucket's planned sets.
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const BUCKETS=[
    {key:'lower',label:'下肢',glyph:'下',slots:['A','D1']},
    {key:'upper',label:'上肢',glyph:'上',slots:['B','D2']},
    {key:'support',label:'支撑',glyph:'撑',slots:['C']},
    {key:'core',label:'核心',glyph:'核',slots:['CORE']},
  ];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  function setsOf(prescription){
    const match=String(prescription||'').match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*组/);
    return match?Number(match[1]):0;
  }

  function buckets(slots=[]){
    return BUCKETS.map(bucket=>({...bucket,sets:slots.filter(slot=>bucket.slots.includes(slot.slotKey)).reduce((sum,slot)=>sum+setsOf(slot.prescriptionOverride||slot.prescription),0)}));
  }

  function hoop(groups,total){
    const size=184,stroke=18,radius=(size-stroke)/2,center=size/2,circumference=2*Math.PI*radius;
    const gap=groups.filter(group=>group.sets).length>1?stroke*1.5:0;
    let offset=0;
    const arcs=groups.filter(group=>group.sets).map(group=>{
      const length=Math.max(0,circumference*group.sets/total-gap);
      const arc=`<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--vb-bucket-${group.key})" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${length.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${(-offset-gap/2).toFixed(2)}" transform="rotate(-90 ${center} ${center})"/>`;
      offset+=circumference*group.sets/total;
      return arc;
    }).join('');
    return `<svg class="vb-bangle-hoop" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--vb-well)" stroke-width="${stroke}"/>${arcs}</svg>`;
  }

  function render(slots){
    const groups=buckets(slots),total=groups.reduce((sum,group)=>sum+group.sets,0);
    if(!total)return '';
    const rows=groups.filter(group=>group.sets).map(group=>`<li class="vb-row" data-vb-bucket="${group.key}"><span class="vb-bead" aria-hidden="true">${group.glyph}</span><span class="vb-row-name">${group.label}</span><span class="vb-pill">${group.sets} 组</span></li>`).join('');
    return `<section class="vb-bangle" data-vb-bangle aria-label="本节组数 ${total} 组">
      <div class="vb-bangle-ring">${hoop(groups,total)}<div class="vb-bangle-center"><span class="vb-bangle-disc" aria-hidden="true"></span><strong>${esc(total)}<small>组</small></strong><span class="vb-label">本节组数</span></div></div>
      <ul class="vb-bangle-legend">${rows}</ul>
    </section>`;
  }

  M.Bangle={render,buckets,setsOf};
})();
