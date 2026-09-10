const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
const memory={};
const sessionStorage={getItem:k=>memory[k]??null,setItem:(k,v)=>{memory[k]=String(v);},removeItem:k=>{delete memory[k];}};
const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console};
vm.createContext(ctx);
for(const file of ['data/system-data.js','js/state.js'])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
const S=ctx.window.V15State,V14=ctx.window.V14State,D=ctx.window.V14_DATA;
const plain=value=>JSON.parse(JSON.stringify(value));
function expectCode(fn,code){let error=null;try{fn();}catch(e){error=e;}assert(error,`expected ${code}`);assert.strictEqual(error.code,code);}

const key='BODY-GUARD-L2',actionId=Object.keys(D.actions)[0];
S.ensureSession('body',key,{familyId:'BODY-GUARD',level:'L2',resolverVersion:'body-v1',input:{targetMuscles:['臀大肌']}});
S.setSelection('body',key,'A',actionId,'manual');

// Returned state is a clone; callers cannot mutate storage by reference.
const external=S.getSession('body',key);external.input.targetMuscles.push('股四头肌');external.selections.A.actionId='tampered';
assert.deepStrictEqual(plain(S.getSession('body',key).input.targetMuscles),['臀大肌']);
assert.strictEqual(S.getSelections('body',key).A.actionId,actionId);

// Ordinary input patches preserve explicit decisions.
S.patchSession('body',key,{input:{split:'lower'}});
assert.strictEqual(S.getSession('body',key).input.split,'lower');
assert.strictEqual(S.getSelections('body',key).A.actionId,actionId);

// Resolver version changes must never bypass reconcileSession.
expectCode(()=>S.ensureSession('body',key,{familyId:'BODY-GUARD',level:'L2',resolverVersion:'body-v2',input:{}}),'RESOLVER_VERSION_CHANGE_REQUIRES_RECONCILE');
expectCode(()=>S.patchSession('body',key,{resolverVersion:'body-v2'}),'RESOLVER_VERSION_CHANGE_REQUIRES_RECONCILE');
assert.strictEqual(S.getSession('body',key).resolverVersion,'body-v1');
assert.strictEqual(S.getSelections('body',key).A.actionId,actionId);

const reconciled=S.reconcileSession('body',key,{resolverVersion:'body-v2'});
assert(reconciled.reasons.includes('RESOLVER_VERSION_MISMATCH'));
assert.strictEqual(reconciled.session.resolverVersion,'body-v2');
assert.deepStrictEqual(plain(reconciled.session.selections),{});

// V14 optional composer context helper attaches exact private F111 input without losing manual decisions.
const composerKey='F111-C-SLH-HP-L3';
V14.setComposerSelection(composerKey,'A','movement_db_single_leg_rdl');
V14.setComposerContext(composerKey,{level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',coreDemand:'anti_extension'});
const composer=S.getSession('f111',composerKey);
assert.strictEqual(composer.input.lowerMode,'single_leg_hinge');
assert.strictEqual(composer.input.upperMode,'horizontal_push');
assert.strictEqual(composer.input.coreDemand,'anti_extension');
assert.strictEqual(composer.selections.A.actionId,'movement_db_single_leg_rdl');

console.log('state_version_guard_test: PASS');
