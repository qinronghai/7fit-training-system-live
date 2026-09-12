const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(initial={}){
  const memory={...initial};
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},location:{hash:''},URLSearchParams,console,Date};
  ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/composer.js','js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js',
    'js/conflict-plugins/f111.js','js/conflict-plugins/body.js','js/conflict-plugins/conditioning.js','js/conflict.js',
    'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/f111.js','js/resolvers/body.js',
    'js/resolvers/conditioning.js','js/saved-sessions.js'
  ])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {
    memory,ctx,D:ctx.window.V14_DATA,S:ctx.window.V15State,V14:ctx.window.V14State,
    Save:ctx.window.V15SavedSessions,R:ctx.window.V15TemplateResolver,
    Body:ctx.window.V15BodyResolver,Cond:ctx.window.V15ConditioningResolver,
    Prep:ctx.window.V14PrepResolver,Composer:ctx.window.V14Composer,
  };
}
const plain=value=>JSON.parse(JSON.stringify(value));
const logical=key=>String(key||'').includes('__')?String(key).split('__').pop():String(key||'');

function firstPrepIntent(Prep,resolved){
  const auto=Prep.resolve(resolved.prepContext,{});
  for(const slot of auto.slots){
    const candidate=(slot.candidates||[]).find(item=>item.actionId&&item.actionId!==slot.actionId);
    if(candidate)return {slotKey:slot.slotKey,actionId:candidate.actionId};
  }
  throw new Error('expected replaceable PREP slot');
}

const env=boot(),{D,S,V14,Save,R,Body,Cond,Prep,Composer}=env;

// F111 preset round-trip.
const presetId='F111-06-L3',recipeId='F111-06',level='L3';
V14.getSessionSelections(presetId);
const presetData=D.sessions[presetId],presetView=D.sessionViews[presetId]||{};
let presetChoice=null;
for(const slot of presetData.slots){
  const option=(presetView.slotOptions?.[slot.slotKey]||[]).find(item=>item.id&&item.id!==slot.baselineId);
  if(option){presetChoice={key:logical(slot.slotKey),actionId:option.id};break;}
}
assert(presetChoice,'F111 preset needs one legal alternate');
V14.setSelection(presetId,presetChoice.key,presetChoice.actionId);
const presetResolved=R.resolve('f111',{mode:'preset',recipeId,level,selections:V14.getSessionSelections(presetId)});
const presetPrep=firstPrepIntent(Prep,presetResolved);
S.setPrepSelection('f111',presetId,presetPrep.slotKey,presetPrep.actionId,'manual');
const savedPreset=Save.saveCurrent({templateId:'f111',sessionKey:presetId,name:'F111 收藏',now:'2026-09-12T07:00:00Z'});
assert.strictEqual(savedPreset.input.mode,'preset');
S.resetSession('f111',presetId);
const restoredPreset=Save.restore(savedPreset.id);
assert.strictEqual(restoredPreset.routeHash,'#/coach/f111/f111-06/l3');
assert.deepStrictEqual(plain(S.getSelections('f111',presetId)[presetChoice.key]),{actionId:presetChoice.actionId,source:'manual'});
assert.deepStrictEqual(plain(S.getPrepSelections('f111',presetId)[presetPrep.slotKey]),{actionId:presetPrep.actionId,source:'manual'});
assert.strictEqual(restoredPreset.resolvedSession.main.content.find(x=>x.key===presetChoice.key).actionId,presetChoice.actionId);

