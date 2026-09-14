const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

const memory={};
const sessionStorage={
  getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
  setItem:(key,value)=>{memory[key]=String(value);},
  removeItem:key=>{delete memory[key];},
};
const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console};
vm.createContext(ctx);
function load(file){vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
]) load(file);

const S=ctx.window.V15State,Body=ctx.window.V15BodyResolver,Resolver=ctx.window.V15TemplateResolver;
const familyId='BODY-01',level='L2',sessionKey=`${familyId}-${level}`;
const reason='教练已现场确认会员具备当前器械负荷能力';
const plain=value=>JSON.parse(JSON.stringify(value));
S.ensureSession('body',sessionKey,{familyId,level,resolverVersion:'body-v1',input:{familyId,level}});
S.setSelection('body',sessionKey,'PRIMARY','hake_shendun','manual',{venueOverrideReason:reason});
assert.deepStrictEqual(plain(S.getSelections('body',sessionKey).PRIMARY),{actionId:'hake_shendun',source:'manual',venueOverrideReason:reason});

const reconciled=S.reconcileSession('body',sessionKey,{
  resolverVersion:'body-v1',
  isSelectionValid:(slotKey,entry,state)=>Body.isSelectionValid({
    familyId:state.familyId,
    level:state.level,
    slotKey,
    actionId:entry.actionId,
    venueOverrideReason:entry.venueOverrideReason,
    currentSelections:Object.fromEntries(Object.entries(state.selections||{}).map(([key,value])=>[key,value.actionId])),
  }),
});
assert.deepStrictEqual(plain(reconciled.reasons),[],'valid venue override must survive State reconciliation');
const resolved=Resolver.resolve('body',{familyId,level,selections:S.getSelections('body',sessionKey)});
assert.strictEqual(resolved.main.content.find(item=>item.key==='PRIMARY').actionId,'hake_shendun');
assert.strictEqual(resolved.domainContext.venue.slots.PRIMARY.status,'OVERRIDDEN');
assert.notStrictEqual(resolved.conflictContext.status,'FAIL','venue override must not become a slot-intent conflict');
assert(!resolved.conflictContext.issues.some(issue=>issue.code==='BODY_SLOT_INTENT_MISMATCH'),'venue audit codes must stay out of slot-intent conflicts');

S.setSelection('body',sessionKey,'SECONDARY','movement_supported_split_squat','manual');
const stored=S.getSession('body',sessionKey);
assert.strictEqual(Object.prototype.hasOwnProperty.call(stored.selections.SECONDARY,'venueOverrideReason'),false,'normal selections must not gain override metadata');

console.log('body_venue_state_test: #94 State override persistence GREEN');
