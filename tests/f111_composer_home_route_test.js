const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

load('data/system-data.js');
load('js/router.js');
window.V14CoachModules={
  Home:{render:()=>'<main>GENERIC HOME</main>'},
  F111Home:{render:()=>'<main>RECOMMENDED PRESETS</main>'},
  TemplateHome:{render:()=>'<main>OTHER TEMPLATE</main>'},
  Session:{render:()=>'<main>PRESET DETAIL</main>'},
  ComposerView:{render:route=>`<main data-level="${route.query?.level||'L1'}">FREE COMPOSER</main>`},
};
load('js/views-coach.js');

const rootRoute=window.V14Router.parseHash('#/coach/f111');
const composeRoute=window.V14Router.parseHash('#/coach/f111/compose?level=L3');
assert(window.V14Router.isValid(rootRoute),'the F111 home route must remain valid');
assert(window.V14Views.coach(rootRoute).includes('FREE COMPOSER'),'the F111 home route must open free composition directly');
assert(!window.V14Views.coach(rootRoute).includes('RECOMMENDED PRESETS'),'the F111 home route must not expose the recommended-preset browser');
assert(window.V14Views.coach(composeRoute).includes('FREE COMPOSER'),'the old compose route must remain a compatible alias');

const views=fs.readFileSync(`${root}/js/views-coach.js`,'utf8');
assert(views.includes("const isF111Composer=route=>route?.page==='compose'||(route?.page==='template'&&route.templateId==='f111')")&&
  (views.match(/if\(isF111Composer\(route\)\)/g)||[]).length===2,
  'the home route must bind the composer controls and drawers as well as render the composer');

console.log('f111_composer_home_route_test: PASS');