// F111 Composer exact input + manual choice round-trip.
const composerInput={
  mode:'composer',level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',
  coreDemand:'anti_rotation',includeExpandedMain:false,includeExpandedSupport:false,includeExpandedCore:false,
};
const composerBase=Composer.resolve(composerInput),composerKey=`${composerBase.compositionId}-L3`;
V14.setComposerContext(composerKey,composerInput);
const composerAlt=composerBase.slotOptions.A.find(item=>item.id!==composerBase.slots.find(x=>x.slotKey==='A').actionId);
assert(composerAlt,'F111 Composer needs alternate A');
V14.setComposerSelection(composerKey,'A',composerAlt.id);
const composerResolved=R.resolve('f111',{...composerInput,selections:V14.getComposerSelections(composerKey)});
const composerPrep=firstPrepIntent(Prep,composerResolved);
S.setPrepSelection('f111',composerKey,composerPrep.slotKey,composerPrep.actionId,'manual');
const savedComposer=Save.saveCurrent({templateId:'f111',sessionKey:composerKey,name:'单腿拉×水平推',now:'2026-09-12T07:01:00Z'});
assert.strictEqual(savedComposer.input.lowerMode,'single_leg_hinge');
assert.strictEqual(savedComposer.input.upperMode,'horizontal_push');
assert.strictEqual(savedComposer.input.coreDemand,'anti_rotation');
S.resetSession('f111',composerKey);
const restoredComposer=Save.restore(savedComposer.id);
assert(restoredComposer.routeHash.includes('lower=single_leg_hinge'));
assert(restoredComposer.routeHash.includes('upper=horizontal_push'));
assert(restoredComposer.routeHash.includes('core=anti_rotation'));
assert.deepStrictEqual(plain(S.getSession('f111',composerKey).input.lowerMode),'single_leg_hinge');
assert.deepStrictEqual(plain(S.getSelections('f111',composerKey).A),{actionId:composerAlt.id,source:'manual'});
assert.deepStrictEqual(plain(S.getPrepSelections('f111',composerKey)[composerPrep.slotKey]),{actionId:composerPrep.actionId,source:'manual'});

// Body round-trip + stale action fallback.
const bodyFamily='BODY-02',bodyLevel='L3',bodyKey='BODY-02-L3';
S.ensureSession('body',bodyKey,{familyId:bodyFamily,level:bodyLevel,resolverVersion:'body-v1',input:{familyId:bodyFamily,level:bodyLevel}});
const bodyAuto=R.resolve('body',{familyId:bodyFamily,level:bodyLevel,selections:{}});
const bodyPrimary=bodyAuto.main.content.find(x=>x.key==='PRIMARY');
const bodyAlt=Body.candidates({familyId:bodyFamily,level:bodyLevel,slotKey:'PRIMARY',currentSelections:{}})
  .candidates.find(x=>x.actionId!==bodyPrimary.actionId);
assert(bodyAlt,'Body needs alternate PRIMARY');
S.setSelection('body',bodyKey,'PRIMARY',bodyAlt.actionId,'manual');
const bodyResolved=R.resolve('body',{familyId:bodyFamily,level:bodyLevel,selections:S.getSelections('body',bodyKey)});
const bodyPrep=firstPrepIntent(Prep,bodyResolved);
S.setPrepSelection('body',bodyKey,bodyPrep.slotKey,bodyPrep.actionId,'manual');
const savedBody=Save.saveCurrent({templateId:'body',sessionKey:bodyKey,name:'Body 臀腿',now:'2026-09-12T07:02:00Z'});
S.resetSession('body',bodyKey);
let restoredBody=Save.restore(savedBody.id);
assert.strictEqual(restoredBody.routeHash,'#/coach/body/body-02/l3');
assert.deepStrictEqual(plain(S.getSelections('body',bodyKey).PRIMARY),{actionId:bodyAlt.actionId,source:'manual'});
assert.deepStrictEqual(plain(S.getPrepSelections('body',bodyKey)[bodyPrep.slotKey]),{actionId:bodyPrep.actionId,source:'manual'});

const oldRoute=D.actions[bodyAlt.actionId].route;
D.actions[bodyAlt.actionId].route='POST_CARDIO_ONLY';
S.resetSession('body',bodyKey);
restoredBody=Save.restore(savedBody.id);
assert(restoredBody.reasons.includes('STALE_SELECTION'));
assert(restoredBody.droppedSelections.includes('PRIMARY'));
assert.strictEqual(S.getSelections('body',bodyKey).PRIMARY,undefined);
assert.notStrictEqual(restoredBody.resolvedSession.main.content.find(x=>x.key==='PRIMARY').actionId,bodyAlt.actionId);
D.actions[bodyAlt.actionId].route=oldRoute;

