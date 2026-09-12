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
    'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
    'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js',
    'js/coach/common.js','js/coach/template-ui.js','js/coach/conflict-view.js',
    'js/coach/conditioning-home.js','js/coach/conditioning-recovery.js','js/coach/conditioning-prep.js','js/coach/conditioning-session.js'
  ])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {
    ctx,S:ctx.window.V15State,R:ctx.window.V15TemplateResolver,Cond:ctx.window.V15ConditioningResolver,
    PrepResolver:ctx.window.V14PrepResolver,M:ctx.window.V14CoachModules,D:ctx.window.V14_DATA,
  };
}
const plain=value=>JSON.parse(JSON.stringify(value));
const {S,R,Cond,PrepResolver,M,D}=boot();
const UI=M.ConditioningSession,Prep=M.ConditioningPrep;
for(const name of ['ensureState','resolveState','setFormalSelection','reset']){
  assert.strictEqual(typeof UI[name],'function',`ConditioningSession.${name} must exist`);
}
assert(Prep&&typeof Prep.resolve==='function'&&typeof Prep.render==='function'&&typeof Prep.setSelection==='function');

const familyId='CON-03',level='L2',protocolId='CIRCUIT',sessionKey='CON-03-L2-CIRCUIT';
UI.ensureState(familyId,level,protocolId);
assert.deepStrictEqual(plain(S.getSession('conditioning',sessionKey)),{
  templateId:'conditioning',familyId,level,resolverVersion:'conditioning-v1',
  input:{familyId,level,protocolId},selections:{},prepSelections:{}
});

const baseline=UI.resolveState(familyId,level,protocolId);
const stationKey='STATION-1';
const station=baseline.domainContext.stations[stationKey];
const current=Object.fromEntries(Object.values(baseline.domainContext.stations).map(x=>[x.key,x.actionId]));
const alternate=Cond.candidates({familyId,level,protocolId,stationKey,currentSelections:current}).candidates.find(x=>x.actionId!==station.actionId);
assert(alternate,'CON-03 L2 CIRCUIT needs a legal alternate STATION-1');

UI.setFormalSelection(familyId,level,protocolId,stationKey,alternate.actionId);
const manual=UI.resolveState(familyId,level,protocolId);
assert.strictEqual(manual.domainContext.stations[stationKey].actionId,alternate.actionId);
assert.strictEqual(manual.domainContext.stations[stationKey].source,'manual');
assert.deepStrictEqual(plain(S.getSelections('conditioning',sessionKey)[stationKey]),{actionId:alternate.actionId,source:'manual'});
assert.deepStrictEqual(plain(manual.domainContext.metrics),plain(baseline.domainContext.metrics),'same Protocol station swap should re-derive but preserve Protocol timing');
assert.deepStrictEqual(plain(manual.conflictContext),plain(R.resolve('conditioning',{
  familyId,level,protocolId,selections:S.getSelections('conditioning',sessionKey)
}).conflictContext),'Conflict must be derived from current station intent');

let html=UI.render({area:'coach',page:'template-session',templateId:'conditioning',familyId,level,query:{}});
assert(html.includes('conditioning-station-select'),'Conditioning editor must expose station selects');
assert(html.includes(`data-conditioning-session="${sessionKey}"`));
assert(html.includes(`data-conditioning-station="${stationKey}"`));
assert(html.includes(`value="${alternate.actionId}"`));

const persisted=plain(S.getSession('conditioning',sessionKey));
for(const key of ['domainContext','metrics','anatomyContext','conflictContext','main','resolvedSelections']){
  assert.strictEqual(Object.prototype.hasOwnProperty.call(persisted,key),false,`${key} must not persist`);
}

const prepAuto=Prep.resolve(manual,sessionKey);
assert.strictEqual(prepAuto.slots.length,5,'Conditioning PREP must expose five shared functional slots');
const directAuto=PrepResolver.resolve(manual.prepContext,{selections:S.getPrepSelections('conditioning',sessionKey)});
assert.deepStrictEqual(
  plain(prepAuto.slots.map(x=>x.actionId)),
  plain(directAuto.slots.map(x=>x.actionId)),
  'Conditioning PREP must be an adapter over the shared PREP Resolver'
);

const replaceable=prepAuto.slots.find(slot=>(slot.candidates||[]).some(candidate=>candidate.actionId!==slot.actionId));
assert(replaceable,'CON-03 L2 needs one replaceable PREP slot');
const prepAlternate=replaceable.candidates.find(candidate=>candidate.actionId!==replaceable.actionId);
Prep.setSelection(sessionKey,replaceable.slotKey,prepAlternate.actionId);
const prepManual=Prep.resolve(manual,sessionKey);
const manualPrepSlot=prepManual.slots.find(slot=>slot.slotKey===replaceable.slotKey);
assert.strictEqual(manualPrepSlot.actionId,prepAlternate.actionId);
assert.strictEqual(manualPrepSlot.source,'manual');
assert.deepStrictEqual(plain(S.getPrepSelections('conditioning',sessionKey)[replaceable.slotKey]),{actionId:prepAlternate.actionId,source:'manual'});

const changed=plain(manual);
changed.prepContext.formalActionIds=[...(changed.prepContext.formalActionIds||[]),prepAlternate.actionId];
const fallback=Prep.resolve(changed,sessionKey);
assert(fallback.fallbackSlots.includes(replaceable.slotKey),'stale Conditioning PREP manual choice must be reported');
assert.strictEqual(S.getPrepSelections('conditioning',sessionKey)[replaceable.slotKey],undefined,'stale PREP intent must be removed');

html=Prep.render(manual,sessionKey);
assert(html.includes('PREP / PRIMER｜动态热身 · 动作排演'));
for(const slot of Prep.resolve(manual,sessionKey).slots){
  assert(html.includes(slot.slotKey),`${slot.slotKey} missing from PREP render`);
}

UI.reset(familyId,level,protocolId);
const reset=UI.resolveState(familyId,level,protocolId);
assert(Object.values(reset.domainContext.stations).every(item=>item.source==='auto'));
assert.deepStrictEqual(plain(S.getSelections('conditioning',sessionKey)),{});
assert.deepStrictEqual(plain(S.getPrepSelections('conditioning',sessionKey)),{});
assert.deepStrictEqual(plain(reset),plain(R.resolve('conditioning',{familyId,level,protocolId,selections:{}})));

console.log('conditioning_coach_state_prep_test: station State + shared PREP PASS');
