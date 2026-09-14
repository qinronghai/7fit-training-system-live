const { test, expect } = require('@playwright/test');

function capturePageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  return errors;
}

async function expect390NoOverflow(page){
  const width=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(width.clientWidth).toBe(390);
  expect(width.scrollWidth).toBe(width.clientWidth);
}

async function firstReplaceable(page,selector){
  const selects=page.locator(selector);
  for(let i=0;i<await selects.count();i+=1){
    const select=selects.nth(i);
    const current=await select.inputValue();
    const values=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));
    const target=values.find(value=>value!==current);
    if(target)return {select,current,target,slotKey:await select.getAttribute('data-body-slot')};
  }
  return null;
}

test('Body home exposes four families and all 16 level routes at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body');

  await expect(page.getByRole('heading',{name:'健美式塑形'})).toBeVisible();
  await expect(page.locator('.body-family-card')).toHaveCount(4);
  for(const familyId of ['BODY-01','BODY-02','BODY-03','BODY-04']){
    const card=page.locator(`.body-family-card[data-body-family="${familyId}"]`);
    await expect(card).toHaveCount(1);
    await expect(card.locator('.level-links a')).toHaveCount(4);
    for(const level of ['l1','l2','l3','l4']){
      await expect(card.locator(`a[href="#/coach/body/${familyId.toLowerCase()}/${level}"]`)).toHaveCount(1);
    }
  }
  await expect390NoOverflow(page);

  for(const route of [
    '#/coach/body/body-01/l1',
    '#/coach/body/body-02/l2',
    '#/coach/body/body-03/l3',
    '#/coach/body/body-04/l4',
  ]){
    await page.goto(`/${route}`);
    await expect(page.locator('.body-editor')).toBeVisible();
    await expect(page.locator('.body-slot-card').first()).toBeVisible();
    await expect390NoOverflow(page);
  }
  expect(errors,`unexpected Body pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});

test('BODY-02/L3 full workflow survives swap, copy, reload and reset at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-02/l3');

  await expect(page.locator('.body-slot-card')).toHaveCount(6);
  await expect(page.locator('[data-body-block="main"] .body-slot-card')).toHaveCount(2);
  await expect(page.locator('[data-body-block="accessory"] .body-slot-card')).toHaveCount(1);
  await expect(page.locator('[data-body-block="isolation"] .body-slot-card')).toHaveCount(3);
  await expect(page.locator('.body-action-tags').first()).toBeVisible();
  const familyGroups=await page.evaluate(()=>{
    const route=window.V14Router.parseHash(window.location.hash);
    const ctx=window.V14CoachModules.BodySession.context(route);
    return ctx.session.main.content.map(slot=>window.V14_DATA.bodyActionMeta[slot.actionId]?.exerciseFamily||'').filter(Boolean);
  });
  expect(new Set(familyGroups).size).toBe(familyGroups.length);
  const advanced=page.locator('[data-body-advanced]');
  await expect(advanced).toHaveCount(1);
  await expect(advanced).not.toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'ANATOMY｜动作涉及肌群'})).toBeHidden();
  await expect(page.getByRole('heading',{name:'Direct Work Sets｜有效工作组'})).toBeHidden();
  await advanced.locator('summary').click();
  await expect(page.getByRole('heading',{name:'ANATOMY｜动作涉及肌群'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Direct Work Sets｜有效工作组'})).toBeVisible();
  await expect(page.locator('.body-anatomy-summary')).toHaveCount(1);
  await expect(page.locator('.session-volume-summary')).toHaveCount(1);
  await expect(page.locator('.body-prep-card')).toHaveCount(5);

  const replaceable=await firstReplaceable(page,'.body-slot-select');
  expect(replaceable,'BODY-02/L3 requires a replaceable formal slot').toBeTruthy();
  await replaceable.select.selectOption(replaceable.target);
  const manualCard=page.locator(`.body-slot-card[data-body-slot="${replaceable.slotKey}"]`);
  await expect(manualCard.locator('.body-slot-head small')).toHaveText('手动选择');
  await expect(manualCard.locator('.body-slot-select')).toHaveValue(replaceable.target);

  const resolved=await page.evaluate(()=>{
    const route=window.V14Router.parseHash(window.location.hash);
    const ctx=window.V14CoachModules.BodySession.context(route);
    return {
      totalWorkingSets:ctx.session.domainContext.volume.totalWorkingSets,
      conflictStatus:ctx.session.conflictContext.status,
      prepNames:window.V14CoachModules.BodyPrep.items(ctx.prep).map(item=>item.name),
      selected:ctx.session.main.content.find(slot=>slot.source==='manual')?.actionId||'',
    };
  });
  expect(resolved.selected).toBe(replaceable.target);
  await expect(page.locator('.body-volume-overview>div').first().locator('b')).toHaveText(String(resolved.totalWorkingSets));
  await expect(page.locator('.conflict-box')).toContainText(resolved.conflictStatus);
  for(const name of resolved.prepNames)await expect(page.locator('.body-prep-section')).toContainText(name);

  await page.evaluate(()=>{
    window.__bodyCopied=[];
    window.V14SessionCopy.copyText=async text=>{window.__bodyCopied.push(text);return true;};
  });
  await page.locator('[data-body-copy="coach"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__bodyCopied.length)).toBe(1);
  await page.locator('[data-body-copy="member"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__bodyCopied.length)).toBe(2);
  const [coachCopy,memberCopy]=await page.evaluate(()=>window.__bodyCopied);
  expect(coachCopy).not.toBe(memberCopy);
  expect(coachCopy).toContain('BODY-02');
  expect(coachCopy).toContain('Direct Work Sets');
  expect(memberCopy).toContain('臀腿｜臀后侧链');
  for(const forbidden of [
    'PRIMARY','SECONDARY','ACCESSORY','ISOLATION','OPTIONAL','BODY_','resolverVersion','body-v1',
    'directSetsByTarget','secondaryExposureByTarget','hardCount','warnCount'
  ]) expect(memberCopy,`member copy leaked ${forbidden}`).not.toContain(forbidden);

  await page.reload();
  await expect(page.locator(`.body-slot-card[data-body-slot="${replaceable.slotKey}"] .body-slot-select`)).toHaveValue(replaceable.target);
  await expect(page.locator(`.body-slot-card[data-body-slot="${replaceable.slotKey}"] .body-slot-head small`)).toHaveText('手动选择');

  await page.locator('#reset-body-session').click();
  await expect(page.locator(`.body-slot-card[data-body-slot="${replaceable.slotKey}"] .body-slot-head small`)).toHaveText('系统推荐');
  await expect(page.locator(`.body-slot-card[data-body-slot="${replaceable.slotKey}"] .body-slot-select`)).not.toHaveValue(replaceable.target);
  await expect390NoOverflow(page);
  expect(errors,`unexpected Body workflow pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});


