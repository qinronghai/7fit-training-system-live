const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {actions}=require('../data/src/actions.json');
const {composer}=require('../data/src/composer.json');
const {sessions}=require('../data/src/sessions.json');

const data={actions,composer};
const window={V14_DATA:data,V14CoachModules:{Common:{D:()=>data,esc:String}}};
for(const file of ['module-copy.js','coach/f111-energy.js']){
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),{window});
}
const {estimate}=window.V14CoachModules.F111Energy;
const actionIds=['tushen_shendun','movement_bodyweight_pullup','movement_dowel_hip_hinge','V13_SQ_DB_GOBLET','tushen_shendun','movement_dowel_hip_hinge'];
const slots=Object.entries(composer.prescriptionBySlot).map(([key,prescription],index)=>{
  const actionId=actionIds[index];
  return {key,prescription,actionId,name:actions[actionId].name};
});

const session={main:{content:slots}};
const base=estimate(session,60);
assert.equal(base.movements.length,6);
assert.equal(base.movements[0].name,'徒手深蹲');
assert.equal(base.strength[0],base.movements.reduce((sum,item)=>sum+item.kcal[0],0));
assert.equal(base.total[0],base.warmup[0]+base.strength[0]+base.recovery[0]);
assert.equal(estimate(session,90).total[0]/base.total[0],1.5);

const replaced=estimate({main:{content:[{...slots[0],actionId:'V13_SQ_DB_GOBLET',name:'哑铃高脚杯深蹲'},...slots.slice(1)]}},60);
assert.equal(replaced.movements[0].name,'哑铃高脚杯深蹲');
assert(replaced.movements[0].kcal[1]>base.movements[0].kcal[1]);
assert(replaced.total[1]>base.total[1]);

const higherDose=estimate({main:{content:[{...slots[0],prescription:'4组 × 12–15次/侧'},...slots.slice(1)]}},60);
assert(higherDose.movements[0].kcal[0]>base.movements[0].kcal[0]);
assert.equal(estimate({main:{content:slots.slice(1)}},60),null);
assert.equal(estimate(session,0),null);
assert.equal(estimate(session,Infinity),null);
for(const [id,preset] of Object.entries(sessions)){
  const content=preset.slots.map(slot=>{
    const key=slot.slotKey.split('__').pop();
    return {key,label:slot.slotName,actionId:slot.baselineId,prescription:composer.prescriptionBySlot[key]||''};
  });
  assert.equal(estimate({main:{content}},60)?.movements.length,6,id);
}
console.log('F111 energy estimate passed');
