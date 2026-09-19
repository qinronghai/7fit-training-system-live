const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

[
  'data/system-data.js',
  'data/anatomy-data.js',
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
  'js/coach/common.js',
  'js/coach/f111-preset-browser.js',
].forEach(load);

const D=window.V14_DATA;
const B=window.V14CoachModules.F111PresetBrowser;
assert(B,'F111PresetBrowser module missing');

const index=B.buildIndex();
assert.strictEqual(index.length,32,'browser index must expose 8 Recipe × 4 Level states');
assert.strictEqual(new Set(index.map(x=>x.key)).size,32,'preset keys must be unique');
assert.strictEqual(index[0].recipeId,'F111-01');
assert.strictEqual(index[0].level,'L1');
assert.strictEqual(index.at(-1).recipeId,'F111-08');
assert.strictEqual(index.at(-1).level,'L4');

for(const recipeId of D.recipeIds){
  const states=index.filter(x=>x.recipeId===recipeId);
  assert.deepStrictEqual(states.map(x=>x.level),['L1','L2','L3','L4']);
  for(const state of states){
    assert(D.sessions[`${recipeId}-${state.level}`],`${state.key} must map to a real preset session`);
    assert.strictEqual(state.href,`#/coach/f111/${recipeId.toLowerCase()}/${state.level.toLowerCase()}`);
    for(const token of [recipeId,state.level,state.patterns.lower,state.patterns.upper,state.patterns.support]){
      assert(state.searchTokens.includes(token),`${state.key} missing search token ${token}`);
    }
  }
}

const rows=B.recipeRows();
assert.strictEqual(rows.length,8);
assert(rows.every(row=>row.states.length===4));
assert.strictEqual(rows[0].label,'下肢推｜水平拉｜支撑');
assert.strictEqual(rows[2].patterns.lower,'髋铰链');
assert.strictEqual(rows[3].patterns.lower,'髋伸');
assert.strictEqual(rows[4].patterns.lower,'单腿');

const facets=B.facetValues();
assert.deepStrictEqual([...facets.levels],['L1','L2','L3','L4']);
assert.deepStrictEqual([...facets.lower],['下肢推','髋铰链','髋伸','单腿']);
for(const expected of ['水平拉','垂直拉','水平推','垂直推'])assert(facets.upper.includes(expected));
for(const expected of ['支撑','单侧支撑','动态支撑'])assert(facets.support.includes(expected));

assert.strictEqual(B.find('F111-03','L2').key,'F111-03:L2');
assert.strictEqual(B.find('F111-99','L2'),null);
assert.strictEqual(B.find('F111-03','L9'),null);

const originalResolve=window.V15TemplateResolver.resolve;
let resolveCalls=0;
window.V15TemplateResolver.resolve=function(...args){resolveCalls++;return originalResolve.apply(this,args);};
B.buildIndex();
assert.strictEqual(resolveCalls,0,'building the browser index must not eagerly resolve 32 sessions');

const preview=B.resolvePreview('F111-03','L2');
assert.strictEqual(resolveCalls,1,'preview must resolve lazily');
assert.strictEqual(preview.key,'F111-03:L2');
assert.strictEqual(preview.recipeId,'F111-03');
assert.strictEqual(preview.level,'L2');
assert.strictEqual(preview.duration.minutes,60);
assert.strictEqual(preview.duration.source,'F111_SESSION_CONTRACT');
assert(preview.goals.includes('髋铰链'));
assert(preview.goals.includes('水平拉'));
assert(Array.isArray(preview.equipment));
assert(preview.sections.some(section=>section.key==='PREP'));
assert(preview.sections.some(section=>section.key==='A'));
assert(preview.sections.some(section=>section.key==='B'));
assert(preview.sections.some(section=>section.key==='SUPPORT'));
assert(preview.sections.some(section=>section.key==='CORE'));

const previewAgain=B.resolvePreview('F111-03','L2');
assert.deepStrictEqual(previewAgain,preview,'same preset must produce deterministic browser preview data');

assert.throws(
  ()=>B.resolvePreview('F111-99','L2'),
  error=>error&&error.code==='F111_BROWSER_PRESET_INVALID'
);

console.log('f111_preset_browser_view_model_test: PASS');
