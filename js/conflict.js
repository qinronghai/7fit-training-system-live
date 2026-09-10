(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const emptyResult=()=>({status:'PASS',hardCount:0,warnCount:0,issues:[]});

  function slotKey(slot,index){
    const raw=String(slot?.slotKey||'');
    if(raw.includes('__'))return raw.split('__').pop();
    const label=String(slot?.slotName||'');
    if(label.includes('｜'))return label.split('｜')[0];
    return raw||`S${index+1}`;
  }

  function draft(level,slots){
    return {
      templateId:'f111',
      level:/^L[1-4]$/.test(level||'')?level:'L1',
      main:{
        kind:'SLOT',
        content:slots.map((slot,index)=>({
          key:slot.key||slotKey(slot,index),
          actionId:slot.actionId
        }))
      }
    };
  }

  function service(){
    if(!window.V15Conflict?.evaluate||!window.V15F111ConflictPlugin?.sharedPolicy){
      const error=new Error('V15 F111 Conflict service is unavailable');
      error.code='F111_CONFLICT_SERVICE_UNAVAILABLE';
      throw error;
    }
    return window.V15Conflict;
  }

  function evaluateComposer(resolved){
    const slots=resolved?.slots||[];
    if(!slots.length)return emptyResult();
    const chosenSlots=slots.filter(slot=>slot?.actionId).map((slot,index)=>({
      key:slot.slotKey||slotKey(slot,index),
      actionId:slot.actionId
    }));
    if(!chosenSlots.length)return emptyResult();
    return service().evaluate('f111',draft(resolved?.level,chosenSlots),{
      sharedPolicy:window.V15F111ConflictPlugin.sharedPolicy('composer'),
      pluginContext:{mode:'composer',resolved}
    });
  }

  function evaluate(sessionId,selectedIds){
    const data=D(),session=data.sessions?.[sessionId];
    if(!session){
      return {status:'FAIL',hardCount:1,warnCount:0,issues:[{severity:'hard',title:'课程不存在',text:sessionId}]};
    }
    const chosen=selectedIds||session.slots.map(slot=>slot.baselineId);
    if(!chosen.length)return emptyResult();
    const slots=chosen.map((actionId,index)=>({key:slotKey(session.slots[index],index),actionId}));
    const level=(sessionId.match(/-(L[1-4])$/)||[])[1]||'L1';
    return service().evaluate('f111',draft(level,slots),{
      sharedPolicy:window.V15F111ConflictPlugin.sharedPolicy('preset'),
      pluginContext:{mode:'preset',sessionId}
    });
  }

  window.V14Conflict={__v15Facade:true,evaluateComposer,evaluate};
})();
