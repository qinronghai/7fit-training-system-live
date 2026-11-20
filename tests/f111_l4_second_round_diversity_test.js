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

const R = window.V14PrepResolver;
const recipes = ['F111-01', 'F111-02', 'F111-03', 'F111-04', 'F111-05', 'F111-06', 'F111-07', 'F111-08'];
const warmups = recipes.map(recipeId => R.resolve(R.contextFromF111({ recipeId, level: 'L4' })));

function slotValues(slotKey, field = 'name') {
  return warmups.map(resolved => resolved.slots.find(slot => slot.slotKey === slotKey)?.[field] || '');
}

function counts(values) {
  return values.reduce((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function assertNoCountAbove(values, max, label) {
  for (const [value, count] of Object.entries(counts(values))) {
    assert(count <= max, `${label} repeated ${count} times: ${value}`);
  }
}

// The second anti-repetition pass must spread L4 core strategies instead of
// letting side-plank hip lifts occupy half of the eight official modules.
const coreNames = slotValues('CORE-ACT');
assertNoCountAbove(coreNames, 2, 'CORE-ACT');
assert(new Set(coreNames).size >= 4, `L4 CORE-ACT needs at least four strategies, saw ${new Set(coreNames).size}`);
for (let index = 1; index < coreNames.length; index += 1) {
  assert.notStrictEqual(coreNames[index], coreNames[index - 1], 'adjacent L4 modules must not repeat CORE-ACT');
}

// Machines remain the best fit for pull patterns, but one module in each pull
// family may use a low-fatigue full-body alternative so rower/ski are not the
// only integrated ending members ever see.
const integratedNames = slotValues('INTEGRATED');
assertNoCountAbove(integratedNames, 2, 'INTEGRATED');
for (const [upper, expectedMachine] of [['水平拉', '划船机低强度热身'], ['垂直拉', '滑雪机低强度热身']]) {
  const peerNames = warmups
    .filter(resolved => resolved.context.mainPatterns.includes(upper))
    .map(resolved => resolved.slots.find(slot => slot.slotKey === 'INTEGRATED'));
  assert(peerNames.filter(slot => slot.name === expectedMachine).length >= 2,
    `${upper} must keep at least two machine-integrated warmups`);
  assert(peerNames.some(slot => slot.name !== expectedMachine),
    `${upper} needs one low-fatigue integrated alternative`);
}

console.log('f111 L4 second-round diversity: PASS');
