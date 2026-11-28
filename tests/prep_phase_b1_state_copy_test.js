const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
const memory={};
const sessionStorage={getItem:k=>memory[k]??null,setItem:(k,v)=>{memory[k]=String(v)},removeItem:k=>delete memory[k]};
const document={body:{dataset:{}}};
const ctx={window:{},sessionStorage,document,console,URLSearchParams,location:{hash:''}};
ctx.window.addEventListener=()=>{};
vm.createContext(ctx);
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/composer.js','js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/f111.js','js/conflict.js','js/template-resolver.js','js/resolvers/f111.js','js/recovery-matcher.js','js/module-copy.js','js/coach/common.js','js/coach/slot.js','js/coach/foam.js','js/coach/prep.js',
  'js/coach/summary.js','js/coach/conflict-view.js','js/coach/session.js','js/coach/composer-view.js'
]) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
const D=ctx.window.V14_DATA,S=ctx.window.V15State,V14=ctx.window.V14State,M=ctx.window.V14CoachModules;
const plain=v=>JSON.parse(JSON.stringify(v));

function assertF111Alternatives(prep){
  const currentIds=prep.slots.map(slot=>slot.actionId);
  const {level,formalActionIds}=prep.context;
  const primer=prep.slots.find(slot=>slot.slotKey==='PRIMER');
  assert.strictEqual(primer.prepGrade,`P${level.slice(-1)}`,'Default mode preparation must progress with the course level');
  for(const slot of prep.slots){
    const label=`${level} ${prep.context.mainPatterns.join('+')} ${slot.slotKey}`;
    const alternatives=slot.candidates.filter(item=>item.actionId!==slot.actionId);
    assert(alternatives.length>=8,`${label} has only ${alternatives.length} replacements`);
    assert.strictEqual(new Set(slot.candidates.map(item=>item.actionId)).size,slot.candidates.length,label);
    assert(slot.candidates.some(item=>item.actionId===slot.actionId),`${label} must include the current selection`);
    assert(alternatives.every(item=>!formalActionIds.includes(item.actionId)&&!currentIds.includes(item.actionId)),label);
    assert(alternatives.every(item=>!item.f111Slot||item.f111Slot===slot.slotKey),label);
    if(slot.slotKey==='INTEGRATED')assert(alternatives.every(item=>item.sequencePhase==='standing-dynamic'),label);
    const ranks=slot.candidates.map(item=>ctx.window.V14PrepGrade.gradeRank(level,item.prepGrade));
    assert(ranks.every((rank,index)=>Number.isFinite(rank)&&(index===0||rank>=ranks[index-1])),label);
  }
}

assert.strictEqual(typeof M.Prep.resolvePresetPrep,'function','Preset PREP must use shared Phase B1 resolver');
assert.strictEqual(typeof M.Prep.resolveComposerPrep,'function','Composer PREP must use shared Phase B1 resolver');

function firstReplaceableSlot(resolved){return resolved.slots.find(slot=>slot.actionId&&slot.candidates.length>1);}
function invalidActionFor(slot){return Object.keys(D.actions).find(id=>id!==slot.actionId&&!slot.candidates.some(c=>c.actionId===id));}

// Preset: auto -> manual -> stale fallback, all in templates.f111 PREP namespace.
const sessionId='F111-01-L3',recipeId='F111-01',level='L3';
const session=D.sessions[sessionId];
const selected=session.slots.map(slot=>slot.baselineId);
let preset=M.Prep.resolvePresetPrep(sessionId,recipeId,level,selected);
assert.deepStrictEqual(plain(preset.slots.map(x=>x.slotKey)),['MOB-L','MOB-U','PRIMER','CORE-ACT','INTEGRATED']);
assert(preset.slots.every(x=>x.source==='auto'));
let slot=firstReplaceableSlot(preset); assert(slot,'expected replaceable preset PREP slot');
const manual=slot.candidates.find(c=>c.actionId!==slot.actionId); assert(manual);
S.setPrepSelection('f111',sessionId,slot.slotKey,manual.actionId,'manual');
preset=M.Prep.resolvePresetPrep(sessionId,recipeId,level,selected);
assert.strictEqual(preset.slots.find(x=>x.slotKey===slot.slotKey).actionId,manual.actionId);
assert.strictEqual(preset.slots.find(x=>x.slotKey===slot.slotKey).source,'manual');
assert.strictEqual(S.getPrepSelections('f111',sessionId)[slot.slotKey].actionId,manual.actionId);
const badId=invalidActionFor(slot); assert(badId);
S.setPrepSelection('f111',sessionId,slot.slotKey,badId,'manual');
preset=M.Prep.resolvePresetPrep(sessionId,recipeId,level,selected);
assert(preset.fallbackSlots.includes(slot.slotKey),'invalid preset PREP must report fallback');
assert.strictEqual(S.getPrepSelections('f111',sessionId)[slot.slotKey],undefined,'invalid manual PREP must be removed from state');
assert.strictEqual(preset.slots.find(x=>x.slotKey===slot.slotKey).source,'auto');

