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

  function selectionMap(session){
    return Object.fromEntries(asArray(session?.main?.content)
      .filter(item=>item?.key&&item?.actionId)
      .map(item=>[item.key,item.actionId]));
  }

  function slotIntentAssessment(session,slotKey){
    const item=asArray(session?.main?.content).find(entry=>entry?.key===slotKey);
    if(!item?.actionId||!window.V15BodyResolver?.assessSlotIntent)return null;
    return window.V15BodyResolver.assessSlotIntent({
      familyId:session.familyId,
      level:session.level,
      slotKey,
      actionId:item.actionId,
      currentSelections:selectionMap(session),
    });
  }

  function slotIntentIssues(session){
    const issues=[];
    asArray(session?.main?.content).forEach((item,index)=>{
      if(!item?.key||!item?.actionId)return;
      const assessment=slotIntentAssessment(session,item.key);
      if(!assessment||assessment.ok)return;
      const handled=new Set([
        'BODY_PRIMARY_SECONDARY_TOO_SIMILAR',
        'BODY_ACCESSORY_ROLE_COLLAPSE',
      ]);
      const residual=assessment.reasons.filter(code=>!handled.has(code));
      if(!residual.length)return;
      const actionName=D().actions?.[item.actionId]?.name||item.actionId;
      issues.push(makeIssue(
        'hard','Body 槽位职责不匹配',
        `${item.key} 的 ${actionName} 不符合当前槽位职责：${residual.join('、')}。`,
        'BODY_SLOT_INTENT_MISMATCH',10050+index
      ));
    });
    return issues;
  }

  function primarySecondarySimilarityIssue(session){
    const assessment=slotIntentAssessment(session,'SECONDARY');
    if(!assessment?.reasons?.includes('BODY_PRIMARY_SECONDARY_TOO_SIMILAR'))return null;
    const selections=selectionMap(session),data=D();
    const primary=data.actions?.[selections.PRIMARY]?.name||selections.PRIMARY||'主项';
    const secondary=data.actions?.[selections.SECONDARY]?.name||selections.SECONDARY||'次主项';
    return makeIssue(
      'hard','主项与次主项过于同质',
      `${primary} + ${secondary} 未形成足够的动作模式、侧别或目标刺激差异。`,
      'BODY_PRIMARY_SECONDARY_TOO_SIMILAR',10070
    );
  }

  function accessoryRoleCollapseIssue(session){
    const assessment=slotIntentAssessment(session,'ACCESSORY');
    if(!assessment?.reasons?.includes('BODY_ACCESSORY_ROLE_COLLAPSE'))return null;
    const actionId=selectionMap(session).ACCESSORY,actionName=D().actions?.[actionId]?.name||actionId||'辅助动作';
    return makeIssue(
      'hard','辅助动作退化为第三主项',
      `${actionName} 与主项 / 次主项的复合动作路径过度重复，应改为承担补充或塑形职责的动作。`,
      'BODY_ACCESSORY_ROLE_COLLAPSE',10080
    );
  }

  function targetRedundancyIssue(session){
    const data=D(),limit=Number(data.bodyConflictPolicy?.maxDirectTargetSlots),counts={};
    if(!Number.isFinite(limit))return null;
    asArray(session?.main?.content).forEach(item=>{
      const meta=data.bodyActionMeta?.[item?.actionId];
      asArray(meta?.directTargets).forEach(target=>{counts[target]=(counts[target]||0)+1;});
    });
    const repeated=Object.entries(counts)
      .filter(([,count])=>count>limit)
      .sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
    if(!repeated.length)return null;
    const text=repeated.map(([target,count])=>{
      const name=data.bodyTargetCatalog?.[target]?.name||target;
      return `${name} × ${count} 个槽位`;
    }).join('；');
    return makeIssue(
      'warn','局部目标重复偏高',
      `${text}，超过 ${limit} 个正式槽位的提醒阈值。`,
      'BODY_SESSION_TARGET_REDUNDANCY',10450
    );
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

  function exerciseFamilyDuplicateIssue(session){
    const data=D(),groups={};
    asArray(session?.main?.content).forEach(item=>{
      const actionId=item?.actionId||'',meta=data.bodyActionMeta?.[actionId],group=String(meta?.exerciseFamily||'');
      if(!group)return;
      (groups[group]||(groups[group]=[])).push(data.actions?.[actionId]?.name||actionId);
    });
    const repeated=Object.entries(groups).filter(([,names])=>names.length>1);
    if(!repeated.length)return null;
    return makeIssue(
      'hard','同动作家族重复',
      repeated.map(([,names])=>names.join(' + ')).join('；')+'。同一动作家族不能同时占用多个正式训练槽位。',
      'BODY_EXERCISE_FAMILY_DUPLICATE',10350
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
    const issues=[
      ...familyDeviationIssues(session),
      ...slotIntentIssues(session),
    ];
    [
      primarySecondarySimilarityIssue(session),
      accessoryRoleCollapseIssue(session),
      primaryTargetIssue(session),
      volumeIssue(session),
      highFatigueIssue(session),
      exerciseFamilyDuplicateIssue(session),
      movementRedundancyIssue(session),
      targetRedundancyIssue(session),
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
