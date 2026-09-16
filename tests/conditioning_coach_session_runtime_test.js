const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/conditioning.js',
  'js/conditioning-protocol.js','js/template-resolver.js','js/resolvers/conditioning.js',
  'js/coach/common.js','js/coach/template-ui.js','js/coach/conflict-view.js',
  'js/coach/conditioning-home.js','js/coach/conditioning-recovery.js',
  'js/recovery-protocol-adapter.js','js/recovery-matcher.js'
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
assert(home.includes('#/coach/conditioning/compose?family=CON-01&level=L1&variant=A'),'Conditioning composer entry missing');

for(const familyId of D.conditioningFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const route={area:'coach',page:'template-session',templateId:'conditioning',familyId,level,query:{}};
    const ctx=M.ConditioningSession.context(route);
    assert.strictEqual(ctx.familyId,familyId);
    assert.strictEqual(ctx.level,level);
    assert(ctx.protocolId);
    assert.strictEqual(ctx.variantId,'A');
    assert.strictEqual(ctx.sessionKey,`${familyId}-${level}-BLUEPRINT-A`);
    assert.strictEqual(ctx.session.templateId,'conditioning');
    assert.strictEqual(ctx.session.main.kind,'PROTOCOL');
    const html=M.ConditioningSession.render(route);
    assert(html.includes('今日体能结构'),'Blueprint panel missing');
    assert(html.includes('2F CONDITIONING｜分段执行'),'Block execution section missing');
    assert(html.includes('训练任务'),'task count label missing');
    assert(html.includes('预计整节'),'estimated duration label missing');
    assert(html.includes('Impact'),'impact summary missing');
    assert(html.includes('Coordination'),'coordination summary missing');
    assert(html.includes('NO POST CARDIO'),'full Conditioning must explicitly show NO POST CARDIO');
    assert(html.includes('完成拉伸｜约 5–8 分钟'),'Recovery block missing');
    assert.strictEqual((html.match(/data-recovery-card=/g)||[]).length,3,'Conditioning must match three Recovery cards');
    for(const block of ctx.session.blocks)assert(html.includes(block.protocolName),`${familyId} ${level} protocol name must render from ResolvedSession`);
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

const composeRoute={area:'coach',page:'template-compose',templateId:'conditioning',query:{family:'CON-03',level:'L2',variant:'B'}};
const compose=M.ConditioningSession.context(composeRoute);
assert.strictEqual(compose.familyId,'CON-03');
assert.strictEqual(compose.level,'L2');
assert.strictEqual(compose.variantId,'B');
assert.strictEqual(compose.sessionKey,'CON-03-L2-BLUEPRINT-B');
const composeHtml=adapter.render(composeRoute);
assert(composeHtml.includes('Conditioning 课程构建'));
assert(composeHtml.includes('data-conditioning-compose-family'));
assert(composeHtml.includes('data-conditioning-compose-level'));
assert(composeHtml.includes('data-conditioning-compose-variant'));
assert(composeHtml.includes('CON-03-L2-BLUEPRINT-B'));
assert(composeHtml.includes('NO POST CARDIO'));

const invalid=M.ConditioningSession.context({area:'coach',page:'template-compose',templateId:'conditioning',query:{family:'CON-99',level:'L9',variant:'MAGIC'}});
assert.strictEqual(invalid.familyId,'CON-01');
assert.strictEqual(invalid.level,'L1');
assert.strictEqual(invalid.variantId,'A');

console.log('conditioning_coach_session_runtime_test: PASS');
