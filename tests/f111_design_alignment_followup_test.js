const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of ['data/system-data.js','js/composer.js','js/coach/common.js','js/coach/f111-compose-ui.js'])load(file);
const UI=window.V14CoachModules.F111ComposeUI;
const resolved=window.V14Composer.resolve({level:'L2',lowerMode:'squat',upperMode:'horizontal_pull',coreDemand:'anti_extension'});
const ctx={level:'L2',lowerMode:'squat',upperMode:'horizontal_pull',coreDemand:'anti_extension',resolved};

assert(!UI.actionTrigger(ctx,'C').includes('个可选动作'),'C card must keep candidate counts inside the drawer, not on the main card');
assert(!UI.actionTrigger(ctx,'CORE').includes('个可选动作'),'CORE card must keep candidate counts inside the drawer, not on the main card');

const prepSource=fs.readFileSync(`${root}/js/coach/prep.js`,'utf8');
assert(prepSource.includes('data-foam-replacement-drawer'),'foam cards must expose the shared replacement drawer trigger');
assert(prepSource.includes('data-foam-slot'),'foam replacement must carry a stable slot key');
const foamSource=fs.readFileSync(`${root}/js/coach/foam.js`,'utf8');
assert(foamSource.includes('f111-foam-selections'),'foam replacement choices must survive the composer rerender without entering formal course selections');
assert(!prepSource.includes('<a class="prep-card-action"'),'PREP action cards must not keep a separate detail-link arrow');
assert(!prepSource.includes('<i aria-hidden="true">↗</i>'),'PREP action cards must remove the visible detail arrow');
const slotSource=fs.readFileSync(`${root}/js/coach/slot.js`,'utf8');
assert(slotSource.includes('data-action-detail-href'),'strength action cards must expose whole-card detail navigation');
assert(!slotSource.includes('f111-slot-arrow'),'strength action cards must remove the visible detail arrow');
const viewsSource=fs.readFileSync(`${root}/js/views-coach.js`,'utf8');
assert(viewsSource.includes('data-prep-detail-href')&&viewsSource.includes('data-action-detail-href'),'coach binding must support whole-card detail navigation');

const css=fs.readFileSync(`${root}/assets/app.css`,'utf8');
assert(css.includes('.f111-replace-trigger')&&css.includes('color:#1f1b2d'),'replacement controls must use the unified dark text treatment');
assert(css.includes('.f111-prep-section .foam-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:'),'foam cards must remain a real two-column grid at the mobile breakpoint');

const view=fs.readFileSync(`${root}/js/coach/composer-view.js`,'utf8');
assert(view.includes('f111-recovery-section')&&view.includes('PostCardio.render'),'recovery and post-cardio must remain rendered');
assert(view.includes('renderCompact'),'F111 composer must use the compact recovery presentation');
assert(!view.includes('f111-core-demand-wrap'),'composer page must not render the extra core-demand selector block');
assert(view.includes('coreDemand'),'core demand must remain available to the resolver even when its extra UI block is removed');

const recoverySource=fs.readFileSync(`${root}/js/recovery-matcher.js`,'utf8');
assert(recoverySource.includes('function renderCompact'),'recovery matcher must expose a compact F111 presentation');
assert(recoverySource.includes('class="recovery-list"'),'compact recovery must use a list layout');
const compactRecoverySource=recoverySource.slice(recoverySource.indexOf('function renderCompact'),recoverySource.indexOf('function copyItems'));
assert(!compactRecoverySource.includes('查看动作详情</a>'),'compact recovery must not repeat a visible detail link');
const cardioSource=fs.readFileSync(`${root}/js/coach/post-cardio.js`,'utf8');
assert(cardioSource.includes('<h2>课后有氧</h2>'),'post-cardio module must use the concise Chinese title');
assert(cardioSource.includes('post-cardio-actions'),'post-cardio copy action must have its own compact action row');
console.log('f111_design_alignment_followup_test: PASS');
