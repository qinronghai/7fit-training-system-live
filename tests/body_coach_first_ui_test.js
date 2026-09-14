const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js','js/coach/common.js','js/coach/template-ui.js',
  'js/coach/body-home.js','js/coach/body-volume-view.js','js/coach/body-recovery.js','js/coach/body-session.js'
]) load(file);

const D=window.V14_DATA,M=window.V14CoachModules,Body=window.V15BodyResolver;
const expectedSlots={L1:5,L2:5,L3:6,L4:6};

for(const familyId of D.bodyFamilyIds){
  for(const level of ['L1','L2','L3','L4']){
    const route={area:'coach',page:'template-session',templateId:'body',familyId,level,query:{}};
    const ctx=M.BodySession.context(route),html=M.BodySession.render(route);
    assert.strictEqual(ctx.session.main.content.length,expectedSlots[level]);
    assert(html.includes('data-body-coach-overview'),'Coach overview missing');
    assert(html.includes('data-body-coach-focus'),'今日重点 missing');
    assert(html.includes('data-body-primary-spotlight'),'今日主项 spotlight missing');
    assert(html.includes('为什么是今天的主项'),'PRIMARY why missing');
    assert(html.includes('data-body-risk'),'今日风险 missing');
    assert(html.includes('今日职责：'),'coach duty missing');
    assert(html.includes('主要刺激：'),'target stimulus missing');
    assert(html.includes('查看推荐替换与理由'),'candidate explanation entry missing');
    assert(html.includes('data-body-candidate-card'),'ranked candidate card missing');
    assert(html.includes('高级训练信息'),'Advanced entry missing');
    assert(html.includes('<details class="body-advanced" data-body-advanced>'),'Advanced must default closed');
    assert(!html.includes('<details class="body-advanced" data-body-advanced open'),'Advanced must not default open');
    assert(html.includes('Direct Work Sets｜有效工作组'),'Direct Work Sets must remain available');
    assert(html.includes('ANATOMY｜动作涉及肌群'),'Anatomy must remain available');
    assert(html.includes('Compatibility Score 分项'),'Score Debug must remain available');
    assert(html.indexOf('data-body-coach-overview')<html.indexOf('body-editor'),'Coach decision layer must precede detailed editor');

    const selections=Object.fromEntries(ctx.session.main.content.map(slot=>[slot.key,{actionId:slot.actionId,source:slot.source}]));
    for(const slot of ctx.session.main.content){
      const ranked=Body.candidates({familyId,level,slotKey:slot.key,currentSelections:selections}).candidates;
      assert(ranked.length>0,`${familyId} ${level} ${slot.key} candidate list missing`);
      assert(Number.isFinite(ranked[0].recommendationScore),'UI must consume real Compatibility Score');
      const reason=ranked[0].reasons?.[0]?.text;
      if(reason)assert(html.includes(reason),`${familyId} ${level} must render resolver reason: ${reason}`);
      const visibleTradeoff=ranked.slice(0,4).flatMap(candidate=>candidate.tradeoffs||[])[0]?.text;
      if(visibleTradeoff)assert(html.includes(visibleTradeoff),`${familyId} ${level} must render tradeoff: ${visibleTradeoff}`);
    }
  }
}

// Internal Role IDs remain available as secondary audit labels, never as the coach-facing role title.
const representative=M.BodySession.render({area:'coach',page:'template-session',templateId:'body',familyId:'BODY-04',level:'L2',query:{}});
for(const label of ['今日主项','第二训练方向','辅助塑形','局部补充'])assert(representative.includes(label),`missing coach label ${label}`);
assert(representative.includes('body-system-role">PRIMARY'),'PRIMARY audit label must remain');
assert(representative.includes('body-system-role">SECONDARY'),'SECONDARY audit label must remain');

// UI must consume #69 facts rather than recreate score weights/formulas.
const source=fs.readFileSync('js/coach/body-session.js','utf8');
for(const forbidden of ['COMPATIBILITY_POLICY','slotFit:30','targetComplement:20','fatigueOverlap:12']){
  assert(!source.includes(forbidden),`Body UI must not duplicate scoring rule: ${forbidden}`);
}

console.log('body_coach_first_ui_test: 16-state Coach-first hierarchy + Advanced + recommendation facts GREEN');
