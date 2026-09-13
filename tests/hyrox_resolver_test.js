const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');

const root=path.resolve(__dirname,'..');
const ctx={window:{},console};
ctx.window.window=ctx.window;
vm.createContext(ctx);

for(const file of [
  'data/system-data.js',
  'js/resolved-session.js',
  'js/template-resolver.js',
  'js/resolvers/hyrox.js',
]){
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
}

const D=ctx.window.V14_DATA;
const Contract=ctx.window.V15ResolvedSession;
const Dispatcher=ctx.window.V15TemplateResolver;
const Hyrox=ctx.window.V15HyroxResolver;

function plain(value){return JSON.parse(JSON.stringify(value));}
function expectCode(fn,code){
  let seen='';
  try{fn();}catch(error){seen=error&&error.code||'';}
  assert.strictEqual(seen,code,'expected '+code+', got '+seen);
}
const sledCalibration={
  SLED_PUSH:{calibratedLoadKg:42,targetRpe:7,calibrationVersion:'7fit-turf-v1'},
  SLED_PULL:{calibratedLoadKg:36,targetRpe:7,calibrationVersion:'7fit-turf-v1'},
};

assert.strictEqual(D.templateRegistry.hyrox.status,'ACTIVE');
assert.strictEqual(D.templateRegistry.hyrox.capabilities.prep,true);
assert.strictEqual(D.templateRegistry.hyrox.capabilities.copy,true);
assert.strictEqual(D.templateRegistry.hyrox.capabilities.save,true);
assert.strictEqual(Dispatcher.has('hyrox'),true);
assert(Hyrox&&typeof Hyrox.resolve==='function');

const mixedCounts={L1:3,L2:4,L3:5,L4:6};
const skillCounts={L1:3,L2:3,L3:4,L4:4};
const defaultBenchmark={L1:'B1',L2:'B2',L3:'B3',L4:'B4'};

for(const level of ['L1','L2','L3','L4']){
  const skill=Dispatcher.resolve('hyrox',{sessionType:'SKILL',level});
  assert.deepStrictEqual(plain(Contract.validate(skill)),{ok:true,errors:[]});
  assert.strictEqual(skill.main.kind,'PROTOCOL');
  assert.strictEqual(skill.domainContext.kind,'HYROX');
  assert.strictEqual(skill.domainContext.sessionType,'SKILL');
  assert.strictEqual(skill.domainContext.orderedStations.length,skillCounts[level]);
  assert(skill.domainContext.orderedStations.length>=3&&skill.domainContext.orderedStations.length<=4);

  const capacity=Dispatcher.resolve('hyrox',{sessionType:'CAPACITY',level,capacityFocus:'ENGINE'});
  assert.deepStrictEqual(plain(Contract.validate(capacity)),{ok:true,errors:[]});
  assert.strictEqual(capacity.domainContext.capacityFocus,'ENGINE');
  assert.deepStrictEqual(plain(capacity.domainContext.orderedStations),['H1','H5']);
  assert(capacity.domainContext.completionMetric.includes('ENGINE'));

  const mixed=Dispatcher.resolve('hyrox',{sessionType:'MIXED',level});
  assert.deepStrictEqual(plain(Contract.validate(mixed)),{ok:true,errors:[]});
  assert.strictEqual(mixed.domainContext.orderedStations.length,mixedCounts[level]);
  assert(mixed.domainContext.orderedStations.length<=6);
  const groups=new Set(mixed.domainContext.orderedStations.map(id=>{
    if(['H1','H5'].includes(id))return 'ENGINE';
    if(['H2','H3'].includes(id))return 'SLED';
    if(['H4','H6','H7'].includes(id))return 'LOCOMOTION';
    return 'BALL';
  }));
  assert(groups.size>=2);

  const benchmark=Dispatcher.resolve('hyrox',{sessionType:'BENCHMARK',level,sledCalibration});
  assert.deepStrictEqual(plain(Contract.validate(benchmark)),{ok:true,errors:[]});
  assert.strictEqual(benchmark.domainContext.benchmarkContext.protocolId,defaultBenchmark[level]);
  assert.deepStrictEqual(plain(benchmark.domainContext.orderedStations),['H1','H2','H3','H4','H5','H6','H7','H8']);
  assert.strictEqual(benchmark.main.content.blocks[0].items.length,8);
  assert(benchmark.domainContext.benchmarkContext.comparisonKey.startsWith('HYROX|'));
}

for(const protocolId of ['B1','B2','B3','B4']){
  const level={B1:'L1',B2:'L2',B3:'L3',B4:'L4'}[protocolId];
  const first=Dispatcher.resolve('hyrox',{sessionType:'BENCHMARK',level,benchmarkProtocolId:protocolId,sledCalibration});
  const second=Dispatcher.resolve('hyrox',{sessionType:'BENCHMARK',level,benchmarkProtocolId:protocolId,sledCalibration});
  assert.deepStrictEqual(plain(first),plain(second),'same HYROX input must resolve deterministically');
  assert.strictEqual(first.domainContext.benchmarkContext.protocolId,protocolId);
  assert.strictEqual(first.domainContext.benchmarkContext.canonical,true);
}

