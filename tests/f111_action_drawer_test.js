const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of ['data/system-data.js','js/composer.js','js/coach/common.js','js/coach/f111-compose-ui.js','js/coach/f111-action-drawer.js'])load(file);
const Drawer=window.V14CoachModules?.F111ActionDrawer;
assert(Drawer,'F111ActionDrawer must be exposed');
const resolved=window.V14Composer.resolve({level:'L4',lowerMode:'squat',upperMode:'horizontal_pull',coreDemand:'anti_extension'});
const ctx={level:'L4',lowerMode:'squat',upperMode:'horizontal_pull',coreDemand:'anti_extension',resolved};
const support=Drawer.renderGroups(window.V14CoachModules.F111ComposeUI.actionGroups(ctx,'C'));
const core=Drawer.renderGroups(window.V14CoachModules.F111ComposeUI.actionGroups(ctx,'CORE'));
assert(support.includes('S1｜基础静态支撑')&&support.includes('S6｜单侧支撑'),'support drawer must show every S1-S6 group available in current candidates');
assert(core.includes('CORE-L1｜基础控制')&&core.includes('CORE-L4｜高负荷整合'),'core drawer must show every CORE L1-L4 group available in current candidates');
assert((support.match(/data-f111-action-choice=/g)||[]).length===window.V14_DATA.supportIds.length);
assert((core.match(/data-f111-action-choice=/g)||[]).length===window.V14_DATA.coreIds.length);
assert(Drawer.renderModes(window.V14CoachModules.F111ComposeUI.modeOptions(ctx,'lower')).includes('下肢推'));
console.log('f111_action_drawer_test: PASS');
