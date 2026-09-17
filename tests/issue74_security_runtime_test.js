const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(memory={}){
  let storageBlocked=false;
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{if(storageBlocked)throw new Error('quota exceeded');memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console,Date};
  vm.createContext(ctx);
  for(const file of ['data/system-data.js','js/state.js']){
    vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  }
  return {V15:ctx.window.V15State,D:ctx.window.V14_DATA,blockStorage:()=>{storageBlocked=true;}};
}

function expectCode(fn,code,messagePart){
  let thrown=null;
  try{fn();}catch(error){thrown=error;}
  assert(thrown,`expected ${code}`);
  assert.strictEqual(thrown.code,code);
  if(messagePart)assert(String(thrown.message).includes(messagePart),`expected error message to include ${messagePart}`);
}

const {V15,blockStorage}=boot();
V15.ensureSession('body','BODY-01-L1',{
  familyId:'BODY-01',
  level:'L1',
  resolverVersion:'body-v1',
  input:{familyId:'BODY-01',level:'L1',surface:'session'},
});

const overlong='x'.repeat(3000);
expectCode(
  ()=>V15.createSavedSession('body','BODY-01-L1',{savedId:'issue74-long',name:overlong}),
  'INVALID_SAVED_SESSION_NAME',
  '120'
);

const saved=V15.createSavedSession('body','BODY-01-L1',{savedId:'issue74-valid',name:'Body boundary test'});
expectCode(
  ()=>V15.renameSavedSession(saved.savedId,overlong),
  'INVALID_SAVED_SESSION_NAME',
  '120'
);
assert.strictEqual(V15.getSavedSession(saved.savedId).name,'Body boundary test');

V15.ensureSession('f111','F111-01-L1',{
  familyId:'F111-01',
  level:'L1',
  resolverVersion:'f111-adapter-v1',
  input:{mode:'preset',recipeId:'F111-01',level:'L1',surface:'session'},
});
const f111=V15.createSavedSession('f111','F111-01-L1',{savedId:'issue74-f111',name:'F111 boundary test'});
const records=V15.listSavedSessions();
assert(records.some(record=>record.savedId===saved.savedId&&record.templateId==='body'&&record.level==='L1'));
assert(records.some(record=>record.savedId===f111.savedId&&record.templateId==='f111'&&record.level==='L1'));

blockStorage();
expectCode(()=>V15.deleteSavedSession(saved.savedId),'STORAGE_WRITE_FAILED');
assert.strictEqual(V15.getSavedSession(saved.savedId).name,'Body boundary test');
expectCode(()=>V15.renameSavedSession(saved.savedId,'lost rename'),'STORAGE_WRITE_FAILED');
assert.strictEqual(V15.getSavedSession(saved.savedId).name,'Body boundary test');
expectCode(()=>V15.createSavedSession('body','BODY-01-L1',{savedId:'not-persisted',name:'lost save'}),'STORAGE_WRITE_FAILED');
assert.strictEqual(V15.getSavedSession('not-persisted'),null);
console.log('issue74_security_runtime_test: PASS');
