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
  for(const file of ['data/system-data.js','js/state.js','js/recent-actions.js']){
    vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  }
  return {memory,V15:ctx.window.V15State,Recent:ctx.window.V15RecentActions,D:ctx.window.V14_DATA};
}
const plain=v=>JSON.parse(JSON.stringify(v));
const eq=(a,b)=>assert.deepStrictEqual(plain(a),b);

{
  const {V15,D}=boot(),ids=Object.keys(D.actions).slice(0,4);
  V15.recordRecentAction('body','body|BODY-02|L3|A',ids[0],{now:'2026-09-12T10:00:00.000Z'});
  V15.recordRecentAction('body','body|BODY-02|L3|A',ids[1],{now:'2026-09-12T10:01:00.000Z'});
  V15.recordRecentAction('conditioning','conditioning|CON-03|L2|CIRCUIT|S1',ids[2],{now:'2026-09-12T10:02:00.000Z'});
  eq(V15.listRecentActions('body','body|BODY-02|L3|A').map(x=>x.actionId),[ids[1],ids[0]]);
  eq(V15.listRecentActions('conditioning','conditioning|CON-03|L2|CIRCUIT|S1').map(x=>x.actionId),[ids[2]]);
  eq(V15.listRecentActions('f111','body|BODY-02|L3|A'),[]);

  V15.recordRecentAction('body','body|BODY-02|L3|A',ids[0],{now:'2026-09-12T10:03:00.000Z'});
  eq(V15.listRecentActions('body','body|BODY-02|L3|A').map(x=>x.actionId),[ids[0],ids[1]]);
}

{
  const first=boot(),id=Object.keys(first.D.actions)[0];
  first.V15.recordRecentAction('f111','preset|F111-06-L3|A',id,{now:'2026-09-12T10:00:00.000Z'});
  const second=boot(first.memory);
  eq(second.V15.listRecentActions('f111','preset|F111-06-L3|A').map(x=>x.actionId),[id]);
}

{
  const {Recent,D}=boot(),ids=Object.keys(D.actions).slice(0,4);
  const ctx=Recent.context.body({familyId:'BODY-02',level:'L3',slotKey:'A'});
  assert.strictEqual(ctx,'body|BODY-02|L3|A');
  const f111=Recent.context.f111Composer({lowerMode:'single_leg_hinge',upperMode:'horizontal_push',level:'L3',coreDemand:'anti_extension',slotKey:'A'});
  assert.strictEqual(f111,'composer|single_leg_hinge|horizontal_push|L3|anti_extension|A');
  const conditioning=Recent.context.conditioning({familyId:'CON-03',level:'L2',protocolId:'CIRCUIT',stationKey:'S1'});
  assert.strictEqual(conditioning,'conditioning|CON-03|L2|CIRCUIT|S1');

  const state=Recent.state();
  state.recordRecentAction('body',ctx,ids[0],{now:'2026-09-12T10:00:00.000Z'});
  state.recordRecentAction('body',ctx,ids[1],{now:'2026-09-12T10:01:00.000Z'});
  const legal=Recent.quickCandidates({
    templateId:'body',contextKey:ctx,
    candidates:[{actionId:ids[0],name:'A'},{actionId:ids[2],name:'C'}],
    currentActionId:ids[2],
  });
  eq(legal.map(x=>x.actionId),[ids[0]]);
  assert.strictEqual(Recent.record({
    templateId:'body',contextKey:ctx,actionId:ids[3],
    candidates:[{actionId:ids[0]},{actionId:ids[2]}],
  }),false,'illegal action must not be recorded');
}

console.log('recent_actions_runtime_test: PASS');
