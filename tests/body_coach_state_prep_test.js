const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(){
  const memory={};
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},location:{hash:''},URLSearchParams,console};
  ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
    'js/template-resolver.js','js/resolvers/body.js','js/coach/common.js','js/coach/template-ui.js',
    'js/coach/body-home.js','js/coach/body-volume-view.js','js/coach/body-session.js'
  ]) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {ctx,S:ctx.window.V15State,R:ctx.window.V15TemplateResolver,Body:ctx.window.V15BodyResolver,M:ctx.window.V14CoachModules};
}

const plain=value=>JSON.parse(JSON.stringify(value));
const {S,R,Body,M}=boot();
const UI=M.BodySession;
for(const name of ['ensureState','resolveState','setFormalSelection','reset']){
  assert.strictEqual(typeof UI[name],'function',`BodySession.${name} must exist`);
}

const familyId='BODY-02',level='L3',sessionKey='BODY-02-L3';
UI.ensureState(familyId,level);
assert.deepStrictEqual(plain(S.getSession('body',sessionKey)),{
  templateId:'body',familyId,level,resolverVersion:'body-v1',input:{familyId,level},selections:{},prepSelections:{}
});

const baseline=UI.resolveState(familyId,level);
const primary=baseline.main.content.find(slot=>slot.key==='PRIMARY');
const alternate=Body.candidates({familyId,level,slotKey:'PRIMARY',currentSelections:{}}).candidates.find(x=>x.actionId!==primary.actionId);
assert(alternate,'BODY-02 L3 needs a legal alternate PRIMARY');
UI.setFormalSelection(familyId,level,'PRIMARY',alternate.actionId);
const manual=UI.resolveState(familyId,level);
assert.strictEqual(manual.main.content.find(slot=>slot.key==='PRIMARY').actionId,alternate.actionId);
assert.strictEqual(manual.main.content.find(slot=>slot.key==='PRIMARY').source,'manual');
assert.deepStrictEqual(plain(S.getSelections('body',sessionKey).PRIMARY),{actionId:alternate.actionId,source:'manual'});

const html=UI.render({area:'coach',page:'template-session',templateId:'body',familyId,level,query:{}});
assert(html.includes('body-slot-select'),'Body editor must expose formal replacement selects');
assert(html.includes(`data-body-session="${sessionKey}"`),'Body select must carry session key');
assert(html.includes(`data-body-slot="PRIMARY"`),'Body PRIMARY select must carry slot key');
assert(html.includes(`value="${alternate.actionId}"`),'current manual action must remain in candidate select');

const persisted=plain(S.getSession('body',sessionKey));
for(const derivedKey of ['domainContext','volume','anatomyContext','conflictContext','main','resolvedSelections']){
  assert.strictEqual(Object.prototype.hasOwnProperty.call(persisted,derivedKey),false,`${derivedKey} must not persist`);
}

UI.reset(familyId,level);
const reset=UI.resolveState(familyId,level);
assert(reset.main.content.every(slot=>slot.source==='auto'),'Reset must restore Body auto recommendations');
assert.deepStrictEqual(plain(S.getSelections('body',sessionKey)),{});

// UI state adapter must preserve the frozen Resolver behavior for no-intent sessions.
assert.deepStrictEqual(plain(reset),plain(R.resolve('body',{familyId,level,selections:{}})));

console.log('body_coach_state_prep_test: formal state RED/GREEN contract PASS');
