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
    'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
    'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js','js/saved-sessions.js',
    'js/coach/common.js','js/coach/template-ui.js','js/coach/conditioning-session.js'
  ])vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {ctx,memory,S:ctx.window.V15State,Save:ctx.window.V15SavedSessions,Session:ctx.window.V14CoachModules.ConditioningSession};
}

function plain(value){return JSON.parse(JSON.stringify(value));}

const env=boot();
const {S,Save,Session}=env;
const familyId='CON-03',level='L3',variantId='A';
const legacyKey=`${familyId}-${level}-CIRCUIT`;
S.ensureSession('conditioning',legacyKey,{
  familyId,level,resolverVersion:'conditioning-v1',
  input:{familyId,level,protocolId:'CIRCUIT'},
});
S.setSelection('conditioning',legacyKey,'STATION-1','huaxueji_jiange','manual');
const legacyBefore=plain(S.getSession('conditioning',legacyKey));

const current=Session.ensureState(familyId,level,'CIRCUIT');
const blueprintKey=Session.sessionKeyFor(familyId,level,'CIRCUIT');
assert.strictEqual(blueprintKey,`${familyId}-${level}-BLUEPRINT-${variantId}`);
assert.strictEqual(current.resolverVersion,'conditioning-v2');
assert.strictEqual(current.input.variantId,variantId);
assert.strictEqual(current.input.sessionBlueprintId,`${familyId}-${level}-${variantId}`);
assert.deepStrictEqual(plain(S.getSession('conditioning',legacyKey)),legacyBefore,'legacy single-block state must remain untouched');
assert.deepStrictEqual(plain(S.getSelections('conditioning',blueprintKey)),{},'new blueprint state must not inherit legacy station keys');

const legacySaved={
  savedId:'legacy-conditioning',schemaVersion:1,resolverVersion:'conditioning-v1',templateId:'conditioning',
  familyId,level,input:{familyId,level,protocolId:'CIRCUIT',surface:'session'},
  selections:{'STATION-1':{actionId:'huaxueji_jiange',source:'manual'}},prepSelections:{},
  createdAt:'2026-09-14T01:00:00.000Z',updatedAt:'2026-09-14T01:00:00.000Z',name:'旧版单块体能课',
};
const raw=JSON.parse(env.memory['7fit-v15-state']);
raw.savedSessions[legacySaved.savedId]=legacySaved;
env.memory['7fit-v15-state']=JSON.stringify(raw);
const reboot=boot(env.memory);
const blocked=reboot.Save.restore(legacySaved.savedId);
assert.strictEqual(blocked.ok,false,'legacy saved Conditioning must not be silently restored');
assert.strictEqual(blocked.code,'CONDITIONING_BLUEPRINT_MIGRATION_REQUIRED');
assert.strictEqual(reboot.S.getSavedSession(legacySaved.savedId).resolverVersion,'conditioning-v1');
const migrated=reboot.Save.migrate(legacySaved.savedId);
assert.strictEqual(migrated.ok,true);
assert.strictEqual(migrated.code,'MIGRATED_EXPLICITLY');
assert.notStrictEqual(migrated.savedId,legacySaved.savedId);
assert.strictEqual(reboot.S.getSavedSession(legacySaved.savedId).resolverVersion,'conditioning-v1','original record remains as backup');
const migratedRecord=reboot.S.getSavedSession(migrated.savedId);
assert.strictEqual(migratedRecord.resolverVersion,'conditioning-v2');
assert.strictEqual(migratedRecord.input.variantId,'A');
assert.strictEqual(migratedRecord.input.sessionBlueprintId,`${familyId}-${level}-A`);
assert.deepStrictEqual(plain(migratedRecord.selections),{},'legacy single-block selections must not be mapped by position');

console.log('conditioning_blueprint_state_migration_test: PASS');
