const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
const actions={
  squat:{name:'徒手深蹲',tier:'T1'},
  row:{name:'基础肩胛划船',tier:'T1'},
  support:{name:'四足跪姿支撑',isSupport:true,supportGrade:'SUP-S1'},
  hinge:{name:'哑铃髋铰链',tier:'T1'},
  fly:{name:'哑铃俯身反向飞鸟',tier:'T1'},
  core:{name:'仰卧脚跟滑动',isCore:true,coreGrade:'CORE-L1'},
};
window.V14_DATA={
  actions,
  actionDetails:{},
  composer:{prescriptionBySlot:{
    A:'3组 × 12次左右',
    B:'3组 × 12次左右',
    C:'3组 × 20次',
    D1:'2组 × 15次左右',
    D2:'2组 × 15次左右',
    CORE:'2组 × 15–20次',
  }},
};
window.V14_ANATOMY={records:Object.fromEntries(['squat','row','hinge','fly'].map(id=>[id,{roleType:'strength'}]))};
window.V14CoachModules={Common:{
  D:()=>window.V14_DATA,
  esc:value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])),
}};
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
load('js/module-copy.js');
load('js/coach/slot.js');

const M=window.V14CoachModules;
const rows=[
  ['A','A｜下肢主项','squat','3组 × 12次左右'],
  ['B','B｜上肢主项','row','3组 × 12次左右'],
  ['C','C｜支撑模式','support','3组 × 20次'],
  ['D1','D1｜下肢辅助','hinge','2组 × 15次左右'],
  ['D2','D2｜上肢辅助','fly','2组 × 15次左右'],
  ['CORE','CORE｜核心模式','core','2组 × 15–20次'],
];
for(const [key,label,actionId,prescription] of rows){
  const action=actions[actionId];
  const ctx={level:'L2',resolved:{slotOptions:{[key]:[{id:actionId,name:action.name,tier:action.tier||'',grade:action.supportGrade||action.coreGrade||''}]}}};
  const html=M.Slot.composerCard(ctx,{slotKey:key,slotName:label,actionId,name:action.name,tier:action.tier||'',grade:action.supportGrade||action.coreGrade||'',prescriptionOverride:window.V14ModuleCopy.prescriptionForF111Slot(key)});
  assert(!html.includes('推荐处方'),`${key} card must omit the extra recommendation label`);
  assert(html.includes(prescription),`${key} card must show the current recommended prescription: ${prescription}`);
}
const fallbackCtx={level:'L2',resolved:{slotOptions:{A:[{id:'squat',name:actions.squat.name,tier:'T1'}]}}};
const fallbackHtml=M.Slot.composerCard(fallbackCtx,{slotKey:'A',slotName:'A｜下肢主项',actionId:'squat',name:actions.squat.name,tier:'T1',grade:'T1',prescriptionOverride:'3组 × 8–12次｜RIR 2–3'});
assert(fallbackHtml.includes('3组 × 8–12次'),'F111 card should keep the sets and reps when RIR is present');
assert(!fallbackHtml.includes('RIR'),'F111 card should hide effort guidance next to the prescription');
assert(!fallbackHtml.includes('推荐处方'),'F111 card should not show a prescription label');
console.log('f111_composer_prescription_visibility_test: PASS');
