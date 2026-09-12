const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
  'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js',
  'js/coach/common.js','js/coach/template-ui.js','js/coach/conflict-view.js',
  'js/coach/conditioning-home.js','js/coach/conditioning-recovery.js'
])load(file);
load('js/coach/conditioning-prep.js');
load('js/coach/conditioning-session.js');

const M=window.V14CoachModules,D=window.V14_DATA;
assert(M.ConditioningHome&&typeof M.ConditioningHome.render==='function');
assert(M.ConditioningSession&&typeof M.ConditioningSession.context==='function');

const home=M.ConditioningHome.render();
for(const familyId of D.conditioningFamilyIds){
  const family=D.conditioningFamilies[familyId];
  assert(home.includes(familyId),`${familyId} missing`);
  assert(home.includes(family.name),`${familyId} name missing`);
  assert(home.includes(family.goal),`${familyId} goal missing`);
  for(const level of ['L1','L2','L3','L4']){
    assert(home.includes(`#/coach/conditioning/${familyId.toLowerCase()}/${level.toLowerCase()}`),`${familyId} ${level} link missing`);
  }
}
assert(home.includes('#/coach/conditioning/compose?family=CON-01&level=L1&protocol=STEADY'),'Conditioning composer entry missing');

for(const familyId of D.conditioningFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const route={area:'coach',page:'template-session',templateId:'conditioning',familyId,level,query:{}};
    const ctx=M.ConditioningSession.context(route);
    assert.strictEqual(ctx.familyId,familyId);
    assert.strictEqual(ctx.level,level);
    assert(ctx.protocolId);
    assert.strictEqual(ctx.sessionKey,`${familyId}-${level}-${ctx.protocolId}`);
    assert.strictEqual(ctx.session.templateId,'conditioning');
    assert.strictEqual(ctx.session.main.kind,'PROTOCOL');
    const html=M.ConditioningSession.render(route);
    assert(html.includes('PROTOCOL｜今日体能结构'),'Protocol panel missing');
    assert(html.includes('2F CONDITIONING｜Station 执行'),'Station execution section missing');
    assert(html.includes('Target RPE'),'RPE label missing');
    assert(html.includes('预计整节'),'estimated duration label missing');
    assert(html.includes('Impact'),'impact summary missing');
    assert(html.includes('Coordination'),'coordination summary missing');
    assert(html.includes('NO POST CARDIO'),'full Conditioning must explicitly show NO POST CARDIO');
    assert(html.includes('RECOVERY｜训练后恢复 · 约 5–8 分钟'),'Recovery block missing');
    assert(html.includes(ctx.session.domainContext.protocolName),'protocol name must render from ResolvedSession');
    assert(html.includes(String(ctx.session.domainContext.metrics.targetRpe)),'target RPE must render from ResolvedSession');
    assert(html.includes(String(ctx.session.domainContext.metrics.estimatedMinutes)),'duration must render from ResolvedSession');
    const stations=Object.values(ctx.session.domainContext.stations);
    assert.strictEqual((html.match(/data-conditioning-station-card=/g)||[]).length,stations.length);
    for(const station of stations){
      assert(html.includes(station.name),`${familyId} ${level} station name missing: ${station.name}`);
      assert(html.includes(station.prescription),`${familyId} ${level} station prescription missing`);
    }
    assert(html.includes(ctx.session.conflictContext.status),'Conflict status missing');
  }
}

const adapter=M.TemplateUI.get('conditioning');
assert(adapter,'Conditioning Template UI adapter must register');
assert.strictEqual(adapter.canHandle({page:'template',templateId:'conditioning'}),true);
assert.strictEqual(adapter.canHandle({page:'template-session',templateId:'conditioning'}),true);
assert.strictEqual(adapter.canHandle({page:'template-compose',templateId:'conditioning'}),true);
assert.strictEqual(adapter.canHandle({page:'template',templateId:'body'}),false);

const composeRoute={area:'coach',page:'template-compose',templateId:'conditioning',query:{family:'CON-03',level:'L2',protocol:'CIRCUIT'}};
const compose=M.ConditioningSession.context(composeRoute);
assert.strictEqual(compose.familyId,'CON-03');
assert.strictEqual(compose.level,'L2');
assert.strictEqual(compose.protocolId,'CIRCUIT');
assert.strictEqual(compose.sessionKey,'CON-03-L2-CIRCUIT');
const composeHtml=adapter.render(composeRoute);
assert(composeHtml.includes('Conditioning 自由编课'));
assert(composeHtml.includes('data-conditioning-compose-family'));
assert(composeHtml.includes('data-conditioning-compose-level'));
assert(composeHtml.includes('data-conditioning-compose-protocol'));
assert(composeHtml.includes('CON-03-L2-CIRCUIT'));
assert(composeHtml.includes('NO POST CARDIO'));

const invalid=M.ConditioningSession.context({area:'coach',page:'template-compose',templateId:'conditioning',query:{family:'CON-99',level:'L9',protocol:'MAGIC'}});
assert.strictEqual(invalid.familyId,'CON-01');
assert.strictEqual(invalid.level,'L1');
assert.strictEqual(invalid.protocolId,'STEADY');

console.log('conditioning_coach_session_runtime_test: PASS');
