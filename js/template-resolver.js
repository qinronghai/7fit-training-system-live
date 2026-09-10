(function(){
  'use strict';

  const resolvers=Object.create(null);
  const D=()=>window.V14_DATA||{};
  const Contract=()=>window.V15ResolvedSession;

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function requireTemplate(templateId){
    const registry=D().templateRegistry||{};
    if(typeof templateId!=='string'||!registry[templateId]){
      fail('UNKNOWN_TEMPLATE',`Unknown training template: ${String(templateId||'')}`,{templateId});
    }
    return registry[templateId];
  }

  function register(templateId,resolver){
    requireTemplate(templateId);
    if(typeof resolver!=='function')fail('INVALID_RESOLVER',`Resolver for ${templateId} must be a function`,{templateId});
    resolvers[templateId]=resolver;
    return resolver;
  }

  function unregister(templateId){
    requireTemplate(templateId);
    delete resolvers[templateId];
  }

  function has(templateId){
    return typeof resolvers[templateId]==='function';
  }

  function resolve(templateId,input={}){
    requireTemplate(templateId);
    const resolver=resolvers[templateId];
    if(typeof resolver!=='function')fail('RESOLVER_NOT_REGISTERED',`No resolver registered for ${templateId}`,{templateId});
    const output=resolver(input||{});
    const contract=Contract();
    if(!contract||typeof contract.validate!=='function')fail('INVALID_RESOLVED_SESSION','ResolvedSession runtime contract is unavailable',{templateId});
    const validation=contract.validate(output);
    if(!validation.ok){
      fail('INVALID_RESOLVED_SESSION',`Resolver ${templateId} returned an invalid ResolvedSession`,{templateId,validationErrors:validation.errors});
    }
    if(output.templateId!==templateId){
      fail('TEMPLATE_ID_MISMATCH',`Resolver ${templateId} returned templateId ${output.templateId}`,{templateId,actualTemplateId:output.templateId});
    }
    return output;
  }

  window.V15TemplateResolver={register,unregister,has,resolve};
})();
