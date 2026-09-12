const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(memory={}){
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console,URLSearchParams,Date};
  ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);
  for(const file of ['data/system-data.js','js/state.js'])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {ctx,memory,S:ctx.window.V15State};
}
const plain=v=>JSON.parse(JSON.stringify(v));

const first=boot({});
const S=first.S;
S.ensureSession('body','BODY-02-L3',{familyId:'BODY-02',level:'L3',resolverVersion:'body-v1',input:{familyId:'BODY-02',level:'L3'}});
S.setSelection('body','BODY-02-L3','PRIMARY','movement_machine_chest_press','manual');
S.setPrepSelection('body','BODY-02-L3','MOB-L','prep_90_90_dynamic','manual');

const saved=S.createSavedSession('body','BODY-02-L3',{
  savedId:'saved-demo',
  now:'2026-09-12T07:00:00.000Z',
  name:'周六上肢训练',
  input:{familyId:'BODY-02',level:'L3',surface:'session'},
});
assert.strictEqual(saved.savedId,'saved-demo');
assert.strictEqual(saved.schemaVersion,1);
assert.strictEqual(saved.templateId,'body');
assert.strictEqual(saved.familyId,'BODY-02');
assert.strictEqual(saved.level,'L3');
assert.strictEqual(saved.resolverVersion,'body-v1');
assert.strictEqual(saved.name,'周六上肢训练');
assert.deepStrictEqual(plain(saved.selections),{PRIMARY:{actionId:'movement_machine_chest_press',source:'manual'}});
assert.deepStrictEqual(plain(saved.prepSelections),{'MOB-L':{actionId:'prep_90_90_dynamic',source:'manual'}});
assert.strictEqual(S.listSavedSessions().length,1);
assert.deepStrictEqual(plain(S.getSavedSession('saved-demo')),plain(saved));

const renamed=S.renameSavedSession('saved-demo','周六训练 A',{now:'2026-09-12T07:10:00.000Z'});
assert.strictEqual(renamed.name,'周六训练 A');
assert.strictEqual(renamed.updatedAt,'2026-09-12T07:10:00.000Z');

// Saved records survive page refresh because they share the canonical V15 store boundary.
const second=boot(first.memory);
assert.strictEqual(second.S.listSavedSessions().length,1);
assert.strictEqual(second.S.getSavedSession('saved-demo').name,'周六训练 A');
assert.strictEqual(second.S.getSavedSessionSchemaVersion(),1);
assert.deepStrictEqual(JSON.parse(second.S.serialize()).savedSessions['saved-demo'],plain(second.S.getSavedSession('saved-demo')));

assert.strictEqual(second.S.deleteSavedSession('saved-demo'),true);
assert.strictEqual(second.S.deleteSavedSession('saved-demo'),false);
assert.strictEqual(second.S.listSavedSessions().length,0);

console.log('saved_sessions_state_test: CRUD + refresh persistence PASS');
