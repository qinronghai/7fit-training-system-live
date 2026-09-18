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
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`, 'utf8'), {filename: file});
}

const D = window.V14_DATA;
const A = window.V14_ANATOMY;
const G = window.V14PrepGrade;
const R = window.V14PrepResolver;

const dollSquat = D.warmupDetails['PREP-52'];
const swallowBalance = D.warmupDetails['PREP-53'];
const advancedScoop = D.warmupDetails['PREP-54'];

assert.strictEqual(dollSquat.name, '娃娃蹲');
assert.strictEqual(dollSquat.prepGrade, 'P1');
assert.deepStrictEqual(dollSquat.sessionLevels, ['L1', 'L2', 'L3', 'L4']);
assert(dollSquat.targetPatterns.includes('蹲'));

assert.strictEqual(swallowBalance.name, '单腿燕子平衡');
assert.strictEqual(swallowBalance.prepGrade, 'P3');
assert.deepStrictEqual(swallowBalance.sessionLevels, ['L3', 'L4']);
assert(swallowBalance.targetPatterns.includes('蹲'));
assert(swallowBalance.targetPatterns.includes('单腿'));

assert.strictEqual(advancedScoop.name, '单腿动态捞月（猴子捞月进阶）');
assert.strictEqual(advancedScoop.prepGrade, 'P3');
assert.deepStrictEqual(advancedScoop.sessionLevels, ['L3', 'L4']);
assert(advancedScoop.targetPatterns.includes('髋铰链'));
assert(!advancedScoop.targetPatterns.includes('蹲'), 'advanced scoop must stay hinge/single-leg specific');

for (const warmup of [dollSquat, swallowBalance, advancedScoop]) {
  assert(D.actions[warmup.actionId], `${warmup.actionId} action missing`);
  assert(A.records[warmup.actionId], `${warmup.actionId} anatomy missing`);
  assert(R.isPrepRouteAllowed(warmup.route), `${warmup.actionId} route must remain PREP-safe`);
}

assert(D.warmupMatchByPattern['蹲'].includes('PREP-52'));
assert(D.warmupMatchByPattern['蹲'].includes('PREP-53'));
assert(D.warmupMatchByPattern['髋铰链'].includes('PREP-54'));
assert(!D.warmupMatchByPattern['蹲'].includes('PREP-54'));

const squatL1 = window.V14Anatomy.rankWarmups(['tushen_shendun'], {
  level: 'L1',
  tier: 'T1',
  limit: 99,
});
assert(squatL1.includes('PREP-52'), 'L1 squat must expose doll squat');
assert(squatL1.includes('PREP-16'), 'L1 squat must retain lunge stretch visibility');
assert(!squatL1.includes('PREP-53'), 'P3 swallow balance must not leak into L1');

const hingeL4 = window.V14Anatomy.rankWarmups(['gangling_yingla'], {
  level: 'L4',
  tier: 'T4',
  limit: 12,
});
assert(hingeL4.includes('PREP-54'), 'L4 hinge must surface advanced scoop in the visible recommendation set');

const squatL4 = window.V14Anatomy.rankWarmups(['tushen_shendun'], {
  level: 'L4',
  tier: 'T4',
  limit: 99,
});
assert(!squatL4.includes('PREP-54'), 'hinge-specific advanced scoop must not leak into squat recommendations');

console.log('prep_hip_activation_test: PASS');
