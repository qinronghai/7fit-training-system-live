const fs=require('fs');
const vm=require('vm');
const assert=require('assert');

const source=fs.readFileSync('js/session-copy.js','utf8');
const context={window:{},console};
vm.createContext(context);
vm.runInContext(source,context);
const api=context.window.V14SessionCopy;

const payload={
  brand:'7Fit',
  sessionTitle:'F111-06｜下肢推 + 水平推 + 支撑',
  recipeName:'下肢推 + 水平推 + 支撑',
  level:'L3',
  foam:[
    '泡沫轴松解-大腿内侧',
    '泡沫轴松解-肱三头肌',
    '泡沫轴松解-大腿前侧',
    '泡沫轴松解-臀部'
  ],
  warmups:[
    '最伟大伸展（弓步 + 胸椎旋转）',
    '平板支撑（核心激活）',
    '青蛙趴内收肌伸展',
    '90/90坐姿前倾臀部伸展',
    '动态90/90髋旋转转换',
    '单腿青蛙趴内收肌伸展'
  ],
  slots:[
    {slot:'A｜下肢主项',name:'哈克深蹲',tier:'T3',prescription:'3组 × 10次｜RIR 1–2'},
    {slot:'B｜上肢主项',name:'哑铃卧推',tier:'T3',prescription:'3组 × 10次｜RIR 1–2'},
    {slot:'C｜支撑模式',name:'高位平板交替触肩',grade:'SUP-S3',prescription:'2–3组 × 20–30秒'},
    {slot:'D1｜下肢辅助',name:'髋内收',tier:'T2',prescription:'1组 × 15次'},
    {slot:'D2｜肩胛 / 手臂',name:'绳索三头下压',tier:'T2',prescription:'3组 × 12次'},
    {slot:'CORE｜核心模式',name:'Pallof抗旋转推举',grade:'CORE-L3',prescription:'2–3组 × 6–10次/侧'}
  ],
  muscles:{primary:['肱三头肌','腹横肌','腹内外斜肌','内收肌群','股四头肌','臀大肌']},
  recovery:['臀肌拉伸','胸肌拉伸'],
  postCardio:'POST CARDIO ONLY｜课后有氧不计入 F111 的 60 分钟力量模板；按会员独立有氧处方执行。',
  conflicts:['INTERNAL']
};

const member=api.formatMember(payload,{now:'2026-09-09T12:00:00+08:00'});
assert(member.startsWith('2026年9月9日｜星期三\n7Fit｜今日训练'));
assert(member.includes('\n腿部力量 × 上肢推 × 核心稳定\nL3｜负重进阶\n'));
assert(member.includes('今天以腿部力量和上肢推力为主，在增加负重的同时继续强化核心稳定，让力量、动作控制和身体稳定一起进阶。'));
assert(member.includes('课前准备｜约 10–12 分钟'));
assert(member.includes('泡沫轴放松：大腿内侧、手臂后侧、大腿前侧、臀部'));
assert(member.includes('髋部活动：青蛙趴、90/90'));
assert(member.includes('动态活动：最伟大伸展'));
assert(member.includes('核心激活：平板支撑'));
assert(member.includes('1. 哈克深蹲｜3 × 10\n   大腿与臀部力量'));
assert(member.includes('2. 哑铃卧推｜3 × 10\n   上肢推力'));
assert(member.includes('3. 高位平板交替触肩｜2–3 × 20–30 秒\n   核心稳定与身体控制'));
assert(member.includes('4. 髋内收｜1 × 15\n   大腿内侧强化'));
assert(member.includes('5. 绳索三头下压｜3 × 12\n   手臂后侧强化'));
assert(member.includes('6. Pallof抗旋转推举｜2–3 × 6–10 / 侧\n   核心抗旋转'));
assert(member.includes('今日训练重点\n下肢力量 · 上肢推力 · 核心稳定'));
assert(member.includes('训练后恢复\n臀部拉伸 · 胸部拉伸'));
assert(member.endsWith('课后有氧｜约 30 分钟\n选择跑步机爬坡、爬楼梯机、快走或其他有氧，时间 30 分钟左右，平均心率 130 到 140 左右（燃烧脂肪心率）。'));
for(const hidden of ['主要训练部位：','T3','SUP-S3','CORE-L3','RIR','POST CARDIO ONLY','F111 的 60 分钟','INTERNAL']){
  assert(!member.includes(hidden),`member copy leaked ${hidden}`);
}

const composer=api.formatMember({
  brand:'7Fit',recipeName:'单腿拉 + 水平推',level:'L4',foam:[],warmups:[],slots:[],recovery:[],postCardio:'内部 cardio'
},{now:'2026-09-10T12:00:00+08:00'});
assert(composer.includes('单腿后侧链 × 上肢推 × 核心稳定'));
assert(composer.includes('L4｜完整能力'));
assert(composer.includes('今天以单腿后侧链和上肢推力为主，在更高阶段的负重与动作控制下，进一步整合核心稳定和全身协调。'));
assert(composer.includes('今日训练重点\n单腿后侧链 · 上肢推力 · 核心稳定'));
assert(!composer.includes('内部 cardio'));

// V2.1: D1 / D2 purpose must prefer exact action anatomy instead of inheriting A/B theme.
context.window.V14_DATA={actions:{
  leg_extension:{name:'腿屈伸',pattern:'膝伸展'},
  reverse_fly:{name:'反向飞鸟',pattern:'水平拉'}
}};
context.window.V14_ANATOMY={records:{
  leg_extension:{roleType:'strength',primary:['股四头肌'],secondary:[],stabilizers:[],movementActions:['膝伸展']},
  reverse_fly:{roleType:'strength',primary:['三角肌后束','中斜方肌','菱形肌'],secondary:[],stabilizers:[],movementActions:['肩水平外展']}
}};
const pullMember=api.formatMember({
  brand:'7Fit',recipeName:'下肢推 + 水平拉 + 支撑',level:'L3',
  foam:[
    {name:'泡沫轴松解-大腿前侧'},
    {name:'泡沫轴松解-肩部'},
    {name:'泡沫轴松解-臀部'},
    {name:'泡沫轴松解-背阔肌/背侧'}
  ],
  warmups:[],
  slots:[
    {slot:'D1｜下肢辅助',actionId:'leg_extension',name:'坐姿腿屈伸',prescription:'2组 × 12次'},
    {slot:'D2｜肩胛 / 手臂',actionId:'reverse_fly',name:'哑铃俯身反向飞鸟',prescription:'2组 × 15次'}
  ],
  recovery:[]
},{now:'2026-09-10T12:00:00+08:00'});
assert(pullMember.includes('今天以腿部力量和背部拉力为主，在增加负重的同时继续强化核心稳定，让力量、动作控制和身体稳定一起进阶。'));
assert(pullMember.includes('泡沫轴放松：大腿前侧、肩后侧、臀部、上背部'));
assert(pullMember.includes('坐姿腿屈伸｜2 × 12\n   大腿前侧强化'));
assert(pullMember.includes('哑铃俯身反向飞鸟｜2 × 15\n   肩后侧与上背强化'));
assert(pullMember.endsWith('课后有氧｜约 30 分钟\n选择跑步机爬坡、爬楼梯机、快走或其他有氧，时间 30 分钟左右，平均心率 130 到 140 左右（燃烧脂肪心率）。'));

console.log('session copy member v2.1: PASS');
