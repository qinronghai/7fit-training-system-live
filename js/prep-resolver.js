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
  const LOWER_PATTERNS=new Set(['蹲','髋铰链','髋伸展','单腿','单腿拉']);
  const UPPER_PATTERNS=new Set(['水平推','垂直推','水平拉','垂直拉']);
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
  const CORE_ROLE_RE=/核心|支撑|抗伸展|抗旋转|抗侧屈|躯干|呼吸|腹压/;
  const CORE_EXCLUDE_RE=/周期性器械|全身整合|火箭推|药球|深蹲推举|弓步配合上举|单腿燕子|燕子平衡|髋飞机|单腿臀桥|单侧臀伸|BOSU|瑜伽球/;
  const INTEGRATED_ROLE_RE=/整合|全身|周期性器械|单腿.*控制|髋.*动态|动态活动|模式准备|深蹲.*活动|后侧链动态|侧向髋|弓步/;
  const INTEGRATED_EXCLUDE_RE=/药球|壶铃高脚杯深蹲到推举|火箭推/;
  const MOVEMENT_FAMILY_BY_PREP_ID=Object.freeze({
    'PREP-01':'support-quadruped','PREP-02':'mobility-thoracic-quadruped','PREP-03':'integrated-lunge-thoracic',
    'PREP-04':'mobility-shoulder-circumduction','PREP-05':'mobility-scapula-circumduction','PREP-06':'activation-rotator-cuff','PREP-07':'activation-rotator-cuff',
    'PREP-08':'core-anti-extension','PREP-09A':'core-bracing-supine','PREP-09B':'core-anti-extension-dead-bug','PREP-09C':'core-anti-extension-dead-bug',
    'PREP-10':'mobility-hamstring-dynamic','PREP-11':'mobility-adductor-floor','PREP-12':'mobility-hip-rotation','PREP-13':'mobility-hip-rotation','PREP-14':'mobility-adductor-floor',
    'PREP-15':'primer-hip-hinge','PREP-16':'mobility-hip-flexor','PREP-17':'activation-glute-medial','PREP-18':'activation-single-leg-glute',
    'PREP-19':'core-anti-extension','PREP-20':'core-anti-extension','PREP-21':'core-anti-extension-supine','PREP-22':'core-anti-rotation','PREP-23':'core-anti-extension-dynamic',
    'PREP-24':'core-anti-extension-instability','PREP-25':'core-rotation-control','PREP-26':'core-anti-lateral-flexion','PREP-27':'core-anti-extension-instability','PREP-28':'core-anti-lateral-flexion-single-leg',
    'PREP-29':'mobility-thoracic-spine','PREP-30':'mobility-thoracic-spine-tool','PREP-31':'mobility-shoulder-thoracic-tool','PREP-32':'mobility-latissimus-tool','PREP-33':'activation-scapula-upward-rotation',
    'PREP-34':'core-anti-rotation','PREP-35':'mobility-ankle','PREP-36':'mobility-adductor-floor','PREP-37':'primer-squat','PREP-38':'integrated-lunge-thoracic',
    'PREP-39':'integrated-lateral-squat','PREP-40':'integrated-single-leg-hip','PREP-41':'activation-glute-max','PREP-42':'activation-glute-medial','PREP-43':'activation-glute-max',
    'PREP-44':'activation-glute-bridge-abduction','PREP-45':'activation-single-leg-glute','PREP-46':'integrated-rower','PREP-47':'integrated-ski-erg','PREP-48':'integrated-hip-drive-press',
    'PREP-49':'integrated-squat-press','PREP-50':'integrated-squat-press','PREP-51':'mobility-ankle','PREP-52':'primer-squat','PREP-53':'integrated-single-leg-hip','PREP-54':'integrated-single-leg-posterior-chain',
  });

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
      supportPatterns:unique(input.supportPatterns),
      coreDemands:unique(input.coreDemands),
      modalities:unique(input.modalities),
      impactDemand:typeof input.impactDemand==='string'?input.impactDemand:'',
      powerDemand:typeof input.powerDemand==='string'?input.powerDemand:'',
      recentPrepActionIds:unique(input.recentPrepActionIds),
      recentPrepFamilies:unique(input.recentPrepFamilies),
    };
  }

  function contextFromF111(input={}){
    const data=D(),recipe=data.recipes?.[input.recipeId]||{};
    return normalizeContext({
      ...input,
      template:'f111',
      mainPatterns:unique([recipe.lower,recipe.upper,...(input.mainPatterns||[])]),
      supportPatterns:unique([recipe.support,...(input.supportPatterns||[])]),
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
      movementFamily:w.movementFamily||MOVEMENT_FAMILY_BY_PREP_ID[w.prepId]||'',
      sequencePhase:w.sequencePhase||'',
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

  function movementFamilyFor(prepId){
    return MOVEMENT_FAMILY_BY_PREP_ID[prepId]||D().warmupDetails?.[prepId]?.movementFamily||'';
  }

  function candidateFamily(candidate,ctx){
    // Keep L1-L3's established deterministic defaults intact. L4 is the
    // long-term rotation tier where functional-family dedupe is intentional.
    if(ctx?.level!=='L4')return `action:${candidate?.actionId||''}`;
    return candidate?.movementFamily||`action:${candidate?.actionId||''}`;
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
  function patternRarity(level){
    const details=D().warmupDetails||{},gradeApi=G(),eligible=(prepId)=>{
      const detail=details[prepId];
      return !level||!gradeApi||gradeApi.isAllowed(level,detail?.prepGrade);
    },eligibleIds=(D().warmupIds||[]).filter(eligible),total=Math.max(1,eligibleIds.length),frequency=new Map();
    eligibleIds.forEach(prepId=>{
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
    // A node that declares all eight patterns must not beat a focused node just
    // because it has more opportunities to overlap. Reward focused coverage;
    // the integrated slot has its own multi-pattern affinity below.
    const patternFit=patterns.reduce((sum,pattern)=>sum+(args.rarity?.get(pattern)??1),0)
      /Math.max(1,(candidate.targetPatterns||[]).length);
    const tierFit=(candidate.mainTiers||[]).some(tier=>(args.mainTiers||[]).includes(tier))?1:0;
    return regionFit*100+patternFit*6+tierFit*4;
  }

  function patternOverlap(candidate,ctx){
    const wanted=new Set(ctx.mainPatterns||[]);
    return (candidate.targetPatterns||[]).reduce((sum,p)=>sum+(wanted.has(p)?1:0),0);
  }

  function patternCount(candidate,patterns){
    const wanted=new Set(patterns||[]);
    return (candidate.targetPatterns||[]).filter(pattern=>wanted.has(pattern)).length;
  }

  function mainPatternsFor(ctx,group){
    const patterns=ctx.mainPatterns||[];
    const wanted=group==='lower'?LOWER_PATTERNS:UPPER_PATTERNS;
    return patterns.filter(pattern=>wanted.has(pattern));
  }

  function anatomyOverlap(candidate,ctx){
    const anatomy=A()?.aggregate?.(ctx.mainActionIds||[]);
    if(!anatomy)return 0;
    const wanted=new Set([...(anatomy.primary||[]),...(anatomy.secondary||[]),...(anatomy.stabilizers||[]),...(anatomy.joints||[]),...(ctx.targetMuscles||[])]);
    return (candidate.regions||[]).reduce((sum,r)=>sum+(wanted.has(r)?1:0),0);
  }

  function slotAffinity(candidate,slotKey,ctx){
    const text=textOf(candidate),patterns=patternOverlap(candidate,ctx),regionText=(candidate.regions||[]).join(' ');
    const lowerPatterns=mainPatternsFor(ctx,'lower'),upperPatterns=mainPatternsFor(ctx,'upper');
    const lowerHits=patternCount(candidate,lowerPatterns),upperHits=patternCount(candidate,upperPatterns);
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
      // When the session has a lower-body main mode, PRIMER belongs to that
      // mode. Upper-body-only primers remain available for upper-only adapters.
      if(lowerPatterns.length&&!lowerHits)return null;
      return 7+lowerHits*4+upperHits+(candidate.role.includes('动作模式')?3:0);
    }
    if(slotKey==='CORE-ACT'){
      const ca=caLevelFor(candidate),allowed=CA_WINDOWS[ctx.level]||[];
      if(!CORE_RE.test(text)||!allowed.includes(ca))return null;
      const coreText=`${candidate.name} ${candidate.role}`;
      if(!CORE_ROLE_RE.test(coreText)||CORE_EXCLUDE_RE.test(coreText))return null;
      const demandFit=(ctx.coreDemands||[]).reduce((sum,demand)=>{
        if(/抗旋转/.test(demand)&&/抗旋转|旋转|对侧/.test(coreText))return sum+3;
        if(/抗侧屈/.test(demand)&&/抗侧屈|侧支撑|抗侧/.test(coreText))return sum+3;
        if(/抗伸展/.test(demand)&&/抗伸展|平板|死虫|空心/.test(coreText))return sum+3;
        if(/骨盆|基础控制/.test(demand)&&/骨盆|基础控制|躯干/.test(coreText))return sum+2;
        return sum;
      },0);
      return 9+(candidate.role.includes('核心')?2:0)+(candidate.role.includes('支撑')?1:0)+patterns+demandFit;
    }
    if(slotKey==='INTEGRATED'){
      if(candidate.sequencePhase!=='standing-dynamic')return null;
      if(INTEGRATED_EXCLUDE_RE.test(text))return null;
      if(!INTEGRATED_ROLE_RE.test(text)&&!INTEGRATED_RE.test(text))return null;
      if((ctx.mainPatterns||[]).length&&!patterns)return null;
      return 6+(INTEGRATED_RE.test(text)?5:0)
        +Math.min(3,patterns)
        +Math.min(2,(candidate.regions||[]).length)
        +(lowerHits&&upperHits?3:0);
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

  /** 0 = the level's highest legal grade (P3 for L3, P4 for L4). */
  const SLOT_GRADE_TARGET=Object.freeze({
    // Mobility and integration stay one rung below the session ceiling so the
    // warm-up still ramps into the main work instead of making every card P3/P4.
    'MOB-L':1,
    'MOB-U':1,
    'PRIMER':0,
    'CORE-ACT':0,
    'INTEGRATED':0,
  });

  function gradeDistance(slotKey,ctx,grade){
    const gradeApi=G();if(!gradeApi)return 0;
    const allowed=gradeApi.allowedGrades(ctx.level)||[];
    if(!allowed.length)return 0;
    let target=Math.min(SLOT_GRADE_TARGET[slotKey]??0,allowed.length-1);
    // L4 has enough P3 candidates to rotate without lowering the preparation
    // below the member's level. Keep the highest grade for some contexts and
    // deliberately open the P3 band for others, instead of selecting the one
    // P4 core drill in every recipe.
    if(ctx.level==='L4'&&ctx.recipeId){
      const rotate=stableHash(`${ctx.recipeId}|${ctx.level}|${slotKey}`)%3;
      if(rotate===0)target=Math.min(target+1,allowed.length-1);
    }
    return Math.abs(gradeApi.gradeRank(ctx.level,grade)-target);
  }

  function recentRank(candidate,ctx){
    const recentActions=new Set(ctx.recentPrepActionIds||[]),recentFamilies=new Set(ctx.recentPrepFamilies||[]);
    return {
      action:recentActions.has(candidate.actionId)?1:0,
      family:recentFamilies.has(candidate.movementFamily)?1:0,
    };
  }

  function pickAutomaticCandidate(candidates,slotKey,ctx,used,usedFamilies){
    const available=(candidates||[]).filter(candidate=>!used.has(candidate.actionId)&&!usedFamilies.has(candidateFamily(candidate,ctx)));
    if(!available.length)return null;
    if(ctx.level!=='L4'||!ctx.recipeId||available.length<2)return available[0];
    const offset=stableHash(`${ctx.recipeId}|${ctx.level}|${slotKey}|rotation`)%Math.min(3,available.length);
    return available[offset]||available[0];
  }

  function stableHash(value){
    let hash=2166136261;
    for(let i=0;i<String(value).length;i++){
      hash^=String(value).charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return hash>>>0;
  }

  function rotationRank(candidate,slotKey,ctx){
    const seed=[ctx.recipeId||ctx.template,ctx.level,slotKey,...(ctx.mainPatterns||[])].join('|');
    return stableHash(`${seed}|${candidate.actionId}`);
  }

  function estimateSlotMinutes(candidate){
    const prescription=String(candidate?.prescription||'');
    const minuteRange=prescription.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*分钟/);
    if(minuteRange)return (Number(minuteRange[1])+Number(minuteRange[2]))/2;
    return 1.5;
  }

  function rankSlotCandidates(slotKey,ctx,{limit=5}={}){
    const data=D(),gradeApi=G(),formal=new Set(ctx.formalActionIds||[]),items=[];
    // Tiers are read from the main lifts here rather than stored on the context:
    // the ResolvedSession contract validates prepContext strictly and would reject
    // an extra key.
    const fitArgs={
      anatomy:A()?.aggregate?.(ctx.mainActionIds||[]),
      rarity:patternRarity(ctx.level),
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
        fitBand:Math.floor(sessionFit(candidate,ctx,fitArgs)/8),
        curatedPriority:curatedPriority(candidate,ctx),
      });
    });
    // Progression is an explicit default signal: L3 should lead with P3 and L4
    // with P4/P3. Within the same grade band, movement fit still wins; close
    // candidates rotate by recipe/level so a global curated first item cannot
    // monopolise every template. The hash keeps the result deterministic.
    items.sort((a,b)=>{
      const recentA=recentRank(a,ctx),recentB=recentRank(b,ctx);
      const rotatedOrder=ctx.level==='L4';
      return recentA.action-recentB.action
      ||recentA.family-recentB.family
      ||gradeDistance(slotKey,ctx,a.prepGrade)-gradeDistance(slotKey,ctx,b.prepGrade)
      ||(rotatedOrder?rotationRank(a,slotKey,ctx)-rotationRank(b,slotKey,ctx):b.fitBand-a.fitBand)
      ||(rotatedOrder?b.fitBand-a.fitBand:rotationRank(a,slotKey,ctx)-rotationRank(b,slotKey,ctx))
      ||b.fit-a.fit
      ||b.slotScore-a.slotScore
      ||a.curatedPriority-b.curatedPriority
      ||a.prepId.localeCompare(b.prepId);
    });
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
    const candidatePool={},candidateMap={};
    SLOT_ORDER.forEach(slotKey=>{
      candidatePool[slotKey]=rankSlotCandidates(slotKey,ctx,{limit:99});
      candidateMap[slotKey]=candidatePool[slotKey].slice(0,5);
    });

    const used=new Set(),usedFamilies=new Set(),resolvedMap={};
    SLOT_ORDER.forEach(slotKey=>{
      const selected=normalizedSelections[slotKey];
      if(!selected||selected.source!=='manual')return;
      const candidate=candidatePool[slotKey].find(c=>c.actionId===selected.actionId);
      if(candidate&&!used.has(candidate.actionId)&&!usedFamilies.has(candidateFamily(candidate,ctx))){
        used.add(candidate.actionId);
        usedFamilies.add(candidateFamily(candidate,ctx));
        resolvedMap[slotKey]={candidate,source:'manual',fallbackReason:''};
      }else{
        resolvedMap[slotKey]={candidate:null,source:'auto',fallbackReason:'manual-selection-ineligible'};
      }
    });

    SLOT_ORDER.forEach(slotKey=>{
      if(resolvedMap[slotKey]?.candidate)return;
      const pool=(ctx.recentPrepActionIds?.length||ctx.recentPrepFamilies?.length)?candidatePool[slotKey]:candidateMap[slotKey];
      const candidate=pickAutomaticCandidate(pool,slotKey,ctx,used,usedFamilies);
      if(candidate){
        used.add(candidate.actionId);
        usedFamilies.add(candidateFamily(candidate,ctx));
      }
      const fallbackReason=resolvedMap[slotKey]?.fallbackReason||(!candidate?'no-eligible-candidate':'');
      resolvedMap[slotKey]={candidate,source:'auto',fallbackReason};
    });

    const slots=SLOT_ORDER.map(slotKey=>{
      const entry=resolvedMap[slotKey],candidate=entry.candidate;
      const recentActionIds=new Set(ctx.recentPrepActionIds||[]),recentFamilies=new Set(ctx.recentPrepFamilies||[]);
      return {
        slotKey,
        slotName:SLOT_META[slotKey].name,
        purpose:SLOT_META[slotKey].purpose,
        recommendedId:candidateMap[slotKey][0]?.actionId||'',
        actionId:candidate?.actionId||'',
        prepId:candidate?.prepId||'',
        name:candidate?.name||'',
        sequencePhase:candidate?.sequencePhase||'',
        prepGrade:candidate?.prepGrade||'',
        role:candidate?.role||'',
        movementFamily:candidate?.movementFamily||'',
        targetPatterns:candidate?.targetPatterns||[],
        regions:candidate?.regions||[],
        route:candidate?.route||'',
        recentlyUsed:!!candidate&&(recentActionIds.has(candidate.actionId)||recentFamilies.has(candidate.movementFamily)),
        recentlyUsedExact:!!candidate&&recentActionIds.has(candidate.actionId),
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
      estimatedMinutes:Number(slots.reduce((sum,slot)=>sum+estimateSlotMinutes(slot),0).toFixed(1)),
      selections:Object.fromEntries(slots.filter(s=>s.actionId).map(s=>[s.slotKey,{actionId:s.actionId,source:s.source}])),
      warnings:slots.filter(s=>!s.actionId).map(s=>`${s.slotKey}:no-eligible-candidate`),
    };
  }

  window.V14PrepResolver={
    SLOT_ORDER,SLOT_META,CA_WINDOWS,TEMPLATE_TYPES,
    isPrepRouteAllowed,isActionPrepEligible,caLevelFor,movementFamilyFor,
    normalizeContext,contextFromF111,contextFromBody,contextFromConditioning,contextFromHyrox,normalizeSelections,
    candidateFromWarmup,rankSlotCandidates,resolve,
  };
})();
