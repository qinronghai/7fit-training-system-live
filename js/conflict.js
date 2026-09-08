(function(){
  const D=()=>window.V14_DATA;
  function count(values){return values.reduce((o,x)=>{if(x)o[x]=(o[x]||0)+1;return o;},{});}
  function issue(list,severity,title,text,code=''){list.push({severity,title,text,code});}
  function evaluateComposer(resolved){
    const data=D(),issues=[],slots=resolved?.slots||[],chosen=slots.map(x=>x.actionId).filter(Boolean);
    const duplicates=count(chosen);
    Object.keys(duplicates).forEach(id=>{if(duplicates[id]>1)issue(issues,'hard','动作重复',(data.actions[id]?.name||id)+' 在自由组合正式训练块出现 '+duplicates[id]+' 次。');});
    chosen.forEach(id=>{
      const a=data.actions[id]||{};
      if(!['1F_ONLY','FLEX_1F_2F'].includes(a.route))issue(issues,'hard','楼层路由',(a.name||id)+' 当前不能进入 1F 正式训练块。');
      if(!['可自动编排','SUPPORT_CANON','CORE_CANON'].includes(a.status))issue(issues,'hard','编排状态',(a.name||id)+' 当前不是可自动编排节点。');
    });
    const c=slots.find(x=>x.slotKey==='C');
    if(c?.grade&&!(resolved?.windows?.support?.normal||[]).includes(c.grade)) issue(issues,'warn','支撑等级超出常规范围',c.grade+' 超出 '+resolved.level+' 常规 '+(resolved.windows.support.normal||[]).join('–')+' 候选窗口。','GRADE_OUTSIDE_NORMAL_WINDOW');
    const core=slots.find(x=>x.slotKey==='CORE');
    if(core?.grade&&!(resolved?.windows?.core?.normal||[]).includes(core.grade)) issue(issues,'warn','核心等级超出常规范围',core.grade+' 超出 '+resolved.level+' 常规核心候选窗口。','GRADE_OUTSIDE_NORMAL_WINDOW');
    const A=slots.find(x=>x.slotKey==='A'),B=slots.find(x=>x.slotKey==='B');
    for(const key of ['D1','D2']){const x=slots.find(s=>s.slotKey===key),a=data.actions[x?.actionId]||{};if(!x||!a.pattern)continue;const main=key==='D1'?data.actions[A?.actionId]||{}:data.actions[B?.actionId]||{};if(a.tier&&main.pattern&&a.pattern===main.pattern)issue(issues,'warn','辅助动作重复主模式',key+' 再次使用 '+a.pattern+' 高负荷主模式，请确认是否有意增加该模式训练量。','AUX_PATTERN_DUPLICATION');}
    const hardCount=issues.filter(x=>x.severity==='hard').length,warnCount=issues.filter(x=>x.severity==='warn').length;
    return {status:hardCount?'FAIL':warnCount?'WARN':'PASS',hardCount,warnCount,issues};
  }
  window.V14Conflict={
    evaluateComposer,
    evaluate(sessionId,selectedIds){
      const data=D(), session=data.sessions[sessionId];
      if(!session)return {status:'FAIL',hardCount:1,warnCount:0,issues:[{severity:'hard',title:'课程不存在',text:sessionId}]};
      const issues=[]; const chosen=selectedIds||session.slots.map(s=>s.baselineId);
      const duplicates=count(chosen);
      Object.keys(duplicates).forEach(id=>{if(duplicates[id]>1)issue(issues,'hard','动作重复',(data.actions[id]?.name||id)+' 在正式训练块出现 '+duplicates[id]+' 次。');});
      chosen.forEach(id=>{
        const a=data.actions[id]||{};
        if(!['1F_ONLY','FLEX_1F_2F'].includes(a.route))issue(issues,'hard','楼层路由',(a.name||id)+' 当前路由为 '+(a.routeLabel||a.route||'未标')+'，不能进入 1F 正式训练块。');
        if(!['可自动编排','SUPPORT_CANON','CORE_CANON'].includes(a.status))issue(issues,'hard','编排状态',(a.name||id)+' 当前不是可自动编排节点。');
        if((a.isSupport||a.isCore)&&['OPEN_LANE','WALK_LANE'].includes(a.space))issue(issues,'warn','空间要求',(a.name||id)+' 需要开放通道；一楼空间不足时应换同级动作或在下楼前完成。');
      });
      session.slots.forEach((slot,i)=>{
        const a=data.actions[chosen[i]]||{}, base=data.actions[slot.baselineId]||{};
        if(a.isCore){
          if(a.coreGrade&&base.coreGrade&&a.coreGrade!==base.coreGrade){
            const an=parseInt(a.coreGrade.slice(-1)),bn=parseInt(base.coreGrade.slice(-1));
            issue(issues,an>bn?'warn':'info',an>bn?'核心进阶':'核心退阶','CORE 从 '+base.coreGrade+' 调整到 '+a.coreGrade+'。');
          }
          if(a.coreDemand&&base.coreDemand&&a.coreDemand!==base.coreDemand&&a.coreGrade===base.coreGrade){issue(issues,'warn','核心任务改变','Core Demand 从「'+base.coreDemand+'」改为「'+a.coreDemand+'」。');}
        }else if(a.isSupport){
          const at=a.tier||a.supportGrade, bt=base.tier||base.supportGrade;
          if(at&&bt&&at!==bt){const an=parseInt(at.slice(-1)),bn=parseInt(bt.slice(-1));issue(issues,an>bn?'warn':'info',an>bn?'支撑进阶':'支撑退阶','支撑从 '+bt+' 调整到 '+at+'。');}
        }else{
          if(a.pattern&&slot.baselinePattern&&a.pattern!==slot.baselinePattern)issue(issues,'warn','动作模式改变',slot.slotName+'：'+slot.baselinePattern+' → '+a.pattern+'。');
          if(a.tier&&slot.baselineTier&&a.tier!==slot.baselineTier)issue(issues,'warn','V1.1 层级改变',slot.slotName+'：'+slot.baselineTier+' → '+a.tier+'。');
        }
      });
      const patterns=count(chosen.map(id=>data.actions[id]?.pattern||''));
      Object.keys(patterns).forEach(p=>{
        if(!p||['支撑模式','核心模式'].includes(p))return;
        const base=session.baselinePatterns?.[p]||0;
        if(patterns[p]>=2&&patterns[p]>base)issue(issues,'warn','动作模式堆叠',p+' 从默认 '+base+' 个增加到 '+patterns[p]+' 个。');
      });
      const loads=count(chosen.map(id=>data.actions[id]?.loadFamily||''));
      Object.keys(loads).forEach(f=>{
        if(!f||['支撑稳定','核心稳定'].includes(f))return;
        const base=session.baselineLoadFamilies?.[f]||0;
        if(loads[f]>=3&&loads[f]>base)issue(issues,'warn','训练负荷集中',f+' 从默认 '+base+' 个增加到 '+loads[f]+' 个。');
      });
      const eq=count(chosen.map(id=>data.actions[id]?.equipmentId||''));
      Object.keys(eq).forEach(e=>{
        if(!e||['SUPPORT_MAT','CORE_MAT'].includes(e))return;
        if(eq[e]>=3)issue(issues,'warn','器械集中',e+' 连续承担 '+eq[e]+' 个正式动作。');
        else if(eq[e]===2)issue(issues,'info','器械复用',e+' 有 2 个动作，可减少移动，但注意器械占用顺序。');
      });
      if(window.V14Anatomy){
        const concentration=window.V14Anatomy.compareToBaseline(sessionId,chosen);
        (concentration?.increases||[]).forEach(x=>{
          if(x.current>=3.0&&x.delta>=1.0){
            issue(issues,'warn','肌群刺激集中',x.muscle+' 暴露从 '+x.baseline.toFixed(2)+' 增至 '+x.current.toFixed(2)+'；请确认是否符合本节训练目标。');
          }
        });
      }
      const hardCount=issues.filter(x=>x.severity==='hard').length,warnCount=issues.filter(x=>x.severity==='warn').length;
      return {status:hardCount?'FAIL':warnCount?'WARN':'PASS',hardCount,warnCount,issues};
    }
  };
})();