// Preset UI keeps the replacement control and compact action-card layout.
const presetHtml=M.Session.render({recipeId,level});
assert(presetHtml.includes('prep-slot-select'),'Preset PREP must render replacement selects');
assert(presetHtml.includes('prep-card-meta'),'Preset PREP must retain action-role metadata');
assert(presetHtml.includes('prep-card-title-row'),'Preset PREP must keep the action and replacement control in its compact card row');
assert(presetHtml.includes('f111-prep-purpose'),'Preset PREP must show the slot purpose beside each exercise');

// Copy must consume the same resolved PREP; old matchedWarmups path must not be called.
preset=M.Prep.resolvePresetPrep(sessionId,recipeId,level,selected);
slot=firstReplaceableSlot(preset); const copyManual=slot.candidates.find(c=>c.actionId!==slot.actionId); assert(copyManual);
S.setPrepSelection('f111',sessionId,slot.slotKey,copyManual.actionId,'manual');
const expectedName=copyManual.name;
M.Prep.matchedWarmups=()=>{throw new Error('legacy matchedWarmups must not be used by copy');};
const payload=M.Session.buildCopyPayload(sessionId,recipeId,level);
assert(payload.warmups.some(x=>x.name===expectedName),'Preset copy must include current manual PREP');

// Reset removes PREP manual state together with formal session state.
V14.resetSession(sessionId);
assert.deepStrictEqual(plain(S.getPrepSelections('f111',sessionId)),{});
preset=M.Prep.resolvePresetPrep(sessionId,recipeId,level,selected);
assert(preset.slots.every(x=>x.source==='auto'));

// Composer uses the same PREP engine/state key and its Copy also consumes current resolved PREP.
const resolved=ctx.window.V14Composer.resolve({level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',coreDemand:'anti_extension'});
const stateKey=`${resolved.compositionId}-L3`;
const composerCtx={level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',coreDemand:'anti_extension',stateKey,resolved};
let composerPrep=M.Prep.resolveComposerPrep(composerCtx);
const changed=ctx.window.V14Composer.resolve({...composerCtx,selections:{C:'SUP-S2-01',CORE:'CORE-L3-01'}});
const prepAfterSwap=M.Prep.resolveComposerPrep({...composerCtx,resolved:changed});
assert(prepAfterSwap.context.supportPatterns.includes('肩胛稳定'));
assert.deepStrictEqual(plain(prepAfterSwap.context.coreDemands),[D.actions['CORE-L3-01'].coreDemand]);

for(const mode of ctx.window.V14Composer.combinations()){
  for(const level of ['L1','L2','L3','L4']){
    const resolved=ctx.window.V14Composer.resolve({...mode,level});
    const prep=M.Prep.resolveComposerPrep({level,stateKey:resolved.compositionId+'-'+level,resolved});
    assert.strictEqual(prep.slots.length,5);
    assert(prep.slots.every(slot=>slot.actionId),resolved.compositionId+' '+level+' has an empty warm-up slot');
    assertF111Alternatives(prep);
    const primer=prep.slots.find(slot=>slot.slotKey==='PRIMER');
    assert(primer.targetPatterns.some(pattern=>prep.context.mainPatterns.includes(pattern)));
  }
}
for(const [id,session] of Object.entries(D.sessions)){
  if(!/^F111-\d{2}-L[1-4]$/.test(id))continue;
  assertF111Alternatives(M.Prep.resolvePresetPrep(id,id.slice(0,-3),id.slice(-2),session.slots.map(slot=>slot.baselineId)));
}
slot=firstReplaceableSlot(composerPrep); assert(slot,'expected replaceable Composer PREP slot');
const composerManual=slot.candidates.find(c=>c.actionId!==slot.actionId); assert(composerManual);
S.setPrepSelection('f111',stateKey,slot.slotKey,composerManual.actionId,'manual');
composerPrep=M.Prep.resolveComposerPrep(composerCtx);
assert.strictEqual(composerPrep.slots.find(x=>x.slotKey===slot.slotKey).actionId,composerManual.actionId);
assert.strictEqual(composerPrep.slots.find(x=>x.slotKey===slot.slotKey).source,'manual');
const composerHtml=M.Prep.composerPrepHtml(composerCtx);
assert(composerHtml.includes('prep-slot-select'),'Composer PREP must render replacement selects');
assert.strictEqual((composerHtml.match(/class="f111-prep-purpose"/g)||[]).length,5);
M.Prep.composerPrepItems=()=>{throw new Error('legacy composerPrepItems must not be used by copy');};
const composerPayload=M.ComposerView.buildComposerCopyPayload(composerCtx);
assert(composerPayload.warmups.some(x=>x.name===composerManual.name),'Composer copy must include current manual PREP');
V14.resetComposer(stateKey);
assert.deepStrictEqual(plain(S.getPrepSelections('f111',stateKey)),{});

console.log('prep_phase_b1_state_copy_test: PASS');
