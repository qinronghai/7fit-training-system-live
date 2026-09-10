const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(){
  const memory={};
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console};
  vm.createContext(ctx);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
    'js/template-resolver.js','js/resolvers/body.js'
  ]) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {memory,ctx,S:ctx.window.V15State,R:ctx.window.V15TemplateResolver,Body:ctx.window.V15BodyResolver,D:ctx.window.V14_DATA};
}

const plain=value=>JSON.parse(JSON.stringify(value));
const {S,R,Body,D}=boot();
assert(Body&&typeof Body.isSelectionValid==='function','Body resolver must expose isSelectionValid for State reconcile');

const familyId='BODY-01',level='L2',sessionKey=`${familyId}-${level}`;
const metadata={familyId,level,resolverVersion:'body-v1',input:{familyId,level}};
S.ensureSession('body',sessionKey,metadata);

function reconcile(){
  return S.reconcileSession('body',sessionKey,{
    resolverVersion:'body-v1',
    isSelectionValid:(slotKey,entry,state)=>Body.isSelectionValid({
      familyId:state.familyId,
      level:state.level,
      slotKey,
      actionId:entry.actionId,
    }),
  });
}

// The current auto baseline, when explicitly chosen by the user, remains manual until Reset.
const baseline=R.resolve('body',{familyId,level});
const baselinePrimary=baseline.main.content.find(slot=>slot.key==='PRIMARY').actionId;
S.setSelection('body',sessionKey,'PRIMARY',baselinePrimary,'manual');
let reconciled=reconcile();
assert.deepStrictEqual(plain(reconciled.reasons),[]);
assert.deepStrictEqual(plain(S.getSelections('body',sessionKey).PRIMARY),{actionId:baselinePrimary,source:'manual'});
let resolved=R.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)});
assert.strictEqual(resolved.main.content.find(slot=>slot.key==='PRIMARY').source,'manual');
assert.strictEqual(resolved.main.content.find(slot=>slot.key==='PRIMARY').actionId,baselinePrimary);

// A different legal manual selection is preserved and the resolver is deterministic.
const alternate=Body.candidates({familyId,level,slotKey:'PRIMARY',currentSelections:{}}).candidates
  .map(x=>x.actionId).find(id=>id!==baselinePrimary);
assert(alternate,'Body fixture needs a second legal L2 PRIMARY candidate');
S.setSelection('body',sessionKey,'PRIMARY',alternate,'manual');
reconciled=reconcile();
assert.deepStrictEqual(plain(reconciled.reasons),[]);
resolved=R.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)});
assert.strictEqual(resolved.main.content.find(slot=>slot.key==='PRIMARY').actionId,alternate);
assert.strictEqual(resolved.main.content.find(slot=>slot.key==='PRIMARY').source,'manual');
assert.deepStrictEqual(
  plain(R.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)})),
  plain(resolved),
  'same Body State intent must resolve deterministically'
);

// Generic State may contain an auto entry, but Body only treats source=manual as user intent.
S.setSelection('body',sessionKey,'PRIMARY',alternate,'auto');
resolved=R.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)});
assert.strictEqual(resolved.main.content.find(slot=>slot.key==='PRIMARY').source,'auto');
assert.strictEqual(resolved.main.content.find(slot=>slot.key==='PRIMARY').actionId,baselinePrimary);
S.setSelection('body',sessionKey,'PRIMARY',alternate,'manual');

// If Action status/route becomes illegal, reconcile drops the intent; next resolve falls back to auto.
const originalRoute=D.actions[alternate].route;
D.actions[alternate].route='POST_CARDIO_ONLY';
reconciled=reconcile();
assert(reconciled.reasons.includes('STALE_SELECTION'));
assert(reconciled.droppedSelections.includes('PRIMARY'));
assert.deepStrictEqual(plain(S.getSelections('body',sessionKey)),{});
D.actions[alternate].route=originalRoute;
resolved=R.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)});
assert.strictEqual(resolved.main.content.find(slot=>slot.key==='PRIMARY').source,'auto');

// Resolver version mismatch clears formal + PREP decisions while preserving identity/input.
S.setSelection('body',sessionKey,'PRIMARY',baselinePrimary,'manual');
const prepActionId=D.warmupDetails[D.warmupIds[0]].actionId;
S.setPrepSelection('body',sessionKey,'MOB-L',prepActionId,'manual');
reconciled=S.reconcileSession('body',sessionKey,{resolverVersion:'body-v2'});
assert(reconciled.reasons.includes('RESOLVER_VERSION_MISMATCH'));
assert.deepStrictEqual(plain(reconciled.session.selections),{});
assert.deepStrictEqual(plain(reconciled.session.prepSelections),{});
assert.strictEqual(reconciled.session.familyId,familyId);
assert.strictEqual(reconciled.session.level,level);
assert.deepStrictEqual(plain(reconciled.session.input),{familyId,level});

// Reset deletes user intent; re-created session resolves from auto recommendations again.
S.resetSession('body',sessionKey);
assert.strictEqual(S.getSession('body',sessionKey),null);
S.ensureSession('body',sessionKey,metadata);
resolved=R.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)});
assert(resolved.main.content.every(slot=>slot.source==='auto'));

// State persists intent only, never derived Resolver output.
const persisted=plain(S.getSession('body',sessionKey));
assert.deepStrictEqual(Object.keys(persisted).sort(),['familyId','input','level','prepSelections','resolverVersion','selections','templateId'].sort());
for(const derivedKey of ['domainContext','volume','anatomyContext','conflictContext','estimatedMinutes','main','resolvedSelections']){
  assert.strictEqual(Object.prototype.hasOwnProperty.call(persisted,derivedKey),false,`${derivedKey} must not persist in V15 State`);
}

console.log('body_state_reconcile_test: PASS');
