const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = { window: { V14CoachModules: { Common: { esc: value => String(value ?? '') } } }, console };
context.window.V14CoachModules.Common.D = () => context.window.V14_DATA;
for (const file of ['data/system-data.js', 'js/composer.js', 'js/coach/f111-compose-ui.js', 'js/coach/slot.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const resolved = context.window.V14Composer.resolve({
  level: 'L1', lowerMode: 'squat', upperMode: 'horizontal_pull', coreDemand: 'anti_extension',
});
const ctx = { resolved, level: 'L1' };
const groups = context.window.V14CoachModules.F111ComposeUI.actionGroups(ctx, 'C');
const allItems = groups.flatMap(group => group.items);
const advanced = allItems.find(item => item.id === 'SUP-S6-05');
assert(advanced, 'support drawer must show every manual support option');
assert.strictEqual(advanced.disabled, false, 'manual support options must not be disabled');
assert(advanced.detail.includes('疲劳'), 'support drawer must show fatigue information');
assert(advanced.detail.includes('需确认'), 'support drawer must show confirmation risk');

const supportSlot = resolved.slots.find(slot => slot.slotKey === 'C');
const card = context.window.V14CoachModules.Slot.composerCard({ resolved, level: 'L1', stateKey: 'test' }, supportSlot);
assert(card.includes('supportReason') || card.includes('符合当前等级首选窗口'), 'support card must show recommendation rationale');
assert(card.includes('memberFeeling') || card.includes('腹部'), 'support card must show member-facing feeling');
assert(card.includes('同目的替代'), 'support card must show same-demand alternatives');

console.log('support_ui_runtime_test: PASS');
