const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = { window: { V14CoachModules: { Common: { esc: value => String(value ?? '') } } }, console };
context.window.V14CoachModules.Common.D = () => context.window.V14_DATA;
for (const file of ['data/system-data.js', 'js/composer.js', 'js/coach/f111-compose-ui.js', 'js/coach/slot.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const data = context.window.V14_DATA;
const composer = context.window.V14Composer;
assert.strictEqual(Object.keys(data.coreMeta).length, data.coreIds.length, 'every CORE action needs experience metadata');
for (const id of data.coreIds) {
  const meta = data.coreMeta[id];
  assert(data.coreBranches[id.slice(0, 7)], `${id}: branch missing`);
  assert(['low', 'medium', 'high'].includes(meta.fatigueCost), `${id}: fatigueCost invalid`);
  assert(meta.memberFeeling, `${id}: memberFeeling missing`);
  assert(meta.recommendedDose, `${id}: recommendedDose missing`);
  assert(Array.isArray(meta.jointLoad) && meta.jointLoad.length, `${id}: jointLoad missing`);
}
assert.deepStrictEqual(Object.keys(data.supportBranches).sort(), ['SUP-S1','SUP-S2','SUP-S3','SUP-S4','SUP-S5','SUP-S6']);
assert.strictEqual(composer.supportMetaFor('SUP-S4-01').branch, '位移支撑');
assert.strictEqual(composer.coreMetaFor('CORE-L3-01').branch, '多方向稳定');

const resolved = composer.resolve({ level: 'L1', lowerMode: 'squat', upperMode: 'horizontal_pull', coreDemand: 'anti_rotation' });
const core = resolved.slots.find(slot => slot.slotKey === 'CORE');
assert(core.coreBranch && core.coreMemberFeeling && core.coreFatigueCost, 'resolved CORE must expose coaching metadata');
assert(core.coreNeedsConfirmation, 'no-match CORE should require coach confirmation');

const ctx = { resolved, level: 'L1', coreDemand: 'anti_rotation' };
const coreGroup = context.window.V14CoachModules.F111ComposeUI.actionGroups(ctx, 'CORE');
const coreItem = coreGroup.flatMap(group => group.items).find(item => item.id === core.actionId);
assert(coreItem.detail.includes('疲劳'), 'CORE drawer must show fatigue');
assert(coreItem.detail.includes('会员感受'), 'CORE drawer must show member experience');
const card = context.window.V14CoachModules.Slot.composerCard(ctx, core);
assert(card.includes('composer-core-info'), 'CORE card must show coaching metadata');
assert(card.includes('当前等级没有该 CORE 任务动作'), 'CORE card must expose no-match confirmation');

console.log('core_metadata_ui_test: PASS');
