const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/session-copy.js', 'utf8');
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(source, context);

const api = context.window.V14SessionCopy;
assert(api, 'V14SessionCopy missing');

const payload = {
  brand: '7Fit',
  sessionTitle: 'F111-04｜臀伸 + 垂直拉 + 单侧支撑',
  level: 'L2',
  foam: ['泡沫轴松解-臀部', '泡沫轴松解-背阔肌/背侧'],
  warmups: ['动态90/90髋旋转转换', '四足跪姿胸椎旋转'],
  slots: [
    {slot: 'A｜下肢主项', name: '臀推机', meta: 'T2 · 髋伸展 · 臀推机'},
    {slot: 'B｜上肢主项', name: '高位下拉', meta: 'T2 · 垂直拉 · 高位下拉机'},
    {slot: 'C｜支撑', name: '侧平板', meta: 'SUP-S6 · 支撑模式'},
    {slot: 'D1｜下肢辅助', name: '单腿臀桥', meta: 'T2 · 髋伸展'},
    {slot: 'D2｜肩胛 / 手臂', name: '绳索面拉', meta: '肩胛控制'},
    {slot: 'CORE', name: '死虫式', meta: 'CORE-L2 · 抗伸展'},
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

const coach = api.formatCoach(payload);
assert(coach.includes('7Fit｜教练训练单'));
assert(coach.includes('F111-04｜臀伸 + 垂直拉 + 单侧支撑'));
assert(coach.includes('A｜下肢主项｜臀推机'));
assert(coach.includes('主要刺激：臀大肌 · 背阔肌'));
assert(coach.includes('系统提醒'));
assert(coach.includes('肌群刺激集中'));

const member = api.formatMember(payload);
assert(member.includes('7Fit｜今日训练'));
assert(member.includes('主要训练：'));
assert(!coach.includes('臀推机（T2 · 髋伸展 · 臀推机）'));
assert(member.includes('臀推机'));
assert(member.includes('主要训练部位：臀大肌、背阔肌'));
assert(!member.includes('T2 ·'));
assert(!member.includes('系统提醒'));
assert(!member.includes('肌群刺激集中'));
assert(!member.includes('F111-04｜'));

console.log('session copy formatter: PASS');
