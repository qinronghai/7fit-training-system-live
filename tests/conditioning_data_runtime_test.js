const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
vm.runInThisContext(fs.readFileSync(`${root}/data/system-data.js`,'utf8'),{filename:'data/system-data.js'});

const D=window.V14_DATA;
const KEYS=[
  'conditioningFamilyIds','conditioningFamilies','conditioningProtocolIds','conditioningProtocols',
  'conditioningModalityIds','conditioningModalities','conditioningLevelPolicies','conditioningProtocolPolicies',
  'conditioningActionMeta','conditioningTransitionPolicy','conditioningConflictPolicy'
];
for(const key of KEYS) assert(Object.prototype.hasOwnProperty.call(D,key),`runtime missing ${key}`);

assert.deepStrictEqual(D.conditioningFamilyIds,['CON-01','CON-02','CON-03','CON-04']);
assert.deepStrictEqual(D.conditioningProtocolIds,['STEADY','INTERVAL','CIRCUIT','DENSITY']);
assert.strictEqual(D.conditioningModalityIds.length,8,'Conditioning modality taxonomy drifted');
assert.strictEqual(Object.keys(D.conditioningActionMeta).length,18,'Conditioning candidate inventory drifted');
assert.strictEqual(D.conditioningModalities.CARRY.v1Status,'RESERVED');

for(const [actionId,meta] of Object.entries(D.conditioningActionMeta)){
  assert(D.actions[actionId],`Conditioning candidate references unknown action ${actionId}`);
  assert.strictEqual(D.actions[actionId].route,'CONDITIONING_2F',`Conditioning route invalid ${actionId}`);
  assert.strictEqual(D.actions[actionId].status,'可自动编排',`Conditioning status invalid ${actionId}`);
  assert.strictEqual(meta.route,'CONDITIONING_2F',`Conditioning metadata route invalid ${actionId}`);
}
assert(!D.conditioningActionMeta.venue_treadmill_zone2,'POST_CARDIO treadmill leaked into formal Conditioning');
assert(!D.conditioningActionMeta.venue_stair_zone2,'POST_CARDIO stair leaked into formal Conditioning');
assert.strictEqual(D.conditioningTransitionPolicy.floorChangeAllowed,false);
assert.strictEqual(D.conditioningConflictPolicy.postCardioOnlyEligible,false);

console.log('conditioning_data_runtime_test: PASS');
