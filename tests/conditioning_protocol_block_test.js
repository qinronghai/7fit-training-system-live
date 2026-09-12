const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
  'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js'
])load(file);

const Cond=window.V15ConditioningResolver,Dispatcher=window.V15TemplateResolver;

const block=Cond.resolveBlock({familyId:'CON-02',level:'L2',protocolId:'INTERVAL'});
assert.strictEqual(block.kind,'CONDITIONING_PROTOCOL_BLOCK');
assert.strictEqual(block.protocolId,'INTERVAL');
assert.strictEqual(block.publicBlock.items.length,block.metrics.stationCount);
assert.strictEqual(block.resolvedSelections.length,block.metrics.stationCount);
assert.strictEqual(new Set(block.resolvedSelections.map(x=>x.actionId)).size,block.metrics.stationCount);

const copy=Cond.serializeBlock(block);
assert.deepStrictEqual(copy,block);
copy.metrics.rounds=999;
assert.notStrictEqual(copy.metrics.rounds,block.metrics.rounds,'serialized block must be detached');

// Explicit legal protocol overrides the family default without mutating the default path.
const override=Dispatcher.resolve('conditioning',{familyId:'CON-01',level:'L1',protocolId:'INTERVAL'});
assert.strictEqual(override.domainContext.protocolId,'INTERVAL');
const defaultSession=Dispatcher.resolve('conditioning',{familyId:'CON-01',level:'L1'});
assert.strictEqual(defaultSession.domainContext.protocolId,'STEADY');

// Candidate API respects current used stations and never proposes duplicates.
const current=Object.fromEntries(block.resolvedSelections.map(x=>[x.key,x.actionId]));
const result=Cond.candidates({
  familyId:'CON-02',level:'L2',protocolId:'INTERVAL',stationKey:'STATION-1',currentSelections:current
});
const usedElsewhere=new Set(block.resolvedSelections.filter(x=>x.key!=='STATION-1').map(x=>x.actionId));
assert(result.candidates.length>0);
assert(result.candidates.every(c=>!usedElsewhere.has(c.actionId)));
assert(result.candidates.every(c=>Cond.isSelectionValid({
  familyId:'CON-02',level:'L2',protocolId:'INTERVAL',stationKey:'STATION-1',actionId:c.actionId
})));

console.log('conditioning_protocol_block_test: PASS');
