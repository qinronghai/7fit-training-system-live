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

async function firstReplaceableStation(page){
  const selects=page.locator('.conditioning-station-select');
  for(let i=0;i<await selects.count();i+=1){
    const select=selects.nth(i);
    const current=await select.inputValue();
    const values=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));
    const target=values.find(value=>value!==current);
    if(target)return {
      select,current,target,
      stationKey:await select.getAttribute('data-conditioning-station'),
      sessionKey:await select.getAttribute('data-conditioning-session'),
    };
  }
  return null;
}

test('Conditioning home exposes four Families and all 16 Level routes at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning');

  await expect(page.getByRole('heading',{name:'体能训练'})).toBeVisible();
  await expect(page.locator('.conditioning-family-card')).toHaveCount(4);
  await expect(page.getByRole('link',{name:'自由编课 →',exact:true})).toBeVisible();

  for(const familyId of ['CON-01','CON-02','CON-03','CON-04']){
    const card=page.locator(`.conditioning-family-card[data-conditioning-family="${familyId}"]`);
    await expect(card).toHaveCount(1);
    await expect(card.locator('.level-links a')).toHaveCount(4);
    for(const level of ['l1','l2','l3','l4']){
      await expect(card.locator(`a[href="#/coach/conditioning/${familyId.toLowerCase()}/${level}"]`)).toHaveCount(1);
    }
  }
  await expect390NoOverflow(page);

  for(const route of [
    '#/coach/conditioning/con-01/l1',
    '#/coach/conditioning/con-02/l2',
    '#/coach/conditioning/con-03/l3',
    '#/coach/conditioning/con-04/l4',
  ]){
    await page.goto(`/${route}`);
    await expect(page.locator('.conditioning-protocol-panel')).toBeVisible();
    await expect(page.locator('.conditioning-station-card').first()).toBeVisible();
    await expect(page.getByText('NO POST CARDIO',{exact:false}).first()).toBeVisible();
    await expect390NoOverflow(page);
  }

  expect(errors,`unexpected Conditioning pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});

test('CON-03 L2 Circuit survives Station swap, Copy, reload and reset at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/con-03/l2');

  await expect(page.getByRole('heading',{name:'混合体能'})).toBeVisible();
  await expect(page.locator('.conditioning-protocol-panel')).toContainText('循环');
  await expect(page.locator('.conditioning-protocol-panel')).toContainText('Target RPE');
  await expect(page.locator('.conditioning-protocol-panel')).toContainText('预计整节');
  await expect(page.locator('.conditioning-station-card')).toHaveCount(3);
  await expect(page.locator('.conditioning-prep-card')).toHaveCount(5);
  await expect(page.getByText('NO POST CARDIO',{exact:false}).first()).toBeVisible();

  const replaceable=await firstReplaceableStation(page);
  expect(replaceable,'CON-03 L2 CIRCUIT requires a replaceable Station').toBeTruthy();
  await replaceable.select.selectOption(replaceable.target);

  const card=page.locator(`.conditioning-station-card[data-conditioning-station-card="${replaceable.stationKey}"]`);
  await expect(card.locator('.conditioning-station-head small')).toHaveText('手动选择');
  await expect(card.locator('.conditioning-station-select')).toHaveValue(replaceable.target);

  const resolved=await page.evaluate(()=>{
    const route=window.V14Router.parseHash(window.location.hash);
    const ctx=window.V14CoachModules.ConditioningSession.context(route);
    return {
      familyId:ctx.familyId,
      level:ctx.level,
      protocolId:ctx.protocolId,
      metrics:ctx.session.domainContext.metrics,
      conflictStatus:ctx.session.conflictContext.status,
      selected:Object.values(ctx.session.domainContext.stations).find(station=>station.source==='manual')?.actionId||'',
      prepNames:window.V14CoachModules.ConditioningPrep.items(ctx.prep).map(item=>item.name),
    };
  });
  expect(resolved.familyId).toBe('CON-03');
  expect(resolved.level).toBe('L2');
  expect(resolved.protocolId).toBe('CIRCUIT');
  expect(resolved.selected).toBe(replaceable.target);
  await expect(page.locator('.conflict-box')).toContainText(resolved.conflictStatus);
  await expect(page.locator('.conditioning-protocol-panel')).toContainText(String(resolved.metrics.targetRpe));
  await expect(page.locator('.conditioning-protocol-panel')).toContainText(String(resolved.metrics.estimatedMinutes));
  for(const name of resolved.prepNames)await expect(page.locator('.conditioning-prep-section')).toContainText(name);

  await page.evaluate(()=>{
    window.__conditioningCopied=[];
    window.V14SessionCopy.copyText=async text=>{window.__conditioningCopied.push(text);return true;};
  });
  await page.locator('[data-conditioning-copy="coach"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__conditioningCopied.length)).toBe(1);
  await page.locator('[data-conditioning-copy="member"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__conditioningCopied.length)).toBe(2);
  const [coachCopy,memberCopy]=await page.evaluate(()=>window.__conditioningCopied);
  expect(coachCopy).not.toBe(memberCopy);
  expect(coachCopy).toContain('混合体能');
  expect(coachCopy).toContain('Protocol：循环');
  expect(coachCopy).toContain('Conditioning Conflict');
  expect(coachCopy).toContain('NO POST CARDIO');
  expect(memberCopy).toContain('混合体能');
  expect(memberCopy).toContain('训练方式：循环');
  expect(memberCopy).toContain('不再额外安排课后有氧');
  for(const forbidden of [
    'CON-03','CIRCUIT','CYCLICAL','SLED','CARRY','LOCOMOTION','SIMPLE_STRENGTH',
    'CORE_INTEGRATION','COND_','resolverVersion','conditioning-v1','hardCount','warnCount','powerEligible'
  ])expect(memberCopy,`member copy leaked ${forbidden}`).not.toContain(forbidden);

  const state=await page.evaluate(({sessionKey,stationKey})=>window.V15State.getSelections('conditioning',sessionKey)[stationKey],replaceable);
  expect(state).toEqual({actionId:replaceable.target,source:'manual'});

  await page.reload();
  const reloaded=page.locator(`.conditioning-station-card[data-conditioning-station-card="${replaceable.stationKey}"]`);
  await expect(reloaded.locator('.conditioning-station-select')).toHaveValue(replaceable.target);
  await expect(reloaded.locator('.conditioning-station-head small')).toHaveText('手动选择');

  await page.locator('#reset-conditioning-session').click();
  await expect(page.locator(`.conditioning-station-card[data-conditioning-station-card="${replaceable.stationKey}"] .conditioning-station-head small`)).toHaveText('系统推荐');
  await expect(page.locator(`.conditioning-station-card[data-conditioning-station-card="${replaceable.stationKey}"] .conditioning-station-select`)).not.toHaveValue(replaceable.target);
  await expect390NoOverflow(page);
  expect(errors,`unexpected Conditioning workflow pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});

