const { test, expect } = require('@playwright/test');

async function expectNoHorizontalOverflow(page,width){
  const result=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(result.clientWidth).toBe(width);
  expect(result.scrollWidth).toBe(result.clientWidth);
}

test('Conditioning blueprint timeline stays usable at desktop widths',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  for(const width of [1080,1280,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('/#/coach/conditioning/con-03/l3');
    await expect(page.locator('.conditioning-block-timeline')).toBeVisible();
    await expect(page.locator('.conditioning-block-card')).toHaveCount(3);
    await expect(page.locator('.conditioning-block-guidance')).toHaveCount(3);
    const primerEmpty=page.locator('[data-conditioning-prep-empty="PRIMER"]');
    await expect(primerEmpty).toBeVisible();
    const primerBox=await primerEmpty.boundingBox();
    expect(primerBox?.width||0).toBeGreaterThan(150);
    await expectNoHorizontalOverflow(page,width);
  }
  expect(errors,errors.join(' | ')).toEqual([]);
});

test('Conditioning blueprint variant and cross-block swap preserve the resolved contract',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/compose?family=CON-03&level=L3&variant=A');
  await expect(page.locator('[data-conditioning-compose-variant]')).toHaveValue('A');
  const before=await page.evaluate(()=>{
    const route=window.V14Router.parseHash(window.location.hash);
    const ctx=window.V14CoachModules.ConditioningSession.context(route);
    return {
      variantId:ctx.variantId,
      blueprintId:ctx.session.sessionBlueprintId,
      blockKeys:ctx.session.blocks.map(block=>block.key),
      sessionKey:ctx.sessionKey,
      mainAction:ctx.session.resolvedSelections.find(item=>item.key==='BLOCK-B/STATION-1')?.actionId||'',
    };
  });
  expect(before.variantId).toBe('A');
  expect(before.blueprintId).toBe('CON-03-L3-A');
  expect(before.blockKeys).toEqual(['BLOCK-A','BLOCK-B','BLOCK-C']);
  expect(before.sessionKey).toBe('CON-03-L3-BLUEPRINT-A');

  const select=page.locator('[data-conditioning-station="BLOCK-B/STATION-1"]');
  const current=await select.inputValue();
  const target=(await select.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean))).find(value=>value!==current);
  expect(target).toBeTruthy();
  await select.selectOption(target);
    await expect(select).toHaveValue(target);
    const swappedCard=select.locator('xpath=ancestor::article[contains(@class,"conditioning-station-card")]');
    await expect(swappedCard.locator('h3')).toHaveText('雪橇后退拖行');
    await expect(swappedCard.locator('.conditioning-station-head > small')).toHaveText('手动选择');
    await expect(swappedCard).toContainText('原系统推荐');

  const after=await page.evaluate(()=>{
    const ctx=window.V14CoachModules.ConditioningSession.context(window.V14Router.parseHash(window.location.hash));
    return {
      selected:ctx.session.resolvedSelections.find(item=>item.key==='BLOCK-B/STATION-1')?.actionId||'',
      anatomy:ctx.session.anatomyContext,
      conflict:ctx.session.conflictContext.status,
    };
  });
  expect(after.selected).toBe(target);
  expect(['PASS','WARN']).toContain(after.conflict);

  await page.locator('[data-conditioning-compose-variant]').selectOption('C');
  await expect(page).toHaveURL(/variant=C/);
  await expect(page.locator('.conditioning-block-card')).toHaveCount(3);
  await expectNoHorizontalOverflow(page,390);
  expect(errors,errors.join(' | ')).toEqual([]);
});

