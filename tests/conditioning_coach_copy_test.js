const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(){
  const memory={};
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},location:{hash:''},URLSearchParams,console,Date};
  ctx.window.addEventListener=()=>{};
  ctx.window.navigator={clipboard:{writeText:async()=>{}}};
  vm.createContext(ctx);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
    'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js','js/session-copy.js',
    'js/coach/common.js','js/coach/template-ui.js','js/coach/conflict-view.js',
    'js/coach/conditioning-home.js','js/coach/conditioning-prep.js','js/coach/conditioning-recovery.js',
    'js/coach/conditioning-copy.js','js/coach/conditioning-session.js'
  ])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {
    ctx,M:ctx.window.V14CoachModules,S:ctx.window.V15State,
    Cond:ctx.window.V15ConditioningResolver,D:ctx.window.V14_DATA,
  };
}
const plain=value=>JSON.parse(JSON.stringify(value));
const {ctx,M,S,Cond,D}=boot();
const UI=M.ConditioningSession,Prep=M.ConditioningPrep,Copy=M.ConditioningCopy;
for(const name of ['buildPayload','formatCoach','formatMember']){
  assert.strictEqual(typeof Copy[name],'function',`ConditioningCopy.${name} must exist`);
}

const familyId='CON-03',level='L2',protocolId='CIRCUIT',sessionKey='CON-03-L2-CIRCUIT';
const now=new Date('2026-09-12T06:00:00Z');
UI.ensureState(familyId,level,protocolId);
const baseline=UI.resolveState(familyId,level,protocolId);
const prep=Prep.resolve(baseline,sessionKey);
const payload=Copy.buildPayload(baseline,prep,now);

assert.strictEqual(payload.templateId,'conditioning');
assert.strictEqual(payload.familyId,familyId);
assert.strictEqual(payload.familyName,D.conditioningFamilies[familyId].name);
assert.strictEqual(payload.level,level);
assert.strictEqual(payload.protocolId,protocolId);
assert.strictEqual(payload.protocolName,D.conditioningProtocols[protocolId].name);
assert.strictEqual(payload.stations.length,baseline.domainContext.metrics.stationCount);
assert.deepStrictEqual(plain(payload.metrics),plain(baseline.domainContext.metrics));
assert.deepStrictEqual(plain(payload.conflicts),plain(baseline.conflictContext));
assert.deepStrictEqual(plain(payload.prep.map(x=>x.actionId)),plain(Prep.items(prep).map(x=>x.actionId)));
assert.strictEqual(payload.recovery.noPostCardio,true);

const coach=Copy.formatCoach(payload);
assert(coach.includes('Conditioning 教练训练单'));
assert(coach.includes(D.conditioningFamilies[familyId].name));
assert(coach.includes(D.conditioningProtocols[protocolId].name));
assert(coach.includes('Work / Rest'));
assert(coach.includes('Rounds'));
assert(coach.includes('RPE'));
assert(coach.includes('Station'));
assert(coach.includes('Conditioning Conflict'));
assert(coach.includes('NO POST CARDIO'));
assert(coach.includes('RECOVERY｜训练后恢复 · 约 5–8 分钟'));
for(const station of payload.stations){
  assert(coach.includes(station.name),`Coach copy missing ${station.name}`);
  assert(coach.includes(station.prescription),`Coach copy missing prescription for ${station.name}`);
  assert(coach.includes(station.observation),`Coach copy missing observation for ${station.name}`);
}

const member=Copy.formatMember(payload);
const date=ctx.window.V14SessionCopy.formatDate(now);
assert(member.includes(date));
assert(member.includes(D.conditioningFamilies[familyId].name));
assert(member.includes(D.conditioningProtocols[protocolId].name));
assert(member.includes('预计训练时间'));
assert(member.includes('训练前准备'));
assert(member.includes('主要训练'));
assert(member.includes('今天完成完整体能课后，不再额外安排课后有氧。'));
for(const station of payload.stations)assert(member.includes(station.name),`Member copy missing ${station.name}`);
for(const prepItem of payload.prep.filter(x=>x.name))assert(member.includes(prepItem.name),`Member copy missing PREP ${prepItem.name}`);

for(const forbidden of [
  'CON-01','CON-02','CON-03','CON-04','CIRCUIT','INTERVAL','STEADY','DENSITY',
  'CYCLICAL','SLED','CARRY','LOCOMOTION','BALL','SIMPLE_STRENGTH','POWER','CORE_INTEGRATION',
  'COND_','resolverVersion','conditioning-v1','protocolId','familyId','hardCount','warnCount','powerEligible'
]){
  assert(!member.includes(forbidden),`Member copy leaked internal Conditioning term: ${forbidden}`);
}

// Swap refresh: Copy must be rebuilt from the current ResolvedSession, never cached.
const first=baseline.domainContext.stations['STATION-1'];
const current=Object.fromEntries(Object.values(baseline.domainContext.stations).map(x=>[x.key,x.actionId]));
const alternate=Cond.candidates({familyId,level,protocolId,stationKey:'STATION-1',currentSelections:current})
  .candidates.find(x=>x.actionId!==first.actionId);
assert(alternate,'CON-03/L2/CIRCUIT requires a legal alternate for Copy refresh');
UI.setFormalSelection(familyId,level,protocolId,'STATION-1',alternate.actionId);
const swapped=UI.resolveState(familyId,level,protocolId);
const swappedPrep=Prep.resolve(swapped,sessionKey);
const refreshed=Copy.buildPayload(swapped,swappedPrep,now);
assert.strictEqual(refreshed.stations[0].actionId,alternate.actionId);
assert.notStrictEqual(refreshed.stations[0].actionId,first.actionId);
assert.deepStrictEqual(plain(refreshed.metrics),plain(swapped.domainContext.metrics));
assert.deepStrictEqual(plain(refreshed.conflicts),plain(swapped.conflictContext));
assert.deepStrictEqual(plain(refreshed.prep.map(x=>x.actionId)),plain(Prep.items(swappedPrep).map(x=>x.actionId)));
assert.deepStrictEqual(plain(S.getSelections('conditioning',sessionKey)['STATION-1']),{actionId:alternate.actionId,source:'manual'});
assert(Copy.formatCoach(refreshed).includes(alternate.name),'refreshed Coach copy must contain swapped Station action');
assert(Copy.formatMember(refreshed).includes(alternate.name),'refreshed Member copy must contain swapped Station action');

console.log('conditioning_coach_copy_test: Coach/Member copy + anti-leak PASS');
