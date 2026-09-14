const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(initialMemory={}){
  const memory=initialMemory;
  const sessionStorage={
    getItem:key=>memory[key]??null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console,URLSearchParams,Date,location:{hash:''}};
  ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
    'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js',
    'js/coach/common.js','js/coach/template-ui.js','js/coach/conditioning-prep.js','js/coach/conditioning-recovery.js','js/coach/conditioning-session.js',
    'js/saved-sessions.js','js/coach/saved-sessions.js','js/router.js','js/template-search.js'
  ])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {ctx,memory,D:ctx.window.V14_DATA,R:ctx.window.V15TemplateResolver,Contract:ctx.window.V15ResolvedSession,Cond:ctx.window.V15ConditioningResolver,Session:ctx.window.V14CoachModules.ConditioningSession,Save:ctx.window.V15SavedSessions,S:ctx.window.V15State};
}

const env=boot();
const {D,R,Contract,Cond,Session,Save,S}=env;

// Explicit legacy Protocol intent must not silently become the default blueprint.
{
  const context=Session.context({area:'coach',page:'template-compose',templateId:'conditioning',query:{family:'CON-03',level:'L2',protocol:'CIRCUIT'}});
  assert.strictEqual(context.legacyProtocolId,'CIRCUIT');
  assert.strictEqual(context.session.schemaVersion,1);
  assert.strictEqual(context.session.domainContext.protocolId,'CIRCUIT');
}

// A valid explicit Protocol that is represented by a blueprint can select that variant.
{
  const context=Session.context({area:'coach',page:'template-compose',templateId:'conditioning',query:{family:'CON-03',level:'L3',protocol:'CIRCUIT'}});
  assert.strictEqual(context.legacyProtocolId,'');
  assert.strictEqual(context.variantId,'A');
  assert.strictEqual(context.session.schemaVersion,2);
  assert.strictEqual(context.session.blocks[0].protocolId,'CIRCUIT');
}

// Deterministic rotation is explicit and also works when only the previous saved variant is known.
assert.strictEqual(Session.nextVariantId({familyId:'CON-03',level:'L3',currentVariantId:'A'}),'B');
assert.strictEqual(Session.nextVariantId({familyId:'CON-03',level:'L3',currentVariantId:'B'}),'C');
assert.strictEqual(Session.nextVariantId({familyId:'CON-03',level:'L3',currentVariantId:'C'}),'A');
assert.strictEqual(Session.nextVariantId({familyId:'CON-03',level:'L3',previousVariantId:'B'}),'C');

// UNIQUE_ACTIONS is enforced at the selection boundary, not only by resolver fallback.
{
  const first='BLOCK-A/STATION-1',second='BLOCK-B/STATION-1',actionId='huaxueji_jiange';
  assert.strictEqual(Cond.isSelectionValid({
    familyId:'CON-03',level:'L3',variantId:'A',stationKey:first,actionId,
    currentSelections:{[second]:{actionId,source:'manual'}},
  }),false);
  assert.strictEqual(Cond.isSelectionValid({
    familyId:'CON-03',level:'L3',variantId:'A',slotKey:first,actionId,
    currentSelections:{[first]:{actionId,source:'manual'}},
  }),true);
}

// A v2 record with a valid variant but a missing blueprint id is repairable and remains atomic.
{
  S.ensureSession('conditioning','CON-03-L3-BLUEPRINT-B',{familyId:'CON-03',level:'L3',resolverVersion:'conditioning-v2',input:{familyId:'CON-03',level:'L3',variantId:'B',sessionBlueprintId:'CON-03-L3-B'}});
  const record=S.createSavedSession('conditioning','CON-03-L3-BLUEPRINT-B',{savedId:'corrupt-conditioning-v2',name:'损坏的 B 变体'});
  const raw=JSON.parse(env.memory['7fit-v15-state']);
  assert(raw.savedSessions[record.savedId],'saved Conditioning record should be persisted');
  delete raw.savedSessions[record.savedId].input.sessionBlueprintId;
  env.memory['7fit-v15-state']=JSON.stringify(raw);
  const corrupted=boot(env.memory);
  assert(corrupted.S.getSavedSession(record.savedId),'corrupted saved record should remain available for explicit repair');
  const before=JSON.stringify(corrupted.S.getSavedSession(record.savedId));
  const repaired=corrupted.Save.migrate(record.savedId);
  assert.strictEqual(repaired.ok,true,JSON.stringify(repaired));
  assert.strictEqual(repaired.code,'REPAIRED_EXPLICITLY');
  assert.notStrictEqual(repaired.savedId,record.savedId);
  assert.strictEqual(corrupted.S.getSavedSession(record.savedId).input.sessionBlueprintId,undefined);
  assert.strictEqual(JSON.stringify(corrupted.S.getSavedSession(record.savedId)),before,'repair must retain the original backup record');
  const repairedRecord=corrupted.S.getSavedSession(repaired.savedId);
  assert.strictEqual(repairedRecord.input.variantId,'B');
  assert.strictEqual(repairedRecord.input.sessionBlueprintId,'CON-03-L3-B');
}

// Real v2 sessions are rejected when blueprint identity/order or station legality is tampered with.
{
  const valid=R.resolve('conditioning',{familyId:'CON-03',level:'L3',variantId:'A'});
  const validContract=Contract.validate(valid);
  assert.strictEqual(validContract.ok,true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(validContract)),{ok:true,errors:[]});
  const wrongIdentity=JSON.parse(JSON.stringify(valid));
  wrongIdentity.variantId='B';
  assert(Contract.validate(wrongIdentity).errors.some(error=>error.includes('variantId')));
  const wrongOrder=JSON.parse(JSON.stringify(valid));
  [wrongOrder.blocks[0],wrongOrder.blocks[1]]=[wrongOrder.blocks[1],wrongOrder.blocks[0]];
  assert(Contract.validate(wrongOrder).errors.some(error=>error.includes('blocks')));
  const illegalStation=JSON.parse(JSON.stringify(valid));
  illegalStation.blocks[0].stations['BLOCK-A/STATION-1'].actionId='pallof_press';
  assert(Contract.validate(illegalStation).errors.some(error=>error.includes('conditioning')));
}

// The L1 timeline derives its phases from its actual two blocks.
{
  const html=Session.render({area:'coach',page:'template-session',templateId:'conditioning',familyId:'CON-01',level:'L1',query:{}});
  assert(html.includes('准备 → 建立段 → 主训练段 → 恢复'));
  assert(!html.includes('准备 → 建立 → 主训练 → 挑战 → 恢复'));
}

// Every Family × Level exposes three materially distinct blueprint signatures.
{
  for(const familyId of D.conditioningFamilyIds)for(const level of ['L1','L2','L3','L4']){
    const signatures=Object.values(D.conditioningBlueprints[familyId][level]).map(blueprint=>JSON.stringify(blueprint.blocks.map(block=>({
      role:block.role,protocolId:block.protocolId,targetMinutes:block.targetMinutes,targetRpe:block.targetRpe,
      actions:block.stations.map(station=>station.actionId),
    }))));
    assert.strictEqual(new Set(signatures).size,3,`${familyId} ${level} variants need substantive differences`);
  }
}

console.log('conditioning_review_regression_test: PASS');
