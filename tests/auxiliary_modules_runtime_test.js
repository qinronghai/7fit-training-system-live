const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const root = process.cwd();
const context = { window: {}, console };
vm.runInNewContext(fs.readFileSync(`${root}/data/system-data.js`, 'utf8'), context, {
  filename: 'data/system-data.js',
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
assert.strictEqual(lower.total, 6, 'lower auxiliary pool should deduplicate to 6 actions');
assert.strictEqual(JSON.stringify(lower.classCounts), JSON.stringify({ fixed_machine: 4, cable_station: 2 }));
assert.deepStrictEqual(
  [...lower.entries.filter(entry => entry.equipmentClass === 'fixed_machine').map(entry => entry.id)],
  ['tui_qushen', 'kuangnei_shou', 'kuangwai_zhan', 'tui_wanju'],
);
assert.deepStrictEqual(
  [...lower.entries.filter(entry => entry.equipmentClass === 'cable_station').map(entry => entry.id)],
  ['tunbu_houti', 'xiao_longmen_wai_zhan'],
);
assert.strictEqual(lower.entries.find(entry => entry.id === 'tunbu_houti').action.equipmentClass, 'cable_station');
assert.strictEqual(lower.entries.find(entry => entry.id === 'tui_qushen').action.equipmentClass, 'fixed_machine');

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
fixture.composer.auxiliaryRules.lower.hinge.unshift('fixture_auxiliary');
context.window.V14_DATA = fixture;

const dynamic = api.catalog('lower');
assert.strictEqual(dynamic.total, 7, 'catalog must derive additions from current rules');
const fixtureEntry = dynamic.entries.find(entry => entry.id === 'fixture_auxiliary');
assert(fixtureEntry, 'new rule reference should create a catalog entry');
assert.deepStrictEqual([...fixtureEntry.sourcePools.map(pool => pool.key)], ['squat', 'hinge']);
assert.deepStrictEqual(
  [...fixtureEntry.detailState.missing],
  ['教练口令', '执行步骤', '常见错误', '禁忌 / 限制'],
  'incomplete details must be explicit instead of fabricated',
);

for (const ids of Object.values(fixture.composer.auxiliaryRules.lower)) {
  const index = ids.indexOf('fixture_auxiliary');
  if (index >= 0) ids.splice(index, 1);
}
assert.strictEqual(api.catalog('lower').total, 6, 'removing every rule reference must remove the action');

console.log('auxiliary_modules_runtime_test: PASS');
