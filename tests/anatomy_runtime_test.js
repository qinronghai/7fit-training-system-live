const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const root = process.cwd();
global.window = global;
for (const file of ['data/system-data.js','data/anatomy-data.js','js/anatomy.js']) {
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`, 'utf8'), {filename:file});
}

assert(window.V14Anatomy, 'V14Anatomy must exist');

const out = V14Anatomy.aggregate(['hake_shendun', 'qixie_xiongtui']);
assert(out.primary.includes('股四头肌'));
assert(out.primary.includes('胸大肌'));
assert(out.scores['股四头肌'] >= 1.0);

const missing = V14Anatomy.aggregate(['UNKNOWN_ACTION']);
assert.deepStrictEqual(missing.unknownIds, ['UNKNOWN_ACTION']);

const labels = V14Anatomy.labels('hake_shendun');
assert.deepStrictEqual(labels.slice(0,3), ['主要肌群','辅助肌群','稳定肌群']);

const foam = V14Anatomy.rankFoam(['hake_shendun','qixie_xiongtui'], {limit:4});
assert(foam.includes('FOAM-09'), 'hack squat should surface anterior-thigh foam');
assert(foam.includes('FOAM-01'), 'chest press should surface chest foam');

const warm = V14Anatomy.rankWarmups(['hake_shendun','qixie_xiongtui'], {
  recipeId: 'F111-06',
  level: 'L3',
  tier: 'T3',
  limit: 6,
});
assert(warm.length > 0);
assert(warm.every(id => window.V14_DATA.warmupDetails[id]));

const sessionSummary = V14Anatomy.aggregateSession('F111-01-L1');
assert(sessionSummary.primary.length > 0);

const comparison = V14Anatomy.compareToBaseline('F111-01-L1', window.V14_DATA.sessions['F111-01-L1'].slots.map(s=>s.baselineId));
assert.deepStrictEqual(comparison.increases, []);

console.log('anatomy_runtime_test: PASS');

vm.runInThisContext(fs.readFileSync(`${root}/js/conflict.js`, 'utf8'), {filename:'js/conflict.js'});

const concentrationIds = window.V14_DATA.sessions['F111-01-L1'].slots.map(s=>s.baselineId);
concentrationIds[3] = 'hake_shendun';
concentrationIds[5] = 'CORE-L2-02';
const concentrationResult = window.V14Conflict.evaluate('F111-01-L1', concentrationIds);
assert.notStrictEqual(concentrationResult.status, 'FAIL');
assert(concentrationResult.issues.some(x => x.title === '肌群刺激集中' && x.text.includes('臀大肌')));

const savedAnatomy = window.V14Anatomy;
delete window.V14Anatomy;
const fallbackConflict = window.V14Conflict.evaluate('F111-01-L1');
assert(fallbackConflict && fallbackConflict.status);
window.V14Anatomy = savedAnatomy;

console.log('muscle_concentration_conflict_test: PASS');

const conditioningLabels = V14Anatomy.labels('huaxueji_jiange');
assert.deepStrictEqual(conditioningLabels.slice(0,3), ['主要参与肌群','协同参与肌群','稳定肌群']);

const strengthOnly = V14Anatomy.aggregate(['hake_shendun']);
const strengthPlusConditioning = V14Anatomy.aggregate(['hake_shendun','huaxueji_jiange']);
assert.strictEqual(strengthPlusConditioning.scores['股四头肌'], strengthOnly.scores['股四头肌']);
assert(strengthPlusConditioning.primary.includes('背阔肌'), 'conditioning anatomy should remain visible in human summary');

const stretchOnly = V14Anatomy.aggregate(['lashen_xiongjida']);
assert.deepStrictEqual(stretchOnly.scores, {}, 'stretch must not count toward muscle concentration score');
console.log('v146_role_filter_test: PASS');

vm.runInThisContext(fs.readFileSync(`${root}/js/views-maintenance.js`, 'utf8'), {filename:'js/views-maintenance.js'});
const coverage = window.V14Maintenance.anatomyCoverage();
assert.strictEqual(coverage.runtimeExpected, 243);
assert.strictEqual(coverage.runtimeCovered, 243);
assert.strictEqual(coverage.phaseA.covered, 120);
assert.strictEqual(coverage.phaseB.covered, 85);
assert.strictEqual(coverage.phaseC.covered, 34);
assert.strictEqual(coverage.uncoveredRuntime.length, 0);
console.log('v147_runtime_coverage_test: PASS');
