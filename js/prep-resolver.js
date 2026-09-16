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
  const TEMPLATE_TYPES=Object.freeze(['f111','body','conditioning','hyrox']);
  const PREP_ROUTES=new Set(['2F PREP','2F_ONLY','FLEX_1F_2F','CONDITIONING_2F']);
  const LOWER_RE=/髋|踝|腘绳|内收|臀|股四|小腿|下肢|后侧链/;
  const UPPER_RE=/胸椎|肩|上背|胸廓|肩胛|肩袖|上肢/;
  const MOBILITY_RE=/活动|伸展|旋转|绕环|捞月/;
  /**
   * Region gates for the two mobility slots. `textOf` includes the node's free-text
   * `why`, so matching only on text let core work into a hip/ankle slot: 平板支撑交替抬腿
   * passed because its rationale mentions 髋. The slot must own the area it claims.
   */
  const LOWER_REGION_RE=/髋|臀|膝|踝|小腿|腘绳|内收|股四|下肢|后侧链/;
  const UPPER_REGION_RE=/肩|胸椎|胸廓|上背|背阔|上肢|肩胛|肩袖/;
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

  function contextFromBody(input={}){
    return normalizeContext({
      ...input,
      template:'body',
      mainActionIds:unique([input.firstCompoundId,input.secondCompoundId,...(input.mainActionIds||[])]),
    });
  }

  function contextFromConditioning(input={}){
    return normalizeContext({
      ...input,
      template:'conditioning',
      mainActionIds:unique([...(input.firstStationActionIds||[]),...(input.mainActionIds||[])]),
    });
  }

  function contextFromHyrox(input={}){
    const stationPatterns={
      H1:['垂直拉'],
      H2:['蹲'],
      H3:['水平拉'],
      H4:['蹲'],
      H5:['水平拉'],
      H6:['单腿'],
      H7:['单腿'],
      H8:['蹲','垂直推'],
    };
    const stationIds=unique(input.stationIds);
    return normalizeContext({
      ...input,
      template:'hyrox',
      mainPatterns:unique([...stationIds.flatMap(id=>stationPatterns[id]||[]),...(input.mainPatterns||[])]),
      mainActionIds:[],
      formalActionIds:[],
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

  /**
   * Anatomy muscles → the vocabulary `warmupDetails[].regions` actually uses.
   *
   * The two curated layers were written with different words: the anatomy layer
   * names muscles (股四头肌 / 臀大肌 / 背阔肌) while PREP nodes name areas
   * (踝 / 肩胛 / 髋 / 胸椎 / 臀部). Only 臀大肌 / 臀中肌 / 腘绳肌 / 背阔肌 matched
   * literally, so the anatomy signal — the one that should make a squat day
   * differ from a hinge day — scored 0–1 hits for every session and decided
   * nothing. Bridging the two vocabularies is what makes the fit signal real.
   * First matching rule wins.
   */
  const MUSCLE_REGION_BRIDGE=Object.freeze([
    {match:['股四头','股直','股外侧','股内侧'],regions:['膝','髋','骨盆']},
    {match:['髂腰','髋屈'],regions:['髋屈肌','髋']},
    {match:['内收','股薄'],regions:['髋内收肌','髋']},
    {match:['臀大','臀中','臀小','臀肌','臀部深层'],regions:['臀部','臀大肌','臀中肌','骨盆']},
    {match:['腘绳'],regions:['腘绳肌','髋','骨盆']},
    {match:['腓肠','比目鱼','小腿','足踝','足内在','胫骨前'],regions:['小腿','踝','足踝','膝']},
    {match:['背阔','大圆'],regions:['背阔肌','上背','胸廓']},
    {match:['斜方','菱形','上背'],regions:['肩胛','上背','胸椎']},
    {match:['三角肌后','肩后侧','肩袖','冈上','冈下','小圆'],regions:['肩关节','肩袖','肩胛']},
    {match:['三角肌前','三角肌中','三角肌','肩带'],regions:['肩关节','肩带','胸廓']},
    {match:['胸大','胸小','胸廓前'],regions:['胸廓','肩关节']},
    {match:['肱三头','肱二头','肱肌','肱桡','前臂'],regions:['肩关节','肩带']},
    {match:['腹壁','腹直','腹内外斜','腹横','核心'],regions:['核心','骨盆']},
    {match:['竖脊','多裂','腰方','胸腰段','腰背'],regions:['胸椎','核心','骨盆']},
    {match:['前锯','肩胛稳定'],regions:['肩胛','胸廓']},
    {match:['胸椎'],regions:['胸椎','肩胛']},
    {match:['踝','足'],regions:['踝','足踝']},
    {match:['膝'],regions:['膝']},
  ]);

  /** The PREP-region vocabulary a session's trained muscles imply. */
  function bridgedRegions(anatomy){
    const wanted=new Set();
    [...(anatomy.primary||[]),...(anatomy.secondary||[]),...(anatomy.stabilizers||[])].forEach(muscle=>{
      for(const rule of MUSCLE_REGION_BRIDGE){
        if(rule.match.some(keyword=>String(muscle).includes(keyword))){
          rule.regions.forEach(region=>wanted.add(region));
          break;
        }
      }
    });
    [...(anatomy.joints||[])].forEach(joint=>wanted.add(joint));
    return wanted;
  }

  /**
   * Weighted rarity of a movement pattern across the eligible PREP nodes.
   *
   * 21 of the 52 nodes declare all eight patterns, so a raw hit count is
   * constant and decides nothing. Weighting by ln(1 + total / frequency) lets a
   * pattern only a few nodes prepare for count for more than 蹲, which half the
   * library claims to cover.
   */
  function patternRarity(){
    const details=D().warmupDetails||{},total=Math.max(1,(D().warmupIds||[]).length),frequency=new Map();
    (D().warmupIds||[]).forEach(prepId=>{
      (details[prepId]?.targetPatterns||[]).forEach(pattern=>frequency.set(pattern,(frequency.get(pattern)||0)+1));
    });
    const rarity=new Map();
    frequency.forEach((count,pattern)=>rarity.set(pattern,Math.log(1+total/(1+count))));
    return rarity;
  }

  /** Session fit: muscles first, then rarity-weighted patterns, then the tier. */
  function sessionFit(candidate,ctx,args){
    const wanted=bridgedRegions(args.anatomy||{});
    const hit=(candidate.regions||[]).filter(region=>wanted.has(region)).length;
    // Normalise by how many areas the node claims, so a node that lists
    // everything cannot win on breadth alone.
    const regionFit=hit?hit/Math.max(1,(candidate.regions||[]).length):0;
    const patterns=(candidate.targetPatterns||[]).filter(pattern=>(ctx.mainPatterns||[]).includes(pattern));
    const patternFit=patterns.reduce((sum,pattern)=>sum+(args.rarity?.get(pattern)??1),0);
    const tierFit=(candidate.mainTiers||[]).some(tier=>(args.mainTiers||[]).includes(tier))?1:0;
    return regionFit*100+patternFit*6+tierFit*4;
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
    // `role` is the node's authoritative purpose, and it is what separates a hip
    // mobility drill from core work that merely mentions 臀部 in its regions.
    const role=String(candidate.role||'');
    if(slotKey==='MOB-L'){
      if(CORE_RE.test(role))return null;
      if(!(LOWER_RE.test(text)&&MOBILITY_RE.test(text)&&LOWER_REGION_RE.test(regionText)))return null;
      return 8+2+patterns;
    }
    if(slotKey==='MOB-U'){
      if(CORE_RE.test(role))return null;
      if(!(UPPER_RE.test(text)&&MOBILITY_RE.test(text)&&UPPER_REGION_RE.test(regionText)))return null;
      return 8+2+patterns;
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

  /**
   * Where each slot should sit inside the level's grade window, so the five slots
   * build low → high instead of all five landing on the top grade (every L3 slot
   * used to resolve to P3, which is also why L3 had the least variety).
   * 0 = the level's highest grade.
   */
  const SLOT_GRADE_TARGET=Object.freeze({'MOB-L':0,'MOB-U':0,'PRIMER':0,'CORE-ACT':0,'INTEGRATED':0});

  function gradeDistance(slotKey,ctx,grade){
    const gradeApi=G();if(!gradeApi)return 0;
    const allowed=gradeApi.allowedGrades(ctx.level)||[];
    if(!allowed.length)return 0;
    const target=Math.min(SLOT_GRADE_TARGET[slotKey]??0,allowed.length-1);
    return Math.abs(gradeApi.gradeRank(ctx.level,grade)-target);
  }

  function rankSlotCandidates(slotKey,ctx,{limit=5}={}){
    const data=D(),gradeApi=G(),formal=new Set(ctx.formalActionIds||[]),items=[];
    // Tiers are read from the main lifts here rather than stored on the context:
    // the ResolvedSession contract validates prepContext strictly and would reject
    // an extra key.
    const fitArgs={
      anatomy:A()?.aggregate?.(ctx.mainActionIds||[]),
      rarity:patternRarity(),
      mainTiers:unique((ctx.mainActionIds||[]).map(id=>D().actions?.[id]?.tier).filter(Boolean)),
    };
    (data.warmupIds||[]).forEach(prepId=>{
      const raw=data.warmupDetails?.[prepId],candidate=candidateFromWarmup(raw);
      if(!candidate||!isPrepRouteAllowed(candidate.route))return;
      if(!isActionPrepEligible(data.actions?.[candidate.actionId]))return;
      if(formal.has(candidate.actionId))return;
      if(gradeApi&&!gradeApi.isAllowed(ctx.level,candidate.prepGrade))return;
      const affinity=slotAffinity(candidate,slotKey,ctx);
      if(affinity===null)return;
      items.push({
        ...candidate,
        slotKey,
        slotScore:affinity+anatomyOverlap(candidate,ctx),
        fit:sessionFit(candidate,ctx,fitArgs),
        gradeRank:gradeApi?gradeApi.gradeRank(ctx.level,candidate.prepGrade):0,
        curatedPriority:curatedPriority(candidate,ctx),
      });
    });
    // Session fit first: which movement the member is about to train has to beat
    // "this node happens to sit at the session's grade". Grade now breaks ties
    // (aimed at the slot's target for a low → high ramp), then the curated table.
    items.sort((a,b)=>b.fit-a.fit
      ||gradeDistance(slotKey,ctx,a.prepGrade)-gradeDistance(slotKey,ctx,b.prepGrade)
      ||a.gradeRank-b.gradeRank
      ||b.slotScore-a.slotScore
      ||a.curatedPriority-b.curatedPriority
      ||a.prepId.localeCompare(b.prepId));
    const seen=new Set(),all=[];
    for(const item of items){
      if(seen.has(item.actionId))continue;
      seen.add(item.actionId);all.push(item);
    }

    const cap=Math.max(0,limit);
    if(!cap||all.length<=cap)return all.slice(0,cap);

    // Keep downward-compatibility visible inside the capped UI list:
    // first reserve the best legal candidate from each allowed grade,
    // then fill remaining positions from the normal deterministic ranking.
    const picked=new Set();
    for(const grade of (gradeApi?.allowedGrades?.(ctx.level)||[])){
      const item=all.find(candidate=>candidate.prepGrade===grade);
      if(item){
        picked.add(item.actionId);
        if(picked.size>=cap)break;
      }
    }
    for(const item of all){
      if(picked.size>=cap)break;
      picked.add(item.actionId);
    }
    return all.filter(item=>picked.has(item.actionId)).slice(0,cap);
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
    normalizeContext,contextFromF111,contextFromBody,contextFromConditioning,contextFromHyrox,normalizeSelections,
    candidateFromWarmup,rankSlotCandidates,resolve,
  };
})();
