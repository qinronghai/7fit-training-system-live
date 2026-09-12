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
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/composer.js','js/resolved-session.js','js/conflict-core.js','js/conflict-service.js',
    'js/conflict-plugins/f111.js','js/conflict-plugins/body.js','js/conflict-plugins/conditioning.js','js/conflict.js',
    'js/body-volume.js','js/conditioning-protocol.js','js/template-resolver.js',
    'js/resolvers/f111.js','js/resolvers/body.js','js/resolvers/conditioning.js','js/saved-sessions.js'
  ])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {
    ctx,memory,D:ctx.window.V14_DATA,S:ctx.window.V15State,Save:ctx.window.V15SavedSessions,
    R:ctx.window.V15TemplateResolver,Prep:ctx.window.V14PrepResolver,
    Body:ctx.window.V15BodyResolver,Cond:ctx.window.V15ConditioningResolver,
  };
}
const plain=v=>JSON.parse(JSON.stringify(v));
function normalizeSlotKey(slot,index){
  const raw=String(slot?.slotKey||'');
  if(raw.includes('__'))return raw.split('__').pop();
  const label=String(slot?.slotName||'');
  if(label.includes('｜'))return label.split('｜')[0];
  return raw||`S${index+1}`;
}
function firstPrepAlternate(Prep,context){
  const resolved=Prep.resolve(context,{selections:{}});
  for(const slot of resolved.slots||[]){
    const alt=(slot.candidates||[]).find(c=>c.actionId!==slot.actionId);
    if(alt)return {slotKey:slot.slotKey,actionId:alt.actionId};
  }
  return null;
}

const env=boot({});
const {D,S,Save,R,Prep,Body,Cond}=env;

// F111 preset round-trip including PREP.
{
  const recipeId='F111-01',level='L2',sessionId=`${recipeId}-${level}`;
  S.ensureSession('f111',sessionId,{familyId:recipeId,level,resolverVersion:'f111-adapter-v1',input:{mode:'preset',recipeId,level,sessionId}});
  const session=D.sessions[sessionId],view=D.sessionViews[sessionId]||{};
  let chosen=null;
  for(let i=0;i<session.slots.length&&!chosen;i++){
    const slot=session.slots[i],key=normalizeSlotKey(slot,i);
    const alt=(view.slotOptions?.[slot.slotKey]||[]).find(x=>x.id!==slot.baselineId);
    if(alt)chosen={key,actionId:alt.id,index:i};
  }
  assert(chosen,'F111 preset needs a legal alternate');
  S.setSelection('f111',sessionId,chosen.key,chosen.actionId,'manual');
  const selected=session.slots.map((slot,i)=>i===chosen.index?chosen.actionId:slot.baselineId);
  const resolved=R.resolve('f111',{mode:'preset',recipeId,level,selections:selected});
  const prepAlt=firstPrepAlternate(Prep,resolved.prepContext);
  assert(prepAlt,'F111 preset needs PREP alternate');
  S.setPrepSelection('f111',sessionId,prepAlt.slotKey,prepAlt.actionId,'manual');

  const record=Save.saveRoute({templateId:'f111',page:'preset',recipeId,level},'F111 保存测试',{savedId:'save-f111',now:'2026-09-12T08:00:00.000Z'});
  assert.strictEqual(record.input.mode,'preset');
  S.resetSession('f111',sessionId);
  const restored=Save.restore('save-f111');
  assert.strictEqual(restored.ok,true);
  assert.strictEqual(restored.hash,'#/coach/f111/f111-01/l2');
  assert.deepStrictEqual(plain(S.getSelections('f111',sessionId)[chosen.key]),{actionId:chosen.actionId,source:'manual'});
  assert.deepStrictEqual(plain(S.getPrepSelections('f111',sessionId)[prepAlt.slotKey]),{actionId:prepAlt.actionId,source:'manual'});
}

