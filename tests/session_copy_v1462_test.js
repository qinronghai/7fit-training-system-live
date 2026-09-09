const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const source=fs.readFileSync('js/session-copy.js','utf8');
const context={window:{},console}; vm.createContext(context); vm.runInContext(source,context);
const api=context.window.V14SessionCopy;

const payload={
  brand:'7Fit', sessionTitle:'F111-01｜下肢推 + 水平拉 + 支撑', level:'L3',
  foam:['泡沫轴松解-大腿前侧'], warmups:['动态90/90髋旋转转换'],
  slots:[
    {slot:'A｜下肢主项',name:'哈克深蹲',tier:'T3',prescription:'3组 × 10次｜RIR≈3',equipment:'哈克深蹲机'},
    {slot:'B｜上肢主项',name:'胸托划船',tier:'T2',prescription:'3组 × 10–12次｜RIR 2–3',equipment:'飞机拉背机'},
    {slot:'C｜支撑模式',name:'侧平板',tier:'',prescription:'2–3组 × 20–30秒/侧',equipment:'自重 / 垫子'}
  ],
  muscles:{primary:['股四头肌','臀大肌','背阔肌'],secondary:['肱二头肌'],stabilizers:['腹壁']},
  recovery:['臀肌拉伸'], postCardio:'按需安排', conflicts:[]
};
const coach=api.formatCoach(payload);
assert(coach.includes('A｜下肢主项｜哈克深蹲｜T3'));
assert(coach.includes('3组 × 10次｜RIR≈3'));
assert(coach.includes('C｜支撑模式｜侧平板'));
assert(!coach.includes('哈克深蹲机'));
assert(!coach.includes('飞机拉背机'));
assert(!coach.includes('水平拉 ·'));

const member=api.formatMember(payload,{now:'2026-09-09T12:00:00+08:00'});
assert(member.includes('哈克深蹲'));
assert(member.includes('3 × 10'));
assert(member.includes('腿部力量 × 上肢拉 × 核心稳定'));
assert(member.includes('今日训练重点'));
assert(member.includes('课后有氧｜约 30 分钟'));
assert(!member.includes('RIR'));
assert(!member.includes('T3'));
assert(!member.includes('哈克深蹲机'));
console.log('session copy v14.6.2: PASS');
