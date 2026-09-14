const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const memory={};
const localStorage={getItem:k=>memory[k]??null,setItem:(k,v)=>{memory[k]=String(v);},removeItem:k=>{delete memory[k];}};
const ctx={window:{},localStorage,console,URLSearchParams,Date,document:{body:{dataset:{}}}};
ctx.window.window=ctx.window;
vm.createContext(ctx);
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/resolved-session.js','js/template-resolver.js','js/resolvers/hyrox.js',
  'js/hyrox-benchmark-history.js','js/session-copy.js','js/coach/common.js','js/coach/hyrox-copy.js'
])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});

const W=ctx.window,R=W.V15TemplateResolver,H=W.V15HyroxBenchmarkHistory;
const session=R.resolve('hyrox',{
  sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',
  sledCalibration:{
    SLED_PUSH:{calibratedLoadKg:42,targetRpe:7.5,calibrationVersion:'7fit-turf-v1'},
    SLED_PULL:{calibratedLoadKg:36,targetRpe:7.5,calibrationVersion:'7fit-turf-v1'},
  }
});
const ids=['H1','H2','H3','H4','H5','H6','H7','H8'];
const times1=Object.fromEntries(ids.map((id,i)=>[id,(100+i*4)*1000]));
const times2=Object.fromEntries(ids.map((id,i)=>[id,(95+i*4)*1000]));
H.saveFromSession(session,{recordId:'copy-1',completedAt:'2026-09-01T10:00:00+08:00',totalTimeMs:1656000,stationTimes:times1});
H.saveFromSession(session,{recordId:'copy-2',completedAt:'2026-09-08T10:00:00+08:00',totalTimeMs:1612000,stationTimes:times2});
const payload=W.V14CoachModules.HyroxCopy.buildPayload(session,null,new Date('2026-09-08T10:30:00+08:00'));
const coach=W.V14CoachModules.HyroxCopy.formatCoach(payload);
const member=W.V14CoachModules.HyroxCopy.formatMember(payload);
for(const text of [coach,member]){
  assert(text.includes('26:52'));
  assert(text.includes('↑ 0:44'));
  assert(!text.includes('comparisonKey'));
  assert(!text.includes('schemaVersion'));
  assert(!text.includes('HYROX|'));
}
assert(coach.includes('当前短板：'));
assert(coach.includes('下一阶段建议：'));
assert(member.includes('最明显进步：'));
assert(member.includes('下一阶段重点：'));
console.log('hyrox_benchmark_copy_test: coach/member result copy GREEN');
