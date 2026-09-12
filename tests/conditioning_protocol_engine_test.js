const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
load('data/system-data.js');
load('js/conditioning-protocol.js');

const D=window.V14_DATA,P=window.V15ConditioningProtocol;
const defaults={
  'CON-01':{L1:'STEADY',L2:'STEADY',L3:'INTERVAL',L4:'INTERVAL'},
  'CON-02':{L1:'INTERVAL',L2:'INTERVAL',L3:'INTERVAL',L4:'CIRCUIT'},
  'CON-03':{L1:'CIRCUIT',L2:'CIRCUIT',L3:'CIRCUIT',L4:'DENSITY'},
  'CON-04':{L1:'INTERVAL',L2:'INTERVAL',L3:'CIRCUIT',L4:'CIRCUIT'},
};

for(const [familyId,byLevel] of Object.entries(defaults)){
  for(const [level,protocolId] of Object.entries(byLevel)){
    const plan=P.plan({familyId,level});
    assert.strictEqual(plan.protocolId,protocolId,`${familyId} ${level} default protocol drifted`);
    assert(plan.stationCount>=1);
    assert(plan.rounds>=1);
    assert(plan.blockMinutes>0);
    assert(plan.estimatedMinutes>0);
    assert(plan.activeWorkMinutes>0);
    assert(D.conditioningFamilies[familyId].protocolEligibility.includes(plan.protocolId));
    assert(plan.stationCount<=Object.values(D.conditioningActionMeta).filter(meta=>
      meta.families.includes(familyId)&&meta.levels.includes(level)&&meta.protocolEligibility.includes(plan.protocolId)
    ).length);
    const levelPolicy=D.conditioningLevelPolicies[level];
    assert(plan.targetRpe>=levelPolicy.targetRpeRange[0]&&plan.targetRpe<=levelPolicy.targetRpeRange[1]);
    assert(plan.estimatedMinutes>=levelPolicy.estimatedSessionMinutesRange[0]
      &&plan.estimatedMinutes<=levelPolicy.estimatedSessionMinutesRange[1],
      `${familyId} ${level} estimated duration out of level range: ${JSON.stringify(plan)}`);
    assert.deepStrictEqual(P.plan({familyId,level}),plan,`${familyId} ${level} plan must be deterministic`);
  }
}

const override=P.plan({familyId:'CON-01',level:'L1',protocolId:'INTERVAL'});
assert.strictEqual(override.protocolId,'INTERVAL');
assert.strictEqual(override.stationCount,2);

function expectCode(fn,code){
  let thrown=null;
  try{fn();}catch(error){thrown=error;}
  assert(thrown,`expected ${code}`);
  assert.strictEqual(thrown.code,code);
}
expectCode(()=>P.plan({familyId:'CON-01',level:'L1',protocolId:'CIRCUIT'}),'CONDITIONING_PROTOCOL_ILLEGAL');
expectCode(()=>P.plan({familyId:'UNKNOWN',level:'L1'}),'CONDITIONING_INPUT_INVALID');
expectCode(()=>P.plan({familyId:'CON-01',level:'L9'}),'CONDITIONING_INPUT_INVALID');

const density=P.plan({familyId:'CON-03',level:'L4'});
assert.strictEqual(density.protocolId,'DENSITY');
assert(density.densityWindowMinutes>=D.conditioningProtocolPolicies.DENSITY.densityWindowMinutesRange[0]);
assert(density.densityWindowMinutes<=D.conditioningProtocolPolicies.DENSITY.densityWindowMinutesRange[1]);
assert.strictEqual(density.workSeconds,0);

console.log('conditioning_protocol_engine_test: PASS');
