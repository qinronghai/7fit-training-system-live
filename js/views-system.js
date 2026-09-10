(function(){
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const D=()=>window.V14_DATA;
  function tabs(active){return `<nav class="subnav"><a class="${active==='patterns'?'active':''}" href="#/system/patterns">十大动作模式</a><a class="${active==='prep'?'active':''}" href="#/system/prep">PREP 热身</a></nav>`;}
  function hero(title,body){return `<section class="view-hero compact"><span class="eyebrow">TRAINING KNOWLEDGE</span><h1>${esc(title)}</h1><p>${esc(body)}</p></section>`;}
  function copyControl(id,kind,payload){const api=window.V14ModuleCopy;if(!api)return '';api.register(id,kind,payload);return api.button(id,'复制本模块');}
  function patternLevelLabel(item){
    if(item.type==='support')return 'S1–S6';
    if(item.type==='core')return 'L1–L4 + Core Demand';
    return 'T1–T4';
  }
  function patterns(route){
    const data=D(),focus=route.query?.focus;
    if(focus==='单腿'&&data.singleLegBranches){
      const branchCard=(key,title,subtitle)=>{const branch=data.singleLegBranches[key],levels=(branch?.ids||[]).map((id,i)=>{const a=data.actions[id]||{};return {tier:a.tier||`T${i+1}`,name:a.name||id,id};});const copy=copyControl(`pattern-single-leg-${key}`,'pattern',{name:`单腿模式｜${title}`,levels:levels.map(x=>({tier:x.tier,name:x.name})),note:`${subtitle}。同级替换不等于进阶；实际准入继续服从动作质量、稳定性与场馆最低负荷。`});return `<section class="section-card single-leg-branch"><div class="section-head"><div><h2>${title}</h2><p>${subtitle}</p></div>${copy}</div><div class="tier-grid">${levels.map(x=>`<article class="tier-card"><div class="tier-code">${esc(x.tier)}</div><h3>${esc(x.name)}</h3><p>${key==='single_leg_hinge'?'单侧髋铰链 / 后侧链 / 骨盆抗旋转':'单侧膝主导 / 下肢力量 / 骨盆稳定'}</p><a href="#/library?focus=${encodeURIComponent(x.id)}">动作详情 →</a></article>`).join('')}</div></section>`;};
      return tabs('patterns')+`<a class="back-link" href="#/system/patterns">← 返回十大模式</a>`+hero('04｜单腿模式｜单腿双分支','V14.7 将第 04 模式正式拆为「单腿蹲」与「单腿拉」两条 T1–T4 主链；十大动作模式总数仍保持 10。')+branchCard('single_leg_squat','A｜单腿蹲','单侧膝主导：分腿蹲 / 箭步蹲 / 保加利亚分腿蹲进阶链。')+branchCard('single_leg_hinge','B｜单腿拉','单侧髋主导：扶持髋铰链 → 扶持负重 → 独立单腿 RDL → 高阶负重单腿 RDL。');
    }
    if(focus&&data.eightPatternDetails[focus]){
      const detail=data.eightPatternDetails[focus];
      const levels=detail.levels.map(x=>`<article class="tier-card"><div class="tier-code">${esc(x.tier)}</div><h3>${esc(x.name)}</h3><p>${esc(x.text.replace(x.tier,'').replace(x.name,'').trim())}</p><a href="#/library?focus=${encodeURIComponent(x.id)}">动作详情 →</a></article>`).join('');
      const copy=copyControl(`pattern-${focus}`,'pattern',{name:focus,levels:detail.levels.map(x=>({tier:x.tier,name:x.name})),note:'同级替换不等于进阶；实际准入同时服从 7Fit 场馆最低负荷与稳定性要求。'});
      return tabs('patterns')+`<a class="back-link" href="#/system/patterns">← 返回十大模式</a>`+hero(focus,'V1.1 当前冻结主链；同级替换不等于进阶，实际准入同时服从 7Fit 场馆最低负荷与稳定性要求。')+`<section class="section-card"><div class="module-copy-row">${copy}</div><div class="tier-grid">${levels}</div></section>`;
    }
    const catalog=data.tenPatternCatalog||[];
    const catalogCopy=copyControl('ten-pattern-catalog','ten_patterns',{items:catalog});
    const cards=catalog.map((item,index)=>{
      const number=String(index+1).padStart(2,'0');
      if(item.type==='support'){
        return `<a class="knowledge-card ten-pattern-card" href="#/system/support"><span>${esc(patternLevelLabel(item))}</span><h3>${number}｜支撑模式</h3><div class="mini-chain"><b>S1 基础静态</b><i>→</i><b>S3 动态</b><i>→</i><b>S6 单侧整合</b></div></a>`;
      }
      if(item.type==='core'){
        return `<a class="knowledge-card ten-pattern-card" href="#/system/core"><span>${esc(patternLevelLabel(item))}</span><h3>${number}｜核心模式</h3><div class="mini-chain"><b>L1 基础控制</b><i>→</i><b>L3 多方向稳定</b><i>→</i><b>L4 高负荷整合</b></div></a>`;
      }
      const v=data.eightPatternDetails[item.key];
      return `<a class="knowledge-card ten-pattern-card" href="#/system/patterns?focus=${encodeURIComponent(item.key)}"><span>${esc(patternLevelLabel(item))}</span><h3>${number}｜${esc(item.name)}</h3><div class="mini-chain">${v.levels.map(x=>`<b>${esc(x.tier)} ${esc(x.name)}</b>`).join('<i>→</i>')}</div></a>`;
    }).join('');
    return tabs('patterns')+hero('十大动作模式','8 个主动作模式使用 T1–T4；第 09 支撑模式使用 S1–S6；第 10 核心模式使用 L1–L4 + Core Demand。三套等级各自独立，不互相替代。')+`<section class="section-card"><div class="module-copy-row">${catalogCopy}</div><div class="knowledge-grid ten-pattern-grid">${cards}</div></section>`;
  }
  function prep(route){
    const data=D(),focus=route.query?.focus,foam=route.query?.foam;
    if(foam&&data.foamRollDetails?.[foam]){
      const f=data.foamRollDetails[foam],a=data.actions[f.actionId]||{};
      const copy=copyControl(`foam-${foam}`,'foam',{title:f.name,items:[{name:f.name,prescription:f.prescription,safety:f.safety}]});
      return tabs('prep')+`<a class="back-link" href="#/system/prep">← 返回 PREP 热身体系</a>`+
        hero(f.name,`泡沫轴软组织准备｜${f.route}`)+
        `<section class="detail-facts prep-facts">
          <div><small>目标肌群 / 区域</small><b>${esc(f.muscles.join(' · '))}</b></div>
          <div><small>推荐课程等级</small><b>${esc(f.sessionLevels.join(' / '))}</b></div>
          <div><small>推荐主训练层级</small><b>${esc(f.mainTiers.join(' / '))}</b></div>
          <div><small>匹配主训练</small><b>${esc(f.targetPatterns.join(' · '))}</b></div>
          <div><small>器械</small><b>泡沫轴</b></div>
          <div><small>场馆路由</small><b>${esc(f.route)}</b></div>
        </section>`+
        `<section class="section-card"><div class="module-copy-row">${copy}</div><div class="detail-copy"><h3>为什么安排它</h3><p>${esc(f.why)}</p><h3>建议处方</h3><p>${esc(f.prescription)}</p><h3>教练口令</h3><p>${esc(f.cue)}</p><h3>安全边界</h3><p>${esc(f.safety)}</p><a class="text-link" href="#/library?focus=${encodeURIComponent(f.actionId)}">查看动作库记录 →</a></div></section>`;
    }
    if(focus&&data.warmupDetails?.[focus]){
      const w=data.warmupDetails[focus],a=data.actions[w.actionId]||{},compatibleLevels=window.V14PrepGrade?.sessionLevelsForGrade(w.prepGrade)||w.sessionLevels;
      const copy=copyControl(`prep-${focus}`,'prep',{title:w.name,items:[{name:w.name,grade:w.prepGrade,prescription:w.prescription,why:w.why}]});
      return tabs('prep')+`<a class="back-link" href="#/system/prep">← 返回 PREP 热身体系</a>`+
        hero(w.name,`${w.prepGrade}｜${w.role}｜${w.route}`)+
        `<section class="detail-facts prep-facts">
          <div><small>热身等级</small><b>${esc(w.prepGrade)}</b></div>
          <div><small>兼容课程等级</small><b>${esc(compatibleLevels.join(' / '))}</b></div>
          <div><small>主训练 T 参考</small><b>${esc(w.mainTiers.join(' / '))}</b></div>
          <div><small>匹配主训练</small><b>${esc(w.targetPatterns.join(' · '))}</b></div>
          <div><small>主要区域</small><b>${esc(w.regions.join(' · '))}</b></div>
          <div><small>器械</small><b>${esc(w.equipment)}</b></div>
        </section>`+
        `<section class="section-card"><div class="module-copy-row">${copy}</div><div class="detail-copy">
          <h3>为什么安排它</h3><p>${esc(w.why)}</p>
          <h3>建议处方</h3><p>${esc(w.prescription)}</p>
          <h3>教练口令</h3><p>${esc(w.cue)}</p>
          <h3>等级规则</h3><p>正式准入只看 ${esc(w.prepGrade)} 与 Session L 的向下兼容窗口；主训练 T 仅作为动作匹配参考，不作为 PREP 准入门槛。</p>
          <h3>数据状态</h3><p>${esc(w.sourceStatus)}</p>
          <a class="text-link" href="#/library?focus=${encodeURIComponent(w.actionId)}">查看动作库记录 →</a>
        </div></section>`;
    }
    const pattern=route.query?.pattern||'蹲';
    const sessionLevel=route.query?.level||'L1';
    const mainTier=route.query?.tier||'T1';
    const patternOptions=['蹲','髋铰链','髋伸展','单腿','水平推','垂直推','水平拉','垂直拉'];
    const levelOptions=['L1','L2','L3','L4'];
    const tierOptions=['T1','T2','T3','T4'];
    const allowedGrades=window.V14PrepGrade?.allowedGrades(sessionLevel)||[];
    const tierIndex=Math.max(0,Math.min(3,parseInt(mainTier.slice(-1),10)-1));
    const representativeId=data.eightPatterns?.[pattern]?.[tierIndex]||'';
    const anatomyFoam=representativeId?(window.V14Anatomy?.rankFoam([representativeId],{limit:6})||[]):[];
    const foamFallback=data.foamRollMatchByPattern?.[pattern]||[];
    const foamSource=anatomyFoam.length?anatomyFoam:foamFallback;
    const foamIds=foamSource.filter(id=>{
      const f=data.foamRollDetails[id];return f&&f.sessionLevels.includes(sessionLevel)&&f.mainTiers.includes(mainTier);
    });
    const foamCards=foamIds.map(id=>{const f=data.foamRollDetails[id];return `<a class="foam-roll-card" href="#/system/prep?foam=${encodeURIComponent(id)}"><div><span>ROLL</span><small>${esc(f.muscles.join(' · '))}</small></div><h3>${esc(f.name)}</h3><p>${esc(f.why)}</p><footer><b>${esc(f.prescription)}</b></footer></a>`;}).join('');
    const anatomyWarm=representativeId?(window.V14Anatomy?.rankWarmups([representativeId],{level:sessionLevel,tier:mainTier,limit:12})||[]):[];
    const warmFallback=data.warmupMatchByPattern?.[pattern]||[];
    const warmSource=anatomyWarm.length?anatomyWarm:(window.V14PrepGrade?.sortIds(warmFallback,sessionLevel,data.warmupDetails)||warmFallback);
    const ids=warmSource.filter(id=>{
      const w=data.warmupDetails[id];return w&&(window.V14PrepGrade?window.V14PrepGrade.isAllowed(sessionLevel,w.prepGrade):w.sessionLevels.includes(sessionLevel));
    });
    const foamCopy=copyControl(`foam-match-${pattern}-${sessionLevel}-${mainTier}`,'foam',{title:`泡沫轴推荐｜${pattern} · ${sessionLevel} · ${mainTier}`,items:foamIds.map(id=>{const f=data.foamRollDetails[id];return {name:f.name,prescription:f.prescription,safety:f.safety};})});
    const prepCopy=copyControl(`prep-match-${pattern}-${sessionLevel}-${mainTier}`,'prep',{title:`PREP｜${pattern} · ${sessionLevel} · ${allowedGrades.join(' → ')}`,items:ids.map(id=>{const w=data.warmupDetails[id];return {name:w.name,grade:w.prepGrade,prescription:w.prescription,why:w.why};})});
    const cards=ids.map(id=>{
      const w=data.warmupDetails[id];
      return `<a class="prep-action-card" data-prep-id="${esc(id)}" href="#/system/prep?focus=${encodeURIComponent(id)}">
        <div><span>${esc(w.prepGrade)}</span><small>${esc(w.role)}</small></div>
        <h3>${esc(w.name)}</h3>
        <p>${esc(w.why)}</p>
        <footer><span>${esc(w.regions.join(' · '))}</span><b>${esc(w.prescription)}</b></footer>
      </a>`;
    }).join('');
    const gradeCards=Object.entries(data.warmupGradeMeta||{}).map(([g,m])=>{const levels=window.V14PrepGrade?.sessionLevelsForGrade(g)||[];return `<article class="prep-grade-card"><span>${esc(g)}</span><h3>${esc(m.name)}</h3><p>${esc(m.meaning)}</p><small>兼容 ${esc(levels.join(' / ')||m.session)} · PREP 等级独立于主动作 T</small></article>`;}).join('');
    return tabs('prep')+hero('PREP 热身体系','Session 使用 L1–L4，主动作使用 T1–T4，PREP 独立使用 P1–P4。P 等级按本级优先逐级向下兼容，禁止向上越级。')+
      `<section class="section-card"><div class="section-head"><div><h2>热身匹配器</h2><p>选择主训练模式、Session L 与主动作 T。L 决定合法 PREP P 窗口；T 只决定代表主动作与 Anatomy 匹配上下文。</p></div></div>
        <div class="prep-filter-grid">
          <label>主训练模式<select id="prep-pattern">${patternOptions.map(x=>`<option value="${x}" ${x===pattern?'selected':''}>${x}</option>`).join('')}</select></label>
          <label>课程等级<select id="prep-session-level">${levelOptions.map(x=>`<option value="${x}" ${x===sessionLevel?'selected':''}>${x}</option>`).join('')}</select></label>
          <label>主训练层级（匹配上下文）<select id="prep-main-tier">${tierOptions.map(x=>`<option value="${x}" ${x===mainTier?'selected':''}>${x}</option>`).join('')}</select></label>
        </div>
        <div class="prep-match-summary"><b>${esc(pattern)} · ${esc(sessionLevel)} · PREP ${esc(allowedGrades.join(' → ')||'—')}</b><span>主项上下文 ${esc(mainTier)} · 泡沫轴 ${foamIds.length} 个 · 动态热身 ${ids.length} 个</span></div>
        <div class="prep-subsection-head"><div><b>泡沫轴松解建议</b><span>解剖数据优先：按代表动作主要 / 辅助肌群排序；只选择当天明显紧张的 1–3 个部位即可。</span></div>${foamCopy}</div>
        <div class="foam-roll-grid">${foamCards||'<p class="no-results">当前组合暂无泡沫轴匹配。</p>'}</div>
        <div class="prep-subsection-head"><div><b>动态热身 / 激活</b><span>先按当前 Session 的 P Grade 窗口排序，再比较 Anatomy、关节需求与动作模式；主动作 T 不作为 PREP 准入门槛。</span></div>${prepCopy}</div>
        <div class="prep-action-grid">${cards||'<p class="no-results">当前 Session Level 暂无合法 PREP 匹配动作。</p>'}</div>
      </section>`+
      `<section class="section-card"><div class="section-head"><div><h2>PREP P1–P4 分级</h2><p>L1→P1；L2→P2→P1；L3→P3→P2→P1；L4→P4→P3→P2→P1。本级优先，逐级向下，禁止向上越级。</p></div></div><div class="prep-grade-grid">${gradeCards}</div></section>`;
  }
  function support(route){
    const data=D(),focus=route.query?.focus;
    if(focus&&data.supportDetails[focus]){
      const d=data.supportDetails[focus],a=data.actions[focus]||{},f=d.fields||{};
      const copy=copyControl(`support-${focus}`,'knowledge',{title:`${d.name}｜${f['支撑等级']||a.supportGrade||''}`,lines:[`推荐处方：${window.V14ModuleCopy?.prescriptionForAction?.(focus)||'—'}`,`训练目的：${f['训练目的']||'—'}`,`教练口令：${f['教练口令']||'—'}`,`常见代偿：${f['常见代偿']||'—'}`]});
      return tabs('patterns')+`<a class="back-link" href="#/system/support">← 返回 09｜支撑模式</a>`+hero(d.name,`${a.tier||''}｜${f['支撑等级']||''}`)+detailTable(f)+`<section class="section-card"><div class="module-copy-row">${copy}</div><div class="detail-copy"><h3>训练目的</h3><p>${esc(f['训练目的']||'—')}</p><h3>教练口令</h3><p>${esc(f['教练口令']||'—')}</p><h3>常见代偿</h3><p>${esc(f['常见代偿']||'—')}</p><h3>替换与进阶</h3><p><b>同级：</b>${esc(f['同级替换']||'—')}</p><p><b>退阶：</b>${esc(f['推荐退阶']||'—')}</p><p><b>进阶：</b>${esc(f['推荐进阶']||'—')}</p></div></section>`;
    }
    const grades=['SUP-S1','SUP-S2','SUP-S3','SUP-S4','SUP-S5','SUP-S6'];
    const names={'SUP-S1':'基础静态支撑','SUP-S2':'减少支点','SUP-S3':'动态支撑','SUP-S4':'位移支撑','SUP-S5':'旋转支撑','SUP-S6':'单侧支撑'};
    const cards=grades.map(g=>{const ids=data.supportIds.filter(id=>id.startsWith(g+'-'));return `<article class="grade-card"><span>${g}</span><h3>${names[g]}</h3><div class="grade-actions">${ids.map(id=>`<a href="#/system/support?focus=${encodeURIComponent(id)}">${esc(data.supportDetails[id]?.name||data.actions[id]?.name||id)}</a>`).join('')}</div></article>`;}).join('');
    return tabs('patterns')+`<a class="back-link" href="#/system/patterns">← 返回十大模式</a>`+hero('09｜支撑模式 SUPPORT','S1–S6 是独立支撑任务等级：撑住 → 少支点 → 动态 → 位移 → 旋转 → 单侧整合。')+`<section class="grade-grid support-grades">${cards}</section>`;
  }
  function core(route){
    const data=D(),focus=route.query?.focus;
    if(focus&&data.coreDetails[focus]){
      const d=data.coreDetails[focus],a=data.actions[focus]||{},f=d.fields||{};
      const copy=copyControl(`core-${focus}`,'knowledge',{title:`${d.name}｜${a.coreGrade||a.tier||''}`,lines:[`核心任务：${a.coreDemand||f['Core Demand']||'—'}`,`推荐处方：${window.V14ModuleCopy?.prescriptionForAction?.(focus)||'—'}`,`训练目的：${f['训练目的']||'—'}`,`教练口令：${f['教练口令']||'—'}`,`常见代偿：${f['常见代偿']||'—'}`]});
      return tabs('patterns')+`<a class="back-link" href="#/system/core">← 返回 10｜核心模式</a>`+hero(d.name,`${a.coreGrade||a.tier||''}｜${a.coreDemand||f['Core Demand']||''}`)+detailTable(f)+`<section class="section-card"><div class="module-copy-row">${copy}</div><div class="detail-copy"><h3>训练目的</h3><p>${esc(f['训练目的']||'—')}</p><h3>教练口令</h3><p>${esc(f['教练口令']||'—')}</p><h3>常见代偿</h3><p>${esc(f['常见代偿']||'—')}</p><h3>替换与进阶</h3><p><b>同级同任务：</b>${esc(f['同级同任务替换']||'—')}</p><p><b>同级不同任务：</b>${esc(f['同级不同任务']||'—')}</p><p><b>退阶：</b>${esc(f['推荐退阶']||'—')}</p><p><b>进阶：</b>${esc(f['推荐进阶']||'—')}</p></div></section>`;
    }
    const grades=['CORE-L1','CORE-L2','CORE-L3','CORE-L4'];
    const names={'CORE-L1':'基础控制','CORE-L2':'标准抗伸展','CORE-L3':'多方向稳定','CORE-L4':'高负荷整合'};
    const cards=grades.map(g=>{const ids=data.coreIds.filter(id=>id.startsWith(g+'-'));return `<article class="grade-card"><span>${g}</span><h3>${names[g]}</h3><div class="grade-actions">${ids.map(id=>{const a=data.actions[id]||{};return `<a href="#/system/core?focus=${encodeURIComponent(id)}"><b>${esc(data.coreDetails[id]?.name||a.name||id)}</b><small>${esc(a.coreDemand||'')}</small></a>`;}).join('')}</div></article>`;}).join('');
    return tabs('patterns')+`<a class="back-link" href="#/system/patterns">← 返回十大模式</a>`+hero('10｜核心模式 CORE','Core Grade 表示执行难度，Core Demand 表示核心任务；两个维度分开，不把“更难”误解成“必须换功能”。')+`<section class="grade-grid core-grades">${cards}</section>`;
  }
  function detailTable(fields){const preferred=['supportId','coreId','支撑等级','Core Grade','Core Demand','场馆路由','优先区域'];const items=preferred.filter(k=>fields[k]).map(k=>`<div><small>${esc(k)}</small><b>${esc(fields[k])}</b></div>`).join('');return items?`<section class="detail-facts">${items}</section>`:'';}
  function render(route){const page=(route.page||'patterns').split('?')[0];if(page==='prep')return prep(route);if(page==='support')return support(route);if(page==='core')return core(route);return patterns(route);}
  function bind(route){
    const page=(route.page||'patterns').split('?')[0];
    if(page!=='prep'||route.query?.focus||route.query?.foam)return;
    const controls=['prep-pattern','prep-session-level','prep-main-tier'].map(id=>document.getElementById(id)).filter(Boolean);
    controls.forEach(el=>el.addEventListener('change',()=>{
      const p=document.getElementById('prep-pattern')?.value||'蹲';
      const l=document.getElementById('prep-session-level')?.value||'L1';
      const t=document.getElementById('prep-main-tier')?.value||'T1';
      location.hash=`#/system/prep?pattern=${encodeURIComponent(p)}&level=${encodeURIComponent(l)}&tier=${encodeURIComponent(t)}`;
    }));
  }
  window.V14Views=window.V14Views||{};window.V14Views.system=render;
  window.V14Bind=window.V14Bind||{};window.V14Bind.system=bind;
})();