(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const adapters=new Map();

  function validAdapter(adapter){
    return !!adapter&&typeof adapter==='object'
      &&typeof adapter.canHandle==='function'
      &&typeof adapter.render==='function'
      &&typeof adapter.bind==='function';
  }

  function register(templateId,adapter){
    const id=String(templateId||'').trim();
    if(!id)throw new Error('Template UI templateId is required');
    if(!validAdapter(adapter))throw new Error(`Invalid Template UI adapter: ${id}`);
    if(adapters.has(id))throw new Error(`Template UI adapter already registered: ${id}`);
    adapters.set(id,adapter);
    return adapter;
  }

  function get(templateId){
    return adapters.get(String(templateId||'').trim())||null;
  }

  M.TemplateUI={register,get};
})();
