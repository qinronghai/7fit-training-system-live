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
    'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
    'js/template-resolver.js','js/resolvers/body.js','js/session-copy.js','js/coach/common.js','js/coach/template-ui.js',
    'js/coach/body-home.js','js/coach/body-volume-view.js','js/coach/body-prep.js','js/coach/body-recovery.js'
  ]) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  assert.strictEqual(fs.existsSync(`${root}/js/coach/body-copy.js`),true,'Body Copy adapter module must exist');
  vm.runInContext(fs.readFileSync(`${root}/js/coach/body-copy.js`,'utf8'),ctx,{filename:'js/coach/body-copy.js'});
  vm.runInContext(fs.readFileSync(`${root}/js/coach/body-session.js`,'utf8'),ctx,{filename:'js/coach/body-session.js'});
  return {ctx,M:ctx.window.V14CoachModules,S:ctx.window.V15State,Body:ctx.window.V15BodyResolver,D:ctx.window.V14_DATA};
}

const plain=value=>JSON.parse(JSON.stringify(value));
const {ctx,M,S,Body,D}=boot();
const UI=M.BodySession,Prep=M.BodyPrep,Copy=M.BodyCopy;
assert(Copy,'BodyCopy module must register on V14CoachModules');
for(const name of ['buildPayload','formatCoach','formatMember']){
  assert.strictEqual(typeof Copy[name],'function',`BodyCopy.${name} must exist`);
}

const familyId='BODY-02',level='L3',sessionKey='BODY-02-L3';
const now=new Date('2026-09-10T12:00:00Z');
UI.ensureState(familyId,level);
const baseline=UI.resolveState(familyId,level);
const prep=Prep.resolve(baseline,sessionKey);
const payload=Copy.buildPayload(baseline,prep,now);

assert.strictEqual(payload.templateId,'body');
assert.strictEqual(payload.familyId,familyId);
assert.strictEqual(payload.familyName,D.bodyFamilies[familyId].name);
assert.strictEqual(payload.level,level);
assert.strictEqual(payload.slots.length,baseline.main.content.length);
assert.deepStrictEqual(plain(payload.volume),plain(baseline.domainContext.volume),'Copy payload must use ResolvedSession volume verbatim');
assert.deepStrictEqual(plain(payload.conflicts),plain(baseline.conflictContext),'Copy payload must use ResolvedSession conflict verbatim');
assert.deepStrictEqual(plain(payload.prep.map(x=>x.actionId)),plain(Prep.items(prep).map(x=>x.actionId)),'Copy payload PREP must be the exact resolved Body PREP used by the page');

const coach=Copy.formatCoach(payload);
assert(coach.includes(familyId),'Coach copy must include Body family id');
assert(coach.includes(D.bodyFamilies[familyId].name),'Coach copy must include human-readable family name');
assert(coach.includes(level),'Coach copy must include level');
assert(coach.includes('Direct Work Sets'),'Coach copy must include Direct Work Sets');
assert(coach.includes('PREP'),'Coach copy must include PREP');
assert(coach.includes(String(baseline.conflictContext.status)),'Coach copy must include conflict summary');
assert(coach.includes('训练后恢复｜约 5–8 分钟'),'Coach copy must include fixed Recovery title');
assert(coach.includes('恢复内容不计入 Direct Work Sets。'),'Coach copy must include Recovery boundary');

for(const slot of payload.slots){
  assert(coach.includes(slot.roleName),`Coach copy missing role label ${slot.roleName}`);
  assert(coach.includes(slot.name),`Coach copy missing action ${slot.name}`);
  assert(coach.includes('Sets'),'Coach copy must label Sets');
  assert(coach.includes('Reps'),'Coach copy must label Reps');
  assert(coach.includes('RIR'),'Coach copy must label RIR');
  assert(coach.includes('Rest'),'Coach copy must label Rest');
}

const detailedSlot=payload.slots.find(slot=>slot.cue&&slot.observation);
assert(detailedSlot,'BODY-02/L3 should expose at least one action with cue and observation');
assert(coach.includes(detailedSlot.cue),'Coach copy must include action coach cue when present');
assert(coach.includes(detailedSlot.observation),'Coach copy must include common-error observation when present');

for(const [targetId,sets] of Object.entries(baseline.domainContext.volume.directSetsByTarget||{})){
  if(Number(sets)<=0)continue;
  const targetName=D.bodyTargetCatalog[targetId]?.name||targetId;
  assert(coach.includes(targetName),`Coach copy missing direct-set target ${targetName}`);
}

const member=Copy.formatMember(payload);
const expectedDate=ctx.window.V14SessionCopy.formatDate(now);
assert(member.includes(expectedDate),'Member copy must include formatted date');
assert(member.includes(D.bodyFamilies[familyId].name),'Member copy must include human-readable family/focus');
for(const slot of payload.slots){
  assert(member.includes(slot.name),`Member copy missing action ${slot.name}`);
}
for(const item of payload.prep.filter(x=>x.name)){
  assert(member.includes(item.name),`Member copy missing PREP action ${item.name}`);
}
const purposeSlot=payload.slots.find(slot=>slot.purpose);
assert(purposeSlot,'BODY-02/L3 should expose at least one action purpose');
assert(member.includes(purposeSlot.purpose),'Member copy must include member-facing action purpose');
assert(member.includes('训练后恢复｜约 5–8 分钟'),'Member copy must include Recovery');

for(const forbidden of [
  'PRIMARY','SECONDARY','ACCESSORY','ISOLATION','OPTIONAL','BODY_','resolverVersion','body-v1',
  'directSetsByTarget','secondaryExposureByTarget','hardCount','warnCount'
]){
  assert(!member.includes(forbidden),`Member copy leaked internal Body term: ${forbidden}`);
}

// Refresh-after-swap gate: buildPayload must never cache old resolved data.
const beforePrimary=baseline.main.content.find(slot=>slot.key==='PRIMARY');
const alternate=Body.candidates({familyId,level,slotKey:'PRIMARY',currentSelections:{}}).candidates.find(x=>x.actionId!==beforePrimary.actionId);
assert(alternate,'BODY-02/L3 requires one legal PRIMARY alternate for copy refresh test');
UI.setFormalSelection(familyId,level,'PRIMARY',alternate.actionId);
const swapped=UI.resolveState(familyId,level);
const swappedPrep=Prep.resolve(swapped,sessionKey);
const refreshed=Copy.buildPayload(swapped,swappedPrep,now);
const refreshedPrimary=refreshed.slots.find(slot=>slot.key==='PRIMARY');
assert.strictEqual(refreshedPrimary.actionId,alternate.actionId,'Refreshed copy payload must use swapped action');
assert.notStrictEqual(refreshedPrimary.actionId,beforePrimary.actionId,'Refreshed copy payload must not cache old PRIMARY');
assert.deepStrictEqual(plain(refreshed.volume),plain(swapped.domainContext.volume),'Refreshed payload must use current derived volume');
assert.deepStrictEqual(plain(refreshed.conflicts),plain(swapped.conflictContext),'Refreshed payload must use current conflict result');
assert.deepStrictEqual(plain(refreshed.prep.map(x=>x.actionId)),plain(Prep.items(swappedPrep).map(x=>x.actionId)),'Refreshed payload must use current resolved PREP');
assert.deepStrictEqual(plain(S.getSelections('body',sessionKey).PRIMARY),{actionId:alternate.actionId,source:'manual'});

console.log('body_coach_copy_test: Body Coach/Member copy contract PASS');
