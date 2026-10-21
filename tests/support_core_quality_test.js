const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = { window: {}, console };
vm.runInNewContext(fs.readFileSync('data/system-data.js', 'utf8'), context, { filename: 'data/system-data.js' });
vm.runInNewContext(fs.readFileSync('js/composer.js', 'utf8'), context, { filename: 'js/composer.js' });

const composer = context.window.V14Composer;

const noMatch = composer.coreDecision('L1', 'anti_rotation');
assert.strictEqual(noMatch.status, 'NO_MATCH', 'CORE must expose a no-match state instead of silently falling back');
assert.strictEqual(noMatch.exactCandidates.length, 0, 'no-match CORE demand must have no exact candidates');
assert(noMatch.fallbackCandidates.length > 0, 'coach must still receive same-level substitute candidates');

const noMatchResolved = composer.resolve({
  level: 'L1', lowerMode: 'squat', upperMode: 'horizontal_pull', coreDemand: 'anti_rotation',
});
const noMatchCore = noMatchResolved.slots.find(slot => slot.slotKey === 'CORE');
assert.strictEqual(noMatchCore.coreDemandMatch, 'NO_MATCH');
assert.strictEqual(noMatchCore.coreNeedsConfirmation, true);
assert(noMatchCore.coreTradeoffs.includes('当前等级没有该 CORE 任务动作'));

const progressive = composer.resolve({
  level: 'L4', lowerMode: 'squat', upperMode: 'horizontal_push', coreDemand: 'anti_extension',
});
assert.strictEqual(progressive.slots.find(slot => slot.slotKey === 'CORE').actionId, 'CORE-L4-03', 'L4 anti-extension should not regress to CORE-L2');

const actualCore = composer.resolve({
  level: 'L4', lowerMode: 'squat', upperMode: 'horizontal_push', coreDemand: 'anti_extension',
  selections: { CORE: 'CORE-L4-05' },
});
const actualSupport = actualCore.slots.find(slot => slot.slotKey === 'C');
assert(!actualSupport.tradeoffs.includes('与 CORE 训练任务重复'), 'support decision must use the actual selected CORE demand');

const complementary = composer.resolve({
  level: 'L1', lowerMode: 'squat', upperMode: 'horizontal_pull', coreDemand: 'anti_extension',
});
const complementarySupport = complementary.slots.find(slot => slot.slotKey === 'C');
assert.strictEqual(complementarySupport.grade, 'SUP-S2', 'complementarity must outrank the recommended support grade');
assert(!complementarySupport.supportDemand.includes('抗伸展'));

console.log('support_core_quality_test: PASS');
