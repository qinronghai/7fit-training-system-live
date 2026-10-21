(function(){
  const D=()=>window.V14_DATA;
  const clean=x=>String(x??'').trim();
  // Issue #5: D1/D2 are 1F strength-zone auxiliaries; FLEX is reserved for formal main slots.
  const AUXILIARY_ROUTE_POLICY=Object.freeze(['1F_ONLY']);
  const MAIN_TIER_RANK=Object.freeze({T1:1,T2:2,T3:3,T4:4});
  const CORE_GRADE_RANK=Object.freeze({'CORE-L1':1,'CORE-L2':2,'CORE-L3':3,'CORE-L4':4});
  const FATIGUE_LOAD=Object.freeze({low:1,medium:2,high:3,very_high:4});
  const TRUNK_LOAD_BUDGET=Object.freeze({L1:11,L2:13,L3:16,L4:18});
  function cfg(){return D().composer||{};}
  function auxiliaryRoutePolicy(){return [...AUXILIARY_ROUTE_POLICY];}
  function isAuxiliaryRouteAllowed(route){return AUXILIARY_ROUTE_POLICY.includes(route);}
  function mainTierWindow(level){return cfg().levelMap?.[level]||cfg().levelMap?.L1||{recommended:'T1',normal:['T1'],expanded:[]};}
  function supportWindow(level){return cfg().supportMap?.[level]||cfg().supportMap?.L1||{recommended:'SUP-S1',normal:['SUP-S1'],expanded:[]};}
  function coreWindow(level){return cfg().coreMap?.[level]||cfg().coreMap?.L1||{recommended:['CORE-L1'],normal:['CORE-L1'],expanded:[]};}
  function combinations(){
    const out=[];
    for(const [lk,l] of Object.entries(cfg().lowerModes||{})) for(const [uk,u] of Object.entries(cfg().upperModes||{})) out.push({id:`F111-C-${l.code}-${u.code}`,lowerMode:lk,upperMode:uk,lower:l.name,upper:u.name});
    return out;
  }
  function actionView(id){
    const a=D().actions?.[id]||{};
    return {id,name:a.name||id,tier:a.tier||'',grade:a.supportGrade||a.grade||a.coreGrade||'',coreDemand:a.coreDemand||'',pattern:a.pattern||'',route:a.route||'',status:a.status||''};
  }
  function gradeFor(id){
    const a=D().actions?.[id]||{};
    return a.grade||a.supportGrade||a.coreGrade||id.split('-').slice(0,2).join('-');
  }
  const SUPPORT_DEMAND_BY_CORE=Object.freeze({
    anti_extension:['抗伸展'],
    anti_rotation:['抗旋转'],
    anti_lateral_flexion:['抗侧屈'],
    dynamic_rotation:['旋转控制'],
    breathing_pressure:['骨盆控制','抗伸展'],
    loaded_integration:['抗伸展','抗旋转'],
  });
  function supportMetaFor(id){
    const meta=D().supportMeta?.[id]||{};
    const grade=gradeFor(id);
    return {
      supportDemand:Array.isArray(meta.supportDemand)?meta.supportDemand:[],
      branch:meta.branch||D().supportBranches?.[grade]||'',
      posture:meta.posture||'',challengeType:meta.challengeType||'',fatigueCost:meta.fatigueCost||'medium',
      jointLoad:Array.isArray(meta.jointLoad)?meta.jointLoad:[],spaceRequirement:meta.spaceRequirement||'',
      memberFeeling:meta.memberFeeling||'',recommendedDose:meta.recommendedDose||'',
      regressionId:meta.regressionId||'',progressionId:meta.progressionId||'',sameDemandIds:Array.isArray(meta.sameDemandIds)?meta.sameDemandIds:[],
      autoRecommendable:meta.autoRecommendable!==false,
    };
  }
  function coreMetaFor(id){
    const meta=D().coreMeta?.[id]||{},grade=gradeFor(id);
    return {
      coreDemandTags:Array.isArray(meta.coreDemand)?meta.coreDemand:[],
      branch:meta.branch||D().coreBranches?.[grade]||'',
      challengeType:meta.challengeType||'',fatigueCost:meta.fatigueCost||'medium',
      jointLoad:Array.isArray(meta.jointLoad)?meta.jointLoad:[],spaceRequirement:meta.spaceRequirement||'',
      memberFeeling:meta.memberFeeling||'',recommendedDose:meta.recommendedDose||'',
      regressionId:meta.regressionId||'',progressionId:meta.progressionId||'',sameDemandIds:Array.isArray(meta.sameDemandIds)?meta.sameDemandIds:[],
      autoRecommendable:meta.autoRecommendable!==false,
    };
  }
  function trunkLoadAudit(slots=[],level='L1'){
    const entries=(slots||[]).filter(slot=>slot?.actionId).map(slot=>{
      const action=D().actions?.[slot.actionId]||{},body=D().bodyActionMeta?.[slot.actionId]||{};
      let fatigue=body.fatigueCost||action.fatigueCost||'low',stability=body.stabilityDemand||'low',jointLoad=[];
      if(slot.slotKey==='C'){
        const meta=supportMetaFor(slot.actionId);fatigue=meta.fatigueCost;jointLoad=meta.jointLoad;stability=meta.supportDemand.length>1?'medium':'low';
      }else if(slot.slotKey==='CORE'){
        const meta=coreMetaFor(slot.actionId);fatigue=meta.fatigueCost;jointLoad=meta.jointLoad;stability=meta.challengeType==='control'?'low':meta.challengeType==='anti_rotation'?'medium':'high';
      }
      const score=(FATIGUE_LOAD[fatigue]||2)+(stability==='high'?2:stability==='medium'?1:0);
      return {slotKey:slot.slotKey,actionId:slot.actionId,fatigueCost:fatigue,stabilityDemand:stability,jointLoad,score};
    });
    const total=entries.reduce((sum,entry)=>sum+entry.score,0),budget=TRUNK_LOAD_BUDGET[level]||TRUNK_LOAD_BUDGET.L1;
    return {level,total,budget,overBudget:total>budget,entries,highFatigueSlots:entries.filter(entry=>['high','very_high'].includes(entry.fatigueCost)).map(entry=>entry.slotKey)};
  }
  function coreDemandLabels(context={}){
    const actual=clean(context.coreDemandText).split('/').map(value=>value.trim()).filter(Boolean);
    if(actual.length)return actual;
    return SUPPORT_DEMAND_BY_CORE[context.coreDemand]||[];
  }
  function recentSignals(context={}){
    const recent=context.recentContext||context.memberContext||{};
    const recentActions=Array.isArray(recent.recentActions)?recent.recentActions:[];
    const supportIds=new Set(),coreIds=new Set(),supportDemands=new Set(),coreDemands=new Set();
    recentActions.forEach(item=>{
      const id=String(item?.actionId||'');
      if(!id)return;
      if(D().supportMeta?.[id]){
        supportIds.add(id);
        (D().supportMeta[id].supportDemand||[]).forEach(demand=>supportDemands.add(demand));
      }
      if(D().coreMeta?.[id]||D().actions?.[id]?.isCore){
        coreIds.add(id);
        const actionDemand=String(D().actions?.[id]?.coreDemand||'');
        actionDemand.split('/').map(value=>value.trim()).filter(Boolean).forEach(demand=>coreDemands.add(demand));
        (D().coreMeta?.[id]?.coreDemand||[]).forEach(demand=>coreDemands.add(demand));
      }
    });
    return {supportIds,coreIds,supportDemands,coreDemands};
  }
  function supportHistory(id,context={}){
    const signals=recentSignals(context),meta=supportMetaFor(id);
    if(signals.supportIds.has(id))return {score:0,recentlyUsed:true,recentNote:'近 3 节已使用该支撑动作'};
    if(meta.supportDemand.some(demand=>signals.supportDemands.has(demand)))return {score:1,recentlyUsed:true,recentNote:'近 3 节已使用相同支撑任务'};
    return {score:2,recentlyUsed:false,recentNote:''};
  }
  function coreHistory(id,context={}){
    const signals=recentSignals(context),meta=coreMetaFor(id),actionDemand=String(D().actions?.[id]?.coreDemand||'');
    if(signals.coreIds.has(id))return {score:0,historyScore:0,recentlyUsed:true,historyNote:'近 3 节已使用该 CORE 动作'};
    if(meta.coreDemandTags.some(demand=>signals.coreDemands.has(demand))||actionDemand.split('/').some(demand=>signals.coreDemands.has(demand.trim())))return {score:1,historyScore:1,recentlyUsed:true,historyNote:'近 3 节已使用相同 CORE 任务'};
    return {score:2,historyScore:2,recentlyUsed:false,historyNote:''};
  }
  function supportDecision(id,context={}){
    const action=actionView(id),meta=supportMetaFor(id),level=context.level||'L1',window=supportWindow(level);
    const normal=new Set(window.normal||[]),expanded=new Set(window.expanded||[]),tradeoffs=[],reasons=[];
    const coreDemands=coreDemandLabels(context);
    const repeatedCoreDemand=coreDemands.find(demand=>meta.supportDemand.includes(demand));
    if(!normal.has(action.grade)){
      tradeoffs.push(expanded.has(action.grade)?'超出当前等级常规窗口，属于扩展选项':'超出当前等级常规窗口');
    }
    if(repeatedCoreDemand){
      tradeoffs.push('与 CORE 训练任务重复');
    }else if(coreDemands.length){
      reasons.push('补充 CORE 未覆盖的支撑任务');
    }
    const selected=(context.selectedIds||[]).map(actionView);
    if(selected.some(item=>item.pattern&&meta.supportDemand.includes(item.pattern))){
      tradeoffs.push('与主训练模式存在局部负荷重叠');
    }
    if(action.grade===window.recommended)reasons.push('符合当前等级首选窗口');
    if(meta.fatigueCost==='low')reasons.push('疲劳成本低，适合收尾');
    if(meta.spaceRequirement==='open_lane')tradeoffs.push('需要开放通道');
    const history=supportHistory(id,context);
    return {
      ...meta,
      id,
      supportReason:reasons.join('；')||'保持支撑任务多样性',
      needsConfirmation:tradeoffs.length>0,
      complementarityScore:repeatedCoreDemand?0:1,
      fatigueScore:meta.fatigueCost==='low'?3:meta.fatigueCost==='medium'?2:1,
      jointLoadScore:Math.max(0,4-meta.jointLoad.length),
      feasibilityScore:meta.spaceRequirement==='open_lane'?0:1,
      historyScore:history.score,
      recentlyUsed:history.recentlyUsed,
      recentNote:history.recentNote,
      tradeoffs,
      recommendationScore:(action.grade===window.recommended?30:normal.has(action.grade)?24:expanded.has(action.grade)?18:10)+(meta.fatigueCost==='low'?15:meta.fatigueCost==='medium'?8:0)+(tradeoffs.length?0:15),
    };
  }
  function byTier(candidates,level,includeExpanded=false,mode={}){
    const w=mainTierWindow(level),allowed=new Set([...(w.normal||[]),...(includeExpanded?(w.expanded||[]):[])]),rec=w.recommended;
    const ranked=(candidates||[]).map(candidate=>{
      const id=clean(candidate?.id),effectiveTier=clean(candidate?.tier),x=actionView(id);
      x.sourceTier=x.tier;x.tier=effectiveTier;
      x.prescriptionOverride=clean(mode.prescriptionByTier?.[effectiveTier]);
      x.tierNote=clean(mode.tierNoteByTier?.[effectiveTier]);
      return x;
    }).filter(x=>allowed.has(x.tier)&&x.status==='可自动编排'&&['1F_ONLY','FLEX_1F_2F'].includes(x.route))
      .sort((a,b)=>{
        const recOrder=(a.tier===rec?0:1)-(b.tier===rec?0:1);
        if(recOrder)return recOrder;
        const tierOrder=(MAIN_TIER_RANK[a.tier]||99)-(MAIN_TIER_RANK[b.tier]||99);
        if(tierOrder)return tierOrder;
        return String(a.id).localeCompare(String(b.id));
      });
    const seen=new Set();
    return ranked.filter(x=>{if(seen.has(x.id))return false;seen.add(x.id);return true;});
  }
  function mainCandidates(kind,modeKey,level,includeExpanded=false){
    const mode=(kind==='lower'?cfg().lowerModes:cfg().upperModes)?.[modeKey];
    return byTier(mode?.candidates||[],level,includeExpanded,mode||{});
  }
  function supportCandidates(level,includeExpanded=false,context={}){
    const w=supportWindow(level),grades=[...(w.normal||[]),...(includeExpanded?(w.expanded||[]):[])],allowed=new Set(grades),rec=w.recommended;
    return (D().supportIds||[]).map(id=>{const a=actionView(id);a.grade=D().actions[id]?.grade||D().actions[id]?.supportGrade||id.split('-').slice(0,2).join('-');return {...a,...supportDecision(id,{...context,level})};}).filter(x=>allowed.has(x.grade)).sort((a,b)=>
      b.complementarityScore-a.complementarityScore
      ||b.historyScore-a.historyScore
      ||b.fatigueScore-a.fatigueScore
      ||b.jointLoadScore-a.jointLoadScore
      ||b.feasibilityScore-a.feasibilityScore
      ||(a.grade===rec?0:1)-(b.grade===rec?0:1)
      ||b.recommendationScore-a.recommendationScore
      ||String(a.id).localeCompare(String(b.id))
    );
  }
  function supportSelectionOptions(){
    return (D().supportIds||[]).map(id=>{const a=actionView(id);a.grade=D().actions[id]?.grade||D().actions[id]?.supportGrade||id.split('-').slice(0,2).join('-');return {...a,...supportMetaFor(id)};});
  }
  function matchesDemand(a,demandKey){
    const meta=cfg().coreDemands?.[demandKey]; if(!meta)return true;
    const text=clean(a.coreDemand); return (meta.keywords||[]).some(k=>text.includes(k));
  }
  function coreGradeRank(grade){return CORE_GRADE_RANK[grade]||0;}
  function sortCoreCandidates(list,recommended,recentContext={}){
    return list.slice().map(item=>({...item,...coreHistory(item.id,{recentContext})})).sort((a,b)=>
      b.historyScore-a.historyScore
      ||(recommended.has(b.grade)?1:0)-(recommended.has(a.grade)?1:0)
      ||coreGradeRank(b.grade)-coreGradeRank(a.grade)
      ||String(a.id).localeCompare(String(b.id))
    );
  }
  function coreCandidates(level,demandKey='anti_extension',includeExpanded=false,recentContext={}){
    const w=coreWindow(level),grades=[...(w.normal||[]),...(includeExpanded?(w.expanded||[]):[])],allowed=new Set(grades),recommended=new Set(w.recommended||[]);
    const base=(D().coreIds||[]).map(id=>{const a=actionView(id);a.grade=D().actions[id]?.coreGrade||a.tier;return a;}).filter(x=>allowed.has(x.grade));
    return sortCoreCandidates(base.filter(x=>matchesDemand(x,demandKey)),recommended,recentContext);
  }
  function coreFallbackCandidates(level,includeExpanded=false,recentContext={}){
    const w=coreWindow(level),grades=[...(w.normal||[]),...(includeExpanded?(w.expanded||[]):[])],allowed=new Set(grades),recommended=new Set(w.recommended||[]);
    const base=(D().coreIds||[]).map(id=>{const a=actionView(id);a.grade=D().actions[id]?.coreGrade||a.tier;return a;}).filter(x=>allowed.has(x.grade));
    return sortCoreCandidates(base,recommended,recentContext);
  }
  function coreDecision(level,demandKey='anti_extension',includeExpanded=false,selectedId='',recentContext={}){
    const exactCandidates=coreCandidates(level,demandKey,includeExpanded,recentContext),fallbackCandidates=coreFallbackCandidates(level,includeExpanded,recentContext);
    const allowed=new Set(fallbackCandidates.map(item=>item.grade));
    const selected=selectedId?((D().coreIds||[]).map(id=>actionView(id)).find(item=>item.id===selectedId)||null):null;
    const chosen=selected||exactCandidates[0]||fallbackCandidates[0]||null;
    const exact=!!chosen&&matchesDemand(chosen,demandKey);
    const tradeoffs=[];
    if(!exactCandidates.length)tradeoffs.push('当前等级没有该 CORE 任务动作');
    if(chosen&&!allowed.has(chosen.grade))tradeoffs.push('超出当前等级常规窗口');
    if(selected&&!matchesDemand(selected,demandKey))tradeoffs.push('当前选择与 CORE 训练任务不匹配');
    return {
      status:exactCandidates.length?'EXACT':'NO_MATCH',
      exactCandidates,
      fallbackCandidates,
      selectedId:chosen?.id||'',
      selected:chosen,
      coreDemandMatch:exact?'EXACT':'NO_MATCH',
      coreReason:exact?'符合当前等级 CORE 任务':'当前等级没有该 CORE 任务动作，请从同级替代中确认',
      coreNeedsConfirmation:tradeoffs.length>0,
      coreTradeoffs:tradeoffs,
      ...coreHistory(chosen?.id||'',{recentContext}),
    };
  }
  function coreSelectionOptions(){
    return (D().coreIds||[]).map(id=>{const a=actionView(id);a.grade=D().actions[id]?.coreGrade||a.tier;return a;});
  }
  function auxCandidates(kind,modeKey,selectedIds=[],context={}){
    if(kind==='lower'&&window.V15LowerAssistance?.candidates){
      const result=window.V15LowerAssistance.candidates({
        consumer:'F111_D1',
        level:context.level||'L1',
        lowerMode:modeKey,
        currentActionIds:selectedIds,
        currentSelections:context.currentSelections||{},
      });
      return (result.candidates||[]).map(candidate=>{
        const view=actionView(candidate.actionId);
        view.recommendationScore=candidate.recommendationScore;
        view.recommendationReasons=candidate.reasons||[];
        view.recommendationTradeoffs=candidate.tradeoffs||[];
        view.functionalFamily=candidate.functionalFamily||'';
        view.functionalFamilyLabel=candidate.functionalFamilyLabel||'';
        view.trainingRoles=candidate.trainingRoles||[];
        view.localFatigueImpact=candidate.localFatigueImpact||{};
        return view;
      }).filter(x=>x.status==='可自动编排'&&isAuxiliaryRouteAllowed(x.route));
    }
    const ids=cfg().auxiliaryRules?.[kind]?.[modeKey]||[],blocked=new Set(selectedIds||[]);
    return ids.filter(id=>!blocked.has(id)).map(actionView).filter(x=>x.status==='可自动编排'&&isAuxiliaryRouteAllowed(x.route));
  }
  function chooseById(options,id){return options.find(x=>x.id===id)||options[0]||null;}
  function resolve(input={}){
    const level=/^L[1-4]$/.test(input.level)?input.level:'L1';
    const lowerMode=cfg().lowerModes?.[input.lowerMode]?input.lowerMode:Object.keys(cfg().lowerModes||{})[0];
    const upperMode=cfg().upperModes?.[input.upperMode]?input.upperMode:Object.keys(cfg().upperModes||{})[0];
    const lower=cfg().lowerModes[lowerMode],upper=cfg().upperModes[upperMode],selections=input.selections||{};
    const coreDemand=cfg().coreDemands?.[input.coreDemand]?input.coreDemand:'anti_extension';
    const Aopts=mainCandidates('lower',lowerMode,level,!!input.includeExpandedMain), Bopts=mainCandidates('upper',upperMode,level,!!input.includeExpandedMain);
    const A=chooseById(Aopts,selections.A),B=chooseById(Bopts,selections.B);
    const COREopts=coreSelectionOptions();
    const COREdecision=coreDecision(level,coreDemand,!!input.includeExpandedCore,selections.CORE,input.recentContext);
    const CORE=COREopts.find(option=>option.id===COREdecision.selectedId)||COREdecision.selected;
    const Ccontext={level,coreDemand,coreDemandText:CORE?.coreDemand,selectedIds:[A?.id,B?.id],recentContext:input.recentContext};
    const CautoOptions=supportCandidates(level,!!input.includeExpandedSupport,Ccontext),Copts=supportSelectionOptions();
    const C=Copts.find(option=>option.id===selections.C)||chooseById(CautoOptions);
    const Cdecision=supportDecision(C?.id||'',Ccontext);
    const D1opts=auxCandidates('lower',lowerMode,[A?.id,B?.id],{level,currentSelections:{A:A?.id,B:B?.id,C:C?.id}}),D1=chooseById(D1opts,selections.D1);
    const D2opts=auxCandidates('upper',upperMode,[A?.id,B?.id,D1?.id]),D2=chooseById(D2opts,selections.D2);
    const coreMeta=coreMetaFor(CORE?.id||'');
    const slot=(key,label,x)=>({slotKey:key,slotName:label,actionId:x?.id||'',name:x?.name||'',tier:x?.tier||'',grade:x?.grade||'',coreDemand:x?.coreDemand||'',prescriptionOverride:clean(cfg().prescriptionBySlot?.[key])||x?.prescriptionOverride||'',tierNote:x?.tierNote||'',...(key==='C'?{supportReason:Cdecision.supportReason,supportDemand:Cdecision.supportDemand,branch:Cdecision.branch,fatigueCost:Cdecision.fatigueCost,memberFeeling:Cdecision.memberFeeling,recommendedDose:Cdecision.recommendedDose,alternatives:Cdecision.sameDemandIds,needsConfirmation:Cdecision.needsConfirmation,tradeoffs:Cdecision.tradeoffs,recentlyUsed:Cdecision.recentlyUsed,recentNote:Cdecision.recentNote}: {}),...(key==='CORE'?{...coreMeta,coreBranch:coreMeta.branch,coreFatigueCost:coreMeta.fatigueCost,coreMemberFeeling:coreMeta.memberFeeling,coreRecommendedDose:coreMeta.recommendedDose,coreJointLoad:coreMeta.jointLoad,coreSpaceRequirement:coreMeta.spaceRequirement,coreReason:COREdecision.coreReason,coreDemandMatch:COREdecision.coreDemandMatch,coreNeedsConfirmation:COREdecision.coreNeedsConfirmation,coreTradeoffs:COREdecision.coreTradeoffs,coreAlternatives:coreMeta.sameDemandIds,recentlyUsed:COREdecision.recentlyUsed,historyNote:COREdecision.historyNote}: {})});
    const resolvedSlots=[slot('A','A｜下肢主项',A),slot('B','B｜上肢主项',B),slot('C','C｜支撑模式',C),slot('D1','D1｜下肢辅助',D1),slot('D2','D2｜上肢辅助',D2),slot('CORE','CORE｜核心模式',CORE)];
    return {
      compositionId:`F111-C-${lower.code}-${upper.code}`,
      level,lowerMode,upperMode,lower,upper,coreDemand,
      windows:{main:mainTierWindow(level),support:supportWindow(level),core:coreWindow(level)},
      slots:resolvedSlots,
      trunkLoadAudit:trunkLoadAudit(resolvedSlots,level),
      slotOptions:{A:Aopts,B:Bopts,C:Copts,D1:D1opts,D2:D2opts,CORE:COREopts}
    };
  }
  window.V14Composer={combinations,mainTierWindow,supportWindow,coreWindow,mainCandidates,supportCandidates,supportMetaFor,supportDecision,coreMetaFor,coreCandidates,coreFallbackCandidates,coreDecision,trunkLoadAudit,auxCandidates,auxiliaryRoutePolicy,isAuxiliaryRouteAllowed,resolve};
})();
