const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');

const memory={};
const sessionStorage={
  getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
  setItem:(key,value)=>{memory[key]=String(value);},
  removeItem:key=>{delete memory[key];},
};
const ctx={
  window:{},console,sessionStorage,URLSearchParams,
  document:{body:{dataset:{}}},
  setTimeout,clearTimeout,
};
ctx.window.window=ctx.window;
vm.createContext(ctx);

for(const file of [
  'data/system-data.js',
  'data/anatomy-data.js',
  'js/router.js',
  'js/state.js',
  'js/prep-grade.js',
  'js/anatomy.js',
  'js/prep-resolver.js',
  'js/resolved-session.js',
  'js/template-resolver.js',
  'js/resolvers/hyrox.js',
  'js/session-copy.js',
  'js/saved-sessions.js',
  'js/coach/common.js',
  'js/coach/template-ui.js',
  'js/coach/hyrox-home.js',
  'js/coach/hyrox-prep.js',
  'js/coach/hyrox-recovery.js',
  'js/coach/hyrox-copy.js',
  'js/coach/hyrox-session.js',
]){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}

const W=ctx.window,D=W.V14_DATA,R=W.V14Router,S=W.V15State,M=W.V14CoachModules;
const plain=value=>JSON.parse(JSON.stringify(value));

assert.strictEqual(D.templateRegistry.hyrox.status,'ACTIVE');
assert.strictEqual(D.templateRegistry.hyrox.capabilities.prep,true);
assert.strictEqual(D.templateRegistry.hyrox.capabilities.copy,true);
assert.strictEqual(D.templateRegistry.hyrox.capabilities.save,true);
assert.deepStrictEqual(Object.keys(plain(S.snapshot().templates)).sort(),['body','conditioning','f111','hyrox']);

let route=R.parseHash('#/coach/hyrox/skill/l2');
assert.strictEqual(route.templateId,'hyrox');
assert.strictEqual(route.sessionType,'SKILL');
assert.strictEqual(route.level,'L2');
assert.strictEqual(R.isValid(route),true);
assert.strictEqual(R.canonicalHash(route),'#/coach/hyrox/skill/l2');

route=R.parseHash('#/coach/hyrox/capacity/l3?focus=SLED');
assert.strictEqual(route.sessionType,'CAPACITY');
assert.strictEqual(route.query.focus,'SLED');
assert.strictEqual(R.isValid(route),true);
assert.strictEqual(R.canonicalHash(route),'#/coach/hyrox/capacity/l3?focus=SLED');

route=R.parseHash('#/coach/hyrox/benchmark/b3');
assert.strictEqual(route.sessionType,'BENCHMARK');
assert.strictEqual(route.protocolId,'B3');
assert.strictEqual(route.level,'L3');
assert.strictEqual(R.isValid(route),true);
assert.strictEqual(R.canonicalHash(route),'#/coach/hyrox/benchmark/b3');

const home=M.HyroxHome.render();
assert.strictEqual((home.match(/data-hyrox-type=/g)||[]).length,4);
assert(home.includes('不加入 1km 跑步'));
assert(home.includes('Turf 8m'));

let skillRoute=R.parseHash('#/coach/hyrox/skill/l2');
let skill=M.HyroxSession.context(skillRoute);
assert(skill.session);
assert.strictEqual(skill.session.domainContext.sessionType,'SKILL');
assert.strictEqual(skill.session.domainContext.orderedStations.length,3);
assert.strictEqual(skill.prep.slots.length,5);
let skillHtml=M.HyroxSession.renderSession(skillRoute);
assert.strictEqual((skillHtml.match(/data-hyrox-station-card=/g)||[]).length,3);
assert(skillHtml.includes('data-hyrox-station-swap'));

const mixedRoute=R.parseHash('#/coach/hyrox/mixed/l3');
let mixed=M.HyroxSession.context(mixedRoute);
assert(mixed.session);
assert.strictEqual(mixed.session.domainContext.orderedStations.length,5);
assert(mixed.session.domainContext.orderedStations.length<=6);
M.HyroxSession.patchInput(mixed,{loadLevel:'L1'});
mixed=M.HyroxSession.context(mixedRoute);
assert.strictEqual(mixed.session.domainContext.loadLevel,'L1');

