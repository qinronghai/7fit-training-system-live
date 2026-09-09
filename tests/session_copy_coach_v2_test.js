const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const source=fs.readFileSync('js/session-copy.js','utf8');
const context={window:{},console};
context.window.V14_DATA={actions:{
  hake_shendun:{id:'hake_shendun',name:'哈克深蹲',pattern:'蹲',tier:'T3'},
  seated_row:{id:'seated_row',name:'坐姿划船',pattern:'水平拉',tier:'T3'},
  high_plank_touch:{id:'high_plank_touch',name:'高位平板交替触肩',pattern:'抗旋转',isSupport:true,supportGrade:'SUP-S3'},
  leg_extension:{id:'leg_extension',name:'坐姿腿屈伸',pattern:'膝伸',tier:'T2'},
  reverse_fly:{id:'reverse_fly',name:'哑铃俯身反向飞鸟',pattern:'肩水平外展',tier:'T2'},
  pallof_press:{id:'pallof_press',name:'Pallof抗旋转推举',pattern:'抗旋转',coreGrade:'CORE-L3'}
}};
context.window.V14_ANATOMY={records:{
  hake_shendun:{primary:['股四头肌','臀大肌'],secondary:['内收肌群'],stabilizers:['腹横肌'],movementActions:['髋伸','膝伸']},
  seated_row:{primary:['背阔肌','中斜方肌','菱形肌'],secondary:['肱二头肌'],stabilizers:['竖脊肌'],movementActions:['肩伸','肩胛后缩','肘屈']},
  high_plank_touch:{primary:['腹横肌','腹内斜肌','腹外斜肌'],secondary:['三角肌前束'],stabilizers:['臀中肌'],movementActions:['抗旋转','交替支撑']},
  leg_extension:{primary:['股四头肌'],secondary:[],stabilizers:[],movementActions:['膝伸展']},
  reverse_fly:{primary:['三角肌后束','中斜方肌','菱形肌'],secondary:[],stabilizers:[],movementActions:['肩水平外展']},
  pallof_press:{primary:['腹内斜肌','腹外斜肌','腹横肌'],secondary:[],stabilizers:[],movementActions:['抗旋转']}
}};
vm.createContext(context);
vm.runInContext(source,context);
const api=context.window.V14SessionCopy;

const payload={
  brand:'7Fit',
  recipeId:'F111-01',
  recipeName:'下肢推 + 水平拉 + 支撑',
  sessionTitle:'F111-01｜下肢推 + 水平拉 + 支撑',
  level:'L3',
  foam:[
    {name:'泡沫轴松解-大腿前侧',prescription:'30–60秒'},
    {name:'泡沫轴松解-背阔肌/背侧',prescription:'30–60秒'}
  ],
  warmups:[
    {name:'动态90/90髋旋转转换',prescription:'8次/侧'},
    {name:'四足跪姿胸椎旋转',prescription:'8次/侧'},
    {name:'平板支撑（核心激活）',prescription:'30秒'}
  ],
  slots:[
    {actionId:'hake_shendun',slot:'A｜下肢主项',name:'哈克深蹲',tier:'T3',prescription:'3组 × 10次｜RIR 2–3'},
    {actionId:'seated_row',slot:'B｜上肢主项',name:'坐姿划船',tier:'T3',prescription:'3组 × 10次｜RIR 2–3'},
    {actionId:'high_plank_touch',slot:'C｜支撑模式',name:'高位平板交替触肩',grade:'SUP-S3',prescription:'2–3组 × 20–30秒'},
    {actionId:'leg_extension',slot:'D1｜下肢辅助',name:'坐姿腿屈伸',tier:'T2',prescription:'2组 × 12次'},
    {actionId:'reverse_fly',slot:'D2｜肩胛 / 手臂',name:'哑铃俯身反向飞鸟',tier:'T2',prescription:'2组 × 15次'},
    {actionId:'pallof_press',slot:'CORE｜核心模式',name:'Pallof抗旋转推举',grade:'CORE-L3',prescription:'2–3组 × 6–10次/侧'}
  ],
  muscles:{primary:['股四头肌','背阔肌'],secondary:['肱二头肌'],stabilizers:['腹横肌']},
  recovery:['臀部拉伸','背部拉伸'],
  postCardio:'POST CARDIO ONLY｜课后有氧不计入正式 60 分钟模板。',
  conflicts:[]
};

const coach=api.formatCoach(payload,{now:'2026-09-10T12:00:00+08:00'});
assert(coach.includes('2026年9月10日｜星期四'));
assert(coach.includes('7Fit｜私教训练'));
assert(coach.includes('F111-01｜L3 负重进阶'));
assert(coach.includes('下肢推 × 水平拉 × 核心稳定'));
assert(coach.includes('动线：2F 准备 → 1F 力量 → 2F 恢复'));
assert(coach.includes('本节目标'));
assert(coach.includes('L3 负重进阶阶段'));
assert(coach.includes('A 位用哈克深蹲'));
assert(coach.includes('B 位用坐姿划船'));
assert(coach.includes('本节重点：下肢推 · 水平拉 · 核心稳定'));
assert(coach.includes('PREP｜约 10–12 分钟'));
assert(coach.includes('泡沫轴松解：大腿前侧 / 上背部'));
assert(coach.includes('髋部活动：90/90'));
assert(coach.includes('上肢活动：四足跪姿胸椎旋转'));
assert(coach.includes('核心激活：平板支撑'));
assert(coach.includes('STRENGTH'));
assert(coach.includes('A｜哈克深蹲｜T3'));
assert(coach.includes('3组 × 10次｜RIR 2–3｜休息 90s'));
assert(coach.includes('目标：大腿与臀部力量'));
assert(coach.includes('Cue：足底三点稳定，膝盖与脚尖方向一致'));
assert(coach.includes('B｜坐姿划船｜T3'));
assert(coach.includes('目标：上肢拉力'));
assert(coach.includes('Cue：先稳定肩胛，再向后拉肘'));
assert(coach.includes('C｜高位平板交替触肩｜SUP-S3'));
assert(coach.includes('2–3组 × 20–30秒｜休息 45–60s'));
assert(coach.includes('目标：核心稳定与身体控制'));
assert(coach.includes('D1｜坐姿腿屈伸｜T2\n2组 × 12次\n目标：大腿前侧强化'));
assert(coach.includes('D2｜哑铃俯身反向飞鸟｜T2\n2组 × 15次\n目标：肩后侧与上背强化'));
assert(coach.includes('CORE｜Pallof抗旋转推举｜CORE-L3'));
assert(coach.includes('目标：核心抗旋转'));
assert(coach.includes('本节观察'));
assert(coach.includes('A 哈克深蹲：膝轨迹 / 骨盆稳定 / 左右发力'));
assert(coach.includes('B 坐姿划船：肩胛控制 / 耸肩代偿 / 左右拉力'));
assert(coach.includes('C 高位平板交替触肩：骨盆旋转 / 重心转移'));
assert(coach.includes('RECOVERY'));
assert(coach.includes('臀部拉伸 / 背部拉伸'));
assert(coach.includes('课后有氧｜约 30 分钟'));
assert(coach.includes('跑步机爬坡 / 楼梯机 / 快走 / 其他有氧'));
assert(coach.includes('平均心率：130–140 bpm 左右（燃烧脂肪心率）'));
for(const hidden of ['【本节主要训练肌群】','【系统提醒】','当前方案未发现替换后冲突。','POST CARDIO ONLY','eq-','actionId']){
  assert(!coach.includes(hidden),`coach copy leaked ${hidden}`);
}
console.log('coach copy v2 contract: PASS');
