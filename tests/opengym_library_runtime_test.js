const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/template-search.js', 'utf8');
const sandbox = {
  window: {
    V14_DATA: {
      actions: {
        formal_row: { id: 'formal_row', name: '正式划船', pattern: '水平拉', equipment: '低位划船一体机' },
      },
      actionDetails: {},
      sessions: {},
      sessionViews: {},
      composer: {},
      recipes: {},
      bodyFamilyIds: [],
      conditioningFamilyIds: [],
      hyroxSessionTypes: {},
      hyroxBenchmarkProtocolIds: [],
      templateRegistry: {},
    },
    V14_OPENGYM: {
      candidates: [{
        id: 'opengym-0534',
        sourceExerciseId: '0534',
        name: 'kettlebell goblet squat',
        bodyPart: 'upper legs',
        equipment: 'kettlebell',
        target: 'glutes',
        secondaryMuscles: ['quadriceps'],
        category: 'strength',
        description: 'A kettlebell squat.',
        instructions: ['Stand tall.', 'Squat with control.'],
        mapping: { equipmentId: 'eq-kb', pattern: '蹲', patterns: ['蹲'] },
        reviewStatus: '待人工验收',
        autoCompileEligible: false,
        media: { status: 'not-imported' },
      }],
    },
    V14Anatomy: { get: () => ({}) },
    V14Composer: { combinations: () => [] },
  },
};
vm.runInNewContext(source, sandbox, { filename: 'js/template-search.js' });

const results = sandbox.window.V15TemplateSearch.search({
  q: 'kettlebell goblet squat',
  kind: 'action',
  source: 'opengym',
});
assert.strictEqual(results.length, 1);
assert.strictEqual(results[0].kind, 'opengym-action');
assert.strictEqual(results[0].id, 'opengym-0534');
assert.strictEqual(sandbox.window.V15TemplateSearch.kindGroup('opengym-action'), 'action');
assert.strictEqual(sandbox.window.V15TemplateSearch.search({ source: 'formal', kind: 'action' }).length, 1);

console.log('opengym library runtime: PASS');
