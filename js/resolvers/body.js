(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function validateInput(input={}){
    const familyId=typeof input.familyId==='string'?input.familyId:'';
    const level=/^L[1-4]$/.test(input.level||'')?input.level:'';
    if(!familyId||!D().bodyFamilies?.[familyId]){
      fail('BODY_INPUT_INVALID',`Unknown Body family: ${String(familyId||'')}`,{familyId});
    }
    if(!level)fail('BODY_INPUT_INVALID','Body level must be L1-L4',{level:input.level});
    return {familyId,level};
  }

  function candidates(input={}){
    validateInput(input);
    return {recommended:'',candidates:[]};
  }

  function resolve(input={}){
    const normalized=validateInput(input);
    fail('BODY_RESOLVER_NOT_IMPLEMENTED','Body Resolver V1 is registered but not implemented yet',normalized);
  }

  const api={resolve,candidates};
  window.V15BodyResolver=api;
  if(!window.V15TemplateResolver?.register)throw new Error('Template Resolver Dispatcher is unavailable');
  window.V15TemplateResolver.register('body',resolve);
})();