// Body round-trip + stale formal selection falls back instead of injecting invalid state.
{
  const familyId='BODY-02',level='L3',sessionKey=`${familyId}-${level}`;
  S.ensureSession('body',sessionKey,{familyId,level,resolverVersion:'body-v1',input:{familyId,level}});
  const base=R.resolve('body',{familyId,level,selections:{}});
  const slot=base.main.content[0];
  const current=Object.fromEntries(base.main.content.map(x=>[x.key,x.actionId]));
  const alt=Body.candidates({familyId,level,slotKey:slot.key,currentSelections:current}).candidates.find(x=>x.actionId!==slot.actionId);
  assert(alt,'Body needs alternate');
  S.setSelection('body',sessionKey,slot.key,alt.actionId,'manual');
  const manual=R.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)});
  const prepAlt=firstPrepAlternate(Prep,manual.prepContext);
  assert(prepAlt,'Body needs PREP alternate');
  S.setPrepSelection('body',sessionKey,prepAlt.slotKey,prepAlt.actionId,'manual');

  Save.saveRoute({templateId:'body',page:'template-session',familyId,level},'Body 保存测试',{savedId:'save-body',now:'2026-09-12T08:05:00.000Z'});
  S.resetSession('body',sessionKey);
  let restored=Save.restore('save-body');
  assert.strictEqual(restored.ok,true);
  assert.deepStrictEqual(plain(S.getSelections('body',sessionKey)[slot.key]),{actionId:alt.actionId,source:'manual'});
  assert.deepStrictEqual(plain(S.getPrepSelections('body',sessionKey)[prepAlt.slotKey]),{actionId:prepAlt.actionId,source:'manual'});

  const originalRoute=D.actions[alt.actionId].route;
  D.actions[alt.actionId].route='POST_CARDIO_ONLY';
  S.resetSession('body',sessionKey);
  restored=Save.restore('save-body');
  assert.strictEqual(restored.ok,true);
  assert(restored.reasons.includes('STALE_SELECTION'));
  assert(restored.droppedSelections.includes(slot.key));
  assert.strictEqual(S.getSelections('body',sessionKey)[slot.key],undefined);
  const safe=R.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)});
  assert.notStrictEqual(safe.main.content.find(x=>x.key===slot.key).actionId,alt.actionId);
  D.actions[alt.actionId].route=originalRoute;
}

// Conditioning Protocol stale recovery: saved DENSITY safely falls back to current default CIRCUIT.
{
  const familyId='CON-03',level='L2',protocolId='DENSITY',sessionKey=`${familyId}-${level}-${protocolId}`;
  S.ensureSession('conditioning',sessionKey,{familyId,level,resolverVersion:'conditioning-v1',input:{familyId,level,protocolId}});
  const base=R.resolve('conditioning',{familyId,level,protocolId,selections:{}});
  const first=Object.values(base.domainContext.stations)[0];
  const current=Object.fromEntries(Object.values(base.domainContext.stations).map(x=>[x.key,x.actionId]));
  const alt=Cond.candidates({familyId,level,protocolId,stationKey:first.key,currentSelections:current}).candidates.find(x=>x.actionId!==first.actionId);
  assert(alt,'Conditioning needs alternate');
  S.setSelection('conditioning',sessionKey,first.key,alt.actionId,'manual');

  Save.saveRoute({templateId:'conditioning',page:'template-compose',query:{family:familyId,level,protocol:protocolId}},'Conditioning 保存测试',{savedId:'save-cond',now:'2026-09-12T08:10:00.000Z'});
  S.resetSession('conditioning',sessionKey);
  let restored=Save.restore('save-cond');
  assert.strictEqual(restored.ok,true);
  assert.strictEqual(restored.hash,`#/coach/conditioning/compose?family=${familyId}&level=${level}&protocol=${protocolId}`);
  assert.deepStrictEqual(plain(S.getSelections('conditioning',sessionKey)[first.key]),{actionId:alt.actionId,source:'manual'});

  const original=[...D.conditioningFamilies[familyId].protocolEligibility];
  D.conditioningFamilies[familyId].protocolEligibility=original.filter(x=>x!==protocolId);
  S.resetSession('conditioning',sessionKey);
  restored=Save.restore('save-cond');
  assert.strictEqual(restored.ok,true);
  assert(restored.reasons.includes('STALE_PROTOCOL'));
  assert(restored.hash.includes('protocol=CIRCUIT'));
  const migratedKey=`${familyId}-${level}-CIRCUIT`;
  const migratedState=S.getSession('conditioning',migratedKey);
  assert(migratedState,'stale protocol restore must create a current legal session');
  const safe=R.resolve('conditioning',{familyId,level,protocolId:'CIRCUIT',selections:S.getSelections('conditioning',migratedKey)});
  assert.strictEqual(safe.domainContext.protocolId,'CIRCUIT');
  D.conditioningFamilies[familyId].protocolEligibility=original;
}

// Resolver mismatch is a migration signal; selections are revalidated under current code.
{
  const raw=JSON.parse(env.memory['7fit-v15-state']);
  raw.savedSessions['save-f111'].resolverVersion='f111-adapter-v0';
  env.memory['7fit-v15-state']=JSON.stringify(raw);
  const reboot=boot(env.memory);
  const result=reboot.Save.restore('save-f111');
  assert.strictEqual(result.ok,true);
  assert(result.reasons.includes('RESOLVER_VERSION_MISMATCH'));
}

// Unsupported saved schema fails closed without touching current sessions.
{
  const raw=JSON.parse(env.memory['7fit-v15-state']);
  raw.savedSessions['save-f111'].schemaVersion=99;
  env.memory['7fit-v15-state']=JSON.stringify(raw);
  const reboot=boot(env.memory);
  const before=plain(reboot.S.snapshot().templates);
  const result=reboot.Save.restore('save-f111');
  assert.strictEqual(result.ok,false);
  assert.strictEqual(result.code,'UNSUPPORTED_SAVED_SCHEMA');
  assert.deepStrictEqual(plain(reboot.S.snapshot().templates),before);
}

console.log('saved_sessions_restore_test: 3-template round-trip + stale recovery PASS');
