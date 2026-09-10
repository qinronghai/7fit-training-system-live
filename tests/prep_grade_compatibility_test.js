const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const root = process.cwd();
global.window = global;
for (const file of ['data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js']) {
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`, 'utf8'), {filename:file});
}

assert(window.V14PrepGrade, 'V14PrepGrade contract must exist');
assert(window.V14Anatomy, 'V14Anatomy must exist');

const expected = {
  L1: ['P1'],
  L2: ['P2','P1'],
  L3: ['P3','P2','P1'],
  L4: ['P4','P3','P2','P1'],
};
const gradeOf = id => window.V14_DATA.warmupDetails[id]?.prepGrade;

for (const [level, grades] of Object.entries(expected)) {
  assert.deepStrictEqual(V14PrepGrade.allowedGrades(level), grades, `${level} compatibility window`);
  for (const grade of ['P1','P2','P3','P4']) {
    assert.strictEqual(V14PrepGrade.isAllowed(level, grade), grades.includes(grade), `${level} ${grade} legality`);
  }

  const ranked = V14Anatomy.rankWarmups([], {level, tier:'T4', limit:99});
  assert(ranked.length > 0, `${level} should expose PREP candidates`);
  assert(ranked.every(id => grades.includes(gradeOf(id))), `${level} must not expose upward PREP grades`);

  const order = ranked.map(id => grades.indexOf(gradeOf(id)));
  for (let i = 1; i < order.length; i++) {
    assert(order[i] >= order[i - 1], `${level} candidates must sort current grade first, then downward`);
  }
}

assert.deepStrictEqual(V14PrepGrade.sessionLevelsForGrade('P1'), ['L1','L2','L3','L4']);
assert.deepStrictEqual(V14PrepGrade.sessionLevelsForGrade('P2'), ['L2','L3','L4']);
assert.deepStrictEqual(V14PrepGrade.sessionLevelsForGrade('P3'), ['L3','L4']);
assert.deepStrictEqual(V14PrepGrade.sessionLevelsForGrade('P4'), ['L4']);

// Main Tier can influence the representative strength action, but it must not be a PREP legality gate.
const l1AtT4 = V14Anatomy.rankWarmups(['hake_shendun'], {level:'L1', tier:'T4', limit:99});
assert(l1AtT4.length > 0);
assert(l1AtT4.every(id => gradeOf(id) === 'P1'), 'L1 remains P1-only even when the main action context is T4');

// The compatibility result must not depend on accidental warmupIds array order.
const originalIds = window.V14_DATA.warmupIds.slice();
const before = V14Anatomy.rankWarmups(['hake_shendun'], {level:'L4', tier:'T4', limit:99});
window.V14_DATA.warmupIds = originalIds.slice().reverse();
const after = V14Anatomy.rankWarmups(['hake_shendun'], {level:'L4', tier:'T4', limit:99});
window.V14_DATA.warmupIds = originalIds;
assert.deepStrictEqual(after, before, 'ranking must be deterministic when warmupIds order changes');

console.log('prep_grade_compatibility_test: PASS');
