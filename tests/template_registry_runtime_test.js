const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

for(const file of ['data/system-data.js','js/router.js','js/coach/common.js','js/coach/home.js','js/coach/f111-home.js','js/coach/template-home.js']) load(file);

const D=window.V14_DATA,R=window.V14Router,M=window.V14CoachModules;
assert(D.templateRegistry,'templateRegistry runtime missing');
assert.deepStrictEqual(D.templateIds,['f111','body','conditioning','posture']);

function expectTemplate(hash,id){
  const route=R.parseHash(hash);
  assert.strictEqual(route.area,'coach');
  assert.strictEqual(route.page,'template');
  assert.strictEqual(route.templateId,id);
  assert.strictEqual(R.isValid(route),true);
}
expectTemplate('#/coach/f111','f111');
expectTemplate('#/coach/body','body');
expectTemplate('#/coach/conditioning','conditioning');
expectTemplate('#/coach/posture','posture');

const composer=R.parseHash('#/coach/compose');
assert.strictEqual(composer.page,'compose');
assert.strictEqual(composer.templateId,'f111');
assert.strictEqual(R.isValid(composer),true);

const legacy=R.parseHash('#/coach/f111-06/l3');
assert.strictEqual(legacy.page,'preset');
assert.strictEqual(legacy.templateId,'f111');
assert.strictEqual(legacy.recipeId,'F111-06');
assert.strictEqual(legacy.level,'L3');
assert.strictEqual(R.isValid(legacy),true);

const unknown=R.parseHash('#/coach/not-a-template');
assert.strictEqual(R.isValid(unknown),false,'unknown template-like route must remain invalid');

const center=M.Home.render();
for(const id of D.templateIds){
  const record=D.templateRegistry[id];
  assert(center.includes(`data-template-id="${id}"`),`Coach Center missing data-driven card ${id}`);
  assert(center.includes(record.name),`Coach Center missing registry name ${record.name}`);
  assert(center.includes(record.description),`Coach Center missing registry description ${id}`);
}
assert(center.includes('即将开放'),'FUTURE template status should be visible');
assert(!center.includes('8 个推荐预设'),'generic Coach Center must not hard-code F111 metrics');

// Prove the center consumes the Registry rather than hard-coding four cards.
D.templateIds.push('test_template');
D.templateRegistry.test_template={
  templateId:'test_template',name:'测试模板',shortName:'Test',engine:'posture',status:'FUTURE',levelSystem:'L1-L4',
  capabilities:{preset:false,composer:false,prep:false,anatomy:false,copy:false,save:false,volume:false,conditioningMetrics:false},
  routeBase:'#/coach/test_template',description:'用于证明 Registry 驱动渲染。'
};
const extended=M.Home.render();
assert(extended.includes('data-template-id="test_template"'));
assert(extended.includes('测试模板'));
D.templateIds.pop();
delete D.templateRegistry.test_template;

// F111-specific landing and generic template landing are separate modules.
assert(M.F111Home&&typeof M.F111Home.render==='function','F111 landing must move to F111Home module');
assert(M.TemplateHome&&typeof M.TemplateHome.render==='function','generic template landing module must exist');
const f111=M.F111Home.render();
assert(f111.includes('女性综合 1+1+1'));
assert(f111.includes('8 个推荐预设'));
assert(f111.includes('20 种自由组合'));
assert(f111.includes('32 套原课程兼容'));
assert(f111.includes('#/coach/f111/compose'));
assert(!f111.includes('href="#/coach/compose"'));

const body=M.TemplateHome.render('body');
assert(body.includes('健美式塑形'));
assert(body.includes('ACTIVE')||body.includes('已启用'));
assert(!body.includes('F111-01'),'Body placeholder must not fabricate F111 sessions');

const conditioning=M.TemplateHome.render('conditioning');
assert(conditioning.includes('体能训练'));
assert(conditioning.includes('ACTIVE')||conditioning.includes('已启用'));

const posture=M.TemplateHome.render('posture');
assert(posture.includes('体态调整'));
assert(posture.includes('FUTURE')||posture.includes('即将开放'));

console.log('template_registry_runtime_test: PASS');
