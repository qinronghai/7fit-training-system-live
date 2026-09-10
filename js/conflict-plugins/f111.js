(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const count=values=>values.reduce((out,value)=>{if(value)out[value]=(out[value]||0)+1;return out;},{});
  const makeIssue=(severity,title,text,code='',_order=0)=>({severity,title,text,code,_order});

  function sharedPolicy(mode){
    const composer=mode==='composer';
    return {
      allowedRoutes:['1F_ONLY','FLEX_1F_2F'],
      allowedStatuses:['可自动编排','SUPPORT_CANON','CORE_CANON'],
      orderIssue(kind,index,sequence){
        if(kind==='structure')return 0;
        if(kind==='duplicate')return 100+(sequence||0);
        if(kind==='missing')return 900+(index||0);
        if(kind==='route')return 1000+(index||0)*10;
        if(kind==='status')return 1001+(index||0)*10;
        if(kind==='equipment')return 7000+(index||0);
        if(kind==='time')return 8000;
        return 9000+(index||0);
      },
      formatIssue:{
        duplicate({name,count}){
          return {severity:'hard',title:'动作重复',text:name+(composer?' 在自由组合正式训练块出现 ':' 在正式训练块出现 ')+count+' 次。',code:''};
        },
        route({actionId,action}){
          const name=action?.name||actionId;
          return composer
            ? {severity:'hard',title:'楼层路由',text:name+' 当前不能进入 1F 正式训练块。',code:''}
            : {severity:'hard',title:'楼层路由',text:name+' 当前路由为 '+(action?.routeLabel||action?.route||'未标')+'，不能进入 1F 正式训练块。',code:''};
        },
        status({actionId,action}){
          return {severity:'hard',title:'编排状态',(text):(action?.name||actionId)+' 当前不是可自动编排节点。',code:''};
        }
      }
    };
  }

  function currentSlots(resolvedSession,resolved){
    const current=new Map((resolvedSession?.main?.content||[]).map(item=>[item.key,item.actionId]));
    return (resolved?.slots||[]).map((slot,index)=>{
      const key=slot.slotKey||slot.key||`S${index+1}`;
      const actionId=current.get(key)||slot.actionId;
      return {...slot,slotKey:key,actionId};
    });
  }

  function evaluateComposer(resolvedSession,context){
    const data=D(),resolved=context.resolved||{},slots=currentSlots(resolvedSession,resolved),issues=[];
    const c=slots.find(x=>x.slotKey==='C');
    if(c?.grade&&!(resolved?.windows?.support?.normal||[]).includes(c.grade)){
      issues.push(makeIssue('warn','支撑等级超出常规范围',c.grade+' 超出 '+resolved.level+' 常规 '+(resolved.windows.support.normal||[]).join('–')+' 候选窗口。','GRADE_OUTSIDE_NORMAL_WINDOW',2000));
    }
    const core=slots.find(x=>x.slotKey==='CORE');
    if(core?.grade&&!(resolved?.windows?.core?.normal||[]).includes(core.grade)){
      issues.push(makeIssue('warn','核心等级超出常规范围',core.grade+' 超出 '+resolved.level+' 常规核心候选窗口。','GRADE_OUTSIDE_NORMAL_WINDOW',2010));
    }
    const A=slots.find(x=>x.slotKey==='A'),B=slots.find(x=>x.slotKey==='B');
    ['D1','D2'].forEach((key,keyIndex)=>{
      const x=slots.find(slot=>slot.slotKey===key),action=data.actions?.[x?.actionId]||{};
      if(!x||!action.pattern)return;
      const main=key==='D1'?(data.actions?.[A?.actionId]||{}):(data.actions?.[B?.actionId]||{});
      if(action.tier&&main.pattern&&action.pattern===main.pattern){
        issues.push(makeIssue('warn','辅助动作重复主模式',key+' 再次使用 '+action.pattern+' 高负荷主模式，请确认是否有意增加该模式训练量。','AUX_PATTERN_DUPLICATION',2100+keyIndex));
      }
    });
    return issues;
  }

  function evaluatePreset(resolvedSession,context){
    const data=D(),sessionId=context.sessionId,session=data.sessions?.[sessionId];
    if(!session)return [];
    const chosen=(resolvedSession?.main?.content||[]).map(item=>item.actionId),issues=[];

    chosen.forEach((actionId,index)=>{
      const action=data.actions?.[actionId]||{};
      if((action.isSupport||action.isCore)&&['OPEN_LANE','WALK_LANE'].includes(action.space)){
        issues.push(makeIssue('warn','空间要求',(action.name||actionId)+' 需要开放通道；一楼空间不足时应换同级动作或在下楼前完成。','',1002+index*10));
      }
    });

    session.slots.forEach((slot,index)=>{
      const action=data.actions?.[chosen[index]]||{},base=data.actions?.[slot.baselineId]||{};
      let offset=0;
      if(action.isCore){
        if(action.coreGrade&&base.coreGrade&&action.coreGrade!==base.coreGrade){
          const current=parseInt(action.coreGrade.slice(-1)),baseline=parseInt(base.coreGrade.slice(-1));
          issues.push(makeIssue(current>baseline?'warn':'info',current>baseline?'核心进阶':'核心退阶','CORE 从 '+base.coreGrade+' 调整到 '+action.coreGrade+'。','',2000+index*10+offset++));
        }
        if(action.coreDemand&&base.coreDemand&&action.coreDemand!==base.coreDemand&&action.coreGrade===base.coreGrade){
          issues.push(makeIssue('warn','核心任务改变','Core Demand 从「'+base.coreDemand+'」改为「'+action.coreDemand+'」。','',2000+index*10+offset++));
        }
      }else if(action.isSupport){
        const current=action.tier||action.supportGrade,baseline=base.tier||base.supportGrade;
        if(current&&baseline&&current!==baseline){
          const currentN=parseInt(current.slice(-1)),baselineN=parseInt(baseline.slice(-1));
          issues.push(makeIssue(currentN>baselineN?'warn':'info',currentN>baselineN?'支撑进阶':'支撑退阶','支撑从 '+baseline+' 调整到 '+current+'。','',2000+index*10+offset++));
        }
      }else{
        if(action.pattern&&slot.baselinePattern&&action.pattern!==slot.baselinePattern){
          issues.push(makeIssue('warn','动作模式改变',slot.slotName+'：'+slot.baselinePattern+' → '+action.pattern+'。','',2000+index*10+offset++));
        }
        if(action.tier&&slot.baselineTier&&action.tier!==slot.baselineTier){
          issues.push(makeIssue('warn','V1.1 层级改变',slot.slotName+'：'+slot.baselineTier+' → '+action.tier+'。','',2000+index*10+offset++));
        }
      }
    });

    let sequence=0;
    const patterns=count(chosen.map(id=>data.actions?.[id]?.pattern||''));
    Object.keys(patterns).forEach(pattern=>{
      if(!pattern||['支撑模式','核心模式'].includes(pattern))return;
      const baseline=session.baselinePatterns?.[pattern]||0;
      if(patterns[pattern]>=2&&patterns[pattern]>baseline){
        issues.push(makeIssue('warn','动作模式堆叠',pattern+' 从默认 '+baseline+' 个增加到 '+patterns[pattern]+' 个。','',3000+sequence++));
      }
    });

    sequence=0;
    const loads=count(chosen.map(id=>data.actions?.[id]?.loadFamily||''));
    Object.keys(loads).forEach(family=>{
      if(!family||['支撑稳定','核心稳定'].includes(family))return;
      const baseline=session.baselineLoadFamilies?.[family]||0;
      if(loads[family]>=3&&loads[family]>baseline){
        issues.push(makeIssue('warn','训练负荷集中',family+' 从默认 '+baseline+' 个增加到 '+loads[family]+' 个。','',4000+sequence++));
      }
    });

    sequence=0;
    const equipment=count(chosen.map(id=>data.actions?.[id]?.equipmentId||''));
    Object.keys(equipment).forEach(equipmentId=>{
      if(!equipmentId||['SUPPORT_MAT','CORE_MAT'].includes(equipmentId))return;
      if(equipment[equipmentId]>=3){
        issues.push(makeIssue('warn','器械集中',equipmentId+' 连续承担 '+equipment[equipmentId]+' 个正式动作。','',5000+sequence++));
      }else if(equipment[equipmentId]===2){
        issues.push(makeIssue('info','器械复用',equipmentId+' 有 2 个动作，可减少移动，但注意器械占用顺序。','',5000+sequence++));
      }
    });

    if(window.V14Anatomy){
      sequence=0;
      const concentration=window.V14Anatomy.compareToBaseline(sessionId,chosen);
      (concentration?.increases||[]).forEach(item=>{
        if(item.current>=3.0&&item.delta>=1.0){
          issues.push(makeIssue('warn','肌群刺激集中',item.muscle+' 暴露从 '+item.baseline.toFixed(2)+' 增至 '+item.current.toFixed(2)+'；请确认是否符合本节训练目标。','',6000+sequence++));
        }
      });
    }
    return issues;
  }

  const plugin={
    sharedPolicy,
    evaluate(resolvedSession,context={}){
      if(context.mode==='composer')return evaluateComposer(resolvedSession,context);
      if(context.mode==='preset')return evaluatePreset(resolvedSession,context);
      return [];
    }
  };

  window.V15F111ConflictPlugin=plugin;
  if(!window.V15Conflict?.register)throw new Error('V15Conflict service is unavailable');
  window.V15Conflict.register('f111',plugin);
})();
