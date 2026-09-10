(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const D=()=>window.V14_DATA||{};
  const Shared=()=>window.V14SessionCopy||{};

  function clean(value){return String(value??'').trim();}
  function rangeText(values,suffix=''){
    const list=Array.isArray(values)?values.filter(value=>value!==null&&value!==undefined&&value!==''):[];
    if(!list.length)return '—';
    return `${list.length===1?list[0]:list.join('–')}${suffix}`;
  }
  function roleName(role){return D().bodyRoles?.[role]?.name||role||'动作';}
  function targetName(id){return D().bodyTargetCatalog?.[id]?.name||id;}
  function actionFields(actionId){return D().actionDetails?.[actionId]?.fields||{};}
  function recovery(){
    if(!M.BodyRecovery?.payload)throw new Error('Body Recovery presentation is unavailable');
    return M.BodyRecovery.payload();
  }

  function buildSlots(session){
    const domains=session?.domainContext?.slots||{};
    return (session?.main?.content||[]).map(slot=>{
      const domain=domains[slot.key]||{};
      const fields=actionFields(slot.actionId);
      return {
        key:slot.key,
        role:domain.role||String(slot.key||'').replace(/-\d+$/,''),
        roleName:roleName(domain.role||String(slot.key||'').replace(/-\d+$/,'')),
        actionId:slot.actionId,
        name:slot.name||D().actions?.[slot.actionId]?.name||slot.actionId,
        source:slot.source||'auto',
        sets:domain.workingSets??null,
        reps:Array.isArray(domain.repRange)?[...domain.repRange]:[],
        rir:Array.isArray(domain.rirRange)?[...domain.rirRange]:[],
        rest:Array.isArray(domain.restSecondsRange)?[...domain.restSecondsRange]:[],
        perSide:Boolean(domain.perSide),
        purpose:clean(fields['训练目标']||fields['训练目的']),
        cue:clean(fields['教练口令']),
        observation:clean(fields['常见错误']||fields['常见代偿']),
      };
    });
  }

  function buildPayload(session,resolvedPrep,now){
    if(!session||session.templateId!=='body')throw new Error('BodyCopy requires a Body ResolvedSession');
    const family=D().bodyFamilies?.[session.familyId]||{};
    const prep=M.BodyPrep?.items?M.BodyPrep.items(resolvedPrep):[];
    return {
      templateId:'body',
      familyId:session.familyId,
      familyName:family.name||session.title||session.familyId,
      level:session.level,
      date:Shared().formatDate?Shared().formatDate(now):'',
      summary:session.summary||'',
      prep,
      slots:buildSlots(session),
      anatomy:session.anatomyContext||{},
      volume:session.domainContext?.volume||{},
      conflicts:session.conflictContext||{status:'PASS',hardCount:0,warnCount:0,issues:[]},
      recovery:recovery(),
    };
  }

  function prepLines(prep){
    if(!(prep||[]).length)return ['- 暂无热身动作'];
    return prep.map(item=>{
      const meta=[clean(item.prescription),clean(item.why)].filter(Boolean).join('｜');
      return `- ${clean(item.name)||'暂无合法候选'}${meta?`｜${meta}`:''}`;
    });
  }

  function slotPrescription(slot){
    return `Sets ${slot.sets??'—'}｜Reps ${rangeText(slot.reps)}${slot.perSide?' / 侧':''}｜RIR ${rangeText(slot.rir)}｜Rest ${rangeText(slot.rest,' 秒')}`;
  }

  function directSetLines(volume){
    const entries=Object.entries(volume?.directSetsByTarget||{}).filter(([,sets])=>Number(sets)>0);
    return entries.length?entries.map(([id,sets])=>`- ${targetName(id)}：${sets} 组`):['- —'];
  }

  function conflictLines(conflicts){
    const result=conflicts||{};
    const lines=[`状态：${clean(result.status)||'PASS'}｜硬冲突 ${Number(result.hardCount||0)}｜警告 ${Number(result.warnCount||0)}`];
    (result.issues||[]).forEach(issue=>{
      const text=[clean(issue.title),clean(issue.text||issue.message)].filter(Boolean).join('｜');
      if(text)lines.push(`- ${text}`);
    });
    return lines;
  }

  function formatCoach(payload){
    const p=payload||{},r=p.recovery||{};
    const lines=[
      '7Fit｜Body 教练训练单',
      clean(p.date),
      `Family：${clean(p.familyId)}｜${clean(p.familyName)}`,
      `Level：${clean(p.level)}`,
    ];
    if(clean(p.summary))lines.push(`训练重点：${clean(p.summary)}`);
    lines.push('','【PREP｜动态热身 / 激活】',...prepLines(p.prep),'','【BODY｜正式训练】');
    (p.slots||[]).forEach(slot=>{
      lines.push(`${clean(slot.roleName)}｜${clean(slot.name)}`);
      lines.push(slotPrescription(slot));
      if(clean(slot.purpose))lines.push(`训练目标：${clean(slot.purpose)}`);
      if(clean(slot.cue))lines.push(`教练口令：${clean(slot.cue)}`);
      if(clean(slot.observation))lines.push(`观察重点：${clean(slot.observation)}`);
    });
    lines.push(
      '',
      '【Direct Work Sets｜有效工作组】',
      `总工作组：${p.volume?.totalWorkingSets??0}｜预计 ${p.volume?.estimatedMinutes??'—'} 分钟`,
      ...directSetLines(p.volume),
      '',
      '【Conflict】',
      ...conflictLines(p.conflicts),
      '',
      `【${clean(r.title)}】`,
      clean(r.note),
      clean(r.boundary),
    );
    return lines.filter((line,index,array)=>line!==''||array[index-1]!=='').join('\n').trim();
  }

  function memberPurpose(slot){
    const purpose=clean(slot?.purpose);
    return purpose?`｜${purpose}`:'';
  }

  function formatMember(payload){
    const p=payload||{},r=p.recovery||{};
    const lines=[
      '7Fit｜今日训练安排',
      clean(p.date),
      `训练主题：${clean(p.familyName)||'健美式塑形'}`,
    ];
    if(clean(p.summary))lines.push(`今日重点：${clean(p.summary)}`);
    lines.push('','【训练前准备】',...prepLines(p.prep),'','【正式训练】');
    (p.slots||[]).forEach((slot,index)=>{
      lines.push(`${index+1}. ${clean(slot.name)}${memberPurpose(slot)}`);
      lines.push(`${slot.sets??'—'} 组 × ${rangeText(slot.reps)}${slot.perSide?' / 侧':''}｜保留 ${rangeText(slot.rir)} 次余力｜组间休息 ${rangeText(slot.rest,' 秒')}`);
    });
    lines.push(
      '',
      `【${clean(r.title)}】`,
      clean(r.note),
    );
    return lines.filter((line,index,array)=>line!==''||array[index-1]!=='').join('\n').trim();
  }

  M.BodyCopy={buildPayload,formatCoach,formatMember};
})();
