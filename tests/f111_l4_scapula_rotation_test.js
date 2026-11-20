const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const root = process.cwd();
global.window = global;
for (const file of [
  'data/system-data.js',
  'data/anatomy-data.js',
  'js/prep-grade.js',
  'js/anatomy.js',
  'js/prep-resolver.js',
]) {
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`, 'utf8'), { filename: file });
}

const D = window.V14_DATA;
const R = window.V14PrepResolver;

function resolve(recipeId, extra = {}) {
  return R.resolve(R.contextFromF111({ recipeId, level: 'L4', ...extra }));
}

function mobU(recipeId, extra = {}) {
  return resolve(recipeId, extra).slots.find(slot => slot.slotKey === 'MOB-U');
}

const recipesByUpper = {};
for (const recipeId of Object.keys(D.recipes || {})) {
  const upper = D.recipes[recipeId].upper;
  (recipesByUpper[upper] ||= []).push(recipeId);
}

for (const upper of ['水平拉', '垂直拉']) {
  const recipeIds = recipesByUpper[upper] || [];
  const families = recipeIds.map(recipeId => mobU(recipeId).movementFamily);
  assert(
    new Set(families).size >= Math.min(3, recipeIds.length),
    `${upper} L4 modules must rotate at least three shoulder-prep families: ${families.join(', ')}`
  );
}

const sequence = D.recipeIds.map(recipeId => ({
  recipeId,
  upper: D.recipes[recipeId].upper,
  slot: mobU(recipeId),
}));
const actionCounts = new Map();
sequence.forEach(item => actionCounts.set(item.slot.actionId, (actionCounts.get(item.slot.actionId) || 0) + 1));
assert(
  Math.max(...actionCounts.values()) <= 2,
  `L4 MOB-U exact action repetition must be <=2 across official modules: ${JSON.stringify(Object.fromEntries(actionCounts))}`
);
for (let index = 1; index < sequence.length; index += 1) {
  assert.notStrictEqual(
    sequence[index].slot.actionId,
    sequence[index - 1].slot.actionId,
    `adjacent L4 modules must not repeat the same MOB-U action: ${sequence[index - 1].recipeId} -> ${sequence[index].recipeId}`
  );
}

for (const upper of ['水平拉', '垂直拉', '水平推', '垂直推']) {
  const ctx = R.contextFromF111({
    recipeId: Object.keys(D.recipes).find(id => D.recipes[id].upper === upper),
    level: 'L4',
  });
  const families = new Set(R.rankSlotCandidates('MOB-U', ctx, { limit: 99 }).map(item => item.movementFamily));
  assert(
    families.has('mobility-scapula-circumduction') || families.has('activation-rotator-cuff'),
    `${upper} L4 MOB-U must expose a non-wall scapula/cuff rotation candidate`
  );
  if (upper === '水平推' || upper === '垂直推') {
    assert(
      families.has('activation-rotator-cuff'),
      `${upper} L4 MOB-U must expose rotator-cuff activation as a push alternative`
    );
  }
}

console.log('f111 L4 scapula rotation: PASS');
