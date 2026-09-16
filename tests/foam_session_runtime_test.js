const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js',
  'js/conflict-plugins/f111.js','js/conflict-plugins/body.js','js/conflict-plugins/conditioning.js',
  'js/conditioning-protocol.js','js/conflict.js','js/composer.js','js/template-resolver.js',
  'js/resolvers/f111.js','js/resolvers/body.js','js/resolvers/conditioning.js','js/resolvers/hyrox.js',
  'js/recovery-protocol-adapter.js','js/module-copy.js','js/coach/common.js','js/coach/foam.js'
])load(file);

const D=window.V14_DATA,M=window.V14CoachModules,R=window.V15TemplateResolver,A=window.V14RecoveryProtocolAdapter;
const Foam=M.Foam;
assert(Foam&&typeof Foam.itemsForSession==='function','Foam must expose itemsForSession');
assert(Foam&&typeof Foam.foamRollCardsFor==='function','Foam must expose foamRollCardsFor');

const sessions={
  body01:R.resolve('body',{familyId:'BODY-01',level:'L3'}),
  body03:R.resolve('body',{familyId:'BODY-03',level:'L3'}),
  body04:R.resolve('body',{familyId:'BODY-04',level:'L3'}),
  con01:R.resolve('conditioning',{familyId:'CON-01',level:'L3'}),
  con04:R.resolve('conditioning',{familyId:'CON-04',level:'L3'}),
  hyroxSkill:R.resolve('hyrox',{sessionType:'SKILL',level:'L3',protocolId:''}),
  hyroxMixed:R.resolve('hyrox',{sessionType:'MIXED',level:'L3',protocolId:''}),
};
function names(session){return Foam.itemsForSession(session,{level:session.level}).map(f=>f.name);}
function foamIdOf(session,muscle){
  const foamId=window.V14_ANATOMY.foamByMuscle[muscle];
  return D.foamRollDetails[foamId];
}

// --- every template gets a muscle-ranked foam block -------------------------
for(const [label,session] of Object.entries(sessions)){
  const items=Foam.itemsForSession(session,{level:session.level});
  assert(items.length>0,`${label} must produce foam-roll items`);
  assert(items.length<=4,`${label} must not exceed four foam-roll items, saw ${items.length}`);
  assert(items.every(item=>item&&item.name&&item.foamId),`${label} foam items must be catalogue records`);
  assert(items.every(item=>D.foamRollDetails[item.foamId]),`${label} foam ids must exist in the catalogue`);
  // Level eligibility is respected (FOAM-07 is T2+ only).
  assert(items.every(item=>item.sessionLevels.includes(session.level)),`${label} foam items must be level-eligible`);
}

// --- the roller targets the muscle groups the session trained ---------------
// Same rule as the stitch selection: 用到得多的就松解哪些. Every foam item must map
// back to a muscle the session actually loaded.
for(const [label,session] of Object.entries(sessions)){
  const exposure=A.muscleExposure(session);
  const loaded=new Set(Object.keys(exposure));
  const reachable=new Set();
  Object.entries(window.V14_ANATOMY.foamByMuscle).forEach(([muscle,foamId])=>{
    if(loaded.has(muscle))reachable.add(foamId);
  });
  for(const item of Foam.itemsForSession(session,{level:session.level})){
    assert(reachable.has(item.foamId),`${label} rolled ${item.name} but no trained muscle maps to it`);
  }
}

// --- 小腿后侧 belongs to the roller, not the stitches ----------------------
// The coach releases the calf with the foam roller, so a session that trains
// calves must offer it here (and never as a stretch card).
assert(names(sessions.con04).includes('泡沫轴松解-小腿'),
  'CON-04 trains 腓肠肌 / 比目鱼肌, so 小腿后侧 must be offered on the roller');
const calf=sessions.con04.domainContext.stations&&Object.keys(sessions.con04.domainContext.stations);
assert(calf.length>0,'CON-04 must expose stations');
assert(!names(sessions.body03).includes('泡沫轴松解-小腿'),
  'BODY-03 trains no calf, so it must not be offered');

// --- leg day rolls legs, back-and-shoulders day rolls upper body ------------
assert(names(sessions.body01).every(name=>/臀部|大腿|小腿/.test(name)),
  `BODY-01 is a legs-only day, saw ${names(sessions.body01).join(' / ')}`);
assert(names(sessions.body04).every(name=>!/(臀部|大腿|小腿)/.test(name)),
  `BODY-04 is an upper-only day, saw ${names(sessions.body04).join(' / ')}`);

// --- card markup / copy contract -------------------------------------------
const block=Foam.foamRollCardsFor({session:sessions.body01,level:'L3',subtitle:'臀腿｜股四主导 · L3'});
assert(block.includes('session-foam-card'),'foam block must render cards');
assert(block.includes('ROLL'),'foam cards must carry the ROLL label');
assert(block.includes('复制本模块'),'foam block must offer the module copy button');
assert.strictEqual((block.match(/session-foam-card/g)||[]).length,4,'foam block must render one card per item');
assert.strictEqual(Foam.foamRollCardsFor({session:null,level:'L3'}),'','a session without muscles must render nothing');

// --- the three session renderers embed the block ---------------------------
for(const file of ['js/coach/body-session.js','js/coach/conditioning-session.js','js/coach/hyrox-session.js']){
  const source=fs.readFileSync(`${root}/${file}`,'utf8');
  assert(/renderResolved\([^)]*session[^)]*\)/.test(source)||/renderResolved\(ctx\.prep,ctx\.sessionKey,ctx\.session\)/.test(source),
    `${file} must pass the session into its PREP renderer`);
}
for(const file of ['js/coach/body-prep.js','js/coach/conditioning-prep.js','js/coach/hyrox-prep.js']){
  const source=fs.readFileSync(`${root}/${file}`,'utf8');
  assert(source.includes('foamRollCardsFor'),`${file} must render the foam block`);
}

console.log('foam session runtime: PASS');
