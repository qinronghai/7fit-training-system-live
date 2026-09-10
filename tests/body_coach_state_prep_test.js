const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(){
  const memory={};
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},location:{hash:''},URLSearchParams,console};
  ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
    'js/template-resolver.js','js/resolvers/body.js','js/coach/common.js','js/coach/template-ui.js',
    'js/coach/body-home.js','js/coach/body-volume-view.js','js/coach/body-recovery.js'
  ]) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  assert.strictEqual(fs.existsSync(`${root}/js/coach/body-prep.js`),true,'Body PREP adapter module must exist');
  vm.runInContext(fs.readFileSync(`${root}/js/coach/body-prep.js`,'utf8'),ctx,{filename:'js/coach/body-prep.js'});
  vm.runInContext(fs.readFileSync(`${root}/js/coach/body-session.js`,'utf8'),ctx,{filename:'js/coach/body-session.js'});
  return {ctx,S:ctx.window.V15State,R:ctx.window.V15TemplateResolver,Body:ctx.window.V15BodyResolver,PrepResolver:ctx.window.V14PrepResolver,M:ctx.window.V14CoachModules};
}

const plain=value=>JSON.parse(JSON.stringify(value));
const {S,R,Body,PrepResolver,M}=boot();
const UI=M.BodySession,Prep=M.BodyPrep;
for(const name of ['ensureState','resolveState','setFormalSelection','reset']){
  assert.strictEqual(typeof UI[name],'function',`BodySession.${name} must exist`);
}
assert(Prep&&typeof Prep.resolve==='function'&&typeof Prep.render==='function'&&typeof Prep.setSelection==='function','Body PREP resolve/render/setSelection must exist');

const familyId='BODY-02',level='L3',sessionKey='BODY-02-L3';
UI.ensureState(familyId,level);
assert.deepStrictEqual(plain(S.getSession('body',sessionKey)),{
  templateId:'body',familyId,level,resolverVersion:'body-v1',input:{familyId,level},selections:{},prepSelections:{}
});

const baseline=UI.resolveState(familyId,level);
const primary=baseline.main.content.find(slot=>slot.key==='PRIMARY');
const alternate=Body.candidates({familyId,level,slotKey:'PRIMARY',currentSelections:{}}).candidates.find(x=>x.actionId!==primary.actionId);
assert(alternate,'BODY-02 L3 needs a legal alternate PRIMARY');
UI.setFormalSelection(familyId,level,'PRIMARY',alternate.actionId);
const manual=UI.resolveState(familyId,level);
assert.strictEqual(manual.main.content.find(slot=>slot.key==='PRIMARY').actionId,alternate.actionId);
assert.strictEqual(manual.main.content.find(slot=>slot.key==='PRIMARY').source,'manual');
assert.deepStrictEqual(plain(S.getSelections('body',sessionKey).PRIMARY),{actionId:alternate.actionId,source:'manual'});

let html=UI.render({area:'coach',page:'template-session',templateId:'body',familyId,level,query:{}});
assert(html.includes('body-slot-select'),'Body editor must expose formal replacement selects');
assert(html.includes(`data-body-session="${sessionKey}"`),'Body select must carry session key');
assert(html.includes(`data-body-slot="PRIMARY"`),'Body PRIMARY select must carry slot key');
assert(html.includes(`value="${alternate.actionId}"`),'current manual action must remain in candidate select');

const persisted=plain(S.getSession('body',sessionKey));
for(const derivedKey of ['domainContext','volume','anatomyContext','conflictContext','main','resolvedSelections']){
  assert.strictEqual(Object.prototype.hasOwnProperty.call(persisted,derivedKey),false,`${derivedKey} must not persist`);
}

// Body PREP must consume the ResolvedSession prepContext directly and match the shared resolver.
const prepAuto=Prep.resolve(manual,sessionKey);
assert.strictEqual(prepAuto.slots.length,5,'Body PREP V2 must expose five functional slots');
const directAuto=PrepResolver.resolve(manual.prepContext,{selections:S.getPrepSelections('body',sessionKey)});
assert.deepStrictEqual(plain(prepAuto.slots.map(x=>x.actionId)),plain(directAuto.slots.map(x=>x.actionId)),'Body PREP helper must be a shared-resolver adapter, not a second algorithm');

const replaceable=prepAuto.slots.find(slot=>(slot.candidates||[]).some(candidate=>candidate.actionId!==slot.actionId));
assert(replaceable,'BODY-02 L3 needs one replaceable PREP slot');
const prepAlternate=replaceable.candidates.find(candidate=>candidate.actionId!==replaceable.actionId);
Prep.setSelection(sessionKey,replaceable.slotKey,prepAlternate.actionId);
const prepManual=Prep.resolve(manual,sessionKey);
const manualSlot=prepManual.slots.find(slot=>slot.slotKey===replaceable.slotKey);
assert.strictEqual(manualSlot.actionId,prepAlternate.actionId);
assert.strictEqual(manualSlot.source,'manual');
assert.deepStrictEqual(plain(S.getPrepSelections('body',sessionKey)[replaceable.slotKey]),{actionId:prepAlternate.actionId,source:'manual'});

// Make the saved PREP action formally ineligible using the same resolved context contract.
const changed=plain(manual);
changed.prepContext.formalActionIds=[...(changed.prepContext.formalActionIds||[]),prepAlternate.actionId];
const fallback=Prep.resolve(changed,sessionKey);
assert(fallback.fallbackSlots.includes(replaceable.slotKey),'stale Body PREP manual choice must be reported');
assert.strictEqual(S.getPrepSelections('body',sessionKey)[replaceable.slotKey],undefined,'stale Body PREP manual intent must be removed');
const fallbackSlot=fallback.slots.find(slot=>slot.slotKey===replaceable.slotKey);
assert.strictEqual(fallbackSlot.source,'auto');
assert.notStrictEqual(fallbackSlot.actionId,prepAlternate.actionId);

html=Prep.render(manual,sessionKey);
assert(html.includes('PREP｜动态热身 / 激活'),'Body PREP section title missing');
for(const slot of Prep.resolve(manual,sessionKey).slots){
  assert(html.includes(slot.slotKey),`${slot.slotKey} missing from Body PREP render`);
  assert(html.includes(slot.name||'暂无合法候选'),`${slot.slotKey} action missing from Body PREP render`);
}

UI.reset(familyId,level);
const reset=UI.resolveState(familyId,level);
assert(reset.main.content.every(slot=>slot.source==='auto'),'Reset must restore Body auto recommendations');
assert.deepStrictEqual(plain(S.getSelections('body',sessionKey)),{});
assert.deepStrictEqual(plain(S.getPrepSelections('body',sessionKey)),{},'Reset must also clear Body PREP manual intent');

// UI state adapter must preserve the frozen Resolver behavior for no-intent sessions.
assert.deepStrictEqual(plain(reset),plain(R.resolve('body',{familyId,level,selections:{}})));

console.log('body_coach_state_prep_test: formal state + Body PREP contract PASS');
