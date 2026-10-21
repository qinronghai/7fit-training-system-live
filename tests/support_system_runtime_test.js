const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = { window: {}, console };
vm.runInNewContext(fs.readFileSync('data/system-data.js', 'utf8'), context, {
  filename: 'data/system-data.js',
});
vm.runInNewContext(fs.readFileSync('js/composer.js', 'utf8'), context, {
  filename: 'js/composer.js',
});

const data = context.window.V14_DATA;
const composer = context.window.V14Composer;

assert(data.supportMeta, 'supportMeta must be available in runtime data');
assert.strictEqual(Object.keys(data.supportMeta).length, data.supportIds.length);

for (const id of data.supportIds) {
  const meta = data.supportMeta[id];
  assert(meta.supportDemand.length >= 1, `${id}: supportDemand missing`);
  assert(['low', 'medium', 'high'].includes(meta.fatigueCost), `${id}: fatigueCost invalid`);
  assert(meta.recommendedDose, `${id}: recommendedDose missing`);
  assert(meta.memberFeeling, `${id}: memberFeeling missing`);
  assert.strictEqual(meta.autoRecommendable, true, `${id}: must remain auto recommendable`);
}

const resolved = composer.resolve({
  level: 'L3',
  lowerMode: 'single_leg_hinge',
  upperMode: 'horizontal_push',
  coreDemand: 'anti_extension',
});
const support = resolved.slots.find(slot => slot.slotKey === 'C');
assert(support.supportReason, 'resolved support must include a recommendation reason');
assert(support.fatigueCost, 'resolved support must include fatigue cost');
assert(Array.isArray(support.alternatives), 'resolved support must include alternatives');
assert(support.alternatives.length >= 2, 'resolved support needs at least two alternatives');

const manual = composer.resolve({
  level: 'L1',
  lowerMode: 'squat',
  upperMode: 'horizontal_pull',
  coreDemand: 'anti_extension',
  selections: { C: 'SUP-S6-05' },
});
const manualSupport = manual.slots.find(slot => slot.slotKey === 'C');
assert.strictEqual(manualSupport.actionId, 'SUP-S6-05');
assert.strictEqual(manualSupport.needsConfirmation, true);
assert(manualSupport.tradeoffs.includes('超出当前等级常规窗口'));

const duplicate = composer.resolve({
  level: 'L1',
  lowerMode: 'squat',
  upperMode: 'horizontal_pull',
  coreDemand: 'anti_extension',
  selections: { C: 'SUP-S1-04', CORE: 'CORE-L1-01' },
});
const duplicateSupport = duplicate.slots.find(slot => slot.slotKey === 'C');
assert(duplicateSupport.tradeoffs.includes('与 CORE 训练任务重复'));

const conflictContext = { window: { V14_DATA: data }, console };
for (const file of ['js/conflict-core.js', 'js/conflict-service.js', 'js/conflict-plugins/f111.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), conflictContext, { filename: file });
}
const conflict = conflictContext.window.V15F111ConflictPlugin.evaluate(duplicate, { mode: 'composer', resolved: duplicate });
assert(conflict.some(issue => issue.code === 'SUPPORT_DEMAND_DUPLICATION'), 'duplicate support demand must be audited');

console.log('support_system_runtime_test: PASS');