const b3=Dispatcher.resolve('hyrox',{sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',sledCalibration});
assert.strictEqual(b3.domainContext.turfLengthMeters,8);
assert.strictEqual(b3.domainContext.stations['STATION-1'].work.value,500);
assert.strictEqual(b3.domainContext.stations['STATION-2'].work.value,6);
assert.strictEqual(b3.domainContext.stations['STATION-2'].load.value,42);
assert.strictEqual(b3.domainContext.stations['STATION-2'].calibrationVersion,'7fit-turf-v1');
assert.strictEqual(b3.domainContext.stations['STATION-6'].load.value,16);
assert.strictEqual(b3.domainContext.stations['STATION-7'].load.value,10);
assert.strictEqual(b3.domainContext.stations['STATION-8'].load.value,4);
assert(b3.domainContext.stations['STATION-2'].prescription.includes('6 趟｜48m'));

const split=Dispatcher.resolve('hyrox',{
  sessionType:'MIXED',
  level:'L3',
  loadLevel:'L1',
  selections:['H1','H6','H8','H5','H4'],
});
assert.strictEqual(split.domainContext.level,'L3');
assert.strictEqual(split.domainContext.loadLevel,'L1');
assert.strictEqual(split.domainContext.stations['STATION-2'].work.value,8);
assert.strictEqual(split.domainContext.stations['STATION-2'].load.value,7);

const explicit=Dispatcher.resolve('hyrox',{
  sessionType:'MIXED',
  level:'L3',
  loadLevel:'L1',
  selections:['H1','H6','H8','H5','H4'],
  explicitLoads:{H6:12,H8:4},
});
assert.strictEqual(explicit.domainContext.stations['STATION-2'].load.value,12);
assert.strictEqual(explicit.domainContext.stations['STATION-2'].load.source,'explicit');

const scaled=Dispatcher.resolve('hyrox',{
  sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',sledCalibration,
  workOverrides:{H1:400},
  scaledVariants:{H4:'Step-back Burpee + Broad Jump'},
});
assert.strictEqual(scaled.domainContext.scaleStatus,'SCALED');
assert.strictEqual(scaled.domainContext.benchmarkContext.canonical,false);
assert.strictEqual(scaled.domainContext.benchmarkContext.newBaselineRequired,true);
assert.notStrictEqual(scaled.domainContext.benchmarkContext.comparisonKey,b3.domainContext.benchmarkContext.comparisonKey);
assert.strictEqual(scaled.domainContext.stations['STATION-4'].parentStationId,'H4');
assert.strictEqual(scaled.domainContext.stations['STATION-4'].scaledVariant,'Step-back Burpee + Broad Jump');

const changedLoad=Dispatcher.resolve('hyrox',{
  sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',sledCalibration,
  explicitLoads:{H6:14},
});
assert.notStrictEqual(changedLoad.domainContext.benchmarkContext.comparisonKey,b3.domainContext.benchmarkContext.comparisonKey);

const changedDensity=Dispatcher.resolve('hyrox',{sessionType:'BENCHMARK',level:'L3',benchmarkProtocolId:'B3',sledCalibration,restSecondsOverride:30});
assert.notStrictEqual(changedDensity.domainContext.benchmarkContext.comparisonKey,b3.domainContext.benchmarkContext.comparisonKey);
assert.strictEqual(changedDensity.domainContext.benchmarkContext.newBaselineRequired,true);

expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'BENCHMARK',level:'L3'}),'HYROX_SLED_CALIBRATION_REQUIRED');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'CAPACITY',level:'L2',capacityFocus:'SLED'}),'HYROX_SLED_CALIBRATION_REQUIRED');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'CAPACITY',level:'L2'}),'HYROX_CAPACITY_FOCUS_REQUIRED');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'CAPACITY',level:'L2',capacityFocus:'ENGINE',selections:['H1','H6']}),'HYROX_CAPACITY_FOCUS_MISMATCH');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'MIXED',level:'L4',selections:['H1','H4','H5','H6','H7','H8','H2'],sledCalibration}),'HYROX_STATION_COUNT_INVALID');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'MIXED',level:'L2',selections:['H1','H1','H4','H8']}),'HYROX_DUPLICATE_STATION');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'SKILL',level:'L1',selections:['RUN','H1','H8']}),'HYROX_RUN_UNSUPPORTED');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'BENCHMARK',level:'L3',sledCalibration,selections:['H1','H2','H3','H4','H5','H6','H7','H8']}),'HYROX_BENCHMARK_MUTATION');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'MIXED',level:'L2',availableStationIds:['H1','H5','H8']}),'HYROX_EQUIPMENT_UNAVAILABLE');
expectCode(()=>Dispatcher.resolve('hyrox',{sessionType:'SKILL',level:'L1',explicitLoads:{H1:10}}),'HYROX_LOAD_INVALID');

assert.strictEqual(Hyrox.isSelectionValid({sessionType:'MIXED',level:'L2',selections:['H1','H4','H5','H8']}),true);
assert.strictEqual(Hyrox.isSelectionValid({sessionType:'MIXED',level:'L2',selections:['H1','H5','H1','H5']}),false);
assert.strictEqual(Hyrox.isSelectionValid({sessionType:'BENCHMARK',level:'L2',selections:['H1']}),false);

console.log('HYROX resolver tests passed');
