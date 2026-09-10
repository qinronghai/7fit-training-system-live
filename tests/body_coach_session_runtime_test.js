const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js','js/coach/common.js','js/coach/template-ui.js'
]) load(file);

for(const file of ['js/coach/body-home.js','js/coach/body-volume-view.js','js/coach/body-session.js']){
  assert.strictEqual(fs.existsSync(file),true,`${file} must exist`);
  load(file);
}

const M=window.V14CoachModules,D=window.V14_DATA;
assert(M.BodyHome&&typeof M.BodyHome.render==='function','BodyHome.render must exist');
assert(M.BodyVolumeView&&typeof M.BodyVolumeView.render==='function','BodyVolumeView.render must exist');
assert(M.BodySession&&typeof M.BodySession.context==='function'&&typeof M.BodySession.render==='function','BodySession context/render must exist');

const home=M.BodyHome.render();
for(const familyId of D.bodyFamilyIds){
  const family=D.bodyFamilies[familyId];
  assert(home.includes(familyId),`${familyId} card missing`);
  assert(home.includes(family.name),`${familyId} name missing`);
  for(const level of ['L1','L2','L3','L4'])assert(home.includes(`#/coach/body/${familyId.toLowerCase()}/${level.toLowerCase()}`),`${familyId} ${level} link missing`);
  for(const targetId of family.primaryTargets){
    const targetName=D.bodyTargetCatalog[targetId].name;
    assert(home.includes(targetName),`${familyId} primary target ${targetName} missing`);
  }
}
assert(home.includes('#/coach/body/compose?family=BODY-01&level=L1'),'Body composer entry missing');

const expectedSlots={L1:5,L2:5,L3:6,L4:6};
for(const familyId of D.bodyFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const route={area:'coach',page:'template-session',templateId:'body',familyId,level,query:{}};
    const ctx=M.BodySession.context(route);
    assert.strictEqual(ctx.familyId,familyId);
    assert.strictEqual(ctx.level,level);
    assert.strictEqual(ctx.sessionKey,`${familyId}-${level}`);
    assert.strictEqual(ctx.session.templateId,'body');
    assert.strictEqual(ctx.session.main.content.length,expectedSlots[level]);
    const html=M.BodySession.render(route);
    assert(html.includes('ANATOMY｜动作涉及肌群'),'Body Anatomy label must be explicit');
    assert(html.includes('Direct Work Sets｜有效工作组'),'Body Direct Work Sets label must be explicit');
    assert(html.includes('协同暴露（不计入 Direct Work Sets）'),'secondary exposure disclaimer missing');
    assert(html.includes(String(ctx.session.domainContext.volume.totalWorkingSets)),'totalWorkingSets must render from domainContext.volume');
    assert(html.includes(String(ctx.session.domainContext.volume.estimatedMinutes)),'estimatedMinutes must render from domainContext.volume');
    for(const slot of ctx.session.main.content){
      const domain=ctx.session.domainContext.slots[slot.key];
      assert(domain,`${slot.key} domain slot missing`);
      assert(html.includes(slot.name),`${slot.key} name missing`);
      assert(html.includes(String(domain.workingSets)),`${slot.key} structured workingSets missing`);
      assert(html.includes(domain.repRange.join('–')),`${slot.key} structured repRange missing`);
      assert(html.includes(domain.rirRange.join('–')),`${slot.key} structured rirRange missing`);
      assert(html.includes(domain.restSecondsRange.join('–')),`${slot.key} structured rest missing`);
    }
    assert(html.includes(ctx.session.conflictContext.status),'Conflict status must come from ResolvedSession');
  }
}

const adapter=M.TemplateUI.get('body');
assert(adapter,'Body Template UI adapter must register');
assert.strictEqual(adapter.canHandle({page:'template',templateId:'body'}),true);
assert.strictEqual(adapter.canHandle({page:'template-session',templateId:'body'}),true);
assert.strictEqual(adapter.canHandle({page:'template-compose',templateId:'body'}),true,'Body adapter must own template-compose');
assert.strictEqual(adapter.canHandle({page:'template',templateId:'conditioning'}),false);

// Composer must normalize query input and reuse the exact same logical editor/session key.
const composeRoute={area:'coach',page:'template-compose',templateId:'body',query:{family:'BODY-02',level:'L3'}};
const composeCtx=M.BodySession.context(composeRoute);
const sessionCtx=M.BodySession.context({area:'coach',page:'template-session',templateId:'body',familyId:'BODY-02',level:'L3',query:{}});
assert.strictEqual(composeCtx.familyId,'BODY-02');
assert.strictEqual(composeCtx.level,'L3');
assert.strictEqual(composeCtx.sessionKey,'BODY-02-L3');
assert.deepStrictEqual(composeCtx.session,sessionCtx.session,'Composer and Session route must share one resolved logical session');

const defaultCompose=M.BodySession.context({area:'coach',page:'template-compose',templateId:'body',query:{}});
assert.strictEqual(defaultCompose.familyId,'BODY-01');
assert.strictEqual(defaultCompose.level,'L1');
const invalidCompose=M.BodySession.context({area:'coach',page:'template-compose',templateId:'body',query:{family:'BODY-99',level:'L9'}});
assert.strictEqual(invalidCompose.familyId,'BODY-01','invalid Body composer family must fall back to BODY-01');
assert.strictEqual(invalidCompose.level,'L1','invalid Body composer level must fall back to L1');

const composeHtml=adapter.render(composeRoute);
assert(composeHtml.includes('Body 自由编课'),'Body Composer heading missing');
assert(composeHtml.includes('data-body-compose-family'),'Body Composer family selector missing');
assert(composeHtml.includes('data-body-compose-level'),'Body Composer level selector missing');
assert(composeHtml.includes('BODY-02-L3'),'Composer must render the shared Body session editor');
for(const forbidden of ['5 × 4 主模式矩阵','lowerMode','upperMode','coreDemand','SUPPORT Grade'])assert(!composeHtml.includes(forbidden),`Body Composer must not leak F111 concept: ${forbidden}`);

console.log('body_coach_session_runtime_test: PASS');