const sledRoute=R.parseHash('#/coach/hyrox/capacity/l2?focus=SLED');
let sled=M.HyroxSession.context(sledRoute);
assert.strictEqual(sled.session,null);
assert.strictEqual(sled.error.code,'HYROX_SLED_CALIBRATION_REQUIRED');
M.HyroxSession.patchInput(sled,{
  sledCalibration:{
    SLED_PUSH:{calibratedLoadKg:42,targetRpe:6.5,calibrationVersion:'7fit-turf-v1'},
    SLED_PULL:{calibratedLoadKg:36,targetRpe:6.5,calibrationVersion:'7fit-turf-v1'},
  },
});
sled=M.HyroxSession.context(sledRoute);
assert(sled.session);
assert.deepStrictEqual(plain(sled.session.domainContext.orderedStations),['H2','H3']);

const benchmarkRoute=R.parseHash('#/coach/hyrox/benchmark/b3');
let benchmark=M.HyroxSession.context(benchmarkRoute);
assert.strictEqual(benchmark.session,null);
assert.strictEqual(benchmark.error.code,'HYROX_SLED_CALIBRATION_REQUIRED');
M.HyroxSession.patchInput(benchmark,{
  sledCalibration:{
    SLED_PUSH:{calibratedLoadKg:42,targetRpe:7.5,calibrationVersion:'7fit-turf-v1'},
    SLED_PULL:{calibratedLoadKg:36,targetRpe:7.5,calibrationVersion:'7fit-turf-v1'},
  },
});
benchmark=M.HyroxSession.context(benchmarkRoute);
assert(benchmark.session);
assert.deepStrictEqual(plain(benchmark.session.domainContext.orderedStations),['H1','H2','H3','H4','H5','H6','H7','H8']);
assert.strictEqual(benchmark.session.domainContext.stations['STATION-2'].prescription.includes('6 趟｜48m'),true);
const benchmarkHtml=M.HyroxSession.renderSession(benchmarkRoute);
assert.strictEqual((benchmarkHtml.match(/data-hyrox-station-card=/g)||[]).length,8);
assert.strictEqual(benchmarkHtml.includes('data-hyrox-station-swap'),false);
assert(benchmarkHtml.includes('只有 Protocol、工作量、有效负重'));

const payload=M.HyroxCopy.buildPayload(benchmark.session,benchmark.prep,new Date('2026-09-14T02:00:00+08:00'));
const coach=M.HyroxCopy.formatCoach(payload),member=M.HyroxCopy.formatMember(payload);
assert(coach.includes('B3'));
assert(coach.includes('6 趟｜48m'));
assert(member.includes('固定 8 个 Station'));
assert(!member.includes('comparisonKey'));
assert(!member.includes('schemaVersion'));
assert(!member.includes('HYROX|'));

const saveRoute=R.parseHash('#/coach/hyrox/mixed/l3');
const saved=W.V15SavedSessions.saveRoute(saveRoute,'HYROX Mixed Test',{savedId:'save-hyrox',now:'2026-09-14T02:30:00+08:00'});
assert.strictEqual(saved.templateId,'hyrox');
assert.strictEqual(saved.input.loadLevel,'L1');
S.resetSession('hyrox','MIXED-L3');
const restored=W.V15SavedSessions.restore('save-hyrox');
assert.strictEqual(restored.ok,true);
assert.strictEqual(restored.hash,'#/coach/hyrox/mixed/l3');
const restoredState=S.getSession('hyrox','MIXED-L3');
assert.strictEqual(restoredState.input.loadLevel,'L1');
assert.strictEqual(W.V15TemplateResolver.resolve('hyrox',restoredState.input).templateId,'hyrox');

console.log('hyrox_coach_runtime_test: PASS');
