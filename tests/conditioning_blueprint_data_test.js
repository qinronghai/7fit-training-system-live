const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
const ctx={window:{},console};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(`${root}/data/system-data.js`,'utf8'),ctx,{filename:'data/system-data.js'});
const data=ctx.window.V14_DATA;

assert(data.conditioningBlueprints,'Conditioning blueprint contract must be present in runtime data');
assert.deepStrictEqual(Object.keys(data.conditioningBlueprints),Array.from(data.conditioningFamilyIds));

for(const familyId of data.conditioningFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const variants=data.conditioningBlueprints[familyId]?.[level];
    assert(variants,`${familyId} ${level} blueprint map missing`);
    assert.deepStrictEqual(Object.keys(variants).sort(),['A','B','C'],`${familyId} ${level} must expose A/B/C`);
    for(const [variantId,variant] of Object.entries(variants)){
      assert.strictEqual(variant.variantId,variantId);
      assert.strictEqual(variant.familyId,familyId);
      assert.strictEqual(variant.level,level);
      assert(variant.sessionBlueprintId);
      assert(variant.label);
      assert(variant.goal);
      assert(variant.prep?.durationMinutes>=10);
      assert(variant.recovery?.durationMinutes>=5);
      const expectedBlocks=level==='L1'?2:level==='L2'?3:3;
      assert.strictEqual(variant.blocks.length,expectedBlocks,`${familyId} ${level} ${variantId} block count`);
      assert.deepStrictEqual(Array.from(variant.blocks,(block)=>block.key),['BLOCK-A','BLOCK-B','BLOCK-C'].slice(0,expectedBlocks));
      for(const block of variant.blocks){
        assert(['BUILD','MAIN','CHALLENGE'].includes(block.role),`${familyId} ${level} ${variantId} role`);
        assert(block.goal,`${block.key} goal missing`);
        assert(block.protocolId,`${block.key} protocol missing`);
        assert(block.targetRpe>=1&&block.targetRpe<=10,`${block.key} targetRpe invalid`);
        assert(block.targetMinutes>0,`${block.key} targetMinutes missing`);
        assert(Array.isArray(block.stations)&&block.stations.length>0,`${block.key} stations missing`);
        assert(Array.isArray(block.coachingCues)&&block.coachingCues.length>0,`${block.key} coaching cues missing`);
        assert(Array.isArray(block.scaleRules)&&block.scaleRules.length>0,`${block.key} scale rules missing`);
        assert(Array.isArray(block.stopCriteria)&&block.stopCriteria.length>0,`${block.key} stop criteria missing`);
        assert(block.completionMetric,`${block.key} completion metric missing`);
        for(const station of block.stations){
          assert(station.actionId,`${block.key} station action missing`);
          assert(station.taskLabel,`${block.key} station task missing`);
          assert(station.setup,`${block.key} station setup missing`);
          assert(station.equipment,`${block.key} station equipment missing`);
          assert(station.zone,`${block.key} station zone missing`);
        }
      }
    }
  }
}

console.log('conditioning_blueprint_data_test: PASS');
