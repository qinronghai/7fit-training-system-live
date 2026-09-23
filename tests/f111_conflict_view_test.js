const fs=require('fs'),vm=require('vm'),assert=require('assert');
global.window={V14CoachModules:{Common:{esc:value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}}};
vm.runInThisContext(fs.readFileSync('js/coach/conflict-view.js','utf8'),{filename:'js/coach/conflict-view.js'});
const pass=window.V14CoachModules.ConflictView.render({status:'PASS',hardCount:0,warnCount:0,issues:[]});
assert(pass.includes('通过'),'PASS must use the user-facing 通过 label');
assert(!pass.includes('LIVE CHECK'),'developer-facing live-check label must not remain');
assert(!pass.includes('课程检查'),'the redundant visible course-check label must be removed');
assert(/f111-course-check-head"><span[^]*<details class="f111-check-details"/.test(pass),
  'pass details must sit alongside the status in the compact header');
const fail=window.V14CoachModules.ConflictView.render({status:'FAIL',hardCount:1,warnCount:0,issues:[{severity:'hard',title:'动作冲突',text:'示例原因'}]});
assert(fail.includes('未通过'),'FAIL must use the user-facing 未通过 label');
assert(fail.includes('data-f111-check-details'),'FAIL must expose a reason-details trigger');
console.log('f111_conflict_view_test: PASS');
