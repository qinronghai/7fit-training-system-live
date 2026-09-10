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
assert(Dispatcher&&typeof Dispatcher.has==='function');

function baseSession(templateId='body'){
  return {
    schemaVersion:1,
    resolverVersion:templateId==='body'?'body-v1':'f111-adapter-v1',
    templateId,
    familyId:templateId==='body'?'BODY-01':'F111-01',
    level:'L1',
    title:'Contract sample',
    summary:'',
    main:{kind:'SLOT',content:[{key:'PRIMARY',label:'主项',actionId:'tushen_shendun',name:'徒手深蹲',tier:'T1',grade:'',prescription:'3 × 10',source:'auto'}]},
    prepContext:{template:templateId,level:'L1',recipeId:'',mainPatterns:[],mainActionIds:['tushen_shendun'],formalActionIds:['tushen_shendun'],targetMuscles:[],modalities:[],impactDemand:'',powerDemand:''},
    anatomyContext:{actionIds:['tushen_shendun'],primary:[],secondary:[],stabilizers:[]},
    conflictContext:{status:'PASS',hardCount:0,warnCount:0,issues:[]},
    copyContext:{title:'Contract sample',summary:'',actionIds:['tushen_shendun']},
    warnings:[],
    resolvedSelections:[{key:'PRIMARY',actionId:'tushen_shendun',source:'auto'}],
    source:{type:'GENERATED',id:templateId==='body'?'BODY-01-L1':'F111-01-L1'}
  };
}

const bodyWithoutDomain=baseSession('body');
assert.strictEqual(Contract.validate(bodyWithoutDomain).ok,false,'Body ResolvedSession must require domainContext');

const bodyWithDomain=baseSession('body');
bodyWithDomain.domainContext={kind:'BODY'};
const bodyResult=Contract.validate(bodyWithDomain);
assert.strictEqual(bodyResult.ok,true,bodyResult.errors.join(' | '));

const wrongKind=baseSession('body');
wrongKind.domainContext={kind:'CONDITIONING'};
assert.strictEqual(Contract.validate(wrongKind).ok,false,'Body domainContext.kind must equal BODY');

const f111=baseSession('f111');
assert.strictEqual(Contract.validate(f111).ok,true,'F111 must remain valid without domainContext');

assert(fs.existsSync(`${root}/js/resolvers/body.js`),'Body resolver file must exist');
load('js/resolvers/body.js');
assert(window.V15BodyResolver&&typeof window.V15BodyResolver.resolve==='function','V15BodyResolver.resolve must exist');
assert.strictEqual(Dispatcher.has('body'),true,'Body resolver must register with V15TemplateResolver');

console.log('body_resolved_session_contract_test: PASS');
