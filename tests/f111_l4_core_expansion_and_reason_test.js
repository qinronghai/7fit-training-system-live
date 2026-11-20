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

const R = window.V14PrepResolver;
const recipes = ['F111-01', 'F111-02', 'F111-03', 'F111-04', 'F111-05', 'F111-06', 'F111-07', 'F111-08'];
const warmups = recipes.map(recipeId => R.resolve(R.contextFromF111({ recipeId, level: 'L4' })));

// The L4 core slot should expose a meaningful strategy rotation, not only
// repeated floor-based side planks and dead bugs.
const expectedCoreRotation = [
  '高位平板交替触肩',
  '鸟狗式',
  '弹力带站姿抗旋转保持',
  '轻负重农夫行走',
  '死虫式手臂交替伸展',
  '死虫式腿部交替伸展',
  '侧支撑穿针旋转',
  '侧平板髋部升降',
];
assert.deepStrictEqual(
  warmups.map(resolved => resolved.slots.find(slot => slot.slotKey === 'CORE-ACT')?.name || ''),
  expectedCoreRotation,
  'L4 CORE-ACT should rotate through the expanded core strategy set',
);

const allCoreCandidates = new Set(
  warmups.flatMap(resolved => resolved.slots.find(slot => slot.slotKey === 'CORE-ACT')?.candidates || [])
    .map(candidate => candidate.name),
);
for (const name of ['鸟狗式', '高位平板交替触肩', '弹力带站姿抗旋转保持', '轻负重农夫行走']) {
  assert(allCoreCandidates.has(name), `L4 CORE-ACT candidates must include ${name}`);
}

function slot(recipeId, slotKey) {
  const resolved = warmups[recipes.indexOf(recipeId)];
  return resolved.slots.find(item => item.slotKey === slotKey);
}

assert(/针对髋铰链/.test(slot('F111-03', 'PRIMER').matchReason), 'hinge primer should explain its main-pattern match');
assert(/针对垂直拉/.test(slot('F111-02', 'MOB-U').matchReason), 'vertical-pull mobility should explain its main-pattern match');
assert(/肩胛上旋准备/.test(slot('F111-01', 'MOB-U').matchReason), 'scapular upward-rotation prep should be explicit');
assert(/单腿骨盆控制/.test(slot('F111-05', 'PRIMER').matchReason), 'single-leg primer should explain pelvic-control intent');
assert(warmups.every(resolved => resolved.slots.every(item => item.matchReason)), 'every resolved warm-up card must expose a why reason');

console.log('f111 L4 core expansion and reasons: PASS');
