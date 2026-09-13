const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
for(const file of ['data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js']){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}
const D=window.V14_DATA,R=window.V14PrepResolver;

const categoryChecks={
  'PREP-29':['猫牛式','P1'],
  'PREP-30':['泡沫轴胸椎伸展','P2'],
  'PREP-33':['墙面肩胛上旋滑墙离墙','P3'],
  'PREP-34':['鸟狗式','P2'],
  'PREP-35':['半跪姿踝背屈前移','P1'],
  'PREP-40':['单腿髋飞机动态控制','P4'],
  'PREP-41':['臀桥','P1'],
  'PREP-45':['弹力带单腿臀桥','P4'],
  'PREP-46':['划船机低强度热身','P1'],
  'PREP-47':['滑雪机低强度热身','P2'],
  'PREP-48':['轻量火箭推节奏','P3'],
  'PREP-50':['药球深蹲推举','P4'],
};
for(const [prepId,[name,grade]] of Object.entries(categoryChecks)){
  assert.strictEqual(D.warmupDetails[prepId]?.name,name,prepId);
  assert.strictEqual(D.warmupDetails[prepId]?.prepGrade,grade,prepId);
}
const gradeCounts={P1:0,P2:0,P3:0,P4:0};
for(const prepId of D.warmupIds)gradeCounts[D.warmupDetails[prepId].prepGrade]++;
assert(gradeCounts.P1>=15&&gradeCounts.P2>=15&&gradeCounts.P3>=8&&gradeCounts.P4>=5,JSON.stringify(gradeCounts));
assert.strictEqual(D.actions.huachuanji_wentai.warmupEligible,true);
assert.strictEqual(D.actions.huaxueji_wentai.warmupEligible,true);

const expected={
  'PREP-19':['高位平板支撑','P1','SUP-S1-04'],
  'PREP-20':['前臂平板支撑','P1','SUP-S1-05'],
  'PREP-21':['仰卧双腿伸直保持','P1','warmup_supine_straight_leg_hold'],
  'PREP-22':['高位平板交替触肩','P2','SUP-S3-02'],
  'PREP-23':['平板支撑交替抬腿','P2','SUP-S3-03'],
  'PREP-24':['瑜伽球前臂平板支撑','P3','warmup_stability_ball_forearm_plank'],
  'PREP-25':['侧支撑穿针旋转','P3','SUP-S5-05'],
  'PREP-26':['侧平板髋部升降','P3','SUP-S6-04'],
  'PREP-27':['BOSU球足端平板支撑','P4','warmup_bosu_feet_plank'],
  'PREP-28':['侧平板抬上侧腿','P4','SUP-S6-05'],
};
assert.strictEqual(D.warmupIds.length,52);
for(const [prepId,[name,grade,actionId]] of Object.entries(expected)){
  const item=D.warmupDetails[prepId];
  assert(item,`${prepId} missing`);
  assert.strictEqual(item.name,name);
  assert.strictEqual(item.prepGrade,grade);
  assert.strictEqual(item.actionId,actionId);
  assert(D.actions[actionId],`${actionId} action missing`);
  assert.strictEqual(R.isActionPrepEligible(D.actions[actionId]),true,`${actionId} must be PREP eligible`);
}

for(const actionId of ['warmup_supine_straight_leg_hold','warmup_stability_ball_forearm_plank','warmup_bosu_feet_plank']){
  assert(window.V14_ANATOMY.records[actionId],`${actionId} anatomy missing`);
}

const ctx=R.normalizeContext({
  template:'f111',level:'L3',
  mainPatterns:['髋铰链','水平推'],
  mainActionIds:['yaling_luomaniya_yingla','qixie_xiong_tui'],
  formalActionIds:['yaling_luomaniya_yingla','qixie_xiong_tui'],
});
const core=R.rankSlotCandidates('CORE-ACT',ctx,{limit:5});
const grades=[...new Set(core.map(x=>x.prepGrade))];
assert.deepStrictEqual(grades,['P3','P2','P1'],'L3 CORE-ACT top candidates must visibly preserve P3 -> P2 -> P1');

const l4=R.rankSlotCandidates('CORE-ACT',{...ctx,level:'L4'},{limit:5});
const l4Grades=[...new Set(l4.map(x=>x.prepGrade))];
assert.deepStrictEqual(l4Grades,['P4','P3','P2','P1'],'L4 CORE-ACT top candidates must visibly preserve P4 -> P3 -> P2 -> P1');

console.log('prep_core_expansion_test: PASS');
