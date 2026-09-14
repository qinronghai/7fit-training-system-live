const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');

const root=path.resolve(__dirname,'..');
const localMemory={};
const localStorage={
  getItem:key=>Object.prototype.hasOwnProperty.call(localMemory,key)?localMemory[key]:null,
  setItem:(key,value)=>{localMemory[key]=String(value);},
  removeItem:key=>{delete localMemory[key];},
};
const ctx={window:{localStorage},console,localStorage};
ctx.window.window=ctx.window;
vm.createContext(ctx);

for(const file of [
  'data/system-data.js',
  'js/resolved-session.js',
  'js/template-resolver.js',
  'js/resolvers/hyrox.js',
  'js/hyrox-benchmark-history.js',
]){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}

const R=ctx.window.V15TemplateResolver;
const H=ctx.window.V15HyroxBenchmarkHistory;
const plain=value=>JSON.parse(JSON.stringify(value));
const sledCalibration={
  SLED_PUSH:{calibratedLoadKg:42,targetRpe:7.5,calibrationVersion:'7fit-turf-v1'},
  SLED_PULL:{calibratedLoadKg:36,targetRpe:7.5,calibrationVersion:'7fit-turf-v1'},
};
const session=R.resolve('hyrox',{sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',sledCalibration});

H.clear();
assert.strictEqual(H.exportData().schemaVersion,1);
assert.deepStrictEqual(plain(H.list({})),[]);

const firstTimes={H1:120000,H2:90000,H3:100000,H4:110000,H5:125000,H6:80000,H7:90000,H8:100000};
const first=H.saveSessionResult(session,{
  recordId:'r1',athleteRef:'梦影',completedAt:'2026-09-01T10:00:00+08:00',
  totalTimeMs:900000,stationTimes:firstTimes,rpe:8,notes:'first',
});
assert.strictEqual(first.validityStatus,'VALID_NEW_BASELINE');
assert.strictEqual(first.baselineReason,'FIRST_BASELINE');
assert.strictEqual(H.getLastAthleteRef(),'梦影');

let summary=H.summary({athleteRef:'梦影',protocolId:'B3',comparisonKey:session.domainContext.benchmarkContext.comparisonKey});
assert.strictEqual(summary.sameComparisonCount,1);
assert.strictEqual(summary.previous,null);
assert.strictEqual(summary.pb.recordId,'r1');
assert.strictEqual(summary.current.recordId,'r1');

const secondTimes={H1:115000,H2:95000,H3:105000,H4:105000,H5:120000,H6:75000,H7:85000,H8:95000};
const second=H.saveSessionResult(session,{
  recordId:'r2',athleteRef:'梦影',completedAt:'2026-09-08T10:00:00+08:00',
  totalTimeMs:870000,stationTimes:secondTimes,rpe:8,
});
assert.strictEqual(second.validityStatus,'VALID_COMPARABLE');

summary=H.summary({athleteRef:'梦影',protocolId:'B3',comparisonKey:session.domainContext.benchmarkContext.comparisonKey});
assert.strictEqual(summary.current.recordId,'r2');
assert.strictEqual(summary.previous.recordId,'r1');
assert.strictEqual(summary.pb.recordId,'r2');
assert.strictEqual(summary.deltaVsPrevious,30000);
assert.strictEqual(summary.stationSummary.H2.deltaVsPrevious,-5000);
assert.strictEqual(summary.stationSummary.H1.deltaVsPrevious,5000);

const profile=H.abilityProfile(summary);
assert.strictEqual(profile.ready,true);
assert.strictEqual(profile.weakestGroup,'SLED');
assert(profile.groups.SLED.gapToPbPct>0);
const rec=H.recommendation(profile,'L3');
assert.strictEqual(rec.weakestGroup,'SLED');
assert(rec.primary.includes('SLED'));
assert(rec.secondary.includes('L3'));

const changedLoad=R.resolve('hyrox',{
  sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',sledCalibration,
  explicitLoads:{H6:14},
});
const changed=H.saveSessionResult(changedLoad,{
  recordId:'r3',athleteRef:'梦影',completedAt:'2026-09-10T10:00:00+08:00',
  totalTimeMs:880000,stationTimes:secondTimes,
});
assert.strictEqual(changed.validityStatus,'VALID_NEW_BASELINE');
assert.strictEqual(changed.baselineReason,'LOAD_CHANGED');
assert.notStrictEqual(changed.comparisonKey,second.comparisonKey);
assert.strictEqual(H.baselineReasonLabel(changed.baselineReason),'负重变化｜建立新基准');

const scaledSession=R.resolve('hyrox',{
  sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',sledCalibration,
  workOverrides:{H1:400},
});
const scaled=H.saveSessionResult(scaledSession,{
  recordId:'r4',athleteRef:'梦影',completedAt:'2026-09-11T10:00:00+08:00',
  totalTimeMs:850000,stationTimes:secondTimes,
});
assert.strictEqual(scaled.validityStatus,'SCALED');
const canonicalSummary=H.summary({athleteRef:'梦影',protocolId:'B3',comparisonKey:session.domainContext.benchmarkContext.comparisonKey});
assert.strictEqual(canonicalSummary.pb.recordId,'r2');

const incomplete=H.saveSessionResult(session,{
  recordId:'r5',athleteRef:'梦影',completedAt:'2026-09-12T10:00:00+08:00',
  totalTimeMs:860000,stationTimes:{H1:110000},
});
assert.strictEqual(incomplete.validityStatus,'INCOMPLETE');
assert.strictEqual(H.summary({athleteRef:'梦影',comparisonKey:session.domainContext.benchmarkContext.comparisonKey}).pb.recordId,'r2');

const other=H.saveSessionResult(session,{
  recordId:'a1',athleteRef:'源源',completedAt:'2026-09-12T11:00:00+08:00',
  totalTimeMs:910000,stationTimes:firstTimes,
});
assert.strictEqual(other.validityStatus,'VALID_NEW_BASELINE');
assert.strictEqual(H.summary({athleteRef:'源源',comparisonKey:session.domainContext.benchmarkContext.comparisonKey}).sameComparisonCount,1);
assert.strictEqual(H.summary({athleteRef:'梦影',comparisonKey:session.domainContext.benchmarkContext.comparisonKey}).sameComparisonCount,2);

assert.strictEqual(H.deleteRecord('r2','2026-09-13T10:00:00+08:00'),true);
assert.strictEqual(H.list({athleteRef:'梦影',comparisonKey:session.domainContext.benchmarkContext.comparisonKey}).some(r=>r.recordId==='r2'),false);
assert.strictEqual(H.list({athleteRef:'梦影',comparisonKey:session.domainContext.benchmarkContext.comparisonKey,includeDeleted:true}).some(r=>r.recordId==='r2'&&r.deletedAt),true);
assert.strictEqual(H.restoreRecord('r2'),true);
assert.strictEqual(H.list({athleteRef:'梦影',comparisonKey:session.domainContext.benchmarkContext.comparisonKey}).some(r=>r.recordId==='r2'),true);

assert.strictEqual(H.parseDuration('26:52'),1612000);
assert.strictEqual(H.parseDuration('81.5'),81500);
assert.strictEqual(H.parseDuration('bad'),null);
assert.strictEqual(H.formatDuration(1612000),'26:52');
assert.strictEqual(H.formatDuration(null),'—');
assert.strictEqual(H.formatDelta(30000),'↑ 0:30');
assert.strictEqual(H.formatDelta(-5000),'↓ 0:05');

assert.throws(()=>H.createRecord(session,{athleteRef:'',totalTimeMs:900000,stationTimes:firstTimes}),error=>error.code==='HYROX_HISTORY_ATHLETE_REQUIRED');
assert.throws(()=>H.createRecord(session,{athleteRef:'梦影',totalTimeMs:100000,stationTimes:firstTimes}),error=>error.code==='HYROX_HISTORY_TIME_INVALID');

const exported=H.exportData();
H.clear();
assert.strictEqual(H.list({}).length,0);
H.importData(exported);
assert.strictEqual(H.list({athleteRef:'梦影'}).length,5);

H.clear();
H.importData([{recordId:'legacy-1',completedAt:'2025-01-01T00:00:00Z',protocolId:'B3',totalTimeMs:999000}]);
const legacy=H.list({includeDeleted:true})[0];
assert.strictEqual(legacy.legacy,true);
assert.strictEqual(legacy.validityStatus,'INVALID_PROTOCOL');
assert.strictEqual(H.eligible(legacy),false);

console.log('hyrox_benchmark_history_test: PASS');
