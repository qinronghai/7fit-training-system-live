const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/composer.js','js/resolved-session.js','js/conflict-core.js','js/conflict-service.js',
  'js/conflict-plugins/f111.js','js/conflict.js','js/template-resolver.js','js/resolvers/f111.js'
])load(file);

const D=window.V14_DATA,R=window.V15TemplateResolver,PR=window.V14PrepResolver;
const RECIPES=['F111-01','F111-02','F111-03','F111-04','F111-05','F111-06','F111-07','F111-08'];
const LEVELS=['L1','L2','L3','L4'];

/** The warm-up the coach sees for one preset, via the real resolver path. */
function warmup(recipeId,level){
  const session=R.resolve('f111',{mode:'preset',recipeId,level});
  const result=PR.resolve(session.prepContext,{selections:{}});
  return result.slots;
}
function signature(slots){return slots.map(slot=>slot.name||'—').join(' | ');}

// --- the eight presets must not share one warm-up ---------------------------
// Before this, the fit signal was inert: the anatomy layer names muscles while
// PREP nodes name areas, so every session scored 0–1 region hits and the sort
// fell through to the curated table — L3 shipped 2 warm-ups for 8 different main
// lifts. These floors sit just under what the resolver produces today.
const distinct={};
let total=0;
for(const level of LEVELS){
  const seen=new Set();
  for(const recipeId of RECIPES)seen.add(signature(warmup(recipeId,level)));
  distinct[level]=seen.size;
  total+=seen.size;
  assert(seen.size>=4,`${level} must vary across the 8 presets, saw ${seen.size}`);
}
assert(distinct.L1>=6,`L1 must vary across the presets, saw ${distinct.L1}`);
assert(distinct.L3>=5,`L3 was the worst case (2/8) and must stay fixed, saw ${distinct.L3}`);
assert(total>=20,`the 32 preset x level states must yield at least 20 warm-ups, saw ${total}`);

// --- every slot keeps its own character -------------------------------------
// `role` is the node's purpose; core work that merely lists 臀部 among its
// regions used to fill the hip/ankle slot (平板支撑交替抬腿 / 鸟狗式).
const CORE_ROLE=/核心|支撑|死虫|平板|腹壁|躯干/;
for(const level of LEVELS){
  for(const recipeId of RECIPES){
    const slots=warmup(recipeId,level);
    for(const slot of slots){
      if(slot.slotKey!=='MOB-L'&&slot.slotKey!=='MOB-U')continue;
      const node=D.warmupDetails[slot.prepId]||{};
      assert(!CORE_ROLE.test(String(node.role||'')),
        `${recipeId} ${level} ${slot.slotKey} must not be filled by core work (${slot.name})`);
    }
  }
}

// --- the fit follows the session's muscles, not the node's breadth ----------
// A hip-hinge day trains 腘绳肌 / 臀大肌; a squat day trains 股四头肌 / 内收肌群.
// Their warm-ups must differ, and each must contain an area it trains.
const hinge=warmup('F111-03','L3'),squat=warmup('F111-01','L3');
assert.notStrictEqual(signature(hinge),signature(squat),'a hinge day and a squat day must not share a warm-up');
function regionsOf(slots){return slots.map(slot=>(D.warmupDetails[slot.prepId]?.regions||[]).join(' ')).join(' ');}
assert(/腘绳|臀|髋/.test(regionsOf(hinge)),'the hinge day warm-up must address the posterior chain');
assert(/股四|内收|髋|膝|踝/.test(regionsOf(squat)),'the squat day warm-up must address the legs');

// --- the grade window is spread, not stacked on the top grade --------------
const l3Grades=warmup('F111-01','L3').map(slot=>slot.prepGrade);
assert(new Set(l3Grades).size>=2,`an L3 warm-up must not sit entirely on one grade, saw ${l3Grades.join(',')}`);
const l4Grades=warmup('F111-01','L4').map(slot=>slot.prepGrade);
assert(new Set(l4Grades).size>=2,`an L4 warm-up must not sit entirely on one grade, saw ${l4Grades.join(',')}`);

// --- determinism and manual selections still win ---------------------------
assert.strictEqual(signature(warmup('F111-01','L3')),signature(warmup('F111-01','L3')),'warm-ups must be deterministic');
const session=R.resolve('f111',{mode:'preset',recipeId:'F111-01',level:'L3'});
const free=PR.resolve(session.prepContext,{selections:{}});
const manualCandidate=free.slots[0].candidates?.find(candidate=>candidate.actionId!==free.slots[0].actionId);
if(manualCandidate){
  const pinned=PR.resolve(session.prepContext,{selections:{'MOB-L':{actionId:manualCandidate.actionId,source:'manual'}}});
  assert.strictEqual(pinned.slots[0].actionId,manualCandidate.actionId,'a manual pick must still be honoured');
}

console.log(`prep personalization runtime: PASS (${total}/32 distinct warm-ups; L1=${distinct.L1} L2=${distinct.L2} L3=${distinct.L3} L4=${distinct.L4})`);
