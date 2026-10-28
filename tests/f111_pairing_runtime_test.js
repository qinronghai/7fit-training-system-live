const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// Overnight F111 pairing fixes (see report):
// - D1 auto-pick follows the lower-assistance recommendationScore, not the
//   legacy pool order that previously forced the first legacy id first.
// - D2 auto-pick prefers a target-disjoint isolation/accessory over
//   reloading B's prime movers; manual selections are untouched.
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['data/system-data.js', 'js/composer.js', 'js/lower-assistance.js']) {
  vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
}
const C = ctx.window.V14Composer;
const LA = ctx.window.V15LowerAssistance;
const slot = (r, key) => r.slots.find((s) => s.slotKey === key);

// Squat L3: D1 must complement (hamstring) instead of reloading quads,
// and D2 must complement a bench press (lateral delt) instead of
// reloading triceps.
const sqHp = C.resolve({ level: 'L3', lowerMode: 'squat', upperMode: 'horizontal_push', coreDemand: 'anti_extension' });
assert.strictEqual(slot(sqHp, 'D1').actionId, 'tui_wanju');
assert.strictEqual(slot(sqHp, 'D2').actionId, 'shengsuo_cepingju');
// Hinge L3: the mirror image — D1 must complement with quads.
const hgHp = C.resolve({ level: 'L3', lowerMode: 'hinge', upperMode: 'horizontal_push', coreDemand: 'anti_extension' });
assert.strictEqual(slot(hgHp, 'D1').actionId, 'tui_qushen');
// Lower-assistance recommended is now the top-scored candidate, not legacy.
const d1 = LA.candidates({ consumer: 'F111_D1', level: 'L3', lowerMode: 'squat', currentActionIds: [], currentSelections: {} });
assert.strictEqual(d1.recommended, d1.candidates[0].actionId);
assert(d1.candidates[0].recommendationScore >= d1.candidates[d1.candidates.length - 1].recommendationScore);
// Manual D2 selection is preserved exactly.
const manual = C.resolve({ level: 'L3', lowerMode: 'squat', upperMode: 'horizontal_push', coreDemand: 'anti_extension', selections: { D2: 'shengsuo_santou_xiaya' } });
assert.strictEqual(slot(manual, 'D2').actionId, 'shengsuo_santou_xiaya');
// All 80 free combinations still resolve all six slots.
for (const level of ['L1', 'L2', 'L3', 'L4']) {
  for (const lowerMode of Object.keys(ctx.window.V14_DATA.composer.lowerModes)) {
    for (const upperMode of Object.keys(ctx.window.V14_DATA.composer.upperModes)) {
      const r = C.resolve({ level, lowerMode, upperMode, coreDemand: 'anti_extension' });
      assert.strictEqual(r.slots.length, 6);
      assert(r.slots.every((s) => s.actionId), `${level} ${lowerMode} ${upperMode}: missing slot`);
    }
  }
}
console.log('f111 pairing: PASS');
