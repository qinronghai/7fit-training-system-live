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

const upperFamilies = Object.freeze({
  '水平拉': new Set(['integrated-rower', 'activation-scapula-upward-rotation', 'mobility-latissimus-tool', 'mobility-shoulder-thoracic-tool', 'mobility-thoracic-quadruped', 'mobility-scapula-circumduction', 'activation-rotator-cuff']),
  '垂直拉': new Set(['integrated-ski-erg', 'activation-scapula-upward-rotation', 'mobility-latissimus-tool', 'mobility-shoulder-thoracic-tool', 'mobility-thoracic-quadruped', 'mobility-scapula-circumduction', 'activation-rotator-cuff']),
  '水平推': new Set(['activation-scapula-upward-rotation', 'mobility-shoulder-thoracic-tool', 'mobility-thoracic-quadruped', 'mobility-scapula-circumduction', 'activation-rotator-cuff']),
  '垂直推': new Set(['activation-scapula-upward-rotation', 'mobility-shoulder-thoracic-tool', 'mobility-thoracic-quadruped', 'mobility-scapula-circumduction', 'activation-rotator-cuff', 'integrated-hip-drive-press', 'integrated-squat-press']),
});

const integratedFamilies = Object.freeze({
  '水平拉': new Set(['integrated-rower', 'integrated-lunge-thoracic']),
  '垂直拉': new Set(['integrated-ski-erg', 'integrated-lunge-thoracic']),
  '水平推': new Set(['integrated-lunge-thoracic', 'integrated-hip-drive-press', 'integrated-squat-press']),
  '垂直推': new Set(['integrated-lunge-thoracic', 'integrated-hip-drive-press', 'integrated-squat-press']),
});

for (const [recipeId, recipe] of Object.entries(D.recipes || {})) {
  const resolved = R.resolve(R.contextFromF111({ recipeId, level: 'L4' }));
  const bySlot = Object.fromEntries(resolved.slots.map(slot => [slot.slotKey, slot]));
  assert(bySlot['MOB-L'].targetPatterns.includes(recipe.lower),
    `${recipeId} MOB-L must prepare lower pattern ${recipe.lower}: ${bySlot['MOB-L'].name}`);

  const upperAllowed = upperFamilies[recipe.upper];
  assert(upperAllowed?.has(bySlot['MOB-U'].movementFamily),
    `${recipeId} MOB-U must prepare ${recipe.upper}: ${bySlot['MOB-U'].name} (${bySlot['MOB-U'].movementFamily})`);

  if (recipe.lower === '髋铰链') {
    assert(/髋铰链|后侧链|髋飞机|捞月/.test(`${bySlot.PRIMER.name} ${bySlot.PRIMER.role}`),
      `${recipeId} PRIMER must rehearse a hinge/posterior-chain pattern: ${bySlot.PRIMER.name}`);
  }

  const integratedAllowed = integratedFamilies[recipe.upper];
  assert(integratedAllowed?.has(bySlot.INTEGRATED.movementFamily),
    `${recipeId} INTEGRATED must finish with ${recipe.upper} preparation: ${bySlot.INTEGRATED.name} (${bySlot.INTEGRATED.movementFamily})`);
  if (recipe.upper === '垂直推') {
    assert(/上举|推举/.test(`${bySlot.INTEGRATED.name} ${bySlot.INTEGRATED.role}`),
      `${recipeId} vertical-push integration must include an overhead press/reach: ${bySlot.INTEGRATED.name}`);
  }
}

console.log('f111 L4 mode fit: PASS');
