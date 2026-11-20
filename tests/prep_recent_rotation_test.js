const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
for(const file of ['data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js']){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

const D=window.V14_DATA,R=window.V14PrepResolver;
const recipes=Object.keys(D.recipes);

function resolve(recipeId,extra={}){
  return R.resolve(R.contextFromF111({recipeId,level:'L4',...extra}));
}

const all=recipes.flatMap(recipeId=>resolve(recipeId).slots);
const actionCounts=new Map();
const familyCounts=new Map();
all.forEach(slot=>{
  actionCounts.set(slot.actionId,(actionCounts.get(slot.actionId)||0)+1);
  const family=slot.movementFamily||slot.actionId;
  familyCounts.set(family,(familyCounts.get(family)||0)+1);
});

assert([...actionCounts.values()].every(count=>count<=4),
  `L4 default action repetition must be <=4: ${JSON.stringify(Object.fromEntries(actionCounts))}`);
assert([...familyCounts.values()].every(count=>count<=8),
  `L4 default family repetition must be <=8: ${JSON.stringify(Object.fromEntries(familyCounts))}`);
assert(familyCounts.size>=8,`L4 defaults must expose at least eight movement families: ${familyCounts.size}`);

const base=resolve('F111-01');
const withRecent=resolve('F111-01',{
  recentPrepActionIds:base.slots.map(slot=>slot.actionId),
  recentPrepFamilies:base.slots.map(slot=>slot.movementFamily),
});
const changed=withRecent.slots.filter((slot,index)=>slot.actionId!==base.slots[index].actionId);
assert(changed.length>=3,`recent PREP history must rotate at least three slots, changed ${changed.length}`);
assert(withRecent.slots.every(slot=>!base.slots.some(previous=>previous.actionId===slot.actionId)),
  'recent PREP actions must be avoided when legal alternatives exist');

console.log(`prep recent rotation: PASS (families=${familyCounts.size}, changed=${changed.length})`);
