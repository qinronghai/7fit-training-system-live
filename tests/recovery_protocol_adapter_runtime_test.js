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
/**
 * Assert the coach's rule held: the cards are the hardest-trained regions, so no
 * region left off the card was trained harder than one that made it. Ties are
 * allowed to resolve either way.
 */
function assertHardestTrained(session,picked,label){
  assert.strictEqual(picked.length,3,`${label} must pick three regions`);
  const exposure=A.exposureByRegion(session);
  const leftOff=Object.entries(exposure)
    .filter(([region])=>region!=='calf'&&!picked.includes(region))
    .map(([,weight])=>weight);
  const onCard=picked.map(region=>exposure[region]??0);
  const lowestPicked=Math.min(...onCard);
  const highestLeftOff=leftOff.length?Math.max(...leftOff):0;
  assert(lowestPicked>=highestLeftOff,
    `${label} picked ${picked.join('/')} but left a harder-trained region off the card`);
}
const FAMILIES=['CON-01','CON-02','CON-03','CON-04'];
const LEVELS=['L1','L2','L3','L4'];

// --- Protocol sessions resolve to three matched regions ---------------------
for(const [label,result] of [['conditioning',protocol('conditioning',{familyId:'CON-01',level:'L3'})],
  ['hyrox',protocol('hyrox',{sessionType:'SKILL',level:'L3',protocolId:''})]]){
  assert.strictEqual(result.status,'complete',`${label} must resolve three Recovery cards`);
  assert.strictEqual(result.items.length,3,`${label} must produce exactly three cards`);
  assert.strictEqual(new Set(regions(result)).size,3,`${label} regions must be unique`);
  assert(result.items.some(item=>item.regionGroup==='upper'),`${label} must cover an upper-body region`);
  assert(result.items.some(item=>item.regionGroup==='lower'),`${label} must cover a lower-body region`);
  assert(result.items.every(item=>D.actions[item.id]?.route==='RECOVERY_2F'),`${label} cards must be RECOVERY_2F actions`);
  assert(result.items.every(item=>item.reason&&item.detail),`${label} cards must explain the match`);
  assert(result.items.every(item=>item.prescription==='45 秒'),`${label} cards must carry a prescription`);
}

// --- Regions follow the muscle groups the session actually trained ----------
// Recovery follows the coach's rule: stretch the major muscle groups the main
// and accessory work loaded hardest, one action per region, about three in
// total. So every selected region must carry real exposure, and no card may
// come from a region the session never loaded.
for(const familyId of FAMILIES){
  for(const level of LEVELS){
    const session=R.resolve('conditioning',{familyId,level});
    const loaded=new Set(A.signals(session).map(signal=>signal.region));
    const picked=regions(M.match(session));
    for(const region of picked)assert(loaded.has(region),`${familyId} ${level} selected ${region} but never loaded it`);
    assertHardestTrained(session,picked,`${familyId} ${level}`);
  }
}
for(const sessionType of ['SKILL','MIXED']){
  for(const level of LEVELS){
    const session=R.resolve('hyrox',{sessionType,level,protocolId:''});
    const loaded=new Set(A.signals(session).map(signal=>signal.region));
    const picked=regions(M.match(session));
    for(const region of picked)assert(loaded.has(region),`HYROX ${sessionType} ${level} selected ${region} but never loaded it`);
    assertHardestTrained(session,picked,`HYROX ${sessionType} ${level}`);
  }
}

// A rowing / ski session is lat-dominant, so it must not select the chest.
assert(regions(protocol('conditioning',{familyId:'CON-01',level:'L3'})).includes('upper_back'),
  'rowing / ski Conditioning must expose an upper-back Recovery target');

// --- 小腿后侧 is foam-rolled, never stretched --------------------------------
// The action exists in RECOVERY_2F, but this gym recovers the calf with the foam
// roller during PREP, so it must not take one of the three stretch cards.
for(const familyId of FAMILIES){
  for(const level of LEVELS){
    assert(!regions(protocol('conditioning',{familyId,level})).includes('calf'),
      `Conditioning ${familyId} ${level} must not stretch 小腿后侧`);
  }
}
for(const sessionType of ['SKILL','MIXED']){
  for(const level of LEVELS){
    assert(!regions(protocol('hyrox',{sessionType,level,protocolId:''})).includes('calf'),
      `HYROX ${sessionType} ${level} must not stretch 小腿后侧`);
  }
}

