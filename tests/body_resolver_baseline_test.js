const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
]) load(file);

const D=window.V14_DATA,Contract=window.V15ResolvedSession,Dispatcher=window.V15TemplateResolver;
const EXPECTED_SHA='c06f4ddd03bebce65c8875dd66a03d99d897e54adec0190ea50a72e47e5f8005';
const families=['BODY-01','BODY-02','BODY-03','BODY-04'],levels=['L1','L2','L3','L4'];
const expectedSlots={L1:5,L2:5,L3:6,L4:6};
const expectedSets={L1:10,L2:12,L3:14,L4:16};
const expectedKeys={
  L1:['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2'],
  L2:['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2'],
  L3:['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2','OPTIONAL'],
  L4:['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2','OPTIONAL'],
};

function signature(session){
  const body=session.domainContext;
  return {
    familyId:session.familyId,
    level:session.level,
    slots:session.main.content.map(slot=>({
      key:slot.key,actionId:slot.actionId,source:slot.source,
      role:body.slots[slot.key].role,workingSets:body.slots[slot.key].workingSets,
      repRange:body.slots[slot.key].repRange,rirRange:body.slots[slot.key].rirRange,
      restSecondsRange:body.slots[slot.key].restSecondsRange,
    })),
    directSetsByTarget:body.volume.directSetsByTarget,
    secondaryExposureByTarget:body.volume.secondaryExposureByTarget,
    totalWorkingSets:body.volume.totalWorkingSets,
    isolationRatio:body.volume.isolationRatio,
    highFatigueCompoundCount:body.volume.highFatigueCompoundCount,
    estimatedMinutes:body.volume.estimatedMinutes,
    conflictStatus:session.conflictContext.status,
    conflictCodes:session.conflictContext.issues.map(issue=>issue.code),
  };
}

const signatures=[];
for(const familyId of families){
  for(const level of levels){
    const input={familyId,level};
    const session=Dispatcher.resolve('body',input);
    assert.strictEqual(session.schemaVersion,1);
    assert.strictEqual(session.resolverVersion,'body-v1');
    assert.strictEqual(session.templateId,'body');
    assert.strictEqual(session.familyId,familyId);
    assert.strictEqual(session.level,level);
    assert.strictEqual(session.source.type,'GENERATED');
    assert.strictEqual(session.source.id,`${familyId}-${level}`);
    assert.strictEqual(session.main.kind,'SLOT');
    assert.strictEqual(session.main.content.length,expectedSlots[level]);
    assert.deepStrictEqual(session.main.content.map(slot=>slot.key),expectedKeys[level]);
    assert.strictEqual(session.domainContext.kind,'BODY');
    assert.deepStrictEqual(Object.keys(session.domainContext.slots),expectedKeys[level]);
    assert.strictEqual(session.domainContext.volume.totalWorkingSets,expectedSets[level]);
    assert(session.main.content.every(slot=>slot.actionId&&slot.name&&slot.prescription));
    assert(session.main.content.every(slot=>['auto','manual'].includes(slot.source)));
    assert(['PASS','WARN','FAIL'].includes(session.conflictContext.status));
    assert.notStrictEqual(
      session.conflictContext.status,'FAIL',
      `${familyId} ${level} auto baseline must not FAIL: ${JSON.stringify(session.conflictContext)}`
    );
    assert.strictEqual(Contract.validate(session).ok,true,Contract.validate(session).errors.join(' | '));
    assert.deepStrictEqual(Dispatcher.resolve('body',input),session,`${familyId} ${level} must resolve deterministically`);
    signatures.push(signature(session));
  }
}

const sha=crypto.createHash('sha256').update(JSON.stringify(signatures)).digest('hex');
console.log(`BODY_RESOLVER_BASELINE_SHA=${sha}`);
assert.strictEqual(sha,EXPECTED_SHA,'Body Resolver V1 16-state baseline drifted');
console.log('body_resolver_baseline_test: frozen 16-state baseline GREEN');
