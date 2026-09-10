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
  return {memory,V15:ctx.window.V15State,V14:ctx.window.V14State,D:ctx.window.V14_DATA};
}

const plain=value=>JSON.parse(JSON.stringify(value));
const eq=(actual,expected)=>assert.deepStrictEqual(plain(actual),expected);
function expectCode(fn,code){
  let thrown=null;
  try{fn();}catch(error){thrown=error;}
  assert(thrown,`expected ${code}`);
  assert.strictEqual(thrown.code,code);
}

// Fresh root: versioned and isolated to ACTIVE templates.
{
  const {V15}=boot();
  assert(V15,'window.V15State must exist');
  assert.strictEqual(V15.getSchemaVersion(),1);
  const snapshot=plain(V15.snapshot());
  assert.strictEqual(snapshot.schemaVersion,1);
  eq(Object.keys(snapshot.templates).sort(),['body','conditioning','f111']);
  for(const id of ['f111','body','conditioning'])eq(snapshot.templates[id],{sessions:{}});
  eq(snapshot.savedSessions,{});eq(snapshot.recentActions,[]);eq(snapshot.favorites,{});
  eq(JSON.parse(V15.serialize()),snapshot);
  expectCode(()=>V15.getSession('posture','demo'),'UNKNOWN_TEMPLATE');
}

// Namespace isolation: the same session key is legal in multiple templates.
{
  const {V15,D}=boot(),actionId=Object.keys(D.actions)[0];
  V15.ensureSession('f111','shared-L2',{familyId:'F111-01',level:'L2',resolverVersion:'f111-adapter-v1',input:{mode:'preset',recipeId:'F111-01',level:'L2'}});
  V15.ensureSession('body','shared-L2',{familyId:'BODY-DEMO',level:'L2',resolverVersion:'body-v1',input:{targetMuscles:['臀大肌']}});
  V15.ensureSession('conditioning','shared-L2',{familyId:'COND-DEMO',level:'L2',resolverVersion:'conditioning-v1',input:{goal:'work-capacity'}});
  V15.setSelection('f111','shared-L2','A',actionId,'manual');
  V15.setSelection('body','shared-L2','A',actionId,'auto');
  assert.strictEqual(V15.getSelections('f111','shared-L2').A.source,'manual');
  assert.strictEqual(V15.getSelections('body','shared-L2').A.source,'auto');
  eq(V15.getSelections('conditioning','shared-L2'),{});
}

// Formal + PREP manual selections survive state.js reload against the same tab storage.
{
  const first=boot(),actionId=Object.keys(first.D.actions)[0];
  const prepActionId=first.D.warmupDetails[first.D.warmupIds[0]].actionId;
  first.V15.ensureSession('body','BODY-DEMO-L3',{familyId:'BODY-DEMO',level:'L3',resolverVersion:'body-v1',input:{targetMuscles:['臀大肌']}});
  first.V15.setSelection('body','BODY-DEMO-L3','A',actionId,'manual');
  first.V15.setPrepSelection('body','BODY-DEMO-L3','MOB-L',prepActionId,'manual');
  const second=boot(first.memory);
  eq(second.V15.getSelections('body','BODY-DEMO-L3').A,{actionId,source:'manual'});
  eq(second.V15.getPrepSelections('body','BODY-DEMO-L3')['MOB-L'],{actionId:prepActionId,source:'manual'});
}

// Legacy V14 preset/composer state migrates into f111 without inventing coreDemand.
{
  const actionId='movement_db_single_leg_rdl';
  const legacy={
    selections:{'F111-01-L3':{'F111-01-L3__A':actionId}},
    composerSelections:{'F111-C-SLH-HP-L3':{A:actionId}},
  };
  const {V15,V14,memory}=boot({'7fit-v14-state':JSON.stringify(legacy)});
  const preset=plain(V15.getSession('f111','F111-01-L3'));
  assert.strictEqual(preset.familyId,'F111-01');assert.strictEqual(preset.level,'L3');
  assert.strictEqual(preset.resolverVersion,'f111-adapter-v1');
  eq(preset.input,{mode:'preset',recipeId:'F111-01',level:'L3'});
  eq(preset.selections.A,{actionId,source:'manual'});
  const composer=plain(V15.getSession('f111','F111-C-SLH-HP-L3'));
  assert.strictEqual(composer.level,'L3');assert.strictEqual(composer.input.mode,'composer');
  assert.strictEqual(composer.input.legacyCompositionKey,'F111-C-SLH-HP-L3');
  assert.strictEqual(Object.prototype.hasOwnProperty.call(composer.input,'coreDemand'),false);
  eq(composer.selections.A,{actionId,source:'manual'});
  assert.strictEqual(V14.getComposerSelection('F111-C-SLH-HP-L3','A','fallback'),actionId);
  assert(Object.prototype.hasOwnProperty.call(memory,'7fit-v15-state'));
}

