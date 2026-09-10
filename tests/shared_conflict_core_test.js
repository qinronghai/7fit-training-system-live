const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const sandbox={window:{},console};
vm.createContext(sandbox);
function load(path){vm.runInContext(fs.readFileSync(path,'utf8'),sandbox,{filename:path});}
load('data/system-data.js');
load('js/resolved-session.js');

const W=sandbox.window;
assert.ok(W.V15ConflictCore&&typeof W.V15ConflictCore.evaluate==='function','window.V15ConflictCore.evaluate must exist');
assert.ok(W.V15Conflict&&typeof W.V15Conflict.register==='function'&&typeof W.V15Conflict.evaluate==='function','window.V15Conflict register/evaluate must exist');

const A=W.V14_DATA.actions;
A.__conflict_ok={id:'__conflict_ok',name:'测试合法动作',route:'1F_ONLY',status:'可自动编排',equipmentId:'EQ_OK'};
A.__conflict_route={id:'__conflict_route',name:'测试错误楼层动作',route:'2F_ONLY',routeLabel:'2F 专用',status:'可自动编排',equipmentId:'EQ_OK'};
A.__conflict_status={id:'__conflict_status',name:'测试不可编排动作',route:'1F_ONLY',status:'停用',equipmentId:'EQ_OK'};
A.__conflict_equipment={id:'__conflict_equipment',name:'测试缺失器械动作',route:'1F_ONLY',status:'可自动编排',equipmentId:'EQ_BLOCKED'};

function uniq(xs){return [...new Set(xs)];}
function makeSession(ids,{templateId='body'}={}){
  const uniqueIds=uniq(ids);
  const main=ids.map((actionId,i)=>({
    key:`S${i+1}`,
    label:`Slot ${i+1}`,
    actionId,
    name:A[actionId]?.name||actionId,
    tier:'',grade:'',prescription:'',source:'auto'
  }));
  return {
    schemaVersion:1,
    resolverVersion:'test-v1',
    templateId,
    familyId:'TEST-01',
    level:'L1',
    title:'Conflict Test',
    summary:'',
    main:{kind:'SLOT',content:main},
    prepContext:{template:templateId,level:'L1',recipeId:'',mainPatterns:[],mainActionIds:uniqueIds,formalActionIds:uniqueIds,targetMuscles:[],modalities:[],impactDemand:'',powerDemand:''},
    anatomyContext:{actionIds:uniqueIds,primary:[],secondary:[],stabilizers:[]},
    conflictContext:{status:'PASS',hardCount:0,warnCount:0,issues:[]},
    copyContext:{title:'Conflict Test',summary:'',actionIds:uniqueIds},
    warnings:[],
    resolvedSelections:main.map(x=>({key:x.key,actionId:x.actionId,source:'auto'})),
    source:{type:'GENERATED',id:'TEST-01-L1'}
  };
}

const commonPolicy={
  allowedRoutes:['1F_ONLY','FLEX_1F_2F'],
  allowedStatuses:['可自动编排','SUPPORT_CANON','CORE_CANON']
};

// Shared Core: deterministic rule order is structural -> duplicate -> reference -> route -> status -> equipment -> time.
{
  const session=makeSession(['__conflict_ok','__conflict_ok','__missing__','__conflict_route','__conflict_status','__conflict_equipment']);
  const issues=W.V15ConflictCore.evaluate(session,{
    ...commonPolicy,
    availableEquipmentIds:['EQ_OK'],
    timeBudget:{estimatedMinutes:70,maxMinutes:60}
  });
  assert.deepStrictEqual(Array.from(issues,x=>x.code),[
    'SHARED_DUPLICATE_ACTION',
    'SHARED_MISSING_ACTION',
    'SHARED_ROUTE_ILLEGAL',
    'SHARED_STATUS_UNAVAILABLE',
    'SHARED_EQUIPMENT_UNAVAILABLE',
    'SHARED_TIME_BUDGET_EXCEEDED'
  ]);
  assert.ok(issues.every(x=>['hard','warn','info'].includes(x.severity)));
}

// Valid input with explicit shared policy produces no shared issues.
{
  const issues=W.V15ConflictCore.evaluate(makeSession(['__conflict_ok']),commonPolicy);
  assert.strictEqual(issues.length,0);
}

// Structural invalidity is a shared blocking issue, not a thrown template rule.
{
  const broken=makeSession(['__conflict_ok']);
  broken.main={kind:'UNKNOWN',content:[]};
  const issues=W.V15ConflictCore.evaluate(broken,commonPolicy);
  assert.strictEqual(issues[0]?.code,'SHARED_INVALID_STRUCTURE');
  assert.strictEqual(issues[0]?.severity,'hard');
}

// Registry + aggregator: shared first, plugin second, public status remains PASS/WARN/FAIL.
{
  const calls=[];
  W.V15Conflict.register('body',{
    evaluate(session,context){
      calls.push({session,context});
      return [{severity:'warn',title:'Body 测试警告',text:'plugin warning',code:'BODY_TEST_WARNING'}];
    }
  });
  const session=makeSession(['__conflict_ok'],{templateId:'body'});
  const result=W.V15Conflict.evaluate('body',session,{sharedPolicy:commonPolicy,pluginContext:{family:'BODY-01'}});
  assert.strictEqual(result.status,'WARN');
  assert.strictEqual(result.hardCount,0);
  assert.strictEqual(result.warnCount,1);
  assert.deepStrictEqual(Array.from(result.issues,x=>x.code),['BODY_TEST_WARNING']);
  assert.strictEqual(calls.length,1);
  assert.strictEqual(calls[0].context.family,'BODY-01');
}

// A hard shared issue dominates plugin warnings.
{
  W.V15Conflict.register('conditioning',{
    evaluate(){return [{severity:'warn',title:'Conditioning 测试警告',text:'plugin warning',code:'COND_TEST_WARNING'}];}
  });
  const result=W.V15Conflict.evaluate('conditioning',makeSession(['__missing__'],{templateId:'conditioning'}),{sharedPolicy:commonPolicy});
  assert.strictEqual(result.status,'FAIL');
  assert.strictEqual(result.hardCount,1);
  assert.strictEqual(result.warnCount,1);
  assert.deepStrictEqual(Array.from(result.issues,x=>x.code),['SHARED_MISSING_ACTION','COND_TEST_WARNING']);
}

assert.throws(
  ()=>W.V15Conflict.register('body',{evaluate(){return [];}}),
  err=>err&&err.code==='CONFLICT_PLUGIN_ALREADY_REGISTERED'
);
assert.throws(
  ()=>W.V15Conflict.evaluate('posture',makeSession(['__conflict_ok'],{templateId:'posture'}),{sharedPolicy:commonPolicy}),
  err=>err&&err.code==='CONFLICT_PLUGIN_NOT_REGISTERED'
);

console.log('shared_conflict_core_test: PASS');
