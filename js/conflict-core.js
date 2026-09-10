(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const DEFAULT_ALLOWED_STATUSES=Object.freeze(['可自动编排','SUPPORT_CANON','CORE_CANON']);

  function makeIssue(severity,title,text,code){
    return {severity,title,text,code};
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

  function evaluate(session,policy={}){
    const issues=[];
    if(!structureOk(session)){
      issues.push(makeIssue('hard','课程结构无效','当前 resolved session 的主训练结构不符合 Conflict Core 最小要求。','SHARED_INVALID_STRUCTURE'));
      return issues;
    }

    const data=D(),refs=actionRefs(session),counts=new Map();
    refs.forEach(ref=>counts.set(ref.actionId,(counts.get(ref.actionId)||0)+1));
    counts.forEach((count,actionId)=>{
      if(count>1){
        const name=data.actions?.[actionId]?.name||actionId;
        issues.push(makeIssue('hard','动作重复',`${name} 在正式训练内容中出现 ${count} 次。`,'SHARED_DUPLICATE_ACTION'));
      }
    });

    const missing=new Set();
    refs.forEach(({actionId})=>{
      if(!data.actions?.[actionId]&&!missing.has(actionId)){
        missing.add(actionId);
        issues.push(makeIssue('hard','动作引用不存在',`${actionId} 未在正式动作库中找到。`,'SHARED_MISSING_ACTION'));
      }
    });

    const allowedRoutes=Array.isArray(policy.allowedRoutes)?new Set(policy.allowedRoutes):null;
    if(allowedRoutes){
      refs.forEach(({actionId})=>{
        const action=data.actions?.[actionId];
        if(action&&!allowedRoutes.has(action.route)){
          issues.push(makeIssue('hard','楼层路由',`${action.name||actionId} 当前路由 ${action.routeLabel||action.route||'未标'} 不符合本训练块要求。`,'SHARED_ROUTE_ILLEGAL'));
        }
      });
    }

    const allowedStatuses=new Set(Array.isArray(policy.allowedStatuses)?policy.allowedStatuses:DEFAULT_ALLOWED_STATUSES);
    refs.forEach(({actionId})=>{
      const action=data.actions?.[actionId];
      if(action&&!allowedStatuses.has(action.status)){
        issues.push(makeIssue('hard','编排状态',`${action.name||actionId} 当前状态 ${action.status||'未标'} 不允许进入正式训练内容。`,'SHARED_STATUS_UNAVAILABLE'));
      }
    });

    if(Array.isArray(policy.availableEquipmentIds)){
      const available=new Set(policy.availableEquipmentIds);
      refs.forEach(({actionId})=>{
        const action=data.actions?.[actionId],equipmentId=action?.equipmentId;
        if(action&&equipmentId&&!available.has(equipmentId)){
          issues.push(makeIssue('hard','器械不可用',`${action.name||actionId} 需要器械 ${equipmentId}，当前显式器械策略未标记为可用。`,'SHARED_EQUIPMENT_UNAVAILABLE'));
        }
      });
    }

    const time=policy.timeBudget;
    if(isObject(time)&&Number.isFinite(time.estimatedMinutes)&&Number.isFinite(time.maxMinutes)&&time.estimatedMinutes>time.maxMinutes){
      issues.push(makeIssue('warn','时间预算超出',`预计 ${time.estimatedMinutes} 分钟，超过当前预算 ${time.maxMinutes} 分钟。`,'SHARED_TIME_BUDGET_EXCEEDED'));
    }

    return issues;
  }

  window.V15ConflictCore={evaluate};
})();
