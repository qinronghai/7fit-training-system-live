const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(initial={}){
  const memory={...initial};
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console};
  vm.createContext(ctx);
  for(const file of ['data/system-data.js','js/state.js']){
    vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  }
  return {memory,S:ctx.window.V15State,D:ctx.window.V14_DATA};
}
const plain=value=>JSON.parse(JSON.stringify(value));

const first=boot();
const {S}=first;
for(const name of ['putSavedSession','getSavedSession','listSavedSessions','renameSavedSession','deleteSavedSession']){
  assert.strictEqual(typeof S[name],'function',`V15State.${name} must exist`);
}

const record=S.putSavedSession({
  id:'saved-body-1',
  schemaVersion:1,
  resolverVersion:'body-v1',
  templateId:'body',
  familyId:'BODY-02',
  level:'L3',
  input:{familyId:'BODY-02',level:'L3'},
  selections:{
    PRIMARY:{actionId:'tushen_shendun',source:'manual'},
    SECONDARY:{actionId:'movement_supported_split_squat',source:'auto'},
  },
  prepSelections:{
    'MOB-L':{actionId:'warmup_9090',source:'manual'},
    'MOB-U':{actionId:'warmup_band_external_rotation',source:'auto'},
  },
  createdAt:'2026-09-12T06:40:00.000Z',
  updatedAt:'2026-09-12T06:40:00.000Z',
  name:'臀腿 L3',
  sessionKey:'BODY-02-L3',
  domainContext:{must:'not persist'},
  main:{must:'not persist'},
});
assert.deepStrictEqual(plain(record.selections),{
  PRIMARY:{actionId:'tushen_shendun',source:'manual'},
},'SavedSession must keep manual formal intent only');
assert.deepStrictEqual(plain(record.prepSelections),{
  'MOB-L':{actionId:'warmup_9090',source:'manual'},
},'SavedSession must keep manual PREP intent only');
for(const forbidden of ['domainContext','main','conflictContext','anatomyContext','copyContext','resolvedSelections']){
  assert.strictEqual(Object.prototype.hasOwnProperty.call(record,forbidden),false,`${forbidden} must not enter SavedSession contract`);
}

assert.strictEqual(S.getSavedSession('saved-body-1').name,'臀腿 L3');
assert.strictEqual(S.listSavedSessions().length,1);
S.renameSavedSession('saved-body-1','臀腿加强','2026-09-12T06:41:00.000Z');
assert.strictEqual(S.getSavedSession('saved-body-1').name,'臀腿加强');
assert.strictEqual(S.getSavedSession('saved-body-1').updatedAt,'2026-09-12T06:41:00.000Z');

const second=boot(first.memory);
assert.deepStrictEqual(plain(second.S.getSavedSession('saved-body-1')),plain(S.getSavedSession('saved-body-1')),
  'SavedSession must survive state.js reload in the same browser-tab storage');
assert.strictEqual(second.S.snapshot().savedSessions['saved-body-1'].name,'臀腿加强');

assert.strictEqual(second.S.deleteSavedSession('saved-body-1'),true);
assert.strictEqual(second.S.getSavedSession('saved-body-1'),null);
assert.strictEqual(second.S.deleteSavedSession('saved-body-1'),false);

// Unsupported records already present in persisted storage remain inspectable so Restore can fail closed explicitly.
const raw={
  schemaVersion:1,
  templates:{f111:{sessions:{}},body:{sessions:{}},conditioning:{sessions:{}}},
  savedSessions:{
    future:{
      id:'future',schemaVersion:99,resolverVersion:'body-v99',templateId:'body',
      familyId:'BODY-01',level:'L1',input:{familyId:'BODY-01',level:'L1'},
      selections:{},prepSelections:{},createdAt:'x',updatedAt:'x',name:'future',sessionKey:'BODY-01-L1'
    }
  },
  recentActions:[],favorites:{}
};
const third=boot({'7fit-v15-state':JSON.stringify(raw)});
assert.strictEqual(third.S.getSavedSession('future').schemaVersion,99);

let thrown=null;
try{
  third.S.putSavedSession({...third.S.getSavedSession('future'),id:'bad-current'});
}catch(error){thrown=error;}
assert(thrown);
assert.strictEqual(thrown.code,'INVALID_SAVED_SESSION_SCHEMA');

console.log('saved_sessions_state_test: SavedSession CRUD + persistence PASS');
