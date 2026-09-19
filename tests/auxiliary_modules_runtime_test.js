const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const root = process.cwd();
const context = { window: {}, console };
vm.runInNewContext(fs.readFileSync(`${root}/data/system-data.js`, 'utf8'), context, {
  filename: 'data/system-data.js',
});
vm.runInNewContext(fs.readFileSync(`${root}/js/lower-assistance.js`, 'utf8'), context, {
  filename: 'js/lower-assistance.js',
});
vm.runInNewContext(fs.readFileSync(`${root}/js/auxiliary-modules.js`, 'utf8'), context, {
  filename: 'js/auxiliary-modules.js',
});

const api = context.window.V14AuxiliaryModules;
assert(api, 'auxiliary module API must be exposed');

const upper = api.catalog('upper');
assert.strictEqual(upper.total, 21, 'upper auxiliary pool should deduplicate to 21 actions');
assert.deepStrictEqual(
  [...upper.entries.map(entry => entry.id)],
  [
    'houzu_sanji',
    'mianla',
    'shengsuo_ertou_wanju',
    'shengsuo_jianwai_xuanzhuan',
    'fushen_y_ju',
    'xieban_ytw_jinjie',
    'hudieji_fanxiang_feiniao',
    'feiji_labei_xiaba',
    'dixie_mianla_shangju',
    'V13_HR_SCAP_ROW',
    'zhibi_xiala',
    'shengsuo_mianla',
    'shuanggang_zhicheng',
    'shengsuo_santou_xiaya',
    'xiongjia_jiaxiong',
    'shengsuo_jiaxiong_zhongwei',
    'shengsuo_jiaxiong_gaowei',
    'pecdeck_unilateral_press_main',
    'qixie_xiong_tui_zhaiwo',
    'shengsuo_cepingju',
    'V13_VP_SEATED_LIGHT_DB',
  ],
);
assert.strictEqual(upper.classCounts.cable_station, 10);
assert.strictEqual(upper.classCounts.fixed_machine, 7);
assert.strictEqual(upper.classCounts.free_weight, 3);
assert.strictEqual(upper.classCounts.bodyweight, 1);
// D2 must supplement A/B instead of restating the tiered main windows: only an
// explicit venue overlay may carry a tier, and it stays visibly 待补齐 until the
// coach copy exists.
const tieredOverlays = upper.entries.filter(entry => entry.action.tier);
assert.deepStrictEqual([...tieredOverlays.map(entry => entry.id)], ['V13_HR_SCAP_ROW', 'V13_VP_SEATED_LIGHT_DB']);
assert(
  tieredOverlays.every(entry => entry.action.isVenueOverlay === true && String(entry.action.note || '').trim()),
  'a tiered D2 candidate must be a documented venue overlay',
);
const pendingDetail = upper.entries.filter(entry => !entry.detailState.complete);
assert.deepStrictEqual(
  [...pendingDetail.map(entry => entry.id)],
  [...tieredOverlays.map(entry => entry.id)],
  'detail-pending entries are exactly the venue overlays; the module shows 动作详情待补齐',
);
assert.strictEqual(api.equipmentClassLabel('bodyweight'), '自重');
assert.strictEqual(api.equipmentClassLabel('cable_station'), '绳索 / 龙门架辅助');
assert.strictEqual(api.equipmentClassLabel('fixed_machine'), '固定器械');

const upperFacePull = upper.entries.find(entry => entry.id === 'mianla');
assert.deepStrictEqual([...upperFacePull.sourcePools.map(pool => pool.key)], [
  'horizontal_pull',
  'vertical_pull',
  'vertical_push',
]);
assert.strictEqual(upperFacePull.action.equipmentClass, 'cable_station');

const lower = api.catalog('lower');
assert.strictEqual(lower.title, '12｜下肢辅助与容量动作');
assert(lower.total >= 20, 'lower module should expose the shared audited assistance domain, not only six legacy D1 ids');
assert(lower.entries.some(entry => entry.id === 'shengsuo_kuan_neishou'));
assert(!lower.entries.some(entry => entry.id === 'hake_shendun'));
assert.strictEqual(lower.entries.find(entry => entry.id === 'tui_wanju').functionalFamily, 'KNEE_FLEXION');
assert.strictEqual(lower.entries.find(entry => entry.id === 'tui_qushen').functionalFamily, 'KNEE_EXTENSION');
assert(lower.entries.find(entry => entry.id === 'tunbu_houti').consumers.f111D1);
assert(lower.familyCounts.KNEE_FLEXION >= 1);
assert(lower.familyCounts.HIP_ABDUCTION >= 1);

const fixture = JSON.parse(JSON.stringify(context.window.V14_DATA));
fixture.actions.fixture_auxiliary = {
  id: 'fixture_auxiliary',
  name: '测试固定器械动作',
  pattern: '蹲',
  route: '1F_ONLY',
  routeLabel: '1F 专用',
  equipment: '测试器械',
  equipmentClass: 'fixed_machine',
  status: '可自动编排',
  zone: '1F 力量区',
};
fixture.actionDetails.fixture_auxiliary = { fields: { 训练目标: 'fixture' } };
fixture.composer.auxiliaryRules.lower.squat.push('fixture_auxiliary');
context.window.V14_DATA = fixture;

// Legacy rule membership alone is no longer the lower-domain source of truth.
assert(!api.catalog('lower').entries.some(entry => entry.id === 'fixture_auxiliary'));

fixture.bodyActionMeta.fixture_auxiliary = {
  families:['BODY-01'],
  levels:['L1','L2','L3','L4'],
  roles:['ACCESSORY','ISOLATION','OPTIONAL'],
  directTargets:['quadriceps'],
  secondaryTargets:[],
  exerciseClass:'isolation',
  fatigueCost:'low',
  stabilityDemand:'low',
  repProfile:'isolation_large',
  laterality:'bilateral',
};
const dynamic = api.catalog('lower');
const fixtureEntry = dynamic.entries.find(entry => entry.id === 'fixture_auxiliary');
assert(fixtureEntry, 'audited Body metadata should add the action to the shared lower domain');
assert.strictEqual(fixtureEntry.functionalFamily, 'KNEE_EXTENSION');
assert.deepStrictEqual([...fixtureEntry.sourcePools.map(pool => pool.key)], ['squat']);
assert.deepStrictEqual(
  [...fixtureEntry.detailState.missing],
  ['教练口令', '执行步骤', '常见错误', '禁忌 / 限制'],
  'incomplete details must be explicit instead of fabricated',
);

console.log('auxiliary_modules_runtime_test: PASS');
