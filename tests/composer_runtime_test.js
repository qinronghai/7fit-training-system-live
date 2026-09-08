const fs=require('fs'),vm=require('vm'),assert=require('assert');
const ctx={window:{},console}; vm.createContext(ctx);
for(const file of ['data/system-data.js','js/composer.js']) vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
const D=ctx.window.V14_DATA,C=ctx.window.V14Composer;
assert(C,'V14Composer missing');
assert(D.composer,'composer config missing');
assert.strictEqual(Object.keys(D.composer.lowerModes).length,5);
assert.strictEqual(Object.keys(D.composer.upperModes).length,4);
assert.strictEqual(C.combinations().length,20);
assert.strictEqual(new Set(C.combinations().map(x=>x.id)).size,20);
assert.deepStrictEqual(Array.from(C.mainTierWindow('L1').normal),['T1']);
assert.deepStrictEqual(Array.from(C.mainTierWindow('L2').normal),['T1','T2']);
assert.deepStrictEqual(Array.from(C.mainTierWindow('L3').normal),['T2','T3']);
assert.deepStrictEqual(Array.from(C.mainTierWindow('L4').normal),['T3','T4']);
assert.strictEqual(C.supportWindow('L3').recommended,'SUP-S3');
assert.deepStrictEqual(Array.from(C.supportWindow('L3').normal),['SUP-S2','SUP-S3','SUP-S4']);
assert.deepStrictEqual(Array.from(C.supportWindow('L3').expanded),['SUP-S5']);
assert.deepStrictEqual(Array.from(C.coreWindow('L4').normal),['CORE-L2','CORE-L3','CORE-L4']);
const r=C.resolve({level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',coreDemand:'anti_extension'});
assert.strictEqual(r.compositionId,'F111-C-SLH-HP');
assert.strictEqual(r.level,'L3');
assert.strictEqual(r.slots.length,6);
assert.strictEqual(r.slots[0].slotKey,'A');
assert.strictEqual(r.slots[0].actionId,'movement_db_single_leg_rdl');
assert.strictEqual(r.slots[0].tier,'T3');
assert.strictEqual(r.slots[1].slotKey,'B');
assert(['T2','T3'].includes(r.slots[1].tier));
assert.strictEqual(r.slots[2].grade,'SUP-S3');
assert(r.slotOptions.A.some(x=>x.tier==='T2'));
assert(r.slotOptions.A.some(x=>x.tier==='T3'));
assert(r.slotOptions.D1.length>=3);
assert(r.slotOptions.D2.length>=3);
assert(!r.slotOptions.D1.some(x=>x.id===r.slots[0].actionId));
assert(!r.slotOptions.D2.some(x=>x.id===r.slots[1].actionId));
assert(r.slotOptions.C.every(x=>['SUP-S2','SUP-S3','SUP-S4'].includes(x.grade)));
assert(r.slotOptions.CORE.every(x=>['CORE-L2','CORE-L3'].includes(x.grade)));
assert(r.slots[5].coreDemand.includes('抗伸展'));

// V14.7 release-gate: every 20 x 4 state must resolve all six formal slots.
for(const level of ['L1','L2','L3','L4']){
  for(const lowerMode of Object.keys(D.composer.lowerModes)){
    for(const upperMode of Object.keys(D.composer.upperModes)){
      const full=C.resolve({level,lowerMode,upperMode,coreDemand:'anti_extension'});
      assert.strictEqual(full.slots.length,6,`${level} ${lowerMode} ${upperMode}: slot count`);
      assert(full.slots.every(x=>x.actionId),`${level} ${lowerMode} ${upperMode}: missing formal slot`);
    }
  }
}
// FLEX_1F_2F T1 movements are valid formal-strength candidates in the venue route.
assert.strictEqual(C.resolve({level:'L1',lowerMode:'squat',upperMode:'horizontal_pull'}).slots[0].actionId,'tushen_shendun');
assert.strictEqual(C.resolve({level:'L1',lowerMode:'hip_extension',upperMode:'horizontal_pull'}).slots[0].actionId,'tunqiao');
// Hip-extension T4 reuses the venue's T3 hip-thrust action with an explicit T4 effective tier + prescription.
const hipL4=C.resolve({level:'L4',lowerMode:'hip_extension',upperMode:'horizontal_pull'});
assert.strictEqual(hipL4.slots[0].actionId,'hipthrust_pause_main');
assert.strictEqual(hipL4.slots[0].tier,'T4');
assert.strictEqual(hipL4.slots[0].prescriptionOverride,'3–4组 × 6–8次｜RIR 1–2');
assert.strictEqual(hipL4.slotOptions.A.filter(x=>x.id==='hipthrust_pause_main').length,1);
assert.strictEqual(hipL4.slotOptions.A.find(x=>x.id==='hipthrust_pause_main').tier,'T4');
console.log('composer runtime: PASS');
