(function(){
  'use strict';

  const DATA=()=>window.V14_DATA||{};
  const ANAT=()=>window.V14_ANATOMY||{meta:{exposureWeights:{primary:1,secondary:.5,stabilizers:.25}},records:{}};

  const ROLE_LABELS={
    strength:['主要肌群','辅助肌群','稳定肌群'],
    support_core:['主要训练肌群','协同肌群','稳定作用'],
    activation:['主要激活肌群','辅助激活肌群','稳定作用'],
    mobility:['主要活动区域','辅助活动区域','稳定控制'],
    stretch:['主要伸展肌群','辅助伸展区域','稳定控制'],
    foam_roll:['主要松解组织','相关肌群或区域','安全避让区域'],
    conditioning:['主要参与肌群','协同参与肌群','稳定肌群']
  };

  function uniquePush(list,value){if(value&&!list.includes(value))list.push(value);}
  function asArray(value){return Array.isArray(value)?value:[];}
  function get(actionId){return ANAT().records?.[actionId]||null;}
  function labels(actionId){
    const role=get(actionId)?.roleType||'strength';
    return (ROLE_LABELS[role]||ROLE_LABELS.strength).slice();
  }

  function aggregate(actionIds){
    const ids=Array.isArray(actionIds)?actionIds.filter(Boolean):[];
    const result={primary:[],secondary:[],stabilizers:[],joints:[],scores:{},unknownIds:[],reviewIds:[]};
    const weights=ANAT().meta?.exposureWeights||{primary:1,secondary:.5,stabilizers:.25};
    const firstSeen={}; let order=0;

    function scoreMuscle(muscle,weight){
      if(!muscle)return;
      if(firstSeen[muscle]===undefined)firstSeen[muscle]=order++;
      result.scores[muscle]=(result.scores[muscle]||0)+weight;
    }

    ids.forEach(id=>{
      const rec=get(id);
      if(!rec){uniquePush(result.unknownIds,id);return;}
      if(rec.confidence==='review')uniquePush(result.reviewIds,id);
      asArray(rec.primary).forEach(x=>uniquePush(result.primary,x));
      asArray(rec.secondary).forEach(x=>uniquePush(result.secondary,x));
      asArray(rec.stabilizers).forEach(x=>uniquePush(result.stabilizers,x));
      asArray(rec.joints).forEach(x=>uniquePush(result.joints,x));
      if(rec.confidence==='review')return;
      if(['conditioning','stretch','mobility','foam_roll'].includes(rec.roleType))return;
      asArray(rec.primary).forEach(x=>scoreMuscle(x,Number(weights.primary)||1));
      asArray(rec.secondary).forEach(x=>scoreMuscle(x,Number(weights.secondary)||.5));
      asArray(rec.stabilizers).forEach(x=>scoreMuscle(x,Number(weights.stabilizers)||.25));
    });

    const byScore=(a,b)=>(result.scores[b]||0)-(result.scores[a]||0)||((firstSeen[a]??9999)-(firstSeen[b]??9999))||String(a).localeCompare(String(b),'zh-CN');
    result.primary.sort(byScore);
    result.secondary.sort(byScore);
    result.stabilizers.sort(byScore);
    return result;
  }

  function aggregateSession(sessionId,selectedIds){
    const session=DATA().sessions?.[sessionId];
    if(!session)return aggregate([]);
    const ids=Array.isArray(selectedIds)&&selectedIds.length?selectedIds:session.slots.map(s=>s.baselineId);
    return aggregate(ids);
  }

  function compareToBaseline(sessionId,selectedIds){
    const session=DATA().sessions?.[sessionId];
    if(!session)return {baseline:{},current:{},increases:[]};
    const baselineIds=session.slots.map(s=>s.baselineId);
    const currentIds=Array.isArray(selectedIds)&&selectedIds.length?selectedIds:baselineIds;
    const baseline=aggregate(baselineIds).scores;
    const current=aggregate(currentIds).scores;
    const muscles=new Set([...Object.keys(baseline),...Object.keys(current)]);
    const increases=[];
    muscles.forEach(muscle=>{
      const b=Number(baseline[muscle]||0),c=Number(current[muscle]||0);
      if(c>b+1e-9)increases.push({muscle,baseline:b,current:c,delta:c-b});
    });
    increases.sort((a,b)=>b.delta-a.delta||b.current-a.current||a.muscle.localeCompare(b.muscle,'zh-CN'));
    return {baseline,current,increases};
  }

  function rankFoam(actionIds,{limit=4}={}){
    const mapping=ANAT().foamByMuscle||{};
    const scores={},order={}; let n=0;
    (Array.isArray(actionIds)?actionIds:[]).forEach(id=>{
      const rec=get(id);
      if(!rec||rec.confidence==='review')return;
      [['primary',2],['secondary',1]].forEach(([key,weight])=>{
        asArray(rec[key]).forEach(muscle=>{
          const foamId=mapping[muscle];
          if(!foamId||!DATA().foamRollDetails?.[foamId])return;
          if(order[foamId]===undefined)order[foamId]=n++;
          scores[foamId]=(scores[foamId]||0)+weight;
        });
      });
    });
    return Object.keys(scores)
      .sort((a,b)=>scores[b]-scores[a]||order[a]-order[b]||a.localeCompare(b))
      .slice(0,Math.max(0,limit));
  }

  function rankWarmups(actionIds,{recipeId,level='L1',tier='T1',limit=6}={}){
    const data=DATA(), target=aggregate(actionIds);
    const targetMuscles=new Set([...target.primary,...target.secondary]);
    const targetJoints=new Set(target.joints);
    const patterns=[];
    const recipe=data.recipes?.[recipeId];
    if(recipe){uniquePush(patterns,recipe.lower);uniquePush(patterns,recipe.upper);}
    (Array.isArray(actionIds)?actionIds:[]).forEach(id=>uniquePush(patterns,data.actions?.[id]?.pattern));

    const priority=new Map(); let priorityIndex=0;
    patterns.forEach(pattern=>{
      (data.warmupMatchByPattern?.[pattern]||[]).forEach(prepId=>{
        if(!priority.has(prepId))priority.set(prepId,priorityIndex++);
      });
    });
    (data.warmupIds||[]).forEach(prepId=>{
      if(!priority.has(prepId))priority.set(prepId,priorityIndex++);
    });

    const scored=[];
    (data.warmupIds||[]).forEach(prepId=>{
      const w=data.warmupDetails?.[prepId]; if(!w)return;
      if(level&&!w.sessionLevels?.includes(level))return;
      if(tier&&!w.mainTiers?.includes(tier))return;
      const rec=get(w.actionId);
      let score=0;
      if(rec){
        const candidateMuscles=new Set([...asArray(rec.primary),...asArray(rec.secondary),...asArray(rec.tissueTargets)]);
        for(const muscle of candidateMuscles){if(targetMuscles.has(muscle)){score+=2;break;}}
        if(asArray(rec.joints).some(j=>targetJoints.has(j)))score+=1;
      }
      if((w.targetPatterns||[]).some(p=>patterns.includes(p)))score+=1;
      scored.push({prepId,score,priority:priority.get(prepId)??9999});
    });

    return scored
      .sort((a,b)=>b.score-a.score||a.priority-b.priority||a.prepId.localeCompare(b.prepId))
      .slice(0,Math.max(0,limit))
      .map(x=>x.prepId);
  }

  window.V14Anatomy={get,labels,aggregate,aggregateSession,compareToBaseline,rankFoam,rankWarmups};
})();
