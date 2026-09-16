const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/f111.js',
  'js/conflict-plugins/body.js','js/conflict-plugins/conditioning.js','js/conditioning-protocol.js',
  'js/conflict.js','js/composer.js','js/resolved-session.js','js/template-resolver.js',
  'js/resolvers/f111.js','js/resolvers/body.js','js/resolvers/conditioning.js','js/resolvers/hyrox.js',
  'js/recovery-protocol-adapter.js','js/recovery-matcher.js'
])load(file);

const D=window.V14_DATA,R=window.V15TemplateResolver,M=window.V14RecoveryMatcher,A=window.V14RecoveryProtocolAdapter;
assert(A&&typeof A.signals==='function','recovery protocol adapter must expose signals');

function regions(result){return result.items.map(item=>item.region);}
function protocol(templateId,input){return M.match(R.resolve(templateId,input));}

// --- Protocol sessions resolve to three matched regions ---------------------
const conditioning=protocol('conditioning',{familyId:'CON-01',level:'L3'});
const hyrox=protocol('hyrox',{sessionType:'SKILL',level:'L3',protocolId:''});
for(const [label,result] of [['conditioning',conditioning],['hyrox',hyrox]]){
  assert.strictEqual(result.status,'complete',`${label} must resolve three Recovery cards`);
  assert.strictEqual(result.items.length,3,`${label} must produce exactly three cards`);
  assert.strictEqual(new Set(regions(result)).size,3,`${label} regions must be unique`);
  assert(result.items.some(item=>item.regionGroup==='upper'),`${label} must cover an upper-body region`);
  assert(result.items.some(item=>item.regionGroup==='lower'),`${label} must cover a lower-body region`);
  assert(result.items.every(item=>D.actions[item.id]?.route==='RECOVERY_2F'),`${label} cards must be RECOVERY_2F actions`);
  assert(result.items.every(item=>item.reason&&item.detail),`${label} cards must explain the match`);
}

// --- The adapter must actually differentiate sessions ------------------------
// Summing every matching signal made all 24 Conditioning/HYROX family x level
// sessions collapse onto the same three broadest cards; that regression is the
// reason this test exists.
const signatures=new Set();
for(const familyId of ['CON-01','CON-02','CON-03','CON-04']){
  for(const level of ['L1','L2','L3','L4']){
    signatures.add(regions(protocol('conditioning',{familyId,level})).join(','));
  }
}
for(const sessionType of ['SKILL','MIXED']){
  for(const level of ['L1','L2','L3','L4']){
    signatures.add(regions(protocol('hyrox',{sessionType,level,protocolId:''})).join(','));
  }
}
assert(signatures.size>=5,`protocol Recovery must differ per session, saw ${signatures.size} distinct result(s)`);

// A rowing / ski session is pull-dominant, so it must not select the chest.
assert(regions(protocol('conditioning',{familyId:'CON-01',level:'L3'})).includes('upper_back'),
  'rowing / ski Conditioning must expose an upper-back Recovery target');

// The posterior chain is the primary driver of every protocol family.
const gluteRows=Object.keys(D.actions).length&&['CON-01','CON-02','CON-03','CON-04'].flatMap(familyId=>
  ['L1','L2','L3','L4'].filter(level=>regions(protocol('conditioning',{familyId,level})).includes('glute')));
assert(gluteRows.length>=12,`臀部 must stay in most leg-loaded protocol sessions, saw ${gluteRows.length}/16`);

// --- Adapter signals are derived, weighted, and inert for SLOT --------------
const conditioningSession=R.resolve('conditioning',{familyId:'CON-01',level:'L3'});
const signals=A.signals(conditioningSession);
assert(signals.length>0,'Conditioning must yield derived demand signals');
assert(signals.every(signal=>signal.key&&signal.actionId),'signals must carry the station identity');
assert(signals.every(signal=>Number.isFinite(signal.weight)&&signal.weight>0),'signals must carry an exposure weight');
assert(signals.some(signal=>signal.weight===5)&&signals.some(signal=>signal.weight===2),
  'primary movers must outweigh assisting muscles');
assert(signals.every(signal=>!(signal.pattern&&signal.loadFamily)),
  'each signal carries a single demand term so the matcher keeps its single-term contract');
assert.strictEqual(A.signals(R.resolve('body',{familyId:'BODY-01',level:'L3'})).length,0,
  'SLOT sessions must not produce adapter signals');
assert.strictEqual(A.signals({main:{kind:'PROTOCOL'}}).length,0,'a protocol without stations must yield nothing');

// --- SLOT behaviour is untouched -------------------------------------------
// The adapter path is additive: F111 / Body must keep the exact matching they
// shipped with (#118), including the pull/push distinction.
const pull=protocol('f111',{mode:'preset',recipeId:'F111-01',level:'L3'});
const push=protocol('f111',{mode:'preset',recipeId:'F111-06',level:'L3'});
assert(regions(pull).includes('upper_back'),'horizontal pull must still expose upper_back');
assert(regions(push).includes('chest'),'horizontal push must still expose chest');
assert.notDeepStrictEqual(regions(pull),regions(push),'pull and push must differ');
assert.strictEqual(regions(protocol('body',{familyId:'BODY-01',level:'L3'})).join(','),'upper_back,glute,hip_flexor',
  'Body L3 must keep the #118 matching result');
assert.deepStrictEqual(regions(protocol('f111',{mode:'preset',recipeId:'F111-01',level:'L3'})),regions(pull),
  'SLOT matching must stay deterministic');

// --- Unknown protocol stations fail loudly, not silently --------------------
const unknown=M.match({main:{kind:'PROTOCOL'},domainContext:{stations:{'STATION-1':{key:'STATION-1',actionId:'does-not-exist'}}}});
assert.strictEqual(unknown.status,'incomplete','an unmappable protocol must not fabricate Recovery');
assert(unknown.message.includes('人工安排'));

console.log('recovery protocol adapter runtime: PASS');
