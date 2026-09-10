const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
vm.runInThisContext(fs.readFileSync(`${root}/data/system-data.js`,'utf8'),{filename:'data/system-data.js'});

const D=window.V14_DATA;
const BODY_KEYS=[
  'bodyTargetIds','bodyTargetCatalog','bodyRoleIds','bodyRoles','bodyFamilyIds','bodyFamilies',
  'bodyLevelPolicies','bodyPrescriptionProfiles','bodyActionMeta','bodyVolumePolicy','bodyConflictPolicy'
];
for(const key of BODY_KEYS) assert(Object.prototype.hasOwnProperty.call(D,key),`runtime missing ${key}`);

assert.strictEqual(D.bodyTargetIds.length,14,'Body target taxonomy drifted');
assert.deepStrictEqual(D.bodyRoleIds,['PRIMARY','SECONDARY','ACCESSORY','ISOLATION','OPTIONAL']);
assert.deepStrictEqual(D.bodyFamilyIds,['BODY-01','BODY-02','BODY-03','BODY-04']);
assert.deepStrictEqual(Object.keys(D.bodyLevelPolicies),['L1','L2','L3','L4']);
assert(D.bodyActionMeta && Object.keys(D.bodyActionMeta).length>=40 && Object.keys(D.bodyActionMeta).length<=60,'Body candidate count must remain 40-60');

for(const [actionId,meta] of Object.entries(D.bodyActionMeta)){
  assert(D.actions[actionId],`Body candidate references unknown action ${actionId}`);
  assert(['1F_ONLY','FLEX_1F_2F'].includes(D.actions[actionId].route),`Body candidate route invalid ${actionId}`);
  assert.strictEqual(D.actions[actionId].status,'可自动编排',`Body candidate status invalid ${actionId}`);
  assert(meta.directTargets.length>0,`Body candidate directTargets empty ${actionId}`);
}

assert.strictEqual(D.bodyVolumePolicy.secondaryExposureCountsDirect,false);
assert.strictEqual(D.bodyVolumePolicy.unilateralSetCounting,'PER_SIDE_PRESCRIPTION_COUNTS_ONCE');
assert.strictEqual(D.bodyVolumePolicy.sessionTotalCounting,'SUM_SLOT_WORKING_SETS_ONCE');
assert.strictEqual(D.bodyVolumePolicy.directTargetCounting,'MULTI_LABEL_EACH_DIRECT_TARGET');

console.log('body_data_runtime_test: PASS');
