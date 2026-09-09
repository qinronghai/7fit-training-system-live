const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/session-copy.js', 'utf8');
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(fs.readFileSync('js/coach-copy.js','utf8'), context);

const api = context.window.V14SessionCopy;
assert(api, 'V14SessionCopy missing');

const payload = {
  brand: '7Fit',
  sessionTitle: 'F111-04｜臀伸 + 垂直拉 + 单侧支撑',
  level: 'L2',
  foam: ['泡沫轴松解-臀部', '泡沫轴松解-背阔肌/背侧'],
  warmups: ['动态90/90髋旋转转换', '四足跪姿胸椎旋转'],
  slots: [
    {slot: 'A｜下肢主项', name: '臀推机', tier:'T2', prescription:'3组 × 10–12次｜RIR 2–3'},
    {slot: 'B｜上肢主项', name: '高位下拉', tier:'T2', prescription:'3组 × 10–12次｜RIR 2–3'},
    {slot: 'C｜支撑', name: '侧平板', grade:'SUP-S6', prescription:'2组 × 20–30秒/侧'},
    {slot: 'D1｜下肢辅助', name: '单腿臀桥', tier:'T2', prescription:'2组 × 12次/侧'},
    {slot: 'D2｜肩胛 / 手臂', name: '绳索面拉', prescription:'2组 × 15次'},
    {slot: 'CORE', name: '死虫式', grade:'CORE-L2', prescription:'2组 × 8–10次/侧'},
  ],
  muscles: {
    primary: ['臀大肌', '背阔肌'],
    secondary: ['腘绳肌', '肱二头肌'],
    stabilizers: ['腹壁', '臀中肌'],
  },
  recovery: ['臀部拉伸', '背阔肌拉伸'],
  postCardio: '课后按需安排 20 分钟有氧。',
  conflicts: ['肌群刺激集中：臀大肌暴露增加，请确认符合本节目标。'],
};

const coach = api.formatCoach(payload,{now:'2026-09-10T12:00:00+08:00'});
assert(coach.includes('2026年9月10日｜星期四'));
assert(coach.includes('7Fit｜私教训练'));
assert(coach.includes('F111-04｜L2 基础负重'));
assert(coach.includes('臀伸 × 垂直拉 × 核心稳定'));
assert(coach.includes('本节目标'));
assert(coach.includes('A｜臀推机｜T2'));
assert(coach.includes('目标：臀部力量'));
assert(coach.includes('本节观察'));
assert(!coach.includes('肌群刺激集中'));
assert(!coach.includes('注意事项'));
assert(!coach.includes('【本节主要训练肌群】'));
assert(!coach.includes('【系统提醒】'));

const member = api.formatMember(payload,{now:'2026-09-09T12:00:00+08:00'});
assert(member.includes('7Fit｜今日训练'));
assert(member.includes('主要训练'));
assert(member.includes('臀部力量 × 上肢拉 × 核心稳定'));
assert(member.includes('L2｜基础负重'));
assert(member.includes('课前准备｜约 10–12 分钟'));
assert(member.includes('今日训练重点'));
assert(member.includes('课后有氧｜约 30 分钟'));
assert(!coach.includes('臀推机（T2 · 髋伸展 · 臀推机）'));
assert(member.includes('臀推机'));
assert(!member.includes('主要训练部位：'));
assert(!member.includes('课后按需安排 20 分钟有氧。'));
assert(!member.includes('T2 ·'));
assert(!member.includes('系统提醒'));
assert(!member.includes('肌群刺激集中'));
assert(!member.includes('F111-04｜'));

console.log('session copy formatter: PASS');
