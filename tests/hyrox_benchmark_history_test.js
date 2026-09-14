const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const root=path.resolve(__dirname,'..');

function boot(seed=null){
  const memory={};
  if(seed!==null)memory['7fit-hyrox-benchmark-history']=JSON.stringify(seed);
  const localStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},localStorage,console,URLSearchParams,Date};
  ctx.window.window=ctx.window;
  vm.createContext(ctx);
  for(const file of ['data/system-data.js','data/anatomy-data.js','js/resolved-session.js','js/template-resolver.js','js/resolvers/hyrox.js','js/hyrox-benchmark-history.js']){
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  }
  return {W:ctx.window,H:ctx.window.V15HyroxBenchmarkHistory,R:ctx.window.V15TemplateResolver,memory};
}
function session(R,options={}){
  return R.resolve('hyrox',{
    sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',
    sledCalibration:{
      SLED_PUSH:{calibratedLoadKg:42,targetRpe:7.5,calibrationVersion:options.calibrationVersion||'7fit-turf-v1'},
      SLED_PULL:{calibratedLoadKg:36,targetRpe:7.5,calibrationVersion:options.calibrationVersion||'7fit-turf-v1'},
    },
    ...(options.explicitLoads?{explicitLoads:options.explicitLoads}:{}),
    ...(options.workOverrides?{workOverrides:options.workOverrides}:{}),
    ...(options.scaledVariants?{scaledVariants:options.scaledVariants}:{}),
  });
}
function times(base){
  return Object.fromEntries(['H1','H2','H3','H4','H5','H6','H7','H8'].map((id,i)=>[id,(base+i*5)*1000]));
}

let env=boot(),H=env.H,R=env.R;
assert.strictEqual(H.schemaVersion(),1);
assert.strictEqual(H.getLoadStatus().code,'FRESH');

const s1=session(R);
const first=H.saveFromSession(s1,{recordId:'r1',completedAt:'2026-09-01T10:00:00+08:00',totalTimeMs:27*60*1000+36*1000,stationTimes:times(100)});
assert.strictEqual(first.record.validityStatus,'VALID_NEW_BASELINE');
assert.strictEqual(first.analysis.previous,null);
assert.strictEqual(first.analysis.isPb,true);

const second=H.saveFromSession(s1,{recordId:'r2',completedAt:'2026-09-08T10:00:00+08:00',totalTimeMs:26*60*1000+52*1000,stationTimes:times(95)});
assert.strictEqual(second.record.validityStatus,'VALID_COMPARABLE');
assert.strictEqual(second.analysis.previous.recordId,'r1');
assert.strictEqual(second.analysis.deltaPreviousMs,44*1000);
assert.strictEqual(second.analysis.pb.recordId,'r2');
assert.strictEqual(second.analysis.stationDeltas.H1,5000);
assert(second.analysis.abilityProfile.weakestGroup);
assert(second.analysis.abilityProfile.recommendation?.hint);

const slower=H.saveFromSession(s1,{recordId:'r3',completedAt:'2026-09-10T10:00:00+08:00',totalTimeMs:28*60*1000,stationTimes:times(105)});
assert.strictEqual(slower.analysis.previous.recordId,'r2');
assert(slower.analysis.deltaPreviousMs<0);
assert.strictEqual(slower.analysis.pb.recordId,'r2');

const changedLoad=session(R,{explicitLoads:{H6:99}});
assert.notStrictEqual(changedLoad.domainContext.benchmarkContext.comparisonKey,s1.domainContext.benchmarkContext.comparisonKey);
const changed=H.saveFromSession(changedLoad,{recordId:'load-change',completedAt:'2026-09-11T10:00:00+08:00',totalTimeMs:29*60*1000,stationTimes:times(106)});
assert.strictEqual(changed.record.validityStatus,'VALID_NEW_BASELINE');
assert.strictEqual(changed.analysis.previous,null);
assert.strictEqual(H.contextForSession(changedLoad).sameKeyRecords.length,1);

const changedWork=session(R,{workOverrides:{H1:550}});
const workChanged=H.saveFromSession(changedWork,{recordId:'work-change',completedAt:'2026-09-12T10:00:00+08:00',totalTimeMs:29*60*1000,stationTimes:times(107)});
assert.strictEqual(workChanged.record.validityStatus,'SCALED');
assert.strictEqual(workChanged.analysis.pb,null);

const scaled=session(R,{scaledVariants:{H4:'step-back burpee'}});
const scaledRow=H.saveFromSession(scaled,{recordId:'scaled',completedAt:'2026-09-12T11:00:00+08:00',totalTimeMs:30*60*1000,stationTimes:times(108)});
assert.strictEqual(scaledRow.record.validityStatus,'SCALED');
assert.strictEqual(H.analyzeRecord('r2').pb.recordId,'r2');

const incomplete=H.saveFromSession(s1,{recordId:'incomplete',completedAt:'2026-09-13T10:00:00+08:00',totalTimeMs:30*60*1000,stationTimes:{H1:100000}});
assert.strictEqual(incomplete.record.validityStatus,'INCOMPLETE');
assert.strictEqual(H.analyzeRecord('r2').pb.recordId,'r2');

const beforeDelete=H.list().length,removed=H.remove('r3');
assert.strictEqual(removed.recordId,'r3');
assert.strictEqual(H.list().length,beforeDelete-1);
H.restoreRecord(removed);
assert.strictEqual(H.get('r3').recordId,'r3');

const cal2=session(R,{calibrationVersion:'7fit-turf-v2'});
assert.notStrictEqual(cal2.domainContext.benchmarkContext.comparisonKey,s1.domainContext.benchmarkContext.comparisonKey);

// Protocol version changes also create a distinct comparison identity.
R.resolve('hyrox',{sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',
  sledCalibration:{
    SLED_PUSH:{calibratedLoadKg:42,targetRpe:7.5,calibrationVersion:'7fit-turf-v1'},
    SLED_PULL:{calibratedLoadKg:36,targetRpe:7.5,calibrationVersion:'7fit-turf-v1'},
  }
});
env.W.V14_DATA.hyroxBenchmarkProtocols.B3.protocolVersion='1.0.1';
const version2=session(R);
assert.notStrictEqual(version2.domainContext.benchmarkContext.comparisonKey,s1.domainContext.benchmarkContext.comparisonKey);
env.W.V14_DATA.hyroxBenchmarkProtocols.B3.protocolVersion='1.0.0';

env=boot({schemaVersion:0,profileRef:'legacy',records:[{recordId:'legacy-1',completedAt:'2026-08-01',protocolId:'B3',totalTimeMs:1600000}]});
H=env.H;
const legacy=H.get('legacy-1');
assert.strictEqual(legacy.legacy,true);
assert.strictEqual(legacy.validityStatus,'INVALID_PROTOCOL');
assert.strictEqual(H.analyzeRecord('legacy-1').pb,null);

env=boot({schemaVersion:99,profileRef:'future',records:[]});
H=env.H;
assert.strictEqual(H.getLoadStatus().code,'UNSUPPORTED_NEWER_SCHEMA');
assert.throws(()=>H.restoreRecord({recordId:'x'}),/newer schema/);

env=boot();H=env.H;
assert.strictEqual(H.parseTimeText('26:52'),1612000);
assert.strictEqual(H.formatTimeMs(1612000),'26:52');
assert.strictEqual(H.formatDeltaMs(44000),'↑ 0:44');
assert.strictEqual(H.formatDeltaMs(-8000),'↓ 0:08');

console.log('hyrox_benchmark_history_test: comparison/PB/migration GREEN');
