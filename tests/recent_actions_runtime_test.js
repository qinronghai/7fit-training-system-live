const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
const memory={};
global.window=global;
global.sessionStorage={
  getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
  setItem:(key,value)=>{memory[key]=String(value);},
  removeItem:key=>{delete memory[key];},
};
global.document={body:{dataset:{}}};
global.addEventListener=()=>{};
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of ['data/system-data.js','js/state.js','js/recent-actions.js'])load(file);

const R=window.V15RecentActions,S=window.V15State,D=window.V14_DATA;
const bodyIds=Object.keys(D.bodyActionMeta||{});
assert(bodyIds.length>=3,'need Body candidate fixtures');
const desc=R.body('BODY-02','L3','PRIMARY');
assert.strictEqual(desc.templateId,'body');
assert.strictEqual(desc.contextKey,'body:BODY-02:L3:PRIMARY');
assert.strictEqual(desc.context.role,D.bodyFamilies['BODY-02'].slotPolicy.PRIMARY);

const candidates=bodyIds.slice(0,3).map(actionId=>({actionId,name:D.actions[actionId].name}));
R.record(desc,candidates[1].actionId,{now:'2026-09-12T10:00:00.000Z'});
R.record(desc,candidates[2].actionId,{now:'2026-09-12T10:01:00.000Z'});

const ranked=R.rank(desc,candidates);
assert.deepStrictEqual(ranked.slice(0,2).map(x=>x.actionId),[candidates[2].actionId,candidates[1].actionId]);

const legalSubset=[candidates[0],candidates[1]];
const quick=R.quick(desc,legalSubset,{currentActionId:candidates[0].actionId});
assert.deepStrictEqual(quick.map(x=>x.actionId),[candidates[1].actionId]);
assert(!quick.some(x=>x.actionId===candidates[2].actionId),'recent action outside current legal candidates must not surface');

const preset=R.f111Preset('F111-06-L3','F111-06-L3__A');
assert.strictEqual(preset.contextKey,'preset:F111-06-L3:A');
const composer=R.f111Composer({stateKey:'F111-C-SLH-HP-L3',level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',coreDemand:'anti_extension',resolved:{compositionId:'F111-C-SLH-HP'}},'A');
assert.strictEqual(composer.contextKey,'composer:F111-C-SLH-HP-L3:A');
const cond=R.conditioning('CON-03','L2','CIRCUIT','STATION-1');
assert.strictEqual(cond.contextKey,'conditioning:CON-03:L2:CIRCUIT:STATION-1');

console.log('recent_actions_runtime_test: legal-candidate intersection PASS');
