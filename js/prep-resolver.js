(function(){
  'use strict';

  const SLOT_ORDER=Object.freeze(['MOB-L','MOB-U','PRIMER','CORE-ACT','INTEGRATED']);
  const SLOT_META=Object.freeze({
    'MOB-L':Object.freeze({name:'下肢 / 髋踝活动',purpose:'为下肢主模式准备可用活动范围'}),
    'MOB-U':Object.freeze({name:'上肢 / 胸椎 / 肩带活动',purpose:'为上肢推拉准备胸椎、肩带与肩关节'}),
    'PRIMER':Object.freeze({name:'主动作模式准备',purpose:'用低疲劳动作预习当节主要模式或关键稳定需求'}),
    'CORE-ACT':Object.freeze({name:'核心 / 躯干激活',purpose:'建立呼吸、骨盆与躯干稳定，不做到疲劳'}),
    'INTEGRATED':Object.freeze({name:'整合动态热身',purpose:'把多个区域连接成连续、低疲劳的全身准备'}),
  });
  const CA_WINDOWS=Object.freeze({
    L1:Object.freeze(['CA1']),
    L2:Object.freeze(['CA2','CA1']),
    L3:Object.freeze(['CA3','CA2','CA1']),
    L4:Object.freeze(['CA4','CA3','CA2','CA1']),
  });
  const TEMPLATE_TYPES=Object.freeze(['f111','body','conditioning']);
  const PREP_ROUTES=new Set(['2F PREP','2F_ONLY','FLEX_1F_2F']);
  const LOWER_RE=/髋|踝|腘绳|内收|臀|股四|小腿|下肢|后侧链/;
  const UPPER_RE=/胸椎|肩|上背|胸廓|肩胛|肩袖|上肢/;
  const MOBILITY_RE=/活动|伸展|旋转|绕环|捞月/;
  const PRIMER_RE=/动作模式|激活|唤醒|稳定|外旋|侧向|臀桥/;
  const CORE_RE=/核心|支撑|死虫|平板|腹壁|躯干/;
  const INTEGRATED_RE=/全身动态|整合|多关节/;

  const D=()=>window.V14_DATA||{};
  const G=()=>window.V14PrepGrade||null;
  const A=()=>window.V14Anatomy||null;
  const unique=items=>[...new Set((Array.isArray(items)?items:[]).filter(x=>typeof x==='string'&&x))];
  const textOf=w=>[w?.name,w?.alias,w?.role,...(w?.regions||[])].filter(Boolean).join(' ');

  function isPrepRouteAllowed(route){return PREP_ROUTES.has(route);}

  function isActionPrepEligible(action){
    if(!action||!isPrepRouteAllowed(action.route))return false;
    if(action.prepEligible===true||action.warmupEligible===true)return true;
    return Array.isArray(action.usageDomains)&&action.usageDomains.includes('PREP');
  }

  function caLevelFor(candidate){
    if(candidate?.caLevel&&/^CA[1-4]$/.test(candidate.caLevel))return candidate.caLevel;
    const grade=candidate?.prepGrade;
    return /^P[1-4]$/.test(grade||'')?`CA${grade.slice(-1)}`:'';
  }

  function normalizeContext(input={}){
    const data=D();
    const template=TEMPLATE_TYPES.includes(input.template)?input.template:'f111';
    const level=/^L[1-4]$/.test(input.level||'')?input.level:'L1';
    const mainActionIds=unique(input.mainActionIds);
    const inferredPatterns=mainActionIds.map(id=>data.actions?.[id]?.pattern).filter(Boolean);
    const mainPatterns=unique([...(input.mainPatterns||[]),...inferredPatterns]);
    const formalActionIds=unique([
      ...mainActionIds,
      ...(input.formalActionIds||[]),
      ...(input.supportActionIds||[]),
      ...(input.coreActionIds||[]),
    ]);
    return {
      template,
      level,
      recipeId:typeof input.recipeId==='string'?input.recipeId:'',
      mainPatterns,
      mainActionIds,
      formalActionIds,
      targetMuscles:unique(input.targetMuscles),
      modalities:unique(input.modalities),
      impactDemand:typeof input.impactDemand==='string'?input.impactDemand:'',
      powerDemand:typeof input.powerDemand==='string'?input.powerDemand:'',
    };
  }

  function contextFromF111(input={}){
    const data=D(),recipe=data.recipes?.[input.recipeId]||{};
    return normalizeContext({
      ...input,
      template:'f111',
      mainPatterns:unique([recipe.lower,recipe.upper,...(input.mainPatterns||[])]),
    });
  }

  function normalizeSelections(input={}){
    const out={};
    SLOT_ORDER.forEach(slotKey=>{
      const value=input?.[slotKey];
      if(!value)return;
      const actionId=typeof value==='string'?value:value.actionId;
      if(typeof actionId!=='string'||!actionId)return;
      const source=typeof value==='object'&&value.source==='auto'?'auto':'manual';
      out[slotKey]={actionId,source};
    });
    return out;
  }

  function candidateFromWarmup(w){
    if(!w||!w.actionId||!w.prepId)return null;
    return {
      prepId:w.prepId,
      actionId:w.actionId,
      name:w.name||w.actionId,
      prepGrade:w.prepGrade||'',
      role:w.role||'',
      route:w.route||'',
      targetPatterns:unique(w.targetPatterns),
      regions:unique(w.regions),
      prescription:w.prescription||'',
      why:w.why||'',
      caLevel:caLevelFor(w),
    };
  }

  function patternOverlap(candidate,ctx){
    const wanted=new Set(ctx.mainPatterns||[]);
    return (candidate.targetPatterns||[]).reduce((sum,p)=>sum+(wanted.has(p)?1:0),0);
  }

  function anatomyOverlap(candidate,ctx){
    const anatomy=A()?.aggregate?.(ctx.mainActionIds||[]);
    if(!anatomy)return 0;
    const wanted=new Set([...(anatomy.primary||[]),...(anatomy.secondary||[]),...(anatomy.stabilizers||[]),...(anatomy.joints||[]),...(ctx.targetMuscles||[])]);
    return (candidate.regions||[]).reduce((sum,r)=>sum+(wanted.has(r)?1:0),0);
  }

  function slotAffinity(candidate,slotKey,ctx){
    const text=textOf(candidate),patterns=patternOverlap(candidate,ctx),regionText=(candidate.regions||[]).join(' ');
    if(slotKey==='MOB-L'){
      if(!(LOWER_RE.test(text)&&MOBILITY_RE.test(text)))return null;
      return 8+(LOWER_RE.test(regionText)?2:0)+patterns;
    }
    if(slotKey==='MOB-U'){
      if(!(UPPER_RE.test(text)&&MOBILITY_RE.test(text)))return null;
      return 8+(UPPER_RE.test(regionText)?2:0)+patterns;
    }
    if(slotKey==='PRIMER'){
      if(!patterns||!PRIMER_RE.test(text)||CORE_RE.test(candidate.role||''))return null;
      return 7+patterns*2+(candidate.role.includes('动作模式')?3:0);
    }
    if(slotKey==='CORE-ACT'){
      const ca=caLevelFor(candidate),allowed=CA_WINDOWS[ctx.level]||[];
      if(!CORE_RE.test(text)||!allowed.includes(ca))return null;
      return 9+(candidate.role.includes('核心')?2:0)+(candidate.role.includes('支撑')?1:0)+patterns;
    }
    if(slotKey==='INTEGRATED'){
      const broad=(candidate.targetPatterns||[]).length>=4&&(candidate.regions||[]).length>=2;
      if(!INTEGRATED_RE.test(text)&&!(broad&&(/动态|支撑/.test(text))))return null;
      return 6+(INTEGRATED_RE.test(text)?5:0)+Math.min(3,(candidate.targetPatterns||[]).length)+Math.min(2,(candidate.regions||[]).length);
    }
    return null;
  }

  function curatedPriority(candidate,ctx){
    const data=D(); let best=9999;
    (ctx.mainPatterns||[]).forEach(pattern=>{
      const index=(data.warmupMatchByPattern?.[pattern]||[]).indexOf(candidate.prepId);
      if(index>=0)best=Math.min(best,index);
    });
    return best;
  }

  function rankSlotCandidates(slotKey,ctx,{limit=5}={}){
    const data=D(),gradeApi=G(),formal=new Set(ctx.formalActionIds||[]),items=[];
    (data.warmupIds||[]).forEach(prepId=>{
      const raw=data.warmupDetails?.[prepId],candidate=candidateFromWarmup(raw);
      if(!candidate||!isPrepRouteAllowed(candidate.route))return;
      if(formal.has(candidate.actionId))return;
      if(gradeApi&&!gradeApi.isAllowed(ctx.level,candidate.prepGrade))return;
      const affinity=slotAffinity(candidate,slotKey,ctx);
      if(affinity===null)return;
      items.push({
        ...candidate,
        slotKey,
        slotScore:affinity+anatomyOverlap(candidate,ctx),
        gradeRank:gradeApi?gradeApi.gradeRank(ctx.level,candidate.prepGrade):0,
        curatedPriority:curatedPriority(candidate,ctx),
      });
    });
    items.sort((a,b)=>a.gradeRank-b.gradeRank||b.slotScore-a.slotScore||a.curatedPriority-b.curatedPriority||a.prepId.localeCompare(b.prepId));
    const seen=new Set(),deduped=[];
    for(const item of items){
      if(seen.has(item.actionId))continue;
      seen.add(item.actionId);deduped.push(item);
      if(deduped.length>=Math.max(0,limit))break;
    }
    return deduped;
  }

  function resolve(inputContext,{selections={}}={}){
    const ctx=normalizeContext(inputContext),normalizedSelections=normalizeSelections(selections);
    const candidateMap={};
    SLOT_ORDER.forEach(slotKey=>{candidateMap[slotKey]=rankSlotCandidates(slotKey,ctx,{limit:5});});

    const used=new Set(),resolvedMap={};
    SLOT_ORDER.forEach(slotKey=>{
      const selected=normalizedSelections[slotKey];
      if(!selected||selected.source!=='manual')return;
      const candidate=candidateMap[slotKey].find(c=>c.actionId===selected.actionId);
      if(candidate&&!used.has(candidate.actionId)){
        used.add(candidate.actionId);
        resolvedMap[slotKey]={candidate,source:'manual',fallbackReason:''};
      }else{
        resolvedMap[slotKey]={candidate:null,source:'auto',fallbackReason:'manual-selection-ineligible'};
      }
    });

    SLOT_ORDER.forEach(slotKey=>{
      if(resolvedMap[slotKey]?.candidate)return;
      const candidate=candidateMap[slotKey].find(c=>!used.has(c.actionId))||null;
      if(candidate)used.add(candidate.actionId);
      const fallbackReason=resolvedMap[slotKey]?.fallbackReason||(!candidate?'no-eligible-candidate':'');
      resolvedMap[slotKey]={candidate,source:'auto',fallbackReason};
    });

    const slots=SLOT_ORDER.map(slotKey=>{
      const entry=resolvedMap[slotKey],candidate=entry.candidate;
      return {
        slotKey,
        slotName:SLOT_META[slotKey].name,
        purpose:SLOT_META[slotKey].purpose,
        recommendedId:candidateMap[slotKey][0]?.actionId||'',
        actionId:candidate?.actionId||'',
        prepId:candidate?.prepId||'',
        name:candidate?.name||'',
        prepGrade:candidate?.prepGrade||'',
        caLevel:slotKey==='CORE-ACT'?(candidate?.caLevel||''):'',
        prescription:candidate?.prescription||'',
        why:candidate?.why||'',
        source:entry.source,
        fallbackReason:entry.fallbackReason,
        candidates:candidateMap[slotKey],
      };
    });

    return {
      version:2,
      context:ctx,
      slots,
      selections:Object.fromEntries(slots.filter(s=>s.actionId).map(s=>[s.slotKey,{actionId:s.actionId,source:s.source}])),
      warnings:slots.filter(s=>!s.actionId).map(s=>`${s.slotKey}:no-eligible-candidate`),
    };
  }

  window.V14PrepResolver={
    SLOT_ORDER,SLOT_META,CA_WINDOWS,TEMPLATE_TYPES,
    isPrepRouteAllowed,isActionPrepEligible,caLevelFor,
    normalizeContext,contextFromF111,normalizeSelections,
    candidateFromWarmup,rankSlotCandidates,resolve,
  };
})();
