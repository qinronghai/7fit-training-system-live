const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/composer.js','js/resolved-session.js','js/conflict-core.js','js/conflict-service.js',
  'js/conflict-plugins/f111.js','js/conflict.js','js/template-resolver.js','js/resolvers/f111.js',
  'js/coach/common.js','js/coach/f111-compose-ui.js','js/coach/slot.js','js/coach/session.js','js/coach/composer-view.js'
]) load(file);

const M=window.V14CoachModules;
window.V14State={getComposerSelections:()=>({})};
window.V14RecoveryMatcher={match:()=>({items:[]}),render:()=>'',copyItems:()=>[]};
window.V14ModuleCopy={register:()=>{},button:()=>''};
M.Foam={composerFoamItems:()=>[]};
M.Prep={
  composerPrepHtml:()=>'<section class="f111-prep-section"></section>',
  resolveComposerPrep:()=>({slots:[]}),
  resolvedItems:()=>[]
};
M.Summary={render:()=>''};
M.ConflictView={render:()=>''};
M.PostCardio={render:()=>'<button data-f111-option-drawer></button>'};
M.SavedSessionsUI={controls:()=>''};

const html=M.ComposerView.render({query:{level:'L2',lower:'squat',upper:'horizontal_pull',core:'anti_extension'}});

assert(html.includes('f111-compose-hero'),'F111 compose hero must use the frozen UI namespace');
assert(html.includes('F111｜女性综合训练'),'hero must present the user-facing F111 course title');
assert(html.includes('f111-compose-stepper'),'frozen step line must be present');
assert(html.includes('f111-mode-drawer-trigger'),'lower/upper modes must use drawer triggers');
assert(!html.includes('composer-mobile-selectors'),'native stacked mode selectors must be removed from the page');
assert(html.includes('f111-prep-grid'),'PREP must expose the frozen two-column grid hook');
assert(html.includes('f111-strength-grid'),'strength must expose the frozen two-column grid hook');
assert(html.includes('data-f111-action-drawer="C"'),'support action selection must be a compact drawer entry');
assert(html.includes('data-f111-action-drawer="CORE"'),'core action selection must be a compact drawer entry');
assert(fs.readFileSync(`${root}/js/coach/composer-view.js`,'utf8').includes('f111-anatomy-details'),'anatomy summary must be collapsed at the end of the strength section');
assert(fs.readFileSync(`${root}/js/coach/prep.js`,'utf8').includes('prep-card-action'),'PREP action detail must be attached to the action card instead of a separate link');
assert(html.includes('复制给教练'),'coach copy action must remain user-facing');
assert(html.includes('复制给会员'),'member copy action must remain user-facing');
assert(M.ComposerView.composeHref({level:'L2',lowerMode:'squat',upperMode:'horizontal_pull',coreDemand:'anti_extension'}).startsWith('#/coach/f111?'),
  'F111 stage and mode choices must keep the home composer route canonical');
assert(html.includes('data-f111-option-drawer'),'post-cardio choices must expose drawer triggers on the composer');
assert(!html.includes('5 × 4 主模式矩阵'),'developer-facing matrix explanation must not remain in the hero');
assert(!html.includes('实时 Anatomy / Conflict'),'developer-facing implementation jargon must not remain in the hero');

console.log('f111_mobile_ui_contract_test: PASS');
