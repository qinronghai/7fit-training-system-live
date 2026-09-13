(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const esc=C.esc,D=C.D;
  const TYPE_META={
    SKILL:{title:'Skill｜技术学习',desc:'学习 Station 技术、器械使用与节奏控制；不追求整课成绩。',badge:'3–4 Station',timing:'不强制整课计时',href:'#/coach/hyrox/skill/l1'},
    CAPACITY:{title:'Capacity｜专项能力',desc:'围绕 Engine、Sled、Locomotion 或力量耐力能力组集中提升。',badge:'2–4 Station',timing:'局部计时 / 轮次',href:'#/coach/hyrox/capacity/l1?focus=ENGINE'},
    MIXED:{title:'Mixed｜综合训练',desc:'日常主力模式，组合 3–6 个 Station 训练综合工作容量。',badge:'3–6 Station',timing:'可计时',href:'#/coach/hyrox/mixed/l1'},
    BENCHMARK:{title:'Benchmark｜基准测试',desc:'固定 H1→H8 协议，建立可重复比较的个人基准。',badge:'固定 8 Station',timing:'必须计时',href:'#/coach/hyrox/benchmark/b1'},
  };
  function levelLinks(type){
    if(type==='BENCHMARK'){
      return (D().hyroxBenchmarkProtocolIds||[]).map(function(id){
        const p=D().hyroxBenchmarkProtocols[id]||{};
        return '<a href="#/coach/hyrox/benchmark/'+id.toLowerCase()+'">'+esc(id)+' · '+esc(p.name||'')+'</a>';
      }).join('');
    }
    if(type==='CAPACITY'){
      return (D().hyroxCapacityGroupIds||[]).map(function(id){
        const g=D().hyroxCapacityGroups[id]||{};
        return '<a href="#/coach/hyrox/capacity/l1?focus='+encodeURIComponent(id)+'">'+esc(g.name||id)+'</a>';
      }).join('');
    }
    return ['L1','L2','L3','L4'].map(function(level){
      return '<a href="#/coach/hyrox/'+type.toLowerCase()+'/'+level.toLowerCase()+'">'+level+'</a>';
    }).join('');
  }
  function card(type){
    const m=TYPE_META[type];
    return '<article class="recipe-card hyrox-type-card" data-hyrox-type="'+esc(type)+'">'+
      '<div class="recipe-code">'+esc(type)+' · '+esc(m.badge)+'</div>'+
      '<h3>'+esc(m.title)+'</h3><p>'+esc(m.desc)+'</p>'+
      '<div class="recipe-tags"><span>'+esc(m.timing)+'</span><span>L1–L4 独立缩放</span></div>'+
      '<div class="level-links">'+levelLinks(type)+'</div>'+
    '</article>';
  }
  function render(){
    const cards=['SKILL','CAPACITY','MIXED','BENCHMARK'].map(card).join('');
    return '<a class="back-link" href="#/coach">← 返回模板中心</a>'+
      '<section class="view-hero coach-home-hero hyrox-home-hero">'+
        '<span class="eyebrow">COACH CENTER / HYROX</span><h1>HYROX 训练</h1>'+
        '<p class="coach-home-lead">7Fit 场馆版 Hybrid Training：保留 8 个功能 Station，不做官方竞赛复刻，不加入 1km 跑步。</p>'+
        '<div class="chips"><span class="chip">8 个固定 Station</span><span class="chip">Turf 8m</span><span class="chip">Skill / Capacity / Mixed / Benchmark</span><span class="chip">L1–L4</span></div>'+
      '</section>'+
      '<section class="section-card"><div class="section-head"><div><h2>选择今天的训练类型</h2><p>Session Type 决定今天练什么；L1–L4 决定容量与强度。两者互相独立。</p></div></div><div class="recipe-grid hyrox-type-grid">'+cards+'</div></section>';
  }
  M.HyroxHome={render,TYPE_META};
})();