const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const systemSource = fs.readFileSync('data/system-data.js','utf8');
const moduleSource = fs.readFileSync('js/module-copy.js','utf8');
const context = {window:{}, console};
vm.createContext(context);
vm.runInContext(systemSource, context);
vm.runInContext(moduleSource, context);

const api=context.window.V14ModuleCopy;
assert(api,'V14ModuleCopy missing');

const p1=api.prescriptionForAction('hake_shendun',{level:'L3'});
assert(p1.includes('3组 × 10次'),'should preserve source sets/reps');
assert(p1.includes('RIR≈3'),'RPE 7 should be converted to RIR≈3');
assert(!p1.includes('RPE'),'coach prescription should prefer RIR');

const overlay=api.prescriptionForAction('V13_HR_SCAP_ROW',{level:'L1'});
assert(overlay && overlay.includes('组'),'venue overlay should inherit/fallback to a usable prescription');

const actionText=api.formatAction({
  name:'哈克深蹲', tier:'T3', prescription:p1,
  primary:['股四头肌','臀大肌'], secondary:['内收肌群'], stabilizers:['腹壁'],
  cue:'膝盖对齐脚尖；脚掌三点发力', goal:'下肢力量、股四头肌增肌'
});
assert(actionText.includes('哈克深蹲｜T3'));
assert(actionText.includes('3组 × 10次｜RIR≈3'));
assert(actionText.includes('主要肌群：股四头肌、臀大肌'));
assert(!actionText.includes('哈克深蹲机'));

const prepText=api.formatPrep({
  title:'PREP｜蹲 · L2 · T2',
  items:[
    {name:'动态90/90髋旋转转换', grade:'P2', prescription:'1–2组 × 6–8次/侧', why:'髋旋转动态活动'},
    {name:'弹力带侧向螃蟹走', grade:'P2', prescription:'1–2组 × 8–12步/方向', why:'髋稳定激活'}
  ]
});
assert(prepText.includes('PREP｜蹲 · L2 · T2'));
assert(prepText.includes('动态90/90髋旋转转换｜P2'));
assert(prepText.includes('1–2组 × 6–8次/侧'));

const foamText=api.formatFoam({
  title:'泡沫轴推荐｜蹲 · L2 · T2',
  items:[{name:'泡沫轴松解-大腿前侧',prescription:'1组 × 30–45秒',safety:'避开髌骨和膝关节线'}]
});
assert(foamText.includes('泡沫轴松解-大腿前侧'));
assert(foamText.includes('30–45秒'));
assert(foamText.includes('安全：避开髌骨和膝关节线'));

const patternText=api.formatPattern({
  name:'蹲',
  levels:[
    {tier:'T1',name:'徒手深蹲'},
    {tier:'T2',name:'高脚杯深蹲'},
    {tier:'T3',name:'哈克深蹲'},
    {tier:'T4',name:'杠铃深蹲'}
  ]
});
assert(patternText.includes('T1｜徒手深蹲'));
assert(patternText.includes('T4｜杠铃深蹲'));

const generic=api.formatKnowledge({title:'同级替换规则',lines:['保持同动作模式','优先同级替换']});
assert(generic.includes('同级替换规则'));
assert(generic.includes('保持同动作模式'));

console.log('module copy formatter: PASS');