test('Conditioning session rotates A to B to C and rejects an unknown variant',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/con-03/l3');
  await expect(page.locator('[data-conditioning-next-variant]')).toContainText('B');
  await page.locator('[data-conditioning-next-variant]').click();
  await expect(page).toHaveURL(/#\/coach\/conditioning\/con-03\/l3\?variant=B/);
  await expect(page.locator('.conditioning-block-card')).toHaveCount(3);
  await page.locator('[data-conditioning-next-variant]').click();
  await expect(page).toHaveURL(/#\/coach\/conditioning\/con-03\/l3\?variant=C/);
  await page.locator('[data-conditioning-next-variant]').click();
  await expect(page).toHaveURL(/#\/coach\/conditioning\/con-03\/l3\?variant=A/);

  await page.goto('/#/coach/conditioning/con-03/l3?variant=UNKNOWN');
  await expect(page).toHaveURL(/#\/coach\/conditioning\/con-03\/l3\?variant=A/);
  await expect(page.locator('[data-conditioning-next-variant]')).toContainText('B');
  expect(errors,errors.join(' | ')).toEqual([]);
});

test('Conditioning preserves an explicit legacy Protocol deep link',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/compose?family=CON-03&level=L2&protocol=CIRCUIT');
  await expect(page).toHaveURL(/protocol=CIRCUIT/);
  await expect(page.locator('.conditioning-legacy-editor')).toBeVisible();
  await expect(page.locator('.conditioning-legacy-editor')).toContainText('旧 Protocol 兼容入口');
  await expect(page.locator('.conditioning-legacy-editor')).toContainText('不会静默改成 A / B / C 蓝图');
  await expect(page.locator('.conditioning-block-card')).toHaveCount(0);
  await expect(page.locator('.conditioning-legacy-editor a[href*="variant=A"]')).toBeVisible();
  expect(errors,errors.join(' | ')).toEqual([]);
});

test('Conditioning save surface contains XSS text and rejects 3000-character names',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/compose?family=CON-03&level=L3&variant=A');

  const xss='<img src=x onerror="window.__conditioningXss=1">';
  await page.locator('[data-save-session-name]').fill(xss);
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('.saved-session-card h3')).toHaveText(xss);
  await expect(page.locator('img[onerror]')).toHaveCount(0);
  expect(await page.evaluate(()=>window.__conditioningXss===undefined)).toBe(true);

  await page.locator('[data-save-session-name]').fill('x'.repeat(3000));
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('[data-saved-session-status]')).toContainText('120');
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expectNoHorizontalOverflow(page,390);
  expect(errors,errors.join(' | ')).toEqual([]);
});

test('Conditioning legacy save upgrades explicitly and abnormal routes fail closed',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach');
  await page.evaluate(()=>{
    const snapshot=window.V15State.snapshot();
    snapshot.savedSessions['legacy-conditioning-ui']={
      savedId:'legacy-conditioning-ui',schemaVersion:1,resolverVersion:'conditioning-v1',templateId:'conditioning',
      familyId:'CON-03',level:'L3',input:{familyId:'CON-03',level:'L3',protocolId:'CIRCUIT',surface:'session'},
      selections:{'STATION-1':{actionId:'huachuanji_jiange',source:'manual'}},prepSelections:{},
      createdAt:'2026-09-14T01:00:00.000Z',updatedAt:'2026-09-14T01:00:00.000Z',name:'旧版单块体能课',
    };
    sessionStorage.setItem('7fit-v15-state',JSON.stringify(snapshot));
  });
  await page.reload();
  await expect(page.locator('[data-saved-migrate="legacy-conditioning-ui"]')).toHaveText('升级为多区块版本');
  await expect(page.locator('[data-saved-restore="legacy-conditioning-ui"]')).toHaveCount(0);
  await page.locator('[data-saved-migrate="legacy-conditioning-ui"]').click();
  await expect(page).toHaveURL(/#\/coach\/conditioning\/con-03\/l3/);
  await expect(page.locator('.saved-session-notice')).toContainText('已明确升级为多区块版本');
  await expect(page.locator('[data-saved-session-id="legacy-conditioning-ui"] [data-saved-migrate]')).toBeVisible();
  await expect(page.locator('.saved-session-card')).toHaveCount(2);

  await page.goto('/#/coach/conditioning/compose?family=CON-03&level=%E0%A4%A&variant=UNKNOWN');
  await expect(page).toHaveURL(/#\/coach\/conditioning\/compose\?family=CON-03&level=L1&variant=A/);
  await expect(page.locator('.conditioning-block-card')).toHaveCount(2);
  await page.goto('/#/coach/conditioning/con-03/l9');
  await expect(page.locator('#page-title')).toHaveText('页面不存在');
  await page.goto(`/#/library?focus=${'x'.repeat(3000)}`);
  await expect(page.locator('#page-title')).toHaveText('搜索');
  await expectNoHorizontalOverflow(page,390);
  expect(errors,errors.join(' | ')).toEqual([]);
});
