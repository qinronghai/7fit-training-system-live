const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

load('data/system-data.js');
load('js/resolved-session.js');
load('js/template-resolver.js');

const Contract=window.V15ResolvedSession;
const Dispatcher=window.V15TemplateResolver;
assert(Contract&&typeof Contract.validate==='function');
assert(Dispatcher&&typeof Dispatcher.register==='function');

function slotSession(templateId='body'){
  return {
    schemaVersion:1,
    resolverVersion:'synthetic-slot-v1',
    templateId,
    familyId:'BODY-SAMPLE',
    level:'L2',
    title:'Body sample',
    summary:'Synthetic SLOT contract sample',
    main:{
      kind:'SLOT',
      content:[{key:'A',label:'A｜主动作',actionId:'sample-a',name:'Sample A',tier:'T2',grade:'',prescription:'3 × 10',source:'auto'}]
    },
    prepContext:{template:templateId,level:'L2',recipeId:'',mainPatterns:[],mainActionIds:['sample-a'],formalActionIds:['sample-a'],targetMuscles:['臀大肌'],modalities:[],impactDemand:'',powerDemand:''},
    anatomyContext:{actionIds:['sample-a'],primary:['臀大肌'],secondary:[],stabilizers:[]},
    conflictContext:{status:'PASS',hardCount:0,warnCount:0,issues:[]},
    copyContext:{title:'Body sample',summary:'Synthetic SLOT contract sample',actionIds:['sample-a']},
    warnings:[],
    resolvedSelections:[{key:'A',actionId:'sample-a',source:'auto'}],
    source:{type:'GENERATED',id:'BODY-SAMPLE-L2'}
  };
}

function protocolSession(){
  return {
    schemaVersion:1,
    resolverVersion:'synthetic-protocol-v1',
    templateId:'conditioning',
    familyId:'COND-SAMPLE',
    level:'L3',
    title:'Conditioning sample',
    summary:'Synthetic PROTOCOL contract sample',
    main:{kind:'PROTOCOL',content:{protocolId:'interval-sample',name:'Interval sample',blocks:[{key:'B1',label:'主训练',items:[{actionId:'rower-sample',name:'Rower',prescription:'30s / 30s'}]}],metrics:{workRestRatio:'1:1'}}},
    prepContext:{template:'conditioning',level:'L3',recipeId:'',mainPatterns:[],mainActionIds:['rower-sample'],formalActionIds:['rower-sample'],targetMuscles:[],modalities:['rower'],impactDemand:'low',powerDemand:'moderate'},
    anatomyContext:{actionIds:['rower-sample'],primary:[],secondary:[],stabilizers:[]},
    conflictContext:{status:'PASS',hardCount:0,warnCount:0,issues:[]},
    copyContext:{title:'Conditioning sample',summary:'Synthetic PROTOCOL contract sample',actionIds:['rower-sample']},
    warnings:[],resolvedSelections:[],source:{type:'GENERATED',id:'COND-SAMPLE-L3'}
  };
}

assert.deepStrictEqual(Contract.validate(slotSession()),{ok:true,errors:[]});
assert.deepStrictEqual(Contract.validate(protocolSession()),{ok:true,errors:[]});

const invalid=slotSession();
invalid.main={kind:'MAGIC',content:[]};
const invalidResult=Contract.validate(invalid);
assert.strictEqual(invalidResult.ok,false);
assert(invalidResult.errors.some(x=>x.includes('main.kind')));

Dispatcher.register('body',()=>slotSession());
assert.strictEqual(Dispatcher.has('body'),true);
const body=Dispatcher.resolve('body',{sample:true});
assert.strictEqual(body.templateId,'body');
assert.strictEqual(body.main.kind,'SLOT');

Dispatcher.register('conditioning',()=>protocolSession());
const conditioning=Dispatcher.resolve('conditioning',{});
assert.strictEqual(conditioning.templateId,'conditioning');
assert.strictEqual(conditioning.main.kind,'PROTOCOL');

function expectCode(fn,code){
  let thrown=null;
  try{fn();}catch(error){thrown=error;}
  assert(thrown,`expected ${code} error`);
  assert.strictEqual(thrown.code,code);
}

expectCode(()=>Dispatcher.resolve('not-a-template',{}),'UNKNOWN_TEMPLATE');
expectCode(()=>Dispatcher.resolve('posture',{}),'RESOLVER_NOT_REGISTERED');

Dispatcher.register('body',()=>({bad:true}));
expectCode(()=>Dispatcher.resolve('body',{}),'INVALID_RESOLVED_SESSION');

Dispatcher.register('body',()=>slotSession('f111'));
expectCode(()=>Dispatcher.resolve('body',{}),'TEMPLATE_ID_MISMATCH');

Dispatcher.unregister('body');
assert.strictEqual(Dispatcher.has('body'),false);
expectCode(()=>Dispatcher.resolve('body',{}),'RESOLVER_NOT_REGISTERED');

expectCode(()=>Dispatcher.register('not-a-template',()=>slotSession()),'UNKNOWN_TEMPLATE');
expectCode(()=>Dispatcher.register('body',null),'INVALID_RESOLVER');

console.log('resolved_session_runtime_test: PASS');
