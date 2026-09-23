const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of ['data/system-data.js','js/composer.js','js/coach/common.js','js/coach/f111-compose-ui.js'])load(file);
const UI=window.V14CoachModules?.F111ComposeUI;
assert(UI,'F111ComposeUI must be exposed');
const resolved=window.V14Composer.resolve({level:'L2',lowerMode:'squat',upperMode:'horizontal_pull',coreDemand:'anti_extension'});
const ctx={level:'L2',lowerMode:'squat',upperMode:'horizontal_pull',resolved};

const lower=UI.modeOptions(ctx,'lower');
const upper=UI.modeOptions(ctx,'upper');
assert(lower.length===5&&upper.length===4,'mode options must come from the existing composer config');
assert(UI.modeTrigger(ctx,'lower').includes('data-f111-mode-drawer="lower"'));
assert(UI.modeTrigger(ctx,'upper').includes('data-f111-mode-drawer="upper"'));

const supportGroups=UI.actionGroups(ctx,'C');
const coreGroups=UI.actionGroups(ctx,'CORE');
assert(supportGroups.length>0&&coreGroups.length>0,'C/CORE must expose current legal candidates');
assert(supportGroups.every(group=>/^SUP-S[1-6]$/.test(group.grade)),'support candidates must retain existing SUP grade');
assert(coreGroups.every(group=>/^CORE-L[1-4]$/.test(group.grade)),'core candidates must retain existing CORE grade');
assert(supportGroups.every(group=>group.items.length>0)&&coreGroups.every(group=>group.items.length>0));
assert(!JSON.stringify(supportGroups).includes('高位平板支撑｜示例动作'),'support grouping must not use OpenDesign demo hardcoding');
assert(UI.actionTrigger(ctx,'C').includes('data-f111-action-drawer="C"'));
assert(UI.actionTrigger(ctx,'CORE').includes('data-f111-action-drawer="CORE"'));
console.log('f111_compose_ui_runtime_test: PASS');
