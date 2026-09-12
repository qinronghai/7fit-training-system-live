const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(){
  const memory={};
  const sessionStorage={
    getItem:key=>memory[key]??null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console,URLSearchParams,location:{hash:''}};
  ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
    'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js'
  ])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {memory,ctx,S:ctx.window.V15State,R:ctx.window.V15TemplateResolver,Cond:ctx.window.V15ConditioningResolver,D:ctx.window.V14_DATA};
}
function plain(v){return JSON.parse(JSON.stringify(v));}

const {S,R,Cond,D}=boot();
const familyId='CON-03',level='L3',protocolId='CIRCUIT',sessionKey=`${familyId}-${level}`;
const metadata={familyId,level,resolverVersion:'conditioning-v1',input:{familyId,level,protocolId}};
S.ensureSession('conditioning',sessionKey,metadata);

function reconcile(version='conditioning-v1'){
  return S.reconcileSession('conditioning',sessionKey,{
    resolverVersion:version,
    isSelectionValid:(key,entry,state)=>Cond.isSelectionValid({
      familyId:state.familyId,
      level:state.level,
      protocolId:state.input.protocolId,
      stationKey:key,
      actionId:entry.actionId,
    }),
  });
}

let resolved=R.resolve('conditioning',{
  familyId,level,protocolId,selections:S.getSelections('conditioning',sessionKey)
});
const baseline=plain(resolved);
const stationKey='STATION-1',baselineAction=resolved.resolvedSelections.find(x=>x.key===stationKey).actionId;
const current=Object.fromEntries(resolved.resolvedSelections.map(x=>[x.key,x.actionId]));
const candidateResult=Cond.candidates({familyId,level,protocolId,stationKey,currentSelections:current});
const alternate=candidateResult.candidates.find(c=>c.actionId!==baselineAction);
assert(alternate,'expected a legal alternate station candidate');

S.setSelection('conditioning',sessionKey,stationKey,alternate.actionId,'manual');
let rec=reconcile();
assert.deepStrictEqual(plain(rec.reasons),[]);
resolved=R.resolve('conditioning',{
  familyId,level,protocolId,selections:S.getSelections('conditioning',sessionKey)
});
const swapped=resolved.domainContext.stations[stationKey];
assert.strictEqual(swapped.actionId,alternate.actionId);
assert.strictEqual(swapped.source,'manual');
assert.notDeepStrictEqual(plain(resolved.domainContext),plain(baseline.domainContext),'swap must re-resolve derived context');
assert.deepStrictEqual(
  plain(R.resolve('conditioning',{familyId,level,protocolId,selections:S.getSelections('conditioning',sessionKey)})),
  plain(resolved),
  'same Conditioning State intent must resolve deterministically'
);

// Generic auto entries are not user intent; resolver returns its own deterministic auto recommendation.
S.setSelection('conditioning',sessionKey,stationKey,alternate.actionId,'auto');
resolved=R.resolve('conditioning',{
  familyId,level,protocolId,selections:S.getSelections('conditioning',sessionKey)
});
assert.strictEqual(resolved.domainContext.stations[stationKey].source,'auto');
assert.strictEqual(resolved.domainContext.stations[stationKey].actionId,baselineAction);

// Manual intent becomes stale when Action route is no longer legal; reconcile drops it.
S.setSelection('conditioning',sessionKey,stationKey,alternate.actionId,'manual');
const originalRoute=D.actions[alternate.actionId].route;
D.actions[alternate.actionId].route='POST_CARDIO_ONLY';
rec=reconcile();
assert(rec.reasons.includes('STALE_SELECTION'));
assert(rec.droppedSelections.includes(stationKey));
assert.deepStrictEqual(plain(S.getSelections('conditioning',sessionKey)),{});
D.actions[alternate.actionId].route=originalRoute;

// Resolver-version mismatch clears formal + PREP intent but preserves identity/input.
S.setSelection('conditioning',sessionKey,stationKey,baselineAction,'manual');
const prepActionId=D.warmupDetails[D.warmupIds[0]].actionId;
S.setPrepSelection('conditioning',sessionKey,'MOB-L',prepActionId,'manual');
rec=S.reconcileSession('conditioning',sessionKey,{resolverVersion:'conditioning-v2'});
assert(rec.reasons.includes('RESOLVER_VERSION_MISMATCH'));
assert.deepStrictEqual(plain(rec.session.selections),{});
assert.deepStrictEqual(plain(rec.session.prepSelections),{});
assert.strictEqual(rec.session.familyId,familyId);
assert.strictEqual(rec.session.level,level);
assert.deepStrictEqual(plain(rec.session.input),{familyId,level,protocolId});

// Reset removes intent; recreated state returns deterministic baseline.
S.resetSession('conditioning',sessionKey);
assert.strictEqual(S.getSession('conditioning',sessionKey),null);
S.ensureSession('conditioning',sessionKey,metadata);
resolved=R.resolve('conditioning',{
  familyId,level,protocolId,selections:S.getSelections('conditioning',sessionKey)
});
assert.deepStrictEqual(plain(resolved),baseline);

// State persists only intent, never protocol-derived output.
const persisted=plain(S.getSession('conditioning',sessionKey));
assert.deepStrictEqual(Object.keys(persisted).sort(),['familyId','input','level','prepSelections','resolverVersion','selections','templateId'].sort());
for(const key of ['domainContext','main','conflictContext','anatomyContext','estimatedMinutes','metrics','resolvedSelections']){
  assert.strictEqual(Object.prototype.hasOwnProperty.call(persisted,key),false,`${key} must not persist`);
}

console.log('conditioning_state_reconcile_test: PASS');