// Invalid persisted V15 data fails closed.
{
  const unsupported=boot({'7fit-v15-state':JSON.stringify({schemaVersion:99,templates:{f111:{sessions:{bad:{x:1}}}}})});
  assert.strictEqual(unsupported.V15.getLoadStatus().code,'RESET_UNSUPPORTED_SCHEMA_VERSION');
  assert.strictEqual(unsupported.V15.getLoadStatus().observedVersion,99);
  eq(unsupported.V15.snapshot().templates.f111.sessions,{});
  const invalid=boot({'7fit-v15-state':'{not-json'});
  assert.strictEqual(invalid.V15.getLoadStatus().code,'RESET_INVALID_JSON');
  eq(invalid.V15.snapshot().templates.body.sessions,{});
}

// Resolver mismatch clears selections conservatively while preserving identity/input.
{
  const {V15,D}=boot(),actionId=Object.keys(D.actions)[0];
  const prepActionId=D.warmupDetails[D.warmupIds[0]].actionId;
  V15.ensureSession('f111','F111-01-L2',{familyId:'F111-01',level:'L2',resolverVersion:'f111-adapter-v1',input:{mode:'preset',recipeId:'F111-01',level:'L2'}});
  V15.setSelection('f111','F111-01-L2','A',actionId,'manual');
  V15.setPrepSelection('f111','F111-01-L2','MOB-L',prepActionId,'manual');
  const result=V15.reconcileSession('f111','F111-01-L2',{resolverVersion:'f111-adapter-v2'});
  assert(result.reasons.includes('RESOLVER_VERSION_MISMATCH'));
  eq(result.session.selections,{});eq(result.session.prepSelections,{});
  assert.strictEqual(result.session.resolverVersion,'f111-adapter-v2');
  eq(result.session.input,{mode:'preset',recipeId:'F111-01',level:'L2'});
}

// State delegates domain legality to caller validators and drops stale formal/PREP decisions.
{
  const {V15,D}=boot(),ids=Object.keys(D.actions),keepId=ids[0],dropId=ids[1];
  const prepKeep=D.warmupDetails[D.warmupIds[0]].actionId,prepDrop=D.warmupDetails[D.warmupIds[1]].actionId;
  V15.ensureSession('conditioning','COND-DEMO-L3',{familyId:'COND-DEMO',level:'L3',resolverVersion:'conditioning-v1',input:{goal:'engine'}});
  V15.setSelection('conditioning','COND-DEMO-L3','KEEP',keepId,'manual');
  V15.setSelection('conditioning','COND-DEMO-L3','DROP',dropId,'manual');
  V15.setPrepSelection('conditioning','COND-DEMO-L3','MOB-L',prepKeep,'manual');
  V15.setPrepSelection('conditioning','COND-DEMO-L3','PRIMER',prepDrop,'manual');
  const result=V15.reconcileSession('conditioning','COND-DEMO-L3',{
    resolverVersion:'conditioning-v1',
    isSelectionValid:key=>key!=='DROP',
    isPrepSelectionValid:key=>key!=='PRIMER',
  });
  assert(result.reasons.includes('STALE_SELECTION'));assert(result.reasons.includes('STALE_PREP_SELECTION'));
  eq(Object.keys(result.session.selections),['KEEP']);eq(Object.keys(result.session.prepSelections),['MOB-L']);
}

// V14 facade writes through to f111 and explicit clear removes both storage generations.
{
  const {V15,V14,D,memory}=boot(),presetId='F111-01-L3',slot=D.sessions['F111-01-L3'].slots[0];
  V14.setSelection(presetId,slot.slotKey,slot.baselineId);
  const formal=plain(V15.getSession('f111',presetId)),key=slot.slotKey.includes('__')?slot.slotKey.split('__').pop():slot.slotKey;
  eq(formal.selections[key],{actionId:slot.baselineId,source:'manual'});
  assert.strictEqual(V14.getSelection(presetId,slot.slotKey),slot.baselineId);
  V14.setComposerSelection('F111-C-SLH-HP-L3','A','movement_db_single_leg_rdl');
  assert.strictEqual(V15.getSelections('f111','F111-C-SLH-HP-L3').A.actionId,'movement_db_single_leg_rdl');
  V14.resetComposer('F111-C-SLH-HP-L3');eq(V15.getSelections('f111','F111-C-SLH-HP-L3'),{});
  memory['7fit-v14-state']=JSON.stringify({selections:{[presetId]:{[slot.slotKey]:slot.baselineId}},composerSelections:{}});
  V14.clear();
  assert.strictEqual(Object.prototype.hasOwnProperty.call(memory,'7fit-v14-state'),false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(memory,'7fit-v15-state'),false);
}

console.log('multi_template_state_test: PASS');
