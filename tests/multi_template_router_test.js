const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},location:{hash:''},URLSearchParams,console};ctx.window.addEventListener=()=>{};vm.createContext(ctx);
for(const file of ['data/system-data.js','js/router.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const R=ctx.window.V14Router;
const plain=v=>JSON.parse(JSON.stringify(v));

function pick(route){
  return plain({area:route.area,page:route.page,templateId:route.templateId||'',recipeId:route.recipeId||'',level:route.level||'',query:route.query||{}});
}

assert.deepStrictEqual(pick(R.parseHash('#/coach/f111')),{area:'coach',page:'template',templateId:'f111',recipeId:'',level:'',query:{}});
assert.deepStrictEqual(pick(R.parseHash('#/coach/f111/compose?level=L3&lower=single_leg_hinge')),{area:'coach',page:'compose',templateId:'f111',recipeId:'',level:'',query:{level:'L3',lower:'single_leg_hinge'}});
assert.deepStrictEqual(pick(R.parseHash('#/coach/compose?level=L3')),{area:'coach',page:'compose',templateId:'f111',recipeId:'',level:'',query:{level:'L3'}});
assert.deepStrictEqual(pick(R.parseHash('#/coach/f111/f111-06/l3')),{area:'coach',page:'preset',templateId:'f111',recipeId:'F111-06',level:'L3',query:{}});
assert.deepStrictEqual(pick(R.parseHash('#/coach/f111-06/l3')),{area:'coach',page:'preset',templateId:'f111',recipeId:'F111-06',level:'L3',query:{}});

const bodyCompose=R.parseHash('#/coach/body/compose');
assert.strictEqual(bodyCompose.area,'coach');assert.strictEqual(bodyCompose.page,'template-compose');assert.strictEqual(bodyCompose.templateId,'body');assert(R.isValid(bodyCompose));
const conditioningCompose=R.parseHash('#/coach/conditioning/compose');
assert.strictEqual(conditioningCompose.page,'template-compose');assert.strictEqual(conditioningCompose.templateId,'conditioning');assert(R.isValid(conditioningCompose));

assert.strictEqual(R.isValid(R.parseHash('#/coach/f111/f111-99/l3')),false);
assert.strictEqual(R.isValid(R.parseHash('#/coach/f111/f111-06/l5')),false);
assert.strictEqual(R.isValid(R.parseHash('#/coach/unknown')),false);
assert.strictEqual(R.isValid(R.parseHash('#/coach/posture/compose')),false);

assert.strictEqual(typeof R.canonicalHash,'function');
assert.strictEqual(R.canonicalHash(R.parseHash('#/coach/compose?level=L3&lower=single_leg_hinge')),'#/coach/f111/compose?level=L3&lower=single_leg_hinge');
assert.strictEqual(R.canonicalHash(R.parseHash('#/coach/f111-06/l3')),'#/coach/f111/f111-06/l3');
assert.strictEqual(R.canonicalHash(R.parseHash('#/coach/f111')),'#/coach/f111');

console.log('multi_template_router_test: PASS');
