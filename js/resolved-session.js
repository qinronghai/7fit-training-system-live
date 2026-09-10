(function(){
  'use strict';

  const REQUIRED=Object.freeze([
    'schemaVersion','resolverVersion','templateId','familyId','level','title','summary','main',
    'prepContext','anatomyContext','conflictContext','copyContext','warnings','resolvedSelections','source'
  ]);
  const OPTIONAL=Object.freeze(['domainContext']);
  const TOP_LEVEL=new Set([...REQUIRED,...OPTIONAL]);
  const SELECTION_SOURCES=new Set(['baseline','auto','manual']);
  const SOURCE_TYPES=new Set(['PRESET','COMPOSER','GENERATED']);
  const CONFLICT_STATUS=new Set(['PASS','WARN','FAIL']);
  const CONFLICT_SEVERITY=new Set(['hard','warn','info']);

  const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
  const isString=value=>typeof value==='string';
  const isNonEmpty=value=>isString(value)&&value.length>0;
  const stringArray=value=>Array.isArray(value)&&value.every(isNonEmpty)&&new Set(value).size===value.length;
  const push=(errors,path,message)=>errors.push(`${path}: ${message}`);

  function validateSlotItem(item,index,errors){
    const path=`main.content.${index}`;
    if(!isObject(item)){push(errors,path,'must be an object');return;}
    const keys=['key','label','actionId','name','tier','grade','prescription','source'];
    keys.forEach(key=>{if(!(key in item))push(errors,`${path}.${key}`,'is required');});
    ['key','label','actionId','name'].forEach(key=>{if(key in item&&!isNonEmpty(item[key]))push(errors,`${path}.${key}`,'must be a non-empty string');});
    ['tier','grade','prescription'].forEach(key=>{if(key in item&&!isString(item[key]))push(errors,`${path}.${key}`,'must be a string');});
    if('source' in item&&!SELECTION_SOURCES.has(item.source))push(errors,`${path}.source`,'must be baseline, auto, or manual');
    Object.keys(item).forEach(key=>{if(!keys.includes(key))push(errors,`${path}.${key}`,'is not allowed');});
  }

  function validateProtocol(main,errors){
    const content=main.content;
    if(!isObject(content)){push(errors,'main.content','PROTOCOL content must be an object');return;}
    const keys=['protocolId','name','blocks','metrics'];
    keys.forEach(key=>{if(!(key in content))push(errors,`main.content.${key}`,'is required');});
    ['protocolId','name'].forEach(key=>{if(key in content&&!isNonEmpty(content[key]))push(errors,`main.content.${key}`,'must be a non-empty string');});
    if('blocks' in content){
      if(!Array.isArray(content.blocks)||!content.blocks.length)push(errors,'main.content.blocks','must be a non-empty array');
      else content.blocks.forEach((block,index)=>{
        const path=`main.content.blocks.${index}`;
        if(!isObject(block)){push(errors,path,'must be an object');return;}
        if(!isNonEmpty(block.key))push(errors,`${path}.key`,'must be a non-empty string');
        if(!isNonEmpty(block.label))push(errors,`${path}.label`,'must be a non-empty string');
        if(!Array.isArray(block.items)||!block.items.length)push(errors,`${path}.items`,'must be a non-empty array');
        else block.items.forEach((item,itemIndex)=>{
          const itemPath=`${path}.items.${itemIndex}`;
          if(!isObject(item)){push(errors,itemPath,'must be an object');return;}
          ['actionId','name'].forEach(key=>{if(!isNonEmpty(item[key]))push(errors,`${itemPath}.${key}`,'must be a non-empty string');});
          if(!isString(item.prescription))push(errors,`${itemPath}.prescription`,'must be a string');
          Object.keys(item).forEach(key=>{if(!['actionId','name','prescription'].includes(key))push(errors,`${itemPath}.${key}`,'is not allowed');});
        });
        Object.keys(block).forEach(key=>{if(!['key','label','items'].includes(key))push(errors,`${path}.${key}`,'is not allowed');});
      });
    }
    if('metrics' in content&&!isObject(content.metrics))push(errors,'main.content.metrics','must be an object');
    Object.keys(content).forEach(key=>{if(!keys.includes(key))push(errors,`main.content.${key}`,'is not allowed');});
  }

  function validateMain(main,errors){
    if(!isObject(main)){push(errors,'main','must be an object');return;}
    if(!['SLOT','PROTOCOL'].includes(main.kind)){push(errors,'main.kind','must be SLOT or PROTOCOL');return;}
    Object.keys(main).forEach(key=>{if(!['kind','content'].includes(key))push(errors,`main.${key}`,'is not allowed');});
    if(main.kind==='SLOT'){
      if(!Array.isArray(main.content)||!main.content.length)push(errors,'main.content','SLOT content must be a non-empty array');
      else main.content.forEach((item,index)=>validateSlotItem(item,index,errors));
    }else validateProtocol(main,errors);
  }

  function validatePrep(ctx,errors){
    const path='prepContext',keys=['template','level','recipeId','mainPatterns','mainActionIds','formalActionIds','targetMuscles','modalities','impactDemand','powerDemand'];
    if(!isObject(ctx)){push(errors,path,'must be an object');return;}
    keys.forEach(key=>{if(!(key in ctx))push(errors,`${path}.${key}`,'is required');});
    if(!isNonEmpty(ctx.template))push(errors,`${path}.template`,'must be a non-empty string');
    if(!/^L[1-4]$/.test(ctx.level||''))push(errors,`${path}.level`,'must be L1-L4');
    if(!isString(ctx.recipeId))push(errors,`${path}.recipeId`,'must be a string');
    ['mainPatterns','mainActionIds','formalActionIds','targetMuscles','modalities'].forEach(key=>{if(!stringArray(ctx[key]))push(errors,`${path}.${key}`,'must be a unique non-empty string array');});
    ['impactDemand','powerDemand'].forEach(key=>{if(!isString(ctx[key]))push(errors,`${path}.${key}`,'must be a string');});
    Object.keys(ctx).forEach(key=>{if(!keys.includes(key))push(errors,`${path}.${key}`,'is not allowed');});
  }

  function validateAnatomy(ctx,errors){
    const path='anatomyContext',keys=['actionIds','primary','secondary','stabilizers'];
    if(!isObject(ctx)){push(errors,path,'must be an object');return;}
    keys.forEach(key=>{if(!stringArray(ctx[key]))push(errors,`${path}.${key}`,'must be a unique non-empty string array');});
    Object.keys(ctx).forEach(key=>{if(!keys.includes(key))push(errors,`${path}.${key}`,'is not allowed');});
  }

  function validateConflict(ctx,errors){
    const path='conflictContext',keys=['status','hardCount','warnCount','issues'];
    if(!isObject(ctx)){push(errors,path,'must be an object');return;}
    if(!CONFLICT_STATUS.has(ctx.status))push(errors,`${path}.status`,'must be PASS, WARN, or FAIL');
    ['hardCount','warnCount'].forEach(key=>{if(!Number.isInteger(ctx[key])||ctx[key]<0)push(errors,`${path}.${key}`,'must be a non-negative integer');});
    if(!Array.isArray(ctx.issues))push(errors,`${path}.issues`,'must be an array');
    else ctx.issues.forEach((issue,index)=>{
      const issuePath=`${path}.issues.${index}`;
      if(!isObject(issue)){push(errors,issuePath,'must be an object');return;}
      if(!CONFLICT_SEVERITY.has(issue.severity))push(errors,`${issuePath}.severity`,'must be hard, warn, or info');
      if(!isNonEmpty(issue.title))push(errors,`${issuePath}.title`,'must be a non-empty string');
      if(!isString(issue.text))push(errors,`${issuePath}.text`,'must be a string');
      if(!isString(issue.code))push(errors,`${issuePath}.code`,'must be a string');
      Object.keys(issue).forEach(key=>{if(!['severity','title','text','code'].includes(key))push(errors,`${issuePath}.${key}`,'is not allowed');});
    });
    Object.keys(ctx).forEach(key=>{if(!keys.includes(key))push(errors,`${path}.${key}`,'is not allowed');});
  }

  function validateCopy(ctx,errors){
    const path='copyContext',keys=['title','summary','actionIds'];
    if(!isObject(ctx)){push(errors,path,'must be an object');return;}
    if(!isNonEmpty(ctx.title))push(errors,`${path}.title`,'must be a non-empty string');
    if(!isString(ctx.summary))push(errors,`${path}.summary`,'must be a string');
    if(!stringArray(ctx.actionIds))push(errors,`${path}.actionIds`,'must be a unique non-empty string array');
    Object.keys(ctx).forEach(key=>{if(!keys.includes(key))push(errors,`${path}.${key}`,'is not allowed');});
  }

  function validateSelections(value,errors){
    if(!Array.isArray(value)){push(errors,'resolvedSelections','must be an array');return;}
    value.forEach((item,index)=>{
      const path=`resolvedSelections.${index}`;
      if(!isObject(item)){push(errors,path,'must be an object');return;}
      if(!isNonEmpty(item.key))push(errors,`${path}.key`,'must be a non-empty string');
      if(!isNonEmpty(item.actionId))push(errors,`${path}.actionId`,'must be a non-empty string');
      if(!SELECTION_SOURCES.has(item.source))push(errors,`${path}.source`,'must be baseline, auto, or manual');
      Object.keys(item).forEach(key=>{if(!['key','actionId','source'].includes(key))push(errors,`${path}.${key}`,'is not allowed');});
    });
  }

  function validateSource(value,errors){
    if(!isObject(value)){push(errors,'source','must be an object');return;}
    if(!SOURCE_TYPES.has(value.type))push(errors,'source.type','must be PRESET, COMPOSER, or GENERATED');
    if(!isNonEmpty(value.id))push(errors,'source.id','must be a non-empty string');
    Object.keys(value).forEach(key=>{if(!['type','id'].includes(key))push(errors,`source.${key}`,'is not allowed');});
  }

  function validateDomainContext(value,templateId,errors){
    const path='domainContext';
    if(!isObject(value)){push(errors,path,'must be an object');return;}
    if(!isNonEmpty(value.kind))push(errors,`${path}.kind`,'must be a non-empty string');
    if(templateId==='body'&&value.kind!=='BODY')push(errors,`${path}.kind`,'must equal BODY for body template');
  }

  function validate(session){
    const errors=[];
    if(!isObject(session))return {ok:false,errors:['session: must be an object']};
    REQUIRED.forEach(key=>{if(!(key in session))push(errors,key,'is required');});
    if(session.templateId==='body'&&!('domainContext' in session))push(errors,'domainContext','is required for body template');
    Object.keys(session).forEach(key=>{if(!TOP_LEVEL.has(key))push(errors,key,'is not allowed');});
    if(session.schemaVersion!==1)push(errors,'schemaVersion','must equal 1');
    ['resolverVersion','templateId','familyId','title'].forEach(key=>{if(key in session&&!isNonEmpty(session[key]))push(errors,key,'must be a non-empty string');});
    if('summary' in session&&!isString(session.summary))push(errors,'summary','must be a string');
    if('level' in session&&!/^L[1-4]$/.test(session.level||''))push(errors,'level','must be L1-L4');
    if('main' in session)validateMain(session.main,errors);
    if('prepContext' in session)validatePrep(session.prepContext,errors);
    if('anatomyContext' in session)validateAnatomy(session.anatomyContext,errors);
    if('conflictContext' in session)validateConflict(session.conflictContext,errors);
    if('copyContext' in session)validateCopy(session.copyContext,errors);
    if('warnings' in session&&(!Array.isArray(session.warnings)||!session.warnings.every(isString)))push(errors,'warnings','must be a string array');
    if('resolvedSelections' in session)validateSelections(session.resolvedSelections,errors);
    if('source' in session)validateSource(session.source,errors);
    if('domainContext' in session)validateDomainContext(session.domainContext,session.templateId,errors);
    return {ok:errors.length===0,errors};
  }

  function assertSession(session){
    const result=validate(session);
    if(result.ok)return session;
    const error=new Error(`Invalid ResolvedSession: ${result.errors.join('; ')}`);
    error.code='INVALID_RESOLVED_SESSION';
    error.validationErrors=result.errors;
    throw error;
  }

  window.V15ResolvedSession={validate,assert:assertSession};
})();
