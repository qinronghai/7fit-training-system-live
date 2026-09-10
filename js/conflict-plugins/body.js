(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};

  function makeIssue(severity,title,text,code,_order){
    return {severity,title,text,code,_order};
  }

  function asArray(value){return Array.isArray(value)?value:[];}

  function familyDeviationIssues(session){
    const data=D(),family=data.bodyFamilies?.[session?.familyId],level=session?.level,issues=[];
    if(!family||!data.bodyLevelPolicies?.[level]){
      issues.push(makeIssue(
        'hard','Body Family / Level 无效',
        `当前 Body Family 或 Level 无法识别：${String(session?.familyId||'未标')} / ${String(level||'未标')}。`,
        'BODY_FAMILY_DEVIATION',10000
      ));
      return issues;
    }

    asArray(session?.main?.content).forEach((item,index)=>{
      const actionId=item?.actionId||'',role=family.slotPolicy?.[item?.key],meta=data.bodyActionMeta?.[actionId];
      const legal=!!role&&!!meta
        &&asArray(meta.families).includes(session.familyId)
        &&asArray(meta.levels).includes(level)
        &&asArray(meta.roles).includes(role);
      if(legal)return;
      const actionName=data.actions?.[actionId]?.name||actionId||'未知动作';
      issues.push(makeIssue(
        'hard','Body Family 偏离',
        `${item?.key||`S${index+1}`} 的 ${actionName} 不符合 ${session.familyId} / ${level} / ${role||'未知角色'} 的 Body 白名单。`,
        'BODY_FAMILY_DEVIATION',10000+index
      ));
    });
    return issues;
  }

  function primaryTargetIssue(session){
    const data=D(),family=data.bodyFamilies?.[session?.familyId],direct=session?.domainContext?.volume?.directSetsByTarget||{};
    if(!family)return null;
    const missing=asArray(family.primaryTargets).filter(target=>Number(direct[target]||0)<=0);
    if(!missing.length)return null;
    const names=missing.map(target=>data.bodyTargetCatalog?.[target]?.name||target);
    return makeIssue(
      'hard','主要目标肌群缺失',
      `以下 Family primary target 没有 Direct Work Sets：${names.join('、')}。`,
      'BODY_PRIMARY_TARGET_MISSING',10100
    );
  }

  function volumeIssue(session){
    const data=D(),range=data.bodyLevelPolicies?.[session?.level]?.sessionWorkingSetRange,total=Number(session?.domainContext?.volume?.totalWorkingSets);
    if(!Array.isArray(range)||range.length!==2||!Number.isFinite(total))return null;
    if(total>=range[0]&&total<=range[1])return null;
    return makeIssue(
      'hard','Body 工作组数超出等级范围',
      `${session.level} 正式工作组应为 ${range[0]}–${range[1]} 组，当前为 ${total} 组。`,
      'BODY_VOLUME_OUT_OF_RANGE',10200
    );
  }

  function highFatigueIssue(session){
    const policy=D().bodyConflictPolicy||{},count=Number(session?.domainContext?.volume?.highFatigueCompoundCount);
    if(!Number.isFinite(count)||count<=Number(policy.maxHighFatigueCompounds))return null;
    return makeIssue(
      'warn','高疲劳复合动作堆叠',
      `高疲劳复合动作共 ${count} 个，超过 Body V1 建议上限 ${policy.maxHighFatigueCompounds} 个。`,
      'BODY_HIGH_FATIGUE_STACK',10300
    );
  }

  function movementRedundancyIssue(session){
    const data=D(),policy=data.bodyConflictPolicy||{},max=Number(policy.maxSamePatternActions),counts={};
    if(!Number.isFinite(max))return null;
    asArray(session?.main?.content).forEach(item=>{
      const pattern=data.actions?.[item?.actionId]?.pattern;
      if(pattern)counts[pattern]=(counts[pattern]||0)+1;
    });
    const repeated=Object.keys(counts)
      .filter(pattern=>counts[pattern]>max)
      .sort((a,b)=>String(a).localeCompare(String(b),'zh-CN'));
    if(!repeated.length)return null;
    return makeIssue(
      'warn','动作模式重复偏高',
      repeated.map(pattern=>`${pattern} × ${counts[pattern]}`).join('；')+`，超过同模式 ${max} 个动作的建议上限。`,
      'BODY_MOVEMENT_REDUNDANCY',10400
    );
  }

  function isolationIssue(session){
    const policy=D().bodyConflictPolicy||{},ratio=Number(session?.domainContext?.volume?.isolationRatio),threshold=Number(policy.isolationRatioWarnAbove);
    if(!Number.isFinite(ratio)||!Number.isFinite(threshold)||ratio<=threshold)return null;
    return makeIssue(
      'warn','孤立训练占比偏高',
      `孤立工作组占比为 ${(ratio*100).toFixed(0)}%，超过 Body V1 提醒阈值 ${(threshold*100).toFixed(0)}%。`,
      'BODY_ISOLATION_HEAVY',10500
    );
  }

  function timeIssue(session){
    const policy=D().bodyConflictPolicy||{},range=policy.estimatedSessionMinutesRange,minutes=Number(session?.domainContext?.volume?.estimatedMinutes);
    if(!Array.isArray(range)||range.length!==2||!Number.isFinite(minutes))return null;
    if(minutes>=range[0]&&minutes<=range[1])return null;
    return makeIssue(
      'warn','Body 主训练时间预算偏离',
      `预计 Body 主训练约 ${minutes} 分钟，建议区间为 ${range[0]}–${range[1]} 分钟。`,
      'BODY_TIME_BUDGET',10600
    );
  }

  function evaluate(session){
    const issues=[...familyDeviationIssues(session)];
    [
      primaryTargetIssue(session),
      volumeIssue(session),
      highFatigueIssue(session),
      movementRedundancyIssue(session),
      isolationIssue(session),
      timeIssue(session),
    ].forEach(issue=>{if(issue)issues.push(issue);});
    return issues;
  }

  const plugin={evaluate};
  window.V15BodyConflictPlugin=plugin;
  if(!window.V15Conflict?.register)throw new Error('V15Conflict service is unavailable');
  window.V15Conflict.register('body',plugin);
})();
