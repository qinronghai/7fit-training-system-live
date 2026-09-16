const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
])load(file);

const D=window.V14_DATA,R=window.V15BodyResolver;
assert.strictEqual(typeof R.assessEquipmentStation,'function','Body Resolver must expose the station assessment contract');

const extension=R.assessEquipmentStation({
  familyId:'BODY-01',level:'L2',slotKey:'ISOLATION-1',actionId:'tui_qushen',currentSelections:{},
});
assert.strictEqual(extension.stationId,'leg-extension-curl-combo-01');
assert.strictEqual(extension.stationName,'腿屈伸一体机');
assert.strictEqual(extension.status,'MAPPED');

const curlAfterExtension=R.assessEquipmentStation({
  familyId:'BODY-01',level:'L2',slotKey:'ISOLATION-2',actionId:'tui_wanju',
  currentSelections:{'ISOLATION-1':'tui_qushen'},
});
assert.strictEqual(curlAfterExtension.ok,false,'leg extension and leg curl must not share one physical station by default');
assert(curlAfterExtension.reasons.includes('BODY_EQUIPMENT_STATION_DUPLICATE'));
assert.strictEqual(
  R.isSelectionValid({
    familyId:'BODY-01',level:'L2',slotKey:'ISOLATION-2',actionId:'tui_wanju',
    currentSelections:{'ISOLATION-1':'tui_qushen'},
  }),
  false,
  'manual swap must use the same station gate as automatic candidates'
);

const extensionWithDumbbellRdl=R.assessEquipmentStation({
  familyId:'BODY-02',level:'L2',slotKey:'ACCESSORY',actionId:'tui_qushen',
  currentSelections:{PRIMARY:'yaling_luomaniya_yingla'},
});
assert.strictEqual(extensionWithDumbbellRdl.ok,true,'leg extension plus dumbbell RDL must remain a legal different-station combination');
assert.notStrictEqual(extensionWithDumbbellRdl.stationId,'', 'the leg extension station must remain auditable');

const stationBlockedCandidates=R.candidates({
  familyId:'BODY-01',level:'L2',slotKey:'ISOLATION-2',
  currentSelections:{'ISOLATION-1':'tui_qushen'},
});
assert(
  stationBlockedCandidates.stationBlockedCandidates.some(item=>item.actionId==='tui_wanju'),
  'Coach candidate results must explain the same-station manual swap even when the exercise family is already used'
);
assert(
  stationBlockedCandidates.stationBlockedCandidates.find(item=>item.actionId==='tui_wanju').equipmentStation.reason.includes('同一台物理器械'),
  'station-blocked candidate must carry the physical-station explanation from the Resolver'
);

const unknown=R.assessEquipmentStation({
  familyId:'BODY-03',level:'L3',slotKey:'ACCESSORY',actionId:'mianla',currentSelections:{},
});
assert.strictEqual(unknown.ok,true);
assert.strictEqual(unknown.status,'UNVERIFIED','multi-instance cable equipment must fail open with an audit state');
assert.strictEqual(unknown.stationId,'');

for(const familyId of ['BODY-01','BODY-02','BODY-03','BODY-04'])for(const level of ['L1','L2','L3','L4']){
  const session=R.resolve({familyId,level});
  const slots=Object.values(session.domainContext.equipmentStations.slots);
  const mapped=slots.map(item=>item.stationId).filter(Boolean);
  assert.strictEqual(new Set(mapped).size,mapped.length,`${familyId} ${level} auto plan must not reuse an exact station`);
  assert(!session.conflictContext.issues.some(issue=>issue.code==='BODY_EQUIPMENT_STATION_DUPLICATE'),`${familyId} ${level} must not emit a station duplicate`);
}

const duplicateBase=R.resolve({familyId:'BODY-01',level:'L2'});
const duplicateSession={
  ...duplicateBase,
  main:{...duplicateBase.main,content:duplicateBase.main.content.map(slot=>{
    if(slot.key==='ISOLATION-1')return {...slot,actionId:'tui_qushen',name:D.actions.tui_qushen.name};
    if(slot.key==='ISOLATION-2')return {...slot,actionId:'tui_wanju',name:D.actions.tui_wanju.name};
    return slot;
  })},
};
const duplicateIssues=window.V15BodyConflictPlugin.evaluate(duplicateSession);
const exactIssue=duplicateIssues.find(issue=>issue.code==='BODY_EQUIPMENT_STATION_DUPLICATE');
assert(exactIssue,'Conflict must independently detect fabricated/manual exact station reuse');
assert.strictEqual(exactIssue.severity,'hard');
assert(exactIssue.text.includes('同一台')||exactIssue.text.includes('同一物理器械'));
assert(exactIssue.text.includes('腿屈伸一体机'),'Conflict copy should expose the coach-facing equipment name');

const allowed=R.resolve({
  familyId:'BODY-01',level:'L2',stationReusePolicy:'STATION_REUSE_ALLOWED',
  selections:{'ISOLATION-1':'tui_qushen','ISOLATION-2':'tui_wanju'},
});
const allowedSlots=Object.values(allowed.domainContext.equipmentStations.slots).filter(item=>item.stationId==='leg-extension-curl-combo-01');
assert.strictEqual(allowedSlots.length,2,'explicit reuse policy must keep both requested station assignments visible');
const concentration=allowed.conflictContext.issues.find(issue=>issue.code==='BODY_EQUIPMENT_STATION_CONCENTRATION');
assert(concentration,'explicit station reuse must remain visible as a warning');
assert.strictEqual(concentration.severity,'warn');
assert.notStrictEqual(allowed.conflictContext.status,'FAIL');

const firstIssues=window.V15BodyConflictPlugin.evaluate(duplicateSession);
const secondIssues=window.V15BodyConflictPlugin.evaluate(duplicateSession);
assert.deepStrictEqual(secondIssues,firstIssues,'station conflict code and order must be deterministic');

console.log('body_equipment_station_test: exact station gate, group audit, resolver and explicit policy PASS');
