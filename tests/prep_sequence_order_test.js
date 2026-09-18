const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const root = process.cwd();
const storage = {};
const sessionStorage = {
  getItem: key => storage[key] ?? null,
  setItem: (key, value) => { storage[key] = String(value); },
  removeItem: key => { delete storage[key]; },
};
const context = {
  window: {},
  sessionStorage,
  document: { body: { dataset: {} } },
  console,
  URLSearchParams,
  location: { hash: '' },
};
context.window.addEventListener = () => {};
vm.createContext(context);

for (const file of [
  'data/system-data.js',
  'data/anatomy-data.js',
  'js/state.js',
  'js/prep-grade.js',
  'js/anatomy.js',
  'js/prep-resolver.js',
  'js/composer.js',
  'js/resolved-session.js',
  'js/conflict-core.js',
  'js/conflict-service.js',
  'js/conflict-plugins/f111.js',
  'js/conflict.js',
  'js/template-resolver.js',
  'js/resolvers/f111.js',
  'js/recovery-matcher.js',
  'js/module-copy.js',
  'js/coach/common.js',
  'js/coach/slot.js',
  'js/coach/foam.js',
  'js/coach/prep.js',
  'js/coach/summary.js',
  'js/coach/conflict-view.js',
  'js/coach/session.js',
  'js/coach/composer-view.js',
  'js/session-copy.js',
]) {
  vm.runInContext(fs.readFileSync(`${root}/${file}`, 'utf8'), context, { filename: file });
}

const data = context.window.V14_DATA;
const modules = context.window.V14CoachModules;
const plain = value => JSON.parse(JSON.stringify(value));
const phases = new Set(['floor', 'floor-tool', 'standing', 'standing-dynamic']);
const unclassified = Object.entries(data.warmupDetails)
  .filter(([, detail]) => !phases.has(detail.sequencePhase))
  .map(([prepId]) => prepId);
assert.deepStrictEqual(unclassified, [], 'every PREP node must declare a teaching-sequence phase');
const sessionId = 'F111-02-L3';
const recipeId = 'F111-02';
const level = 'L3';
const selected = data.sessions[sessionId].slots.map(slot => slot.baselineId);
const resolved = modules.Prep.resolvePresetPrep(sessionId, recipeId, level, selected);
const items = modules.Prep.resolvedItems(resolved);
const expected = plain(items.map(item => item.name));
const phaseRank = { floor: 0, 'floor-tool': 1, standing: 2, 'standing-dynamic': 3 };
assert.strictEqual(expected.length, 5, 'shared PREP must resolve five warm-up items');
assert.strictEqual(new Set(expected).size, expected.length, 'shared PREP must not duplicate warm-up items');
assert(items.every(item => Number.isInteger(phaseRank[item.sequencePhase])), 'shared PREP items must expose known sequence phases');
assert(items.every((item, index) => index === 0 || phaseRank[item.sequencePhase] >= phaseRank[items[index - 1].sequencePhase]), 'shared PREP items must follow floor-to-standing progression');

const grid = modules.Prep.resolvedGrid(resolved, sessionId);
let previousIndex = -1;
for (const name of expected) {
  const index = grid.indexOf(`>${name}<`);
  assert(index > previousIndex, `PREP UI must render ${name} after the previous stage`);
  previousIndex = index;
}

const payload = modules.Session.buildCopyPayload(sessionId, recipeId, level);
assert.deepStrictEqual(plain(payload.warmups.map(item => item.name)), expected, 'coach/member copy payload must follow the same PREP order');

function assertOrderedText(text, names, label) {
  let previousIndex = -1;
  for (const name of names) {
    const index = text.indexOf(name);
    assert(index > previousIndex, `${label} must render ${name} after the previous warmup`);
    previousIndex = index;
  }
}

assertOrderedText(context.window.V14SessionCopy.formatCoach(payload), expected, 'coach copy');
const memberExpected = expected.map(name => {
  if (/90\s*\/\s*90/.test(name)) return '90/90';
  if (/青蛙趴/.test(name)) return '青蛙趴';
  if (/平板支撑/.test(name)) return '平板支撑';
  if (/胸椎旋转/.test(name)) return '胸椎旋转';
  return name.replace(/[（(].*?[）)]/g, '').replace(/^动态/, '').trim();
});
assertOrderedText(context.window.V14SessionCopy.formatMember(payload), memberExpected, 'member copy');
assertOrderedText(context.window.V14ModuleCopy.formatPrep({ title: 'F111-02｜L3', items }), expected, 'module copy');

console.log('prep sequence order: PASS');
