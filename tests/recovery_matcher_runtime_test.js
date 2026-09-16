const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js',
  'js/prep-resolver.js','js/composer.js','js/resolved-session.js','js/conflict-core.js',
  'js/conflict-service.js','js/conflict-plugins/f111.js','js/conflict.js',
  'js/template-resolver.js','js/resolvers/f111.js','js/recovery-matcher.js'
])load(file);

const D=window.V14_DATA;
const R=window.V15TemplateResolver;
const matcher=window.V14RecoveryMatcher;
assert(matcher&&typeof matcher.match==='function','recovery matcher must expose match');

function resolve(input){return R.resolve('f111',input);}
function ids(result){return result.items.map(item=>item.id);}

const pull=matcher.match(resolve({mode:'preset',recipeId:'F111-01',level:'L3'}));
const push=matcher.match(resolve({mode:'preset',recipeId:'F111-06',level:'L3'}));
for(const result of [pull,push]){
  assert.strictEqual(result.status,'complete');
  assert.strictEqual(result.items.length,3,'F111 Recovery must contain three cards');
  assert.strictEqual(new Set(result.items.map(item=>item.region)).size,3,'Recovery regions must be unique');
  assert(result.items.some(item=>item.regionGroup==='upper'),'Recovery must cover an upper-body region');
  assert(result.items.some(item=>item.regionGroup==='lower'),'Recovery must cover a lower-body region');
  assert(result.items.every(item=>item.prescription==='45 秒'));
  assert(result.items.every(item=>D.actions[item.id]?.route==='RECOVERY_2F'));
  assert(result.items.every(item=>D.actions[item.id]?.recoveryEligible===true));
  assert(result.items.every(item=>item.reason&&item.detail));
}
assert.notDeepStrictEqual(ids(pull),ids(push),'A/B training changes must change Recovery recommendations');
assert(pull.items.some(item=>item.region==='upper_back'),'horizontal pull should expose an upper-back Recovery target');
assert(push.items.some(item=>item.region==='chest'),'horizontal push should expose a chest Recovery target');

const repeat=matcher.match(resolve({mode:'preset',recipeId:'F111-01',level:'L3'}));
assert.deepStrictEqual(repeat,pull,'same resolved session must produce deterministic Recovery');

const malformed=matcher.match({main:{kind:'SLOT',content:[{key:'A',actionId:'missing-action'}]}});
assert.strictEqual(malformed.status,'incomplete','unknown session actions must not silently fabricate Recovery');
assert(malformed.message.includes('人工安排'));
assert.doesNotThrow(()=>matcher.render(malformed));

const rendered=matcher.render(push);
assert.strictEqual((rendered.match(/data-recovery-card=/g)||[]).length,3);
assert.strictEqual((rendered.match(/查看动作详情/g)||[]).length,3);
for(const forbidden of ['2F 体能热身大厅','一次上楼','2F 拉伸评估房'])assert(!rendered.includes(forbidden),`Recovery UI leaked venue copy: ${forbidden}`);

console.log('recovery matcher runtime: PASS');