test('Body Compatibility Score reranks and exposes recommendation facts after a manual swap',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-03/l3');

  await expect(page.locator('.body-candidate-details')).toHaveCount(6);
  const before=await page.evaluate(()=>{
    const route=window.V14Router.parseHash(window.location.hash);
    const ctx=window.V14CoachModules.BodySession.context(route);
    const selections=Object.fromEntries(ctx.session.main.content.map(item=>[item.key,item.actionId]));
    const result=window.V15BodyResolver.candidates({
      familyId:ctx.familyId,level:ctx.level,slotKey:'SECONDARY',currentSelections:selections
    });
    return result.candidates.map(item=>({
      actionId:item.actionId,score:item.recommendationScore,reasons:item.reasons,tradeoffs:item.tradeoffs
    }));
  });
  expect(before.length).toBeGreaterThan(0);
  expect(Number.isFinite(before[0].score)).toBeTruthy();
  expect(before[0].reasons.length).toBeGreaterThan(0);

  const primary=page.locator('.body-slot-card[data-body-slot="PRIMARY"] .body-slot-select');
  const current=await primary.inputValue();
  const currentPattern=await page.evaluate(actionId=>window.V14_DATA.actions?.[actionId]?.pattern||'',current);
  const alternatives=await primary.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));
  const desired=currentPattern==='水平拉'?'gaowei_xiala_vba':'feiji_labei_zhongba';
  const target=alternatives.includes(desired)?desired:alternatives.find(value=>value!==current);
  expect(target,'BODY-03 L3 needs an opposite-direction PRIMARY').toBeTruthy();
  await primary.selectOption(target);
  await expect(page.locator('.body-slot-card[data-body-slot="PRIMARY"] .body-slot-select')).toHaveValue(target);

  const after=await page.evaluate(()=>{
    const route=window.V14Router.parseHash(window.location.hash);
    const ctx=window.V14CoachModules.BodySession.context(route);
    const selections=Object.fromEntries(ctx.session.main.content.map(item=>[item.key,item.actionId]));
    const result=window.V15BodyResolver.candidates({
      familyId:ctx.familyId,level:ctx.level,slotKey:'SECONDARY',currentSelections:selections
    });
    return result.candidates.map(item=>({
      actionId:item.actionId,score:item.recommendationScore,reasons:item.reasons,tradeoffs:item.tradeoffs
    }));
  });

  expect(after.length).toBeGreaterThan(0);
  expect(after[0].reasons.length).toBeGreaterThan(0);
  expect(JSON.stringify(after)).not.toBe(JSON.stringify(before));
  const details=page.locator('.body-slot-card[data-body-slot="SECONDARY"] .body-candidate-details');
  await details.locator('summary').click();
  const topCandidate=details.locator('[data-body-candidate-card]').first();
  await expect(topCandidate).toBeVisible();
  await expect(topCandidate).toContainText('推荐');
  await expect(topCandidate).toContainText('主要刺激');
  await expect(topCandidate.locator('strong')).toContainText('分');
  await expect390NoOverflow(page);
  expect(errors,`unexpected Body compatibility pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});


test('Body Coach-first default hierarchy keeps focus and primary in the mobile decision flow',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-04/l2');

  const focus=page.locator('[data-body-coach-focus]');
  const primary=page.locator('[data-body-primary-spotlight]');
  const risk=page.locator('[data-body-risk]');
  await expect(focus).toBeVisible();
  await expect(focus).toContainText('今日重点');
  await expect(primary).toBeVisible();
  await expect(primary).toContainText('今日主项');
  await expect(primary).toContainText('为什么是今天的主项');
  await expect(risk).toBeVisible();
  await expect(risk).toContainText('今日风险');

  const positions=await page.evaluate(()=>({
    focus:document.querySelector('[data-body-coach-focus]')?.getBoundingClientRect().top,
    primary:document.querySelector('[data-body-primary-spotlight]')?.getBoundingClientRect().top,
    prep:document.querySelector('.body-prep-section')?.getBoundingClientRect().top,
  }));
  expect(positions.focus).toBeLessThan(positions.prep);
  expect(positions.primary).toBeLessThan(positions.prep);
  expect(positions.primary).toBeLessThan(844);

  const advanced=page.locator('[data-body-advanced]');
  await expect(advanced).not.toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'ANATOMY｜动作涉及肌群'})).toBeHidden();
  await expect(page.getByRole('heading',{name:'Direct Work Sets｜有效工作组'})).toBeHidden();

  const primaryCard=page.locator('.body-slot-card[data-body-slot="PRIMARY"]');
  await expect(primaryCard.locator('.body-coach-role')).toHaveText('今日主项');
  await expect(primaryCard.locator('.body-system-role')).toHaveText('PRIMARY');
  await expect(primaryCard).toContainText('今日职责：');
  await expect(primaryCard).toContainText('主要刺激：');

  const candidateDetails=primaryCard.locator('.body-candidate-details');
  await candidateDetails.locator('summary').click();
  const candidates=candidateDetails.locator('[data-body-candidate-card]');
  await expect(candidates.first()).toBeVisible();
  await expect(candidates.first()).toContainText('推荐');
  await expect(candidates.first()).toContainText('主要刺激：');

  const actionable=candidates.locator('button:not([disabled])').first();
  if(await actionable.count()){
    const target=await actionable.getAttribute('data-action-id');
    await actionable.click();
    await expect(primaryCard.locator('.body-slot-select')).toHaveValue(target);
    await expect(page.locator('[data-body-primary-spotlight]')).toContainText('手动选择');
    await expect(page.locator('[data-body-risk]')).toBeVisible();
  }

  await expect390NoOverflow(page);
  expect(errors,`unexpected Body Coach-first pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});
