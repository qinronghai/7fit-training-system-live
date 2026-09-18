const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
for(const file of ['data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js']){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

const D=window.V14_DATA,R=window.V14PrepResolver;
assert(R,'V14PrepResolver must exist');

for(const prepId of ['PREP-19','PREP-20','PREP-24','PREP-27']){
  assert.strictEqual(
    D.warmupDetails[prepId]?.movementFamily,
    'plank-static',
    `${prepId} must declare the shared static-plank movement family`
  );
}

const ctx=R.normalizeContext({
  template:'f111',
  level:'L4',
  mainPatterns:['蹲','垂直推'],
});
const resolved=R.resolve(ctx);
const core=resolved.slots.find(slot=>slot.slotKey==='CORE-ACT');
const integrated=resolved.slots.find(slot=>slot.slotKey==='INTEGRATED');
const familyOf=slot=>D.warmupDetails[slot.prepId]?.movementFamily||slot.prepId;

assert.notStrictEqual(
  familyOf(core),
  familyOf(integrated),
  'CORE-ACT and INTEGRATED must not auto-resolve to the same movement family'
);

const families=resolved.slots.map(familyOf);
assert.strictEqual(
  new Set(families).size,
  families.length,
  `resolved PREP must not repeat movement families: ${families.join(', ')}`
);

console.log('prep_movement_family_diversity_test: PASS');
