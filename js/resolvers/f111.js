(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const unique=values=>[...new Set((Array.isArray(values)?values:[]).filter(value=>typeof value==='string'&&value))];

  function fail(message,details={}){
    const error=new Error(message);
    error.code='F111_INPUT_INVALID';
    Object.assign(error,details);
    throw error;
  }

  function publicConflict(result={}){
    return {
      status:['PASS','WARN','FAIL'].includes(result.status)?result.status:'PASS',
      hardCount:Number.isInteger(result.hardCount)?result.hardCount:0,
      warnCount:Number.isInteger(result.warnCount)?result.warnCount:0,
      issues:(Array.isArray(result.issues)?result.issues:[]).map(issue=>({
        severity:['hard','warn','info'].includes(issue?.severity)?issue.severity:'info',
        title:String(issue?.title||'提示'),
        text:String(issue?.text||''),
        code:String(issue?.code||''),
      })),
    };
  }

  function publicAnatomy(actionIds){
    const summary=window.V14Anatomy?.aggregate?.(actionIds)||{};
    return {
      actionIds:unique(actionIds),
      primary:unique(summary.primary),
      secondary:unique(summary.secondary),
      stabilizers:unique(summary.stabilizers),
    };
  }

  function slotKey(slot,index){
    const raw=String(slot?.slotKey||'');
    if(raw.includes('__'))return raw.split('__').pop();
    const label=String(slot?.slotName||'');
    if(label.includes('｜'))return label.split('｜')[0];
    return raw||`S${index+1}`;
  }

  function publicSlot(key,label,actionId,source,{tier='',grade='',prescription=''}={}){
    const action=D().actions?.[actionId]||{};
    return {
      key,
      label:String(label||key),
      actionId:String(actionId||''),
      name:String(action.name||actionId||''),
      tier:String(tier||action.tier||''),
      grade:String(grade||action.supportGrade||action.grade||action.coreGrade||''),
      prescription:String(prescription||''),
      source,
    };
  }

  function contexts({level,recipeId='',title,summary,slots,mainActionIds,conflict}){
    const actionIds=unique(slots.map(slot=>slot.actionId));
    const prepContext=window.V14PrepResolver.contextFromF111({
      level,
      recipeId,
      mainActionIds:unique(mainActionIds),
      formalActionIds:actionIds,
      mainPatterns:[],
    });
    const conflictContext=publicConflict(conflict);
    const warnings=conflictContext.issues
      .filter(issue=>issue.severity==='hard'||issue.severity==='warn')
      .map(issue=>`${issue.code||issue.severity}:${issue.title}`);
    return {
      prepContext,
      anatomyContext:publicAnatomy(actionIds),
      conflictContext,
      copyContext:{title,summary,actionIds},
      warnings,
      resolvedSelections:slots.map(slot=>({key:slot.key,actionId:slot.actionId,source:slot.source})),
    };
  }

  function resolvePreset(input){
    const data=D();
    const recipeId=typeof input.recipeId==='string'?input.recipeId:'';
    const level=/^L[1-4]$/.test(input.level||'')?input.level:'';
    if(!recipeId||!level)fail('F111 preset requires recipeId and L1-L4 level',{input});
    const sessionId=`${recipeId}-${level}`;
    const session=data.sessions?.[sessionId],recipe=data.recipes?.[recipeId]||{},view=data.sessionViews?.[sessionId]||{};
    if(!session)fail(`Unknown F111 preset session: ${sessionId}`,{sessionId});
    const explicit=Array.isArray(input.selections)?input.selections:[];
    const slots=session.slots.map((slot,index)=>{
      const baselineId=slot.baselineId;
      const requested=explicit[index];
      const actionId=typeof requested==='string'&&data.actions?.[requested]?requested:baselineId;
      const source=actionId===baselineId?'baseline':'manual';
      return publicSlot(slotKey(slot,index),slot.slotName,actionId,source);
    });
    const title=`${recipeId}｜${recipe.name||recipeId}`;
    const summary=String(view.summary||'');
    const mainActionIds=slots.filter(slot=>['A','B'].includes(slot.key)).map(slot=>slot.actionId);
    const shared=contexts({level,recipeId,title,summary,slots,mainActionIds,conflict:window.V14Conflict.evaluate(sessionId,slots.map(slot=>slot.actionId))});
    return {
      schemaVersion:1,
      resolverVersion:'f111-adapter-v1',
      templateId:'f111',
      familyId:recipeId,
      level,
      title,
      summary,
      main:{kind:'SLOT',content:slots},
      ...shared,
      source:{type:'PRESET',id:sessionId},
    };
  }

  function resolveComposer(input){
    if(!window.V14Composer?.resolve)fail('V14Composer.resolve is unavailable');
    const resolved=window.V14Composer.resolve({
      level:input.level,
      lowerMode:input.lowerMode,
      upperMode:input.upperMode,
      coreDemand:input.coreDemand,
      selections:input.selections||{},
      includeExpandedMain:!!input.includeExpandedMain,
      includeExpandedSupport:!!input.includeExpandedSupport,
      includeExpandedCore:!!input.includeExpandedCore,
    });
    const level=resolved.level;
    const requestedSelections=input.selections&&typeof input.selections==='object'?input.selections:{};
    const slots=resolved.slots.map((slot,index)=>{
      const key=slot.slotKey||slotKey(slot,index);
      const source=requestedSelections[key]===slot.actionId?'manual':'auto';
      return publicSlot(key,slot.slotName,slot.actionId,source,{
        tier:slot.tier,
        grade:slot.grade,
        prescription:slot.prescriptionOverride||'',
      });
    });
    const title=`自由组合｜${resolved.lower?.name||''} + ${resolved.upper?.name||''}`;
    const summary='F111 自由组合｜一下肢 + 一上肢 + 一支撑';
    const mainActionIds=slots.filter(slot=>['A','B'].includes(slot.key)).map(slot=>slot.actionId);
    const actionIds=slots.map(slot=>slot.actionId);
    const prepContext=window.V14PrepResolver.contextFromF111({
      level,
      recipeId:'',
      mainPatterns:unique([resolved.lower?.name,resolved.upper?.name]),
      mainActionIds,
      formalActionIds:actionIds,
    });
    const conflictContext=publicConflict(window.V14Conflict.evaluateComposer(resolved));
    const anatomyContext=publicAnatomy(actionIds);
    const warnings=conflictContext.issues
      .filter(issue=>issue.severity==='hard'||issue.severity==='warn')
      .map(issue=>`${issue.code||issue.severity}:${issue.title}`);
    return {
      schemaVersion:1,
      resolverVersion:'f111-adapter-v1',
      templateId:'f111',
      familyId:resolved.compositionId,
      level,
      title,
      summary,
      main:{kind:'SLOT',content:slots},
      prepContext,
      anatomyContext,
      conflictContext,
      copyContext:{title,summary,actionIds:unique(actionIds)},
      warnings,
      resolvedSelections:slots.map(slot=>({key:slot.key,actionId:slot.actionId,source:slot.source})),
      source:{type:'COMPOSER',id:`${resolved.compositionId}-${level}`},
    };
  }

  function resolve(input={}){
    if(input.mode==='preset')return resolvePreset(input);
    if(input.mode==='composer')return resolveComposer(input);
    fail('F111 resolver requires mode preset or composer',{mode:input.mode});
  }

  window.V15F111Resolver=resolve;
  if(!window.V15TemplateResolver?.register)fail('Template Resolver Dispatcher is unavailable');
  window.V15TemplateResolver.register('f111',resolve);
})();