test('Conditioning composer canonicalizes defaults and supports explicit legal Protocol',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/coach/conditioning/compose');
  await expect(page).toHaveURL(/family=CON-01&level=L1&protocol=STEADY/);
  await expect(page.getByRole('heading',{name:'Conditioning 自由编课'})).toBeVisible();

  await page.goto('/#/coach/conditioning/compose?family=CON-03&level=L2&protocol=CIRCUIT');
  await expect(page.locator('[data-conditioning-compose-family]')).toHaveValue('CON-03');
  await expect(page.locator('[data-conditioning-compose-level]')).toHaveValue('L2');
  await expect(page.locator('[data-conditioning-compose-protocol]')).toHaveValue('CIRCUIT');
  await expect(page.locator('.conditioning-station-card')).toHaveCount(3);
  await expect(page.getByText('NO POST CARDIO',{exact:false}).first()).toBeVisible();

  await page.locator('[data-conditioning-compose-protocol]').selectOption('DENSITY');
  await expect(page).toHaveURL(/protocol=DENSITY/);
  await expect(page.locator('[data-conditioning-compose-protocol]')).toHaveValue('DENSITY');
  await expect(page.locator('.conditioning-protocol-panel')).toContainText('密度');
  await expect390NoOverflow(page);
  expect(errors,`unexpected Conditioning Composer pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});
