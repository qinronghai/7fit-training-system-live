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
const bodyIds=Object.keys(first.ctx.window.V14_DATA.bodyActionMeta||{});
assert(bodyIds.length>=2,'need Body actions');
const a=bodyIds[0],b=bodyIds[1];

let rec=S.recordRecentAction('body',a,'body:BODY-02:L3:PRIMARY',{familyId:'BODY-02',level:'L3',slotKey:'PRIMARY'},{now:'2026-09-12T10:00:00.000Z'});
assert.strictEqual(rec.useCount,1);
rec=S.recordRecentAction('body',a,'body:BODY-02:L3:PRIMARY',{familyId:'BODY-02',level:'L3',slotKey:'PRIMARY'},{now:'2026-09-12T10:01:00.000Z'});
assert.strictEqual(rec.useCount,2);
S.recordRecentAction('body',b,'body:BODY-02:L3:PRIMARY',{familyId:'BODY-02',level:'L3',slotKey:'PRIMARY'},{now:'2026-09-12T10:02:00.000Z'});
S.recordRecentAction('body',a,'body:BODY-02:L3:ACCESSORY',{familyId:'BODY-02',level:'L3',slotKey:'ACCESSORY'},{now:'2026-09-12T10:03:00.000Z'});

const primary=plain(S.listRecentActions({templateId:'body',contextKey:'body:BODY-02:L3:PRIMARY'}));
assert.deepStrictEqual(primary.map(x=>x.actionId),[b,a]);
assert.strictEqual(primary[1].useCount,2);
assert.strictEqual(S.listRecentActions({templateId:'body',contextKey:'body:BODY-02:L3:ACCESSORY'}).length,1);

// Same canonical V15 store survives refresh.
const second=boot(first.memory);
assert.deepStrictEqual(
  plain(second.S.listRecentActions({templateId:'body',contextKey:'body:BODY-02:L3:PRIMARY'})).map(x=>x.actionId),
  [b,a]
);
assert.strictEqual(JSON.parse(second.S.serialize()).recentActions.length,3);

assert.throws(()=>second.S.recordRecentAction('posture',a,'x',{}),e=>e.code==='UNKNOWN_TEMPLATE');
assert.throws(()=>second.S.recordRecentAction('body','missing-action','x',{}),e=>e.code==='INVALID_RECENT_ACTION');
assert.throws(()=>second.S.recordRecentAction('body',a,'',{}),e=>e.code==='INVALID_RECENT_CONTEXT');

assert.strictEqual(second.S.clearRecentActions({templateId:'body',contextKey:'body:BODY-02:L3:PRIMARY'}),2);
assert.strictEqual(second.S.listRecentActions({templateId:'body'}).length,1);

console.log('recent_actions_state_test: context isolation + persistence PASS');