// --- Adapter reports muscle-derived regions ---------------------------------
const signals=A.signals(R.resolve('conditioning',{familyId:'CON-04',level:'L3'}));
assert(signals.length>0,'Conditioning must yield derived region signals');
assert(signals.every(signal=>signal.key&&signal.actionId),'signals must carry the station identity');
assert(signals.every(signal=>typeof signal.region==='string'&&signal.region),'signals must name a recovery region');
assert(signals.every(signal=>Number.isFinite(signal.weight)&&signal.weight>0),'signals must carry an exposure weight');
assert(signals.some(signal=>signal.weight===5)&&signals.some(signal=>signal.weight===2),
  'primary movers must outweigh assisting muscles');
assert(signals.every(signal=>signal.pattern===''&&signal.loadFamily===''),
  'region signals must not smuggle movement patterns back into the protocol path');

// CON-04 loads 臀大肌 / 股四头肌 hardest and only brushes the adductor as a KB
// swing stabiliser. Movement-pattern matching used to put 大腿内侧 on the card
// off a 蹲 pattern alone; muscle-derived exposure must keep it off, because its
// exposure is far below the regions that actually carried the session.
const con04=protocol('conditioning',{familyId:'CON-04',level:'L3'});
assert.strictEqual(con04.items.some(item=>item.region==='adductor'),false,
  '大腿内侧 must not be stretched when it was only a light stabiliser');
assertHardestTrained(R.resolve('conditioning',{familyId:'CON-04',level:'L3'}),regions(con04),'CON-04 L3');

// SLOT sessions are handled from their own aggregated anatomy context.
const bodySignals=A.signals(R.resolve('body',{familyId:'BODY-01',level:'L3'}));
assert(bodySignals.length>0,'SLOT sessions must yield region signals from their anatomy context');
assert(bodySignals.every(signal=>signal.region&&signal.weight>0),'SLOT signals must name weighted regions');
// BODY-01 is 臀腿｜股四主导 and trains no upper body at all, so prescribing a
// 背阔肌 stretch for it — which the pattern-matched selection used to do — is the
// defect this rule exists to prevent.
assert(!bodySignals.some(signal=>signal.region==='upper_back'),
  'BODY-01 trains no upper body, so it must report no upper-back exposure');
assert.strictEqual(A.signals({main:{kind:'PROTOCOL'}}).length,0,'a protocol without stations must yield nothing');
assert.strictEqual(A.signals({main:{kind:'SLOT'},anatomyContext:{primary:[],secondary:[],stabilizers:[]}}).length,0,
  'a session with no measured muscle exposure must yield nothing');

// --- SLOT behaviour is untouched -------------------------------------------
const pull=protocol('f111',{mode:'preset',recipeId:'F111-01',level:'L3'});
const push=protocol('f111',{mode:'preset',recipeId:'F111-06',level:'L3'});
assert(regions(pull).includes('upper_back'),'horizontal pull must still expose upper_back');
assert(regions(push).includes('chest'),'horizontal push must still expose chest');
assert.notDeepStrictEqual(regions(pull),regions(push),'pull and push must differ');
// Body is a SLOT session too, so its cards follow its own trained muscles:
// BODY-01 (臀腿｜股四主导) is a legs-only day and must not carry a 背阔肌 stretch,
// while BODY-04 (胸肩臂) must not carry a leg stretch.
assert.strictEqual(regions(protocol('body',{familyId:'BODY-01',level:'L3'})).join(','),'glute,hamstring,hip_flexor',
  'BODY-01 trains only legs, so it must stretch only legs');
assert(!regions(protocol('body',{familyId:'BODY-04',level:'L3'})).some(region=>region==='hamstring'||region==='glute'),
  'BODY-04 trains no legs, so it must not stretch them');
assert.deepStrictEqual(regions(protocol('f111',{mode:'preset',recipeId:'F111-01',level:'L3'})),regions(pull),
  'SLOT matching must stay deterministic');

// --- Unknown protocol stations fail loudly, not silently --------------------
const unknown=M.match({main:{kind:'PROTOCOL'},domainContext:{stations:{'STATION-1':{key:'STATION-1',actionId:'does-not-exist'}}}});
assert.strictEqual(unknown.status,'incomplete','an unmappable protocol must not fabricate Recovery');
assert(unknown.message.includes('人工安排'));

console.log('recovery protocol adapter runtime: PASS');
