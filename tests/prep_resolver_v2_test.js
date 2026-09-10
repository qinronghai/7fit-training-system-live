const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
for(const file of ['data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js']){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

const R=window.V14PrepResolver,D=window.V14_DATA;
assert(R,'V14PrepResolver must exist');
assert.deepStrictEqual(R.SLOT_ORDER,['MOB-L','MOB-U','PRIMER','CORE-ACT','INTEGRATED']);
assert.deepStrictEqual(R.CA_WINDOWS,{L1:['CA1'],L2:['CA2','CA1'],L3:['CA3','CA2','CA1'],L4:['CA4','CA3','CA2','CA1']});

for(const template of ['f111','body','conditioning']){
  const ctx=R.normalizeContext({template,level:'L3'});
  assert.strictEqual(ctx.template,template);
  assert.strictEqual(ctx.level,'L3');
  assert(Array.isArray(ctx.mainPatterns));
  assert(Array.isArray(ctx.mainActionIds));
  assert(Array.isArray(ctx.formalActionIds));
}

assert.strictEqual(R.isPrepRouteAllowed('2F PREP'),true);
assert.strictEqual(R.isPrepRouteAllowed('2F_ONLY'),true);
assert.strictEqual(R.isPrepRouteAllowed('FLEX_1F_2F'),true);
assert.strictEqual(R.isPrepRouteAllowed('1F_ONLY'),false);
assert.strictEqual(R.isActionPrepEligible({route:'2F_ONLY',prepEligible:true}),true);
assert.strictEqual(R.isActionPrepEligible({route:'2F_ONLY',usageDomains:['PREP']}),true);
assert.strictEqual(R.isActionPrepEligible({route:'2F_ONLY',warmupEligible:true}),true,'legacy warmupEligible remains an adapter signal');
assert.strictEqual(R.isActionPrepEligible({route:'2F_ONLY'}),false);
assert.strictEqual(R.isActionPrepEligible({route:'1F_ONLY',prepEligible:true}),false);

const session=D.sessions['F111-06-L3'];
const mainActionIds=session.slots.filter(s=>/^A｜|^B｜/.test(s.slotName)).map(s=>s.baselineId);
const f111=R.contextFromF111({level:'L3',recipeId:'F111-06',mainActionIds});
const resolved=R.resolve(f111);
assert.strictEqual(resolved.slots.length,5);
assert.deepStrictEqual(resolved.slots.map(s=>s.slotKey),R.SLOT_ORDER);
assert(resolved.slots.every(s=>s.actionId), 'all five functional slots need a resolved action for the F111 contract fixture');
assert.strictEqual(new Set(resolved.slots.map(s=>s.actionId)).size,5,'resolved PREP cannot duplicate actionId across slots');

const allowed=window.V14PrepGrade.allowedGrades('L3');
for(const slot of resolved.slots){
  assert(slot.candidates.length>0,`${slot.slotKey} needs candidates`);
  assert(slot.candidates.length<=5,`${slot.slotKey} candidate list is capped at five`);
  assert(slot.candidates.every(c=>allowed.includes(c.prepGrade)),`${slot.slotKey} must obey #24 P Grade window`);
  assert(slot.candidates.every(c=>R.isPrepRouteAllowed(c.route)),`${slot.slotKey} must obey PREP route gate`);
  if(slot.slotKey==='CORE-ACT'){
    assert(slot.candidates.every(c=>R.CA_WINDOWS.L3.includes(c.caLevel)), 'CORE-ACT must obey CA window');
  }
}

// Manual selection is a contract only in Phase A: valid manual survives; invalid manual falls back to auto.
const swappable=resolved.slots.find(s=>s.candidates.length>1);
assert(swappable,'fixture must expose at least one swappable slot');
const alternate=swappable.candidates.find(c=>c.actionId!==swappable.actionId);
const manualSelections={
  [swappable.slotKey]:{actionId:alternate.actionId,source:'manual'}
};
const manualResolved=R.resolve(f111,{selections:manualSelections});
const manualSlot=manualResolved.slots.find(s=>s.slotKey===swappable.slotKey);
assert.strictEqual(manualSlot.actionId,alternate.actionId);
assert.strictEqual(manualSlot.source,'manual');

const invalidResolved=R.resolve(f111,{selections:{[swappable.slotKey]:{actionId:'NOT_A_PREP',source:'manual'}}});
const invalidSlot=invalidResolved.slots.find(s=>s.slotKey===swappable.slotKey);
assert.notStrictEqual(invalidSlot.actionId,'NOT_A_PREP');
assert.strictEqual(invalidSlot.source,'auto');
assert.strictEqual(invalidSlot.fallbackReason,'manual-selection-ineligible');

// Formal training duplication is excluded from PREP when an alternative exists.
const coreSlot=resolved.slots.find(s=>s.slotKey==='CORE-ACT');
const noDuplicate=R.resolve({...f111,formalActionIds:[coreSlot.actionId]});
assert.notStrictEqual(noDuplicate.slots.find(s=>s.slotKey==='CORE-ACT').actionId,coreSlot.actionId);

// Deterministic: accidental source-array order may not change the resolved session.
const original=D.warmupIds.slice();
const before=R.resolve(f111).slots.map(s=>s.actionId);
D.warmupIds=original.slice().reverse();
const after=R.resolve(f111).slots.map(s=>s.actionId);
D.warmupIds=original;
assert.deepStrictEqual(after,before);

const selectionShape=R.normalizeSelections({
  'MOB-L':{actionId:'PREP-12',source:'manual'},
  'BAD-SLOT':{actionId:'PREP-01',source:'manual'}
});
assert.deepStrictEqual(Object.keys(selectionShape),['MOB-L']);
assert.deepStrictEqual(selectionShape['MOB-L'],{actionId:'PREP-12',source:'manual'});

console.log('prep_resolver_v2_test: PASS');
