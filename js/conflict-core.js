(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const DEFAULT_ALLOWED_STATUSES=Object.freeze(['可自动编排','SUPPORT_CANON','CORE_CANON']);
  const DEFAULT_ORDER=Object.freeze({
    structure:0,
    duplicate:100,
    missing:200,
    route:300,
    status:400,
    equipment:500,
    time:600,
  });

  function makeIssue(severity,title,text,code,_order){
    return {severity,title,text,code,_order};
  }

  function isObject(value){return !!value&&typeof value==='object'&&!Array.isArray(value);}

  function structureOk(session){
    if(!isObject(session)||typeof session.templateId!=='string'||!session.templateId)return false;
    if(!/^L[1-4]$/.test(session.level||''))return false;
    const main=session.main;
    if(!isObject(main)||!['SLOT','PROTOCOL'].includes(main.kind))return false;
    if(main.kind==='SLOT'){
      return Array.isArray(main.content)&&main.content.length>0&&main.content.every(item=>isObject(item)&&typeof item.actionId==='string'&&item.actionId);
    }
    if(!isObject(main.content)||!Array.isArray(main.content.blocks)||!main.content.blocks.length)return false;
    return main.content.blocks.every(block=>isObject(block)&&Array.isArray(block.items)&&block.items.length&&block.items.every(item=>isObject(item)&&typeof item.actionId==='string'&&item.actionId));
  }

  function actionRefs(session){
    if(session.main.kind==='SLOT')return session.main.content.map((item,index)=>({actionId:item.actionId,index,key:item.key||`S${index+1}`}));
    const refs=[];
    session.main.content.blocks.forEach((block,blockIndex)=>{
      block.items.forEach((item,itemIndex)=>refs.push({actionId:item.actionId,index:refs.length,key:`${block.key||blockIndex}:${itemIndex}`}));
    });
    return refs;
  }

  function orderFor(policy,kind,index=0,sequence=0){
    if(typeof policy.orderIssue==='function'){
      const custom=policy.orderIssue(kind,index,sequence);
      if(Number.isFinite(custom))return custom;
    }
    return (DEFAULT_ORDER[kind]??10000)+index+sequence/1000;
  }

  function issueFor(policy,kind,ctx,fallback){
    const formatter=policy.formatIssue?.[kind];
    const custom=typeof formatter==='function'?formatter(ctx):null;
    const issue=custom&&typeof custom==='object'?{...fallback,...custom}:fallback;
    return makeIssue(issue.severity,issue.title,issue.text,issue.code,orderFor(policy,kind,ctx.index||0,ctx.sequence||0));
  }

  function evaluate(session,policy={}){
    const issues=[];
    if(!structureOk(session)){
      issues.push(issueFor(policy,'structure',{index:0,sequence:0,session},{severity:'hard',title:'课程结构无效',text:'当前 resolved session 的主训练结构不符合 Conflict Core 最小要求。',code:'SHARED_INVALID_STRUCTURE'}));
      return issues;
    }

    const data=D(),refs=actionRefs(session),counts=new Map(),firstIndex=new Map();
    refs.forEach(ref=>{
      counts.set(ref.actionId,(counts.get(ref.actionId)||0)+1);
      if(!firstIndex.has(ref.actionId))firstIndex.set(ref.actionId,ref.index);
    });
    let sequence=0;
    counts.forEach((count,actionId)=>{
      if(count>1){
        const action=data.actions?.[actionId]||{},name=action.name||actionId,index=firstIndex.get(actionId)||0;
        issues.push(issueFor(policy,'duplicate',{actionId,action,name,count,index,sequence:sequence++},{severity:'hard',title:'动作重复',text:`${name} 在正式训练内容中出现 ${count} 次。`,code:'SHARED_DUPLICATE_ACTION'}));
      }
    });

    const missing=new Set();
    refs.forEach(({actionId,index})=>{
      if(!data.actions?.[actionId]&&!missing.has(actionId)){
        missing.add(actionId);
        issues.push(issueFor(policy,'missing',{actionId,index,action:null},{severity:'hard',title:'动作引用不存在',text:`${actionId} 未在正式动作库中找到。`,code:'SHARED_MISSING_ACTION'}));
      }
    });

    const allowedRoutes=Array.isArray(policy.allowedRoutes)?new Set(policy.allowedRoutes):null;
    if(allowedRoutes){
      refs.forEach(({actionId,index})=>{
        const action=data.actions?.[actionId];
        if(action&&!allowedRoutes.has(action.route)){
          issues.push(issueFor(policy,'route',{actionId,index,action},{severity:'hard',title:'楼层路由',text:`${action.name||actionId} 当前路由 ${action.routeLabel||action.route||'未标'} 不符合本训练块要求。`,code:'SHARED_ROUTE_ILLEGAL'}));
        }
      });
    }

    const allowedStatuses=new Set(Array.isArray(policy.allowedStatuses)?policy.allowedStatuses:DEFAULT_ALLOWED_STATUSES);
    refs.forEach(({actionId,index})=>{
      const action=data.actions?.[actionId];
      if(action&&!allowedStatuses.has(action.status)){
        issues.push(issueFor(policy,'status',{actionId,index,action},{severity:'hard',title:'编排状态',text:`${action.name||actionId} 当前状态 ${action.status||'未标'} 不允许进入正式训练内容。`,code:'SHARED_STATUS_UNAVAILABLE'}));
      }
    });

    if(Array.isArray(policy.availableEquipmentIds)){
      const available=new Set(policy.availableEquipmentIds);
      refs.forEach(({actionId,index})=>{
        const action=data.actions?.[actionId],equipmentId=action?.equipmentId;
        if(action&&equipmentId&&!available.has(equipmentId)){
          issues.push(issueFor(policy,'equipment',{actionId,index,action,equipmentId},{severity:'hard',title:'器械不可用',text:`${action.name||actionId} 需要器械 ${equipmentId}，当前显式器械策略未标记为可用。`,code:'SHARED_EQUIPMENT_UNAVAILABLE'}));
        }
      });
    }

    const time=policy.timeBudget;
    if(isObject(time)&&Number.isFinite(time.estimatedMinutes)&&Number.isFinite(time.maxMinutes)&&time.estimatedMinutes>time.maxMinutes){
      issues.push(issueFor(policy,'time',{index:0,estimatedMinutes:time.estimatedMinutes,maxMinutes:time.maxMinutes},{severity:'warn',title:'时间预算超出',text:`预计 ${time.estimatedMinutes} 分钟，超过当前预算 ${time.maxMinutes} 分钟。`,code:'SHARED_TIME_BUDGET_EXCEEDED'}));
    }

    return issues;
  }

  window.V15ConflictCore={evaluate};
})();
