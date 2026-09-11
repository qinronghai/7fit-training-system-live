const fs=require('fs'),vm=require('vm'),assert=require('assert');

const ctx={window:{},location:{hash:''},URLSearchParams,console};
ctx.window.addEventListener=()=>{};
vm.createContext(ctx);
function load(file){vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});}
load('data/system-data.js');
load('js/router.js');

const R=ctx.window.V14Router;
const plain=value=>JSON.parse(JSON.stringify(value));
const pick=route=>plain({
  area:route.area,
  page:route.page,
  templateId:route.templateId||'',
  familyId:route.familyId||'',
  recipeId:route.recipeId||'',
  level:route.level||'',
  query:route.query||{},
});

// Body session route contract.
const bodySession=R.parseHash('#/coach/body/body-02/l3');
assert.deepStrictEqual(pick(bodySession),{
  area:'coach',page:'template-session',templateId:'body',familyId:'BODY-02',recipeId:'',level:'L3',query:{}
});
assert.strictEqual(R.isValid(bodySession),true);
assert.strictEqual(R.canonicalHash(bodySession),'#/coach/body/body-02/l3');
assert.strictEqual(R.isValid(R.parseHash('#/coach/body/body-99/l3')),false);
assert.strictEqual(R.isValid(R.parseHash('#/coach/body/body-02/l5')),false);
assert.strictEqual(R.isValid(R.parseHash('#/coach/conditioning/c01/l1')),false);

// Existing F111 route/canonical behavior is frozen.
assert.deepStrictEqual(pick(R.parseHash('#/coach/f111')),{area:'coach',page:'template',templateId:'f111',familyId:'',recipeId:'',level:'',query:{}});
assert.deepStrictEqual(pick(R.parseHash('#/coach/f111/compose?level=L3&lower=single_leg_hinge')),{area:'coach',page:'compose',templateId:'f111',familyId:'',recipeId:'',level:'',query:{level:'L3',lower:'single_leg_hinge'}});
assert.deepStrictEqual(pick(R.parseHash('#/coach/f111/f111-06/l3')),{area:'coach',page:'preset',templateId:'f111',familyId:'',recipeId:'F111-06',level:'L3',query:{}});
assert.strictEqual(R.canonicalHash(R.parseHash('#/coach/f111-06/l3')),'#/coach/f111/f111-06/l3');

// Template UI registry is infrastructure only; no Body business rules live here.
assert.strictEqual(fs.existsSync('js/coach/template-ui.js'),true,'Template UI registry module must exist');
load('js/coach/template-ui.js');
const UI=ctx.window.V14CoachModules?.TemplateUI;
assert(UI,'Template UI registry must be exposed');
assert.strictEqual(typeof UI.register,'function');
assert.strictEqual(typeof UI.get,'function');
const adapter={canHandle:()=>true,render:()=>'<p>body</p>',bind:()=>{}};
UI.register('body',adapter);
assert.strictEqual(UI.get('body'),adapter);
assert.throws(()=>UI.register('body',adapter),/already registered/i);

console.log('body_coach_route_ui_test: PASS');
