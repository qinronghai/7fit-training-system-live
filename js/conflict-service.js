(function(){
  'use strict';

  const plugins=new Map();

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function normalizeIssue(issue,index){
    const severity=['hard','warn','info'].includes(issue?.severity)?issue.severity:'info';
    return {
      severity,
      title:String(issue?.title||'提示'),
      text:String(issue?.text||''),
      code:String(issue?.code||''),
      _order:Number.isFinite(issue?._order)?issue._order:index,
    };
  }

  function summarize(issues){
    const publicIssues=issues
      .map((issue,index)=>normalizeIssue(issue,index))
      .sort((a,b)=>a._order-b._order)
      .map(({_order,...issue})=>issue);
    const hardCount=publicIssues.filter(issue=>issue.severity==='hard').length;
    const warnCount=publicIssues.filter(issue=>issue.severity==='warn').length;
    return {
      status:hardCount?'FAIL':warnCount?'WARN':'PASS',
      hardCount,
      warnCount,
      issues:publicIssues,
    };
  }

  function register(templateId,plugin){
    if(typeof templateId!=='string'||!templateId)fail('CONFLICT_PLUGIN_ID_INVALID','Conflict plugin templateId must be a non-empty string.');
    if(!plugin||typeof plugin.evaluate!=='function')fail('CONFLICT_PLUGIN_INVALID',`Conflict plugin ${templateId} must expose evaluate(session, context).`,{templateId});
    if(plugins.has(templateId))fail('CONFLICT_PLUGIN_ALREADY_REGISTERED',`Conflict plugin already registered: ${templateId}`,{templateId});
    plugins.set(templateId,plugin);
    return plugin;
  }

  function evaluate(templateId,resolvedSession,context={}){
    const plugin=plugins.get(templateId);
    if(!plugin)fail('CONFLICT_PLUGIN_NOT_REGISTERED',`Conflict plugin not registered: ${templateId}`,{templateId});
    if(resolvedSession?.templateId&&resolvedSession.templateId!==templateId){
      fail('CONFLICT_TEMPLATE_MISMATCH',`Conflict template mismatch: expected ${templateId}, got ${resolvedSession.templateId}.`,{templateId,actualTemplateId:resolvedSession.templateId});
    }
    const shared=window.V15ConflictCore?.evaluate?.(resolvedSession,context.sharedPolicy||{})||[];
    const domain=(plugin.evaluate(resolvedSession,context.pluginContext||{})||[]).map((issue,index)=>
      Number.isFinite(issue?._order)?issue:{...issue,_order:10000+index}
    );
    return summarize([...shared,...domain]);
  }

  window.V15Conflict={register,evaluate};
})();
