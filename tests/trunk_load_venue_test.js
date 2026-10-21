const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = { window: {}, console };
for (const file of ['data/system-data.js', 'js/composer.js', 'js/conflict-core.js', 'js/conflict-service.js', 'js/conflict-plugins/f111.js']) {
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}

const composer = context.window.V14Composer;
const high = composer.resolve({
  level: 'L3', lowerMode: 'single_leg_hinge', upperMode: 'horizontal_push', coreDemand: 'anti_extension',
  selections: { C: 'SUP-S3-04', CORE: 'CORE-L4-05' },
});
const load = composer.trunkLoadAudit(high.slots, 'L3');
assert(load.entries.every(entry => ['A', 'B', 'C', 'D1', 'D2', 'CORE'].includes(entry.slotKey)));
assert(load.total > load.budget, 'high-risk composition must exceed the trunk-load budget');
assert(load.overBudget, 'trunk-load audit must expose an over-budget state');

const venue = composer.resolve({
  level: 'L3', lowerMode: 'single_leg_hinge', upperMode: 'horizontal_push', coreDemand: 'anti_extension',
  selections: { C: 'SUP-S4-01', CORE: 'CORE-L3-03' },
});
const venueResult = context.window.V15F111ConflictPlugin.evaluate(venue, { mode: 'composer', resolved: venue });
assert(venueResult.some(issue => issue.code === 'VENUE_FEASIBILITY'), 'open-lane support/core actions must produce a venue warning');

const noMatch = composer.resolve({ level: 'L1', lowerMode: 'squat', upperMode: 'horizontal_pull', coreDemand: 'anti_rotation' });
const noMatchResult = context.window.V15F111ConflictPlugin.evaluate(noMatch, { mode: 'composer', resolved: noMatch });
assert(noMatchResult.some(issue => issue.code === 'CORE_DEMAND_UNAVAILABLE'));

const mismatch = composer.resolve({ level: 'L3', lowerMode: 'squat', upperMode: 'horizontal_pull', coreDemand: 'anti_rotation', selections: { CORE: 'CORE-L2-01' } });
const mismatchResult = context.window.V15F111ConflictPlugin.evaluate(mismatch, { mode: 'composer', resolved: mismatch });
assert(mismatchResult.some(issue => issue.code === 'CORE_DEMAND_MISMATCH'));

console.log('trunk_load_venue_test: PASS');
