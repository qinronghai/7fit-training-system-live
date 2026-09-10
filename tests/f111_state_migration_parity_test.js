const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
const read=file=>fs.readFileSync(`${root}/${file}`,'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

function baseContext(memory={}){
  const sessionStorage={
    getItem:key=>memory[key]??null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console,URLSearchParams,location:{hash:''}};
  ctx.window.addEventListener=()=>{};
  vm.createContext(ctx);
  return ctx;
}
function load(ctx,file){vm.runInContext(read(file),ctx,{filename:file});}
function probeFixtures(){
  const ctx=baseContext({});
  load(ctx,'data/system-data.js');
  load(ctx,'js/composer.js');
  const D=ctx.window.V14_DATA;
  const sessionId='F111-06-L3',session=D.sessions[sessionId],view=D.sessionViews[sessionId];
  const replaceable=session.slots.find(slot=>(view.slotOptions?.[slot.slotKey]||[]).some(option=>option.id!==slot.baselineId));
  assert(replaceable,'expected an official preset slot with a legal replacement');
  const presetAlt=(view.slotOptions[replaceable.slotKey]||[]).find(option=>option.id!==replaceable.baselineId)?.id;
  assert(presetAlt&&D.actions[presetAlt],`expected valid preset replacement for ${replaceable.slotKey}`);

  const composerInput={level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',coreDemand:'anti_extension'};
  const resolved=ctx.window.V14Composer.resolve(composerInput);
  const composerSlot=resolved.slots.find(slot=>(resolved.slotOptions[slot.slotKey]||[]).some(option=>option.id!==slot.actionId));
  assert(composerSlot,'expected a composer slot with a legal replacement');
  const composerAlt=(resolved.slotOptions[composerSlot.slotKey]||[]).find(option=>option.id!==composerSlot.actionId)?.id;
  assert(composerAlt&&D.actions[composerAlt],`expected valid composer replacement for ${composerSlot.slotKey}`);
  return {
    sessionId,recipeId:'F111-06',level:'L3',presetSlotKey:replaceable.slotKey,presetKey:String(replaceable.slotKey).split('__').pop(),presetAlt,
    composerInput,compositionKey:`${resolved.compositionId}-L3`,composerSlotKey:composerSlot.slotKey,composerAlt,
  };
}
function boot(memory){
  const ctx=baseContext(memory);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/state.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
    'js/composer.js','js/conflict.js','js/resolved-session.js','js/template-resolver.js','js/resolvers/f111.js',
    'js/coach/common.js','js/coach/session.js','js/coach/composer-view.js'
  ]) load(ctx,file);
  return ctx;
}

const fixture=probeFixtures();
const legacy={
  selections:{
    [fixture.sessionId]:{
      [fixture.presetSlotKey]:fixture.presetAlt,
      'F111-06-L3__STALE':'action-that-does-not-exist',
    },
  },
  composerSelections:{
    [fixture.compositionKey]:{
      [fixture.composerSlotKey]:fixture.composerAlt,
      STALE:'action-that-does-not-exist',
    },
  },
};
const memory={'7fit-v14-state':JSON.stringify(legacy)};
let ctx=boot(memory),S=ctx.window.V15State,V14=ctx.window.V14State,M=ctx.window.V14CoachModules;
assert.strictEqual(S.getLoadStatus().code,'MIGRATED_V14');

// Legacy preset -> templates.f111 -> V15 ResolvedSession.
let presetState=S.getSession('f111',fixture.sessionId);
assert(presetState,'legacy preset must migrate into templates.f111');
assert.strictEqual(presetState.selections[fixture.presetKey].actionId,fixture.presetAlt);
assert.strictEqual(presetState.selections[fixture.presetKey].source,'manual');
assert.strictEqual(presetState.selections.STALE,undefined,'unknown legacy preset actions must not migrate');
let presetResolved=M.Session.resolveResolvedSession(fixture.sessionId,fixture.recipeId,fixture.level);
assert.strictEqual(presetResolved.main.content.find(slot=>slot.key===fixture.presetKey).actionId,fixture.presetAlt);
assert.strictEqual(presetResolved.main.content.find(slot=>slot.key===fixture.presetKey).source,'manual');

// Legacy composer -> templates.f111 -> V15 ResolvedSession through Composer context.
let composerState=S.getSession('f111',fixture.compositionKey);
assert(composerState,'legacy composer must migrate into templates.f111');
assert.strictEqual(composerState.selections[fixture.composerSlotKey].actionId,fixture.composerAlt);
assert.strictEqual(composerState.selections[fixture.composerSlotKey].source,'manual');
assert.strictEqual(composerState.selections.STALE,undefined,'unknown legacy composer actions must not migrate');
let composerCtx=M.ComposerView.composerContext({query:{
  level:fixture.composerInput.level,
  lower:fixture.composerInput.lowerMode,
  upper:fixture.composerInput.upperMode,
  core:fixture.composerInput.coreDemand,
}});
assert.strictEqual(composerCtx.stateKey,fixture.compositionKey);
assert.strictEqual(composerCtx.resolvedSession.main.content.find(slot=>slot.key===fixture.composerSlotKey).actionId,fixture.composerAlt);
assert.strictEqual(composerCtx.resolvedSession.main.content.find(slot=>slot.key===fixture.composerSlotKey).source,'manual');

// Reload from serialized V15 state preserves the same decisions without needing legacy storage again.
delete memory['7fit-v14-state'];
ctx=boot(memory);S=ctx.window.V15State;V14=ctx.window.V14State;M=ctx.window.V14CoachModules;
assert.strictEqual(S.getLoadStatus().code,'LOADED');
presetResolved=M.Session.resolveResolvedSession(fixture.sessionId,fixture.recipeId,fixture.level);
assert.strictEqual(presetResolved.main.content.find(slot=>slot.key===fixture.presetKey).actionId,fixture.presetAlt);
composerCtx=M.ComposerView.composerContext({query:{
  level:fixture.composerInput.level,
  lower:fixture.composerInput.lowerMode,
  upper:fixture.composerInput.upperMode,
  core:fixture.composerInput.coreDemand,
}});
assert.strictEqual(composerCtx.resolvedSession.main.content.find(slot=>slot.key===fixture.composerSlotKey).actionId,fixture.composerAlt);

// V14 facade and V15 namespace are the same persisted source of truth.
assert.strictEqual(V14.getSelection(fixture.sessionId,fixture.presetSlotKey),fixture.presetAlt);
assert.strictEqual(V14.getComposerSelection(fixture.compositionKey,fixture.composerSlotKey),fixture.composerAlt);
assert.deepStrictEqual(plain(S.getSelections('f111',fixture.sessionId)[fixture.presetKey]),{actionId:fixture.presetAlt,source:'manual'});
assert.deepStrictEqual(plain(S.getSelections('f111',fixture.compositionKey)[fixture.composerSlotKey]),{actionId:fixture.composerAlt,source:'manual'});

console.log('f111_state_migration_parity_test: PASS');
