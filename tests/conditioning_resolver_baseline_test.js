const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
  'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js'
])load(file);

const D=window.V14_DATA,Contract=window.V15ResolvedSession,Dispatcher=window.V15TemplateResolver;
const families=['CON-01','CON-02','CON-03','CON-04'],levels=['L1','L2','L3','L4'];
const EXPECTED_SHA='16a3234e77412aa9a2cd5364e430bdf1d620732a1cb169539e20ef11be07dd6f';
const expectedProtocols={
  'CON-01':{L1:'STEADY',L2:'STEADY',L3:'INTERVAL',L4:'INTERVAL'},
  'CON-02':{L1:'INTERVAL',L2:'INTERVAL',L3:'INTERVAL',L4:'CIRCUIT'},
  'CON-03':{L1:'CIRCUIT',L2:'CIRCUIT',L3:'CIRCUIT',L4:'DENSITY'},
  'CON-04':{L1:'INTERVAL',L2:'INTERVAL',L3:'CIRCUIT',L4:'CIRCUIT'},
};

function signature(session){
  const ctx=session.domainContext;
  return {
    familyId:session.familyId,
    level:session.level,
    protocolId:ctx.protocolId,
    metrics:ctx.metrics,
    stations:Object.values(ctx.stations).map(s=>({
      key:s.key,actionId:s.actionId,source:s.source,primaryModality:s.primaryModality,
      workMetric:s.workMetric,impact:s.impact,coordinationDemand:s.coordinationDemand,
      fatigueRisk:s.fatigueRisk,powerEligible:s.powerEligible,
    })),
    conflictStatus:session.conflictContext.status,
    conflictCodes:session.conflictContext.issues.map(issue=>issue.code),
  };
}

const signatures=[];
for(const familyId of families){
  for(const level of levels){
    const session=Dispatcher.resolve('conditioning',{familyId,level});
    assert.strictEqual(session.schemaVersion,1);
    assert.strictEqual(session.resolverVersion,'conditioning-v1');
    assert.strictEqual(session.templateId,'conditioning');
    assert.strictEqual(session.familyId,familyId);
    assert.strictEqual(session.level,level);
    assert.strictEqual(session.main.kind,'PROTOCOL');
    assert.strictEqual(session.domainContext.kind,'CONDITIONING');
    assert.strictEqual(session.domainContext.protocolId,expectedProtocols[familyId][level]);
    assert.strictEqual(session.main.content.protocolId,expectedProtocols[familyId][level]);
    assert.strictEqual(session.source.type,'GENERATED');
    assert.strictEqual(session.source.id,`${familyId}-${level}-${expectedProtocols[familyId][level]}`);
    const stations=Object.values(session.domainContext.stations);
    assert.strictEqual(stations.length,session.domainContext.metrics.stationCount);
    assert.strictEqual(session.main.content.blocks.length,1);
    assert.strictEqual(session.main.content.blocks[0].items.length,stations.length);
    assert.strictEqual(new Set(stations.map(s=>s.actionId)).size,stations.length,'auto stations must be unique');
    assert(stations.every(s=>D.actions[s.actionId]?.route==='CONDITIONING_2F'));
    assert(stations.every(s=>D.actions[s.actionId]?.status==='可自动编排'));
    assert(stations.every(s=>s.source==='auto'));
    if(familyId==='CON-04')assert(stations.every(s=>s.powerEligible===true),'CON-04 must use power eligible stations');
    assert(['PASS','WARN'].includes(session.conflictContext.status),
      `${familyId} ${level} auto baseline must not FAIL: ${JSON.stringify(session.conflictContext)}`);
    const validation=Contract.validate(session);
    assert.strictEqual(validation.ok,true,validation.errors.join(' | '));
    assert.deepStrictEqual(Dispatcher.resolve('conditioning',{familyId,level}),session,
      `${familyId} ${level} must resolve deterministically`);
    signatures.push(signature(session));
  }
}

const sha=crypto.createHash('sha256').update(JSON.stringify(signatures)).digest('hex');
console.log(`CONDITIONING_RESOLVER_BASELINE_SHA=${sha}`);
assert.strictEqual(sha,EXPECTED_SHA,'Conditioning Resolver V1 16-state baseline drifted');
console.log('conditioning_resolver_baseline_test: frozen 16-state baseline GREEN');
