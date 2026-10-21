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
