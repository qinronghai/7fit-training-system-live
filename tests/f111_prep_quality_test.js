const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const root = process.cwd();
global.window = global;
for (const file of [
  'data/system-data.js',
  'data/anatomy-data.js',
  'js/prep-grade.js',
  'js/anatomy.js',
  'js/prep-resolver.js',
]) {
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`, 'utf8'), { filename: file });
}

const D = window.V14_DATA;
const R = window.V14PrepResolver;
const PHASE_RANK = { floor: 0, 'floor-tool': 1, standing: 2, 'standing-dynamic': 3 };
const levels = ['L1', 'L2', 'L3', 'L4'];

function ordered(slots) {
  return slots.slice().sort((a, b) => PHASE_RANK[a.sequencePhase] - PHASE_RANK[b.sequencePhase]);
}

for (const recipeId of Object.keys(D.recipes)) {
  for (const level of levels) {
    const resolved = R.resolve(R.contextFromF111({ recipeId, level }));
    assert.strictEqual(resolved.slots.length, 5, `${recipeId}-${level} must have five PREP slots`);
    assert(resolved.slots.every(slot => slot.actionId), `${recipeId}-${level} must resolve every PREP slot`);
    assert(resolved.estimatedMinutes >= 6 && resolved.estimatedMinutes <= 12,
      `${recipeId}-${level} PREP estimate must stay within 6–12 minutes: ${resolved.estimatedMinutes}`);

    const core = resolved.slots.find(slot => slot.slotKey === 'CORE-ACT');
    assert(!/划船机|滑雪机|火箭推|药球|弓步配合上举|燕子|髋飞机|单腿臀桥/.test(core.name),
      `${recipeId}-${level} CORE-ACT must remain low-fatigue core/trunk work: ${core.name}`);

    const integrated = resolved.slots.find(slot => slot.slotKey === 'INTEGRATED');
    assert.strictEqual(integrated.sequencePhase, 'standing-dynamic',
      `${recipeId}-${level} INTEGRATED must finish in standing-dynamic: ${integrated.name}`);
    assert(/整合|全身|周期性器械|划船机|滑雪机|单腿|髋.*动态|踝.*动态|动态活动|模式准备|深蹲.*活动|后侧链动态|侧向髋|弓步|最伟大伸展/.test(integrated.name + integrated.role),
      `${recipeId}-${level} INTEGRATED must be a genuine whole-body or specific dynamic preparation: ${integrated.name}`);
    assert(!/药球|壶铃高脚杯深蹲到推举|火箭推/.test(integrated.name),
      `${recipeId}-${level} INTEGRATED must be a genuine whole-body or specific dynamic preparation: ${integrated.name}`);

    const sequence = ordered(resolved.slots);
    assert.strictEqual(sequence.at(-1).sequencePhase, 'standing-dynamic',
      `${recipeId}-${level} PREP must end with standing-dynamic`);
  }
}

const singleSide = R.contextFromF111({
  recipeId: 'F111-04',
  level: 'L3',
  coreDemands: ['抗侧屈 / 负重整合'],
});
assert(singleSide.supportPatterns.includes('单侧支撑'), 'F111 context must retain support mode');
assert(singleSide.coreDemands.includes('抗侧屈 / 负重整合'), 'F111 context must retain core demand');

console.log('f111_prep_quality_test: PASS');

// Audit the actual selected A/B and assistance slots for presets and free classes.
for(const file of ['js/composer.js','js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/f111.js','js/conflict.js','js/template-resolver.js','js/resolvers/f111.js']){
  vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
}
const courses=[];
for(const level of levels){
  for(const c of V14Composer.combinations())courses.push(V15TemplateResolver.resolve('f111',{mode:'composer',level,...c}));
  for(const recipeId of Object.keys(D.recipes))courses.push(V15TemplateResolver.resolve('f111',{mode:'preset',recipeId,level}));
}
for(const course of courses){
  const ctx=course.prepContext;
  const base=R.resolve(ctx);
  assert(base.slots.every(slot=>slot.candidates.some(choice=>choice.actionId!==slot.actionId)),course.title+' must offer a replacement for every warm-up');
  assert.notStrictEqual(base.slots.at(-1).movementFamily,'mobility-ankle');
  assert.deepStrictEqual(course.main.content.map(slot=>slot.label.split('｜')[0]),['A','B','D2','D1','C','CORE']);
  for(const slot of course.main.content){
    const dose=(D.coreMeta[slot.actionId]||D.supportMeta[slot.actionId])?.recommendedDose;
    if(dose)assert.strictEqual(slot.prescription,dose,slot.name);
  }
  assert(base.slots.every(s=>s.actionId && R.isPrepRouteAllowed(s.route) && V14PrepGrade.isAllowed(ctx.level,s.prepGrade)),course.title);
  assert(base.slots.some(s=>s.matchReason.includes('辅项')),course.title+' must prepare for at least one assistance exercise');
  const mobility=base.slots.filter(s=>s.slotKey==='MOB-L'||s.slotKey==='MOB-U');
  for(const s of mobility){
    assert(s.matchReason.includes('主项') && ctx.mainActionIds.some(id=>s.matchReason.includes(D.actions[id].name)),s.matchReason);
  }
  for(const slot of base.slots){
    const otherSlots=base.slots.filter(item=>item!==slot);
    const alternatives=slot.candidates.filter(item=>item.actionId!==slot.actionId);
    for(const choice of alternatives){
      assert(choice.mainFit||choice.auxFit,choice.name+' must serve this F111 course');
      assert(!otherSlots.some(other=>other.actionId===choice.actionId||other.movementFamily===choice.movementFamily),choice.name+' already appears elsewhere in the warm-up');
      assert(choice.replacementDetail.includes('主项 ·')||choice.replacementDetail.includes('辅项 ·'),choice.name);
      if(slot.slotKey==='INTEGRATED')assert.notStrictEqual(choice.movementFamily,'mobility-ankle');
    }
    assert(!/辅项「[^」]*(弯举|三头下压)」也需要回放到头顶/.test(slot.matchReason),slot.matchReason);
  }
  const taps=base.slots.find(s=>s.prepId==='PREP-22');
  if(taps)assert(taps.matchReason.includes('支撑手推地') && /主项|辅项/.test(taps.matchReason));
  const next=R.resolve({...ctx,recentPrepActionIds:base.slots.map(s=>s.actionId),recentPrepFamilies:base.slots.map(s=>s.movementFamily)});
  assert(next.slots.some((s,i)=>s.actionId!==base.slots[i].actionId),course.title);
}
console.log('F111 course-aware PREP:',courses.length,'courses with actual main lifts checked');
