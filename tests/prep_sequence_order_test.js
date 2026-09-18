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
const expected = [
  '动态90/90髋旋转转换',
  '四足跪姿胸椎旋转',
  '瑜伽球前臂平板支撑',
  '弹力带前平举位肩外旋',
  '轻量火箭推节奏',
];

const items = modules.Prep.resolvedItems(resolved);
assert.deepStrictEqual(plain(items.map(item => item.name)), expected, 'shared PREP items must follow floor-to-standing progression');

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
assertOrderedText(context.window.V14SessionCopy.formatMember(payload), ['90/90', '胸椎旋转', '平板支撑', '弹力带前平举位肩外旋', '轻量火箭推节奏'], 'member copy');
assertOrderedText(context.window.V14ModuleCopy.formatPrep({ title: 'F111-02｜L3', items }), expected, 'module copy');

console.log('prep sequence order: PASS');
