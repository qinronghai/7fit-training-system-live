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
  for(const file of ['data/system-data.js','js/state.js']){
    vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  }
  return {S:ctx.window.V15State,memory};
}

const {S}=boot();
S.ensureSession('conditioning','CON-03-L3-BLUEPRINT-A',{
  familyId:'CON-03',level:'L3',resolverVersion:'conditioning-v2',
  input:{familyId:'CON-03',level:'L3',variantId:'A',sessionBlueprintId:'CON-03-L3-A'},
});

const oversized='x'.repeat(3000);
assert.throws(
  ()=>S.createSavedSession('conditioning','CON-03-L3-BLUEPRINT-A',{name:oversized}),
  error=>error?.code==='INVALID_SAVED_SESSION_NAME',
  '3000-character saved names must be rejected at the state boundary',
);
const saved=S.createSavedSession('conditioning','CON-03-L3-BLUEPRINT-A',{savedId:'security-name',name:'<script>alert(1)</script>'});
assert.strictEqual(saved.name,'<script>alert(1)</script>','safe text may be stored and escaped by the view layer');
assert.throws(
  ()=>S.renameSavedSession(saved.savedId,oversized),
  error=>error?.code==='INVALID_SAVED_SESSION_NAME',
  'renaming must apply the same name limit',
);

console.log('conditioning_blueprint_security_test: PASS');
