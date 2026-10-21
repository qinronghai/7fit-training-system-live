const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = { window: {}, console };
vm.runInNewContext(fs.readFileSync('data/system-data.js', 'utf8'), context, { filename: 'data/system-data.js' });
vm.runInNewContext(fs.readFileSync('js/composer.js', 'utf8'), context, { filename: 'js/composer.js' });

const composer = context.window.V14Composer;
const recentContext = {
  recentActions: [
    { actionId: 'SUP-S2-01', actionNameSnapshot: '四足跪姿单手抬起', sessionsAgo: 0, countLast3: 1 },
    { actionId: 'CORE-L2-01', actionNameSnapshot: '死虫式', sessionsAgo: 0, countLast3: 2 },
  ],
};

const resolved = composer.resolve({
  level: 'L2',
  lowerMode: 'squat',
  upperMode: 'horizontal_pull',
  coreDemand: 'anti_extension',
  recentContext,
});
const support = resolved.slots.find(slot => slot.slotKey === 'C');
const core = resolved.slots.find(slot => slot.slotKey === 'CORE');

assert.notStrictEqual(support.actionId, 'SUP-S2-01', 'auto support must avoid the exact support action used in the recent-three context');
assert.strictEqual(support.recentlyUsed, true, 'support should expose recent-three history metadata');
assert(support.recentNote, 'support should explain recent support-task history when applicable');
assert.notStrictEqual(core.actionId, 'CORE-L2-01', 'auto CORE should avoid the exact CORE action used in the recent-three context');
assert.strictEqual(core.recentlyUsed, true, 'CORE should expose recent-three history metadata');
assert(core.historyNote, 'CORE should explain recent CORE-task history when applicable');

const manual = composer.resolve({
  level: 'L2',
  lowerMode: 'squat',
  upperMode: 'horizontal_pull',
  coreDemand: 'anti_extension',
  recentContext,
  selections: { C: 'SUP-S2-01', CORE: 'CORE-L2-01' },
});
const manualSupport = manual.slots.find(slot => slot.slotKey === 'C');
const manualCore = manual.slots.find(slot => slot.slotKey === 'CORE');
assert.strictEqual(manualSupport.actionId, 'SUP-S2-01', 'coach must retain manual control over recent support actions');
assert.strictEqual(manualCore.actionId, 'CORE-L2-01', 'coach must retain manual control over recent CORE actions');
assert(manualSupport.recentNote.includes('该支撑动作'));
assert(manualCore.historyNote.includes('该 CORE 动作'));

console.log('member_diversity_composer_test: PASS');
