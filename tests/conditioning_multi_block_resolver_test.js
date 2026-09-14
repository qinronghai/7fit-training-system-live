const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
  'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js'
])load(file);

const D=window.V14_DATA,R=window.V15TemplateResolver,Cond=window.V15ConditioningResolver;
const levels=['L1','L2','L3','L4'];
const expectedBlocks={L1:2,L2:3,L3:3,L4:3};

for(const familyId of D.conditioningFamilyIds){
  for(const level of levels){
    const session=R.resolve('conditioning',{familyId,level,variantId:'A'});
    assert.strictEqual(session.schemaVersion,2,`${familyId} ${level} schema version`);
    assert.strictEqual(session.resolverVersion,'conditioning-v2');
    assert.strictEqual(session.sessionBlueprintId,`${familyId}-${level}-A`);
    assert.strictEqual(session.variantId,'A');
    assert.strictEqual(session.blocks.length,expectedBlocks[level]);
    assert.deepStrictEqual(session.blocks.map(block=>block.key),['BLOCK-A','BLOCK-B','BLOCK-C'].slice(0,expectedBlocks[level]));
    assert.strictEqual(session.main.content.blocks.length,expectedBlocks[level]);
    assert.strictEqual(session.domainContext.blocks.length,expectedBlocks[level]);
    assert(session.blocks.every(block=>block.goal&&block.coachingCues.length&&block.scaleRules.length&&block.stopCriteria.length&&block.completionMetric));
    const stationKeys=session.resolvedSelections.map(item=>item.key);
    assert(stationKeys.every(key=>/^BLOCK-[ABC]\/STATION-\d+$/.test(key)),`${familyId} ${level} stations must be block namespaced`);
    assert.strictEqual(new Set(stationKeys).size,stationKeys.length);
    assert(session.timing.prepMinutes>=10);
    assert(session.timing.recoveryMinutes>=5);
    assert(session.timing.fullSessionMinutes>session.timing.mainTrainingMinutes);
    assert(['PASS','WARN'].includes(session.conflictContext.status),`${familyId} ${level} baseline conflict failed`);
    assert(!JSON.stringify(session).includes('POST_CARDIO_ONLY'));
    assert.deepStrictEqual(R.resolve('conditioning',{familyId,level,variantId:'A'}),session,'same blueprint must be deterministic');
  }
}

const con04=R.resolve('conditioning',{familyId:'CON-04',level:'L3',variantId:'A'});
const flattened=con04.blocks.flatMap(block=>Object.values(block.stations));
const firstHighFatigue=flattened.findIndex(station=>station.fatigueRisk==='high');
assert(firstHighFatigue>=0,'CON-04 must expose a measurable high-fatigue endpoint');
assert(flattened.slice(firstHighFatigue+1).every(station=>station.fatigueRisk==='high'),'power challenge must end the high-fatigue tail');

const base=R.resolve('conditioning',{familyId:'CON-03',level:'L3',variantId:'A'});
const baselineIds=Object.fromEntries(base.resolvedSelections.map(item=>[item.key,item.actionId]));
const first=base.resolvedSelections.find(item=>item.key==='BLOCK-B/STATION-1');
const candidate=Cond.candidates({
  familyId:'CON-03',level:'L3',protocolId:base.blocks.find(block=>block.key==='BLOCK-B').protocolId,
  stationKey:first.key,currentSelections:baselineIds,
}).candidates.find(item=>item.actionId!==first.actionId);
assert(candidate,'multi-block station must retain a legal replacement path');
const swapped=R.resolve('conditioning',{
  familyId:'CON-03',level:'L3',variantId:'A',
  selections:{[first.key]:{actionId:candidate.actionId,source:'manual'}},
});
assert.strictEqual(swapped.resolvedSelections.find(item=>item.key===first.key).actionId,candidate.actionId);
assert.strictEqual(swapped.resolvedSelections.find(item=>item.key===first.key).source,'manual');
assert(!['FAIL'].includes(swapped.conflictContext.status));
assert.notDeepStrictEqual(swapped.anatomyContext,base.anatomyContext,'cross-block swap must refresh derived anatomy');

console.log('conditioning_multi_block_resolver_test: PASS');