// Conditioning round-trip.
const condFamily='CON-03',condLevel='L2',protocolId='CIRCUIT',condKey='CON-03-L2-CIRCUIT';
S.ensureSession('conditioning',condKey,{familyId:condFamily,level:condLevel,resolverVersion:'conditioning-v1',input:{familyId:condFamily,level:condLevel,protocolId}});
const condAuto=R.resolve('conditioning',{familyId:condFamily,level:condLevel,protocolId,selections:{}});
const condCurrent=Object.fromEntries(Object.values(condAuto.domainContext.stations).map(x=>[x.key,x.actionId]));
const condStation=condAuto.domainContext.stations['STATION-1'];
const condAlt=Cond.candidates({familyId:condFamily,level:condLevel,protocolId,stationKey:'STATION-1',currentSelections:condCurrent})
  .candidates.find(x=>x.actionId!==condStation.actionId);
assert(condAlt,'Conditioning needs alternate station');
S.setSelection('conditioning',condKey,'STATION-1',condAlt.actionId,'manual');
const condResolved=R.resolve('conditioning',{familyId:condFamily,level:condLevel,protocolId,selections:S.getSelections('conditioning',condKey)});
const condPrep=firstPrepIntent(Prep,condResolved);
S.setPrepSelection('conditioning',condKey,condPrep.slotKey,condPrep.actionId,'manual');
const savedCond=Save.saveCurrent({templateId:'conditioning',sessionKey:condKey,name:'混合体能',now:'2026-09-12T07:03:00Z'});
S.resetSession('conditioning',condKey);
const restoredCond=Save.restore(savedCond.id);
assert.strictEqual(restoredCond.routeHash,'#/coach/conditioning/con-03/l2');
assert.deepStrictEqual(plain(S.getSelections('conditioning',condKey)['STATION-1']),{actionId:condAlt.actionId,source:'manual'});
assert.deepStrictEqual(plain(S.getPrepSelections('conditioning',condKey)[condPrep.slotKey]),{actionId:condPrep.actionId,source:'manual'});
assert.strictEqual(restoredCond.resolvedSession.domainContext.stations['STATION-1'].actionId,condAlt.actionId);

// Stale Conditioning Protocol migrates to current default instead of injecting an illegal protocol.
const staleProtocol=S.putSavedSession({
  id:'saved-cond-stale-protocol',schemaVersion:1,resolverVersion:'conditioning-v1',
  templateId:'conditioning',familyId:'CON-01',level:'L1',
  input:{familyId:'CON-01',level:'L1',protocolId:'CIRCUIT'},
  selections:{},prepSelections:{},
  createdAt:'2026-09-12T07:04:00.000Z',updatedAt:'2026-09-12T07:04:00.000Z',
  name:'旧 Protocol',sessionKey:'CON-01-L1-CIRCUIT'
});
const migratedProtocol=Save.restore(staleProtocol.id);
assert(migratedProtocol.reasons.includes('STALE_PROTOCOL'));
assert.strictEqual(migratedProtocol.resolvedSession.domainContext.protocolId,'STEADY');
assert.strictEqual(migratedProtocol.sessionKey,'CON-01-L1-STEADY');

// Resolver mismatch is migrated through the current resolver, preserving legal intent.
const oldVersion=S.putSavedSession({
  ...savedBody,id:'saved-body-old-resolver',resolverVersion:'body-v0',
  createdAt:'2026-09-12T07:05:00.000Z',updatedAt:'2026-09-12T07:05:00.000Z'
});
const migratedVersion=Save.restore(oldVersion.id);
assert(migratedVersion.reasons.includes('RESOLVER_VERSION_MIGRATED'));
assert.strictEqual(migratedVersion.state.resolverVersion,'body-v1');

// Saved records persist after service/state reload.
const reloaded=boot(env.memory);
assert(reloaded.Save.list().length>=6);
assert(reloaded.Save.get(savedComposer.id));
assert(reloaded.Save.get(savedCond.id));

console.log('saved_sessions_roundtrip_test: F111/Body/Conditioning restore PASS');
