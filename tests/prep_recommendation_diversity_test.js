const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/composer.js','js/resolved-session.js','js/conflict-core.js','js/conflict-service.js',
  'js/conflict-plugins/f111.js','js/conflict.js','js/template-resolver.js','js/resolvers/f111.js'
])vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});

const D=window.V14_DATA,T=window.V15TemplateResolver,R=window.V14PrepResolver;
const recipes=['F111-01','F111-02','F111-03','F111-04','F111-05','F111-06','F111-07','F111-08'];
const lowerPatterns=new Set(['蹲','髋铰链','髋伸展','单腿','单腿拉']);

function resolved(recipeId,level){
  const session=T.resolve('f111',{mode:'preset',recipeId,level});
  return R.resolve(session.prepContext,{selections:{}});
}
function slot(result,key){return result.slots.find(item=>item.slotKey===key);}
function detail(item){return D.warmupDetails[item.prepId]||{};}
function overlaps(item,patterns){return (detail(item).targetPatterns||[]).some(pattern=>patterns.includes(pattern));}

// Level progression must affect the default selection, not just the candidate menu.
const l3=resolved('F111-07','L3'),l4=resolved('F111-07','L4');
assert(
  l3.slots.some((item,index)=>item.actionId!==l4.slots[index].actionId),
  'F111-07 L3 and L4 must not resolve to the same five defaults'
);
assert(
  l4.slots.some(item=>/^P[34]$/.test(item.prepGrade)),
  `L4 must promote at least one default into P4/P3, saw ${l4.slots.map(item=>item.prepGrade).join(',')}`
);

// PRIMER is the preview of the main movement. An upper-body hit must not
// displace the lower-body pattern on a squat or hinge day.
for(const recipeId of ['F111-01','F111-03','F111-07']){
  const session=T.resolve('f111',{mode:'preset',recipeId,level:'L3'});
  const result=R.resolve(session.prepContext,{selections:{}});
  const primer=slot(result,'PRIMER');
  const lower=session.prepContext.mainPatterns.filter(pattern=>lowerPatterns.has(pattern));
  assert(overlaps(primer,lower),`${recipeId} PRIMER must overlap its lower-body pattern`);
  assert.notStrictEqual(primer.actionId,'warmup_band_front_raise_external_rotation',`${recipeId} must not default to the generic shoulder primer`);
}

// Near-tied candidates should rotate by recipe/level while remaining stable
// for the same context. This protects the coach from a single global default.
const integrated=new Set(recipes.map(recipeId=>slot(resolved(recipeId,'L3'),'INTEGRATED').actionId));
const primer=new Set(recipes.map(recipeId=>slot(resolved(recipeId,'L4'),'PRIMER').actionId));
assert(integrated.size>=3,`L3 INTEGRATED needs at least three defaults across presets, saw ${integrated.size}`);
assert(primer.size>=2,`L4 PRIMER needs at least two mode-specific defaults across presets, saw ${primer.size}`);
assert.deepStrictEqual(
  resolved('F111-07','L4').slots.map(item=>item.actionId),
  resolved('F111-07','L4').slots.map(item=>item.actionId),
  'the same context must remain deterministic'
);

console.log(`prep recommendation diversity: PASS (L3 integrated=${integrated.size}, L4 primer=${primer.size})`);
