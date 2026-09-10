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
  'js/composer.js','js/conflict.js','js/resolved-session.js','js/template-resolver.js','js/resolvers/f111.js','js/module-copy.js','js/coach/common.js','js/coach/slot.js','js/coach/foam.js','js/coach/prep.js',
  'js/coach/summary.js','js/coach/conflict-view.js','js/coach/session.js','js/coach/composer-view.js'
]) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
const D=ctx.window.V14_DATA,S=ctx.window.V15State,V14=ctx.window.V14State,M=ctx.window.V14CoachModules;
const plain=v=>JSON.parse(JSON.stringify(v));

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

// Preset UI exposes a replacement selector and source label.
const presetHtml=M.Session.render({recipeId,level});
assert(presetHtml.includes('prep-slot-select'),'Preset PREP must render replacement selects');
assert(presetHtml.includes('系统推荐'),'Preset PREP must show source label');

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
slot=firstReplaceableSlot(composerPrep); assert(slot,'expected replaceable Composer PREP slot');
const composerManual=slot.candidates.find(c=>c.actionId!==slot.actionId); assert(composerManual);
S.setPrepSelection('f111',stateKey,slot.slotKey,composerManual.actionId,'manual');
composerPrep=M.Prep.resolveComposerPrep(composerCtx);
assert.strictEqual(composerPrep.slots.find(x=>x.slotKey===slot.slotKey).actionId,composerManual.actionId);
assert.strictEqual(composerPrep.slots.find(x=>x.slotKey===slot.slotKey).source,'manual');
const composerHtml=M.Prep.composerPrepHtml(composerCtx);
assert(composerHtml.includes('prep-slot-select'),'Composer PREP must render replacement selects');
M.Prep.composerPrepItems=()=>{throw new Error('legacy composerPrepItems must not be used by copy');};
const composerPayload=M.ComposerView.buildComposerCopyPayload(composerCtx);
assert(composerPayload.warmups.some(x=>x.name===composerManual.name),'Composer copy must include current manual PREP');
V14.resetComposer(stateKey);
assert.deepStrictEqual(plain(S.getPrepSelections('f111',stateKey)),{});

console.log('prep_phase_b1_state_copy_test: PASS');
