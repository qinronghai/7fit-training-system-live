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
  const UPPER_MOBILITY_RE=/活动|伸展|旋转|绕环|捞月|肩袖|肩胛.*激活/;
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
  const MODE_FAMILY_SCORES=Object.freeze({
    '蹲':Object.freeze({
      mobility:Object.freeze({'mobility-hip-rotation':8,'mobility-adductor-floor':8,'mobility-ankle':7,'primer-squat':5}),
      primer:Object.freeze({'primer-squat':9,'integrated-lateral-squat':8,'integrated-lunge-thoracic':5}),
    }),
    '髋铰链':Object.freeze({
      mobility:Object.freeze({'mobility-hamstring-dynamic':10,'mobility-hip-rotation':5,'mobility-adductor-floor':4}),
      primer:Object.freeze({'primer-hip-hinge':10,'integrated-single-leg-posterior-chain':9,'integrated-single-leg-hip':6,'activation-single-leg-glute':5}),
    }),
    '髋伸展':Object.freeze({
      mobility:Object.freeze({'activation-glute-max':8,'mobility-hip-flexor':7,'mobility-hamstring-dynamic':5}),
      primer:Object.freeze({'activation-glute-max':10,'activation-single-leg-glute':9,'integrated-single-leg-posterior-chain':7,'integrated-single-leg-hip':5}),
    }),
    '单腿':Object.freeze({
      mobility:Object.freeze({'mobility-hamstring-dynamic':8,'mobility-hip-rotation':7,'mobility-adductor-floor':6,'primer-squat':4}),
      primer:Object.freeze({'integrated-single-leg-hip':10,'activation-single-leg-glute':9,'integrated-single-leg-posterior-chain':8,'integrated-lateral-squat':6}),
    }),
  });
  const UPPER_FAMILY_SCORES=Object.freeze({
    '水平拉':Object.freeze({'activation-scapula-upward-rotation':9,'mobility-latissimus-tool':9,'mobility-shoulder-thoracic-tool':8,'mobility-thoracic-quadruped':8,'mobility-scapula-circumduction':7,'activation-rotator-cuff':7}),
    '垂直拉':Object.freeze({'activation-scapula-upward-rotation':10,'mobility-latissimus-tool':10,'mobility-shoulder-thoracic-tool':8,'mobility-thoracic-quadruped':7,'mobility-scapula-circumduction':7,'activation-rotator-cuff':6}),
    '水平推':Object.freeze({'activation-scapula-upward-rotation':11,'mobility-shoulder-thoracic-tool':9,'activation-rotator-cuff':8,'mobility-thoracic-quadruped':7,'mobility-scapula-circumduction':7}),
    '垂直推':Object.freeze({'activation-scapula-upward-rotation':11,'mobility-shoulder-thoracic-tool':9,'activation-rotator-cuff':8,'mobility-thoracic-quadruped':7,'mobility-scapula-circumduction':7}),
  });
  const UPPER_ROTATION_FAMILIES=Object.freeze({
    '水平拉':Object.freeze(['activation-scapula-upward-rotation','mobility-shoulder-thoracic-tool','activation-rotator-cuff','mobility-scapula-circumduction']),
    '垂直拉':Object.freeze(['mobility-latissimus-tool','mobility-thoracic-quadruped','mobility-shoulder-thoracic-tool','mobility-scapula-circumduction']),
    '水平推':Object.freeze(['mobility-scapula-circumduction','activation-rotator-cuff','mobility-shoulder-thoracic-tool','activation-scapula-upward-rotation']),
    '垂直推':Object.freeze(['activation-scapula-upward-rotation','mobility-shoulder-thoracic-tool','activation-rotator-cuff','mobility-scapula-circumduction']),
  });
  // L4 core defaults rotate by strategy, not only by muscle region: keep the
  // same family from occupying every module while preserving low fatigue.
  const CORE_ROTATION_FAMILIES=Object.freeze([
    'core-anti-lateral-flexion',
    'core-rotation-control',
    'core-anti-lateral-flexion-single-leg',
    'core-anti-extension-dead-bug',
  ]);
  const CORE_ROTATION_ACTIONS=Object.freeze([
    'SUP-S3-02',
    'diaoweng_shi',
    'warmup_band_anti_rotation_hold',
    'warmup_light_farmer_carry',
    'warmup_deadbug_arm_reach',
    'warmup_deadbug_leg_reach',
    'SUP-S5-05',
    'SUP-S6-04',
  ]);
  // Pull sessions keep two equipment-specific finishes and use one dynamic
  // full-body alternative per upper-pattern family to limit machine repetition.
  const INTEGRATED_ROTATION_ACTIONS=Object.freeze({
    '水平拉':Object.freeze(['huachuanji_wentai','warmup_worlds_greatest_stretch','huachuanji_wentai']),
    '垂直拉':Object.freeze(['huaxueji_wentai','warmup_reverse_lunge_overhead_reach','huaxueji_wentai']),
  });
  const INTEGRATED_FAMILY_SCORES=Object.freeze({
    '水平拉':Object.freeze({'integrated-rower':14,'integrated-lunge-thoracic':3}),
    '垂直拉':Object.freeze({'integrated-ski-erg':14,'integrated-rower':4,'integrated-lunge-thoracic':3}),
    '水平推':Object.freeze({'integrated-lunge-thoracic':7,'integrated-hip-drive-press':6,'integrated-squat-press':5}),
    '垂直推':Object.freeze({'integrated-lunge-thoracic':8,'integrated-hip-drive-press':8,'integrated-squat-press':6}),
  });
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
    'PREP-55':'core-anti-rotation-standing','PREP-56':'core-loaded-carry',
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
    const actions=(input.formalActionIds||[]).map(id=>data.actions?.[id]);
    const support=actions.find(action=>action?.isSupport);
    const core=actions.find(action=>action?.isCore);
    const mainPatterns=unique([recipe.lower,recipe.upper,...(input.mainPatterns||[])]);
    // PREP uses the parent patterns for the single-leg hinge progression.
    if(mainPatterns.includes('单腿拉')||(input.mainActionIds||[]).some(id=>data.actions?.[id]?.pattern==='单腿拉')){
      mainPatterns.push('髋铰链','单腿');
    }
    return normalizeContext({
      ...input,
      template:'f111',
      mainPatterns,
      supportPatterns:support?unique([support.pattern,...(data.supportMeta?.[support.id]?.supportDemand||[])]):unique([recipe.support,...(input.supportPatterns||[])]),
      coreDemands:core?.coreDemand?[core.coreDemand]:input.coreDemands,
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

  // Compare with the actual lifts, including substitutions, before using history
  // to rotate equally useful preparations. Broad catalogue tags are not a
  // sufficient reason to prescribe shoulder taps for every upper-body lift.
  const PATTERN_TRANSFER={
    '蹲':'下蹲时保持脚掌着地，让髋膝顺畅屈伸',
    '单腿':'单脚承重时稳住骨盆，让膝盖沿脚尖方向移动',
    '单腿拉':'单腿向后折髋时保持骨盆朝前',
    '髋铰链':'把髋向后送，同时维持躯干的位置',
    '髋伸展':'伸髋时保持骨盆稳定',
    '水平拉':'手臂向前送出、再拉回时，让肩胛沿胸廓移动',
    '垂直拉':'回放到头顶时让肩胛跟随手臂上移，再控制下拉',
    '水平推':'向前推时保持肩部稳定，控制手臂的回程',
    '垂直推':'手臂上举时让肩胛随之上旋，避免用腰部后仰补幅度',
  };
  function liftFit(slot,candidate,action,primary){
    const pattern=action.pattern,family=candidate.movementFamily,role=candidate.role||'';
    const lower=LOWER_PATTERNS.has(pattern),upper=UPPER_PATTERNS.has(pattern);
    const unilateral=/单臂|单侧|单手|单腿|分腿|弓步/.test(action.name);
    const demand=[action.name,pattern,...(D().supportMeta?.[action.id]?.supportDemand||[]),...(D().coreMeta?.[action.id]?.coreDemand||[])].join(' ');
    const control=['抗旋转','抗侧屈','抗伸展'].find(value=>role.includes(value)&&demand.includes(value));
    if(slot==='CORE-ACT'){
      if(candidate.prepId==='PREP-23'&&action.isSupport&&/交替触肩|交替伸展/.test(action.name))return {rank:2,task:'交替减少支点时稳住躯干'};
      if(/抗旋转/.test(role)&&unilateral)return {rank:3,task:'单侧发力时保持胸口和骨盆朝前'};
      if(control)return {rank:3,task:({'抗旋转':'抵抗转体时稳住骨盆','抗侧屈':'单侧承重时保持躯干直立','抗伸展':'四肢发力时稳住腰盆'})[control]};
      if(candidate.prepId==='PREP-22')return null;
      if(/抗伸展|呼吸|核心基础/.test(role)&&(lower||pattern==='垂直推'))return {rank:2,task:'发力时稳住胸廓和骨盆'};
      return null;
    }
    // Some isolation lifts share their parent pattern in the catalogue (e.g.
    // seated knee extension is tagged as a squat). Describe their actual task.
    if(/腿屈伸|腿弯举/.test(action.name)){
      if(/腿弯举/.test(action.name)&&/hamstring/.test(family))return {rank:2,task:'控制膝关节屈伸时的大腿后侧张力'};
      if(/腿屈伸/.test(action.name)&&/squat|ankle|lunge|split/.test(family))return {rank:2,task:'控制膝关节伸直时的大腿前侧张力'};
      return null;
    }
    // Complementary accessories: each links to the warm-up family that prepares its joint action.
    if(/后踢腿/.test(action.name))return /glute-max|single-leg-glute|hip-extension/.test(family)?{rank:2,task:'伸髋时稳住骨盆、让臀部发力'}:null;
    if(slot==='MOB-U'&&/面拉/.test(action.name))return /scapular-retraction|scapula|rotator-cuff/.test(family)?{rank:2,task:'手臂拉开时让肩胛后收、肩外旋'}:null;
    if(slot==='MOB-U'&&/夹胸/.test(action.name))return /wall-scapular-push|scapula|thoracic/.test(family)?{rank:2,task:'手臂合拢时稳住肩胛和肩前侧'}:null;
    if(slot==='MOB-U'&&/直臂下拉/.test(action.name))return /latissimus|wall-slide|scapula/.test(family)?{rank:2,task:'手臂下压时让背阔肌发力、肩胛下沉'}:null;
    if(slot==='MOB-U'&&/二头弯举|三头下压/.test(action.name))return /scapula|rotator-cuff|wall/.test(family)?{rank:1,task:'肘屈伸时保持上臂和肩胛稳定'}:null;
    if(/髋内收|髋外展/.test(action.name)){
      if(/髋内收/.test(action.name)&&/adductor/.test(family))return {rank:3,task:'在可控幅度内收回大腿'};
      if(/髋外展/.test(action.name)&&/glute-medial|abduction|single-leg-glute|single-leg-hip|lateral-squat/.test(family))return {rank:3,task:'大腿向外打开时稳住骨盆'};
      return null;
    }
    if(slot==='MOB-U'&&/反向飞鸟|侧平举/.test(action.name))return {rank:2,task:'手臂打开时控制肩胛的位置'};
    if(!primary)return null;
    if(!PATTERN_TRANSFER[pattern])return null;
    const targets=candidate.targetPatterns||[];
    if(!targets.includes(pattern)&&!(pattern==='单腿拉'&&targets.some(value=>value==='髋铰链'||value==='单腿')))return null;
    let fit=0;
    if(slot==='MOB-U'&&upper){
      const phaseFit=['mobility-wall-slide','activation-scapular-retraction','activation-wall-scapular-push'].includes(family);
      fit=phaseFit?9:UPPER_FAMILY_SCORES[pattern]?.[family]||1;
    }
    if((slot==='MOB-L'||slot==='PRIMER')&&lower)fit=MODE_FAMILY_SCORES[pattern==='单腿拉'?'髋铰链':pattern]?.[slot==='MOB-L'?'mobility':'primer']?.[family]||1;
    if(slot==='PRIMER'&&lower&&['primer-wall-hinge','primer-supported-split'].includes(family))fit=8;
    if(slot==='INTEGRATED'){
      if(family==='integrated-rower')fit=pattern==='水平拉'?9:0;
      else if(family==='integrated-ski-erg')fit=pattern==='垂直拉'?9:0;
      else if(lower&&/lunge|squat|single-leg|hinge|hamstring|ankle/.test(family))fit=3;
    }
    const task=/引体肩胛下沉/.test(action.name)?'保持手臂伸直，控制肩胛下沉与回放':PATTERN_TRANSFER[pattern];
    const specific=slot==='MOB-U'?fit>=8:fit>=3;
    return fit?{rank:specific?3:2,task}:null;
  }

  function lessonMatch(slot,candidate,ctx){
    if(ctx.template!=='f111'||!ctx.mainActionIds.length)return null;
    const best=(ids,primary)=>ids.reduce((match,id)=>{
      const action=D().actions?.[id],fit=action&&liftFit(slot,candidate,action,primary);
      return fit&&(!match||fit.rank>match.rank)?{...fit,name:action.name}:match;
    },null);
    const primary=best(ctx.mainActionIds,true);
    const accessory=best(ctx.formalActionIds.filter(id=>!ctx.mainActionIds.includes(id)),false);
    return {primary,accessory};
  }

  const UPPER_REHEARSAL={
    'mobility-wall-slide':'先让前臂沿墙滑动，练习上举时肩胛随手臂移动',
    'activation-scapular-retraction':'先用轻弹力带练习肩胛随手臂收回和前伸',
    'activation-wall-scapular-push':'先用墙面降低支撑负荷，练习推离时肩胛沿胸廓滑动',
    'mobility-latissimus-tool':'先借助长凳练习手臂向头顶延伸，同时保持肋骨和骨盆稳定',
    'mobility-shoulder-thoracic-tool':'先在泡沫轴上练习肩屈，让手臂上举时胸廓保持稳定',
    'activation-scapula-upward-rotation':'先沿墙向上滑动手臂，练习肩胛随手臂上旋',
    'mobility-thoracic-quadruped':'先在骨盆稳定时转动胸椎，让上背参与活动',
    'activation-rotator-cuff':'先用轻弹力带练习肩外旋，控制上臂位置',
    'mobility-scapula-circumduction':'先用轻弹力带做绕环，练习手臂移动时肩胛跟着滑动',
  };

  function courseReason(slot,candidate,ctx){
    const links=lessonMatch(slot,candidate,ctx);
    if(!links)return '';
    const {primary,accessory}=links;
    const role=(candidate.role||'动作控制').replace(/\s*[+/]\s*/g,'和');
    if(candidate.prepId==='PREP-22'&&(primary||accessory)){
      const lift=primary||accessory;
      const reason=`${primary?'主项':'辅项'}「${lift.name}」需要${lift.task}。交替触肩时短暂抬起一只手，先在垫上练习用支撑手推地、让骨盆保持朝前。`;
      return primary&&accessory?reason+`辅项「${accessory.name}」也需要${accessory.task}。`:reason;
    }
    if(primary){
      const rehearsal=UPPER_REHEARSAL[candidate.movementFamily]||`先做${role}，再进入正式组`;
      const reason=`这节课的主项「${primary.name}」需要${primary.task}。${rehearsal}。`;
      return accessory?reason+`辅项「${accessory.name}」也需要${accessory.task}。`:reason;
    }
    if(accessory)return `这项热身为辅项「${accessory.name}」做准备。先练${role}，带到正式动作中，能帮助会员${accessory.task}。`;
    return slot==='INTEGRATED'?`先用低强度的连续动作升温，再进入主项「${D().actions?.[ctx.mainActionIds[0]]?.name||'主训练'}」。`:`这项动作补充本节的${role}练习。`;
  }

  function matchReasonFor(slotKey,ctx,candidate){
    if(!candidate)return '';
    const lesson=courseReason(slotKey,candidate,ctx);
    if(lesson)return lesson;
    const lower=mainPatternsFor(ctx,'lower')[0]||'';
    const upper=mainPatternsFor(ctx,'upper')[0]||'';
    const family=candidate.movementFamily||'';
    if(slotKey==='MOB-L'){
      if(lower)return `针对${lower}：先打开髋踝活动，再进入主动作范围`;
      return '下肢活动准备：先打开髋踝活动，再进入主动作范围';
    }
    if(slotKey==='MOB-U'){
      if(family==='activation-scapula-upward-rotation')return `针对${upper||'上肢推拉'}：肩胛上旋准备`;
      if(upper)return `针对${upper}：准备胸椎、肩带与肩关节活动`;
      return '上肢活动准备：先让胸椎与肩带进入可用范围';
    }
    if(slotKey==='PRIMER'){
      if(lower==='髋铰链')return '针对髋铰链：预习后侧链与髋折叠控制';
      if(lower==='单腿')return '针对单腿：单腿骨盆控制';
      if(lower==='蹲')return '针对蹲：预习髋踝协同与下肢控制';
      if(lower==='髋伸展')return '针对髋伸展：激活臀部并稳定骨盆';
      return `针对${lower||'主动作模式'}：用低疲劳动作预习关键控制`;
    }
    if(slotKey==='CORE-ACT'){
      if(family==='core-anti-rotation-standing')return '核心抗旋转：保持胸廓与骨盆正对';
      if(family==='core-loaded-carry')return '核心抗侧屈：练习负重行走中的躯干稳定';
      if(/抗旋转|对侧/.test(candidate.role||''))return '核心抗旋转：练习四肢移动时的躯干稳定';
      if(/抗侧屈|侧支撑/.test(candidate.role||''))return '核心抗侧屈：练习单侧支撑与骨盆控制';
      if(/抗伸展|死虫|平板/.test(candidate.role||''))return '核心抗伸展：建立呼吸、肋骨与骨盆控制';
      return '核心准备：建立躯干稳定，不做到疲劳';
    }
    if(slotKey==='INTEGRATED'){
      if(upper)return `针对${upper}：用低疲劳动作完成全身整合`;
      return '全身整合：把活动、稳定与升温连接起来';
    }
    return '训练前准备：用低疲劳动作进入主训练';
  }

  function modeSpecificity(candidate,slotKey,ctx){
    if(ctx.level!=='L4')return 0;
    const family=candidate?.movementFamily||'',target=candidate?.targetPatterns||[],text=textOf(candidate);
    const lower=mainPatternsFor(ctx,'lower')[0],upper=mainPatternsFor(ctx,'upper')[0];
    const lowerMode=MODE_FAMILY_SCORES[lower]||{};
    const upperScores=UPPER_FAMILY_SCORES[upper]||{};
    const integratedScores=INTEGRATED_FAMILY_SCORES[upper]||{};
    const lowerTarget=lower&&target.includes(lower)?2:0;
    const upperTarget=upper&&target.includes(upper)?2:0;
    if(slotKey==='MOB-L')return lowerTarget+(lowerMode.mobility?.[family]||0);
    if(slotKey==='PRIMER')return lowerTarget+(lowerMode.primer?.[family]||0);
    if(slotKey==='MOB-U')return upperTarget+(upperScores[family]||0);
    if(slotKey==='INTEGRATED'){
      let score=lowerTarget+upperTarget+(integratedScores[family]||0);
      if(upper==='垂直推'&&/上举|推举|肩屈/.test(text))score+=4;
      if(upper==='水平推'&&/肩胛|前锯|肩袖/.test(text))score+=2;
      if(upper==='水平拉'&&/划船|肩胛|背阔/.test(text))score+=2;
      if(upper==='垂直拉'&&/滑雪机|背阔|肩胛/.test(text))score+=2;
      return score;
    }
    return 0;
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
      if(!(UPPER_RE.test(text)&&UPPER_MOBILITY_RE.test(text)&&UPPER_REGION_RE.test(regionText)))return null;
      return 8+2+patterns;
    }
    if(slotKey==='PRIMER'){
      const primerReady=PRIMER_RE.test(text)||(ctx.level==='L4'&&/髋铰链|后侧链|动态捞月/.test(text));
      if(!patterns||!primerReady||CORE_RE.test(candidate.role||''))return null;
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
      const supportFit=ctx.supportPatterns.some(pattern=>coreText.includes(pattern))?2:0;
      return 9+supportFit+(candidate.role.includes('核心')?2:0)+(candidate.role.includes('支撑')?1:0)+patterns+demandFit;
    }
    if(slotKey==='INTEGRATED'){
      if(ctx.template==='f111'&&ctx.mainActionIds.length&&candidate.movementFamily==='mobility-ankle')return null;
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
    let available=(candidates||[]).filter(candidate=>!used.has(candidate.actionId)&&!usedFamilies.has(candidateFamily(candidate,ctx)));
    if(ctx.template==='f111'&&ctx.mainActionIds.length)available=available.filter(item=>item.prepId!=='PREP-22'||item.mainFit||item.auxFit);
    if(!available.length)return null;
    if(ctx.template==='f111'&&ctx.mainActionIds.length){
      const bestMain=Math.max(...available.map(item=>item.mainFit));
      available=available.filter(item=>item.mainFit===bestMain);
      if(!bestMain){
        const bestAux=Math.max(...available.map(item=>item.auxFit));
        available=available.filter(item=>item.auxFit===bestAux);
      }
    }
    const recentActions=new Set(ctx.recentPrepActionIds||[]),recentFamilies=new Set(ctx.recentPrepFamilies||[]);
    const fresh=available.filter(candidate=>!recentActions.has(candidate.actionId)&&!recentFamilies.has(candidate.movementFamily));
    const preferred=fresh.length?fresh:available;
    if(ctx.template==='f111'&&ctx.mainActionIds.length&&preferred.length>1&&(!ctx.recipeId||ctx.level!=='L4')){
      const first=preferred[0];
      const peers=preferred.filter(item=>item.auxFit===first.auxFit&&item.prepGrade===first.prepGrade&&Math.abs(item.fitBand-first.fitBand)<=1);
      const seed=[ctx.level,...ctx.mainActionIds,slotKey].join('|');
      return peers.sort((left,right)=>stableHash(seed+'|'+left.actionId)-stableHash(seed+'|'+right.actionId))[0];
    }
    if(ctx.level!=='L4'||!ctx.recipeId||preferred.length<2)return preferred[0];
    const bestModeFit=Number(preferred[0].modeFit||0);
    const modePool=slotKey==='MOB-U'
      ?preferred
      :preferred.filter(candidate=>Number(candidate.modeFit||0)>=bestModeFit-1);
    const rotationPool=slotKey==='MOB-U'?upperRotationPool(modePool,ctx):modePool;
    if(slotKey==='MOB-U'){
      const upper=mainPatternsFor(ctx,'upper')[0];
      const targetFamily=upperRotationTarget(ctx,upper);
      const target=rotationPool.find(candidate=>candidate.movementFamily===targetFamily);
      if(target)return target;
      const offset=upperRotationIndex(ctx,upper)%rotationPool.length;
      return rotationPool[offset]||preferred[0];
    }
    if(slotKey==='CORE-ACT'){
      const targetAction=coreRotationTargetAction(ctx);
      const target=preferred.find(candidate=>candidate.actionId===targetAction);
      if(target)return target;
      const targetFamily=coreRotationTarget(ctx);
      const familyTarget=preferred.find(candidate=>candidate.movementFamily===targetFamily);
      if(familyTarget)return familyTarget;
    }
    if(slotKey==='INTEGRATED'){
      const upper=mainPatternsFor(ctx,'upper')[0];
      const targetAction=integratedRotationTarget(ctx,upper);
      const target=preferred.find(candidate=>candidate.actionId===targetAction);
      if(target)return target;
    }
    const offset=stableHash(`${ctx.recipeId}|${ctx.level}|${slotKey}|rotation`)%Math.min(3,rotationPool.length);
    return rotationPool[offset]||preferred[0];
  }

  function stableHash(value){
    let hash=2166136261;
    for(let i=0;i<String(value).length;i++){
      hash^=String(value).charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return hash>>>0;
  }

  function upperRotationIndex(ctx,upper){
    if(!ctx.recipeId||!upper)return 0;
    const recipeIds=Array.isArray(D().recipeIds)?D().recipeIds:Object.keys(D().recipes||{});
    const peers=recipeIds.filter(recipeId=>D().recipes?.[recipeId]?.upper===upper);
    const index=peers.indexOf(ctx.recipeId);
    return index>=0?index:stableHash(`${ctx.recipeId}|${upper}`)%Math.max(1,peers.length||1);
  }

  function f111RotationIndex(ctx){
    if(ctx.template!=='f111'||!ctx.recipeId)return 0;
    const recipeIds=Array.isArray(D().recipeIds)?D().recipeIds:Object.keys(D().recipes||{});
    const index=recipeIds.indexOf(ctx.recipeId);
    return index>=0?index:stableHash(`${ctx.recipeId}|f111`)%Math.max(1,recipeIds.length||1);
  }

  function upperRotationTarget(ctx,upper){
    const families=UPPER_ROTATION_FAMILIES[upper]||[];
    if(!families.length)return '';
    return families[upperRotationIndex(ctx,upper)%families.length]||'';
  }

  function coreRotationTarget(ctx){
    if(ctx.template!=='f111')return '';
    return CORE_ROTATION_FAMILIES[f111RotationIndex(ctx)%CORE_ROTATION_FAMILIES.length]||'';
  }

  function coreRotationTargetAction(ctx){
    if(ctx.template!=='f111')return '';
    return CORE_ROTATION_ACTIONS[f111RotationIndex(ctx)%CORE_ROTATION_ACTIONS.length]||'';
  }

  function integratedRotationTarget(ctx,upper){
    if(ctx.template!=='f111')return '';
    const actions=INTEGRATED_ROTATION_ACTIONS[upper]||[];
    if(!actions.length)return '';
    return actions[upperRotationIndex(ctx,upper)%actions.length]||'';
  }

  function diversifyUpperCandidates(candidates,limit=5){
    const picked=[],families=new Set();
    for(const candidate of candidates||[]){
      if(families.has(candidate.movementFamily))continue;
      families.add(candidate.movementFamily);
      picked.push(candidate);
      if(picked.length>=limit)return picked;
    }
    for(const candidate of candidates||[]){
      if(picked.some(item=>item.actionId===candidate.actionId))continue;
      picked.push(candidate);
      if(picked.length>=limit)break;
    }
    return picked;
  }

  function diversifyCoreCandidates(candidates,ctx,limit=5){
    const picked=[],families=new Set();
    const targetAction=coreRotationTargetAction(ctx);
    const target=(candidates||[]).find(item=>item.actionId===targetAction);
    if(target){
      picked.push(target);
      families.add(target.movementFamily);
    }
    for(const family of CORE_ROTATION_FAMILIES){
      const candidate=(candidates||[]).find(item=>item.movementFamily===family);
      if(!candidate||families.has(candidate.movementFamily))continue;
      families.add(candidate.movementFamily);
      picked.push(candidate);
      if(picked.length>=limit)return picked;
    }
    for(const candidate of candidates||[]){
      if(picked.some(item=>item.actionId===candidate.actionId))continue;
      picked.push(candidate);
      if(picked.length>=limit)break;
    }
    return picked;
  }

  function upperRotationPool(candidates,ctx){
    if(ctx.level!=='L4'||!ctx.recipeId)return candidates;
    const upper=mainPatternsFor(ctx,'upper')[0];
    const bestModeFit=Number(candidates[0]?.modeFit||0);
    if(!upper||!bestModeFit)return candidates;
    // Keep near-equivalent matches in the rotation pool. Pull patterns need at
    // least three options; push patterns also include cuff and thoracic-control
    // variants so repeated push sessions do not pin to the wall.
    const margin=UPPER_PATTERNS.has(upper)?4:2;
    const pool=candidates.filter(candidate=>Number(candidate.modeFit||0)>=bestModeFit-margin);
    return pool.length?pool:candidates;
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
      const modeFit=modeSpecificity(candidate,slotKey,ctx);
      if(ctx.level==='L4'&&(['MOB-U','INTEGRATED'].includes(slotKey))&&!modeFit)return;
      const match=lessonMatch(slotKey,candidate,ctx);
      items.push({
        ...candidate,
        mainFit:match?.primary?.rank||0,
        auxFit:match?.accessory?.rank||0,
        slotKey,
        slotScore:affinity+anatomyOverlap(candidate,ctx),
        modeFit,
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
      return b.mainFit-a.mainFit || (!a.mainFit?b.auxFit-a.auxFit:0)
      ||recentA.action-recentB.action
      ||recentA.family-recentB.family
      ||b.auxFit-a.auxFit
      ||(rotatedOrder?b.modeFit-a.modeFit:0)
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

    const options=gradeOptions(all,ctx,limit,gradeApi);
    if(slotKey==='CORE-ACT'&&limit<=5&&gradeApi)options.sort((a,b)=>gradeApi.gradeRank(ctx.level,a.prepGrade)-gradeApi.gradeRank(ctx.level,b.prepGrade));
    return options;
  }

  function gradeOptions(all,ctx,limit,gradeApi){
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

  function replacementGoal(slotKey,candidate,match){
    if(slotKey==='CORE-ACT'){
      return ['抗旋转','抗侧屈','抗伸展','旋转控制'].find(goal=>candidate.role.includes(goal))
        || candidate.movementFamily;
    }
    return (match?.primary||match?.accessory)?.task;
  }

  function replacementOptions(slotKey,ctx,current,pool,otherSlots){
    const usedIds=new Set(otherSlots.map(item=>item.actionId));
    const usedFamilies=new Set(otherSlots.map(item=>item.movementFamily).filter(Boolean));
    const currentMatch=current&&lessonMatch(slotKey,current,ctx);
    const goal=current&&replacementGoal(slotKey,current,currentMatch);
    const compatible=pool.filter(item=>{
      if(item.actionId===current?.actionId||usedIds.has(item.actionId)||usedFamilies.has(item.movementFamily))return false;
      if(!ctx.mainActionIds.length)return true;
      if(slotKey==='MOB-U'&&current?.mainFit===3&&item.mainFit!==3)return false;
      if(slotKey==='INTEGRATED'&&item.movementFamily==='mobility-ankle')return false;
      return item.mainFit>0||item.auxFit>0;
    });
    const rows=compatible.map(item=>{
      const match=lessonMatch(slotKey,item,ctx),lift=match?.primary||match?.accessory;
      const sameGoal=goal&&replacementGoal(slotKey,item,match)===goal;
      const group=sameGoal?'延续当前目的':'调整热身侧重';
      const reason=lift?`${match.primary?'主项':'辅项'} · ${lift.name}`:'';
      const detail=[reason,item.role].filter(Boolean).join('｜').replace(/\s*[+/]\s*/g,'、');
      return {...item,replacementGroup:group,replacementDetail:detail};
    });
    const same=rows.filter(item=>item.replacementGroup==='延续当前目的');
    const different=rows.filter(item=>item.replacementGroup!=='延续当前目的');
    const ordered=[...same,...different];
    const seen=new Set();
    const distinct=ordered.filter(item=>{
      const family=item.movementFamily||item.actionId;
      if(seen.has(family))return false;
      seen.add(family);
      return true;
    });
    const alternatives=distinct.slice(0,4);
    return current?[{...current,replacementGroup:'当前动作',replacementDetail:current.role},...alternatives]:alternatives;
  }

  function resolve(inputContext,{selections={}}={}){
    const ctx=normalizeContext(inputContext),normalizedSelections=normalizeSelections(selections);
    const candidatePool={},candidateMap={};
    SLOT_ORDER.forEach(slotKey=>{
      candidatePool[slotKey]=rankSlotCandidates(slotKey,ctx,{limit:99});
      candidateMap[slotKey]=ctx.level==='L4'&&slotKey==='MOB-U'
        ?diversifyUpperCandidates(candidatePool[slotKey],5)
        :ctx.template==='f111'&&ctx.level==='L4'&&slotKey==='CORE-ACT'
          ?diversifyCoreCandidates(candidatePool[slotKey],ctx,5)
        :candidatePool[slotKey].slice(0,5);
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
      const hasCourse=ctx.template==='f111'&&ctx.mainActionIds.length;
      const otherSlots=Object.entries(resolvedMap).filter(([key,value])=>key!==slotKey&&value.candidate).map(([,value])=>value.candidate);
      let options=hasCourse
        ?replacementOptions(slotKey,ctx,candidate,candidatePool[slotKey],otherSlots)
        :ctx.level==='L4'?candidateMap[slotKey]:gradeOptions(candidatePool[slotKey],ctx,5,G());
      if(candidate&&!options.some(option=>option.actionId===candidate.actionId)){
        const peers=options.filter(option=>option.prepGrade===candidate.prepGrade);
        const replace=peers.at(-1)||options.at(-1);
        options=options.filter(option=>option!==replace).concat(candidate);
      }
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
        matchReason:matchReasonFor(slotKey,ctx,candidate),
        source:entry.source,
        fallbackReason:entry.fallbackReason,
        candidates:options,
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
    candidateFromWarmup,courseReason,rankSlotCandidates,resolve,
  };
})();
