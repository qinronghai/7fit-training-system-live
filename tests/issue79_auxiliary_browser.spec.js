const { test, expect } = require('@playwright/test');

function diagnostics(page){
  const pageErrors=[],consoleProblems=[];
  page.on('pageerror',error=>pageErrors.push(error.message||String(error)));
  page.on('console',msg=>{if(['error','warning'].includes(msg.type()))consoleProblems.push(msg.type()+': '+msg.text());});
  return {pageErrors,consoleProblems};
}

async function expectNoOverflow(page,width){
  const sizes=await page.evaluate(()=>({
    htmlScroll:document.documentElement.scrollWidth,
    htmlClient:document.documentElement.clientWidth,
    bodyScroll:document.body.scrollWidth,
  }));
  expect(sizes.htmlClient).toBe(width);
  expect(sizes.htmlScroll).toBe(sizes.htmlClient);
  expect(sizes.bodyScroll).toBeLessThanOrEqual(sizes.htmlClient);
}

async function expectClean(diag){
  expect(diag.pageErrors,'pageerror must stay empty').toEqual([]);
  expect(diag.consoleProblems,'console error/warning must stay empty').toEqual([]);
}

test('Issue 79: system index exposes two data-derived auxiliary modules without overflow',async({page})=>{
  const diag=diagnostics(page);
  for(const width of [390,1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/system/patterns');
    const index=page.locator('.auxiliary-index');
    await expect(index).toBeVisible();
    await expect(index.locator('.auxiliary-module-card')).toHaveCount(2);
    await expect(index).toContainText('11｜上肢辅助动作');
    await expect(index).toContainText('12｜下肢固定器械动作');
    await expect(index).toContainText('9 个唯一动作');
    await expect(index).toContainText('6 个唯一动作');
    await expectNoOverflow(page,width);
  }
  await expectClean(diag);
});

test('Issue 79: upper auxiliary module deduplicates source pools and supports filters',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/system/patterns?focus=aux-upper');
  const module=page.locator('[data-auxiliary-module="aux-upper"]');
  await expect(module).toBeVisible();
  await expect(module.locator('[data-aux-entry]')).toHaveCount(9);
  await expect(module).toContainText('同一动作只展示一次');
  const facePull=module.locator('[data-aux-entry="mianla"]');
  await expect(facePull.locator('[data-aux-pool="horizontal_pull"]')).toBeVisible();
  await expect(facePull.locator('[data-aux-pool="vertical_pull"]')).toBeVisible();
  await expect(facePull.locator('[data-aux-pool="vertical_push"]')).toBeVisible();
  await expect(module.locator('[data-aux-filter="pool"]')).toHaveValue('');
  await module.locator('[data-aux-pool-button="horizontal_pull"]').click();
  await expect(module.locator('[data-aux-filter="pool"]')).toHaveValue('horizontal_pull');
  await expect(module.locator('[data-aux-visible-count]')).toHaveText('4 个');
  await expect(module.locator('[data-aux-entry]:not([hidden])')).toHaveCount(4);
  await expectNoOverflow(page,390);
  await expectClean(diag);
});

test('Issue 79: lower auxiliary module separates fixed machines from cable assistance',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:1080,height:844});
  await page.goto('/#/system/patterns?focus=aux-lower');
  const module=page.locator('[data-auxiliary-module="aux-lower"]');
  await expect(module).toBeVisible();
  await expect(module.locator('[data-auxiliary-subgroup="fixed_machine"]')).toContainText('4 个');
  await expect(module.locator('[data-auxiliary-subgroup="cable_station"]')).toContainText('2 个');
  await expect(module.locator('[data-aux-filter="equipmentClass"]')).toHaveValue('');
  await module.locator('[data-aux-filter="equipmentClass"]').selectOption('cable_station');
  await expect(module.locator('[data-aux-visible-count]')).toHaveText('2 个');
  await expect(module.locator('[data-auxiliary-subgroup="fixed_machine"]')).toBeHidden();
  await expect(module.locator('[data-auxiliary-subgroup="cable_station"]')).toBeVisible();
  await expectNoOverflow(page,1080);
  await expectClean(diag);
});

test('Issue 79: coach/system mode and detail links preserve data provenance',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:1080,height:844});
  await page.goto('/#/system/patterns?focus=aux-upper');
  const module=page.locator('[data-auxiliary-module="aux-upper"]');
  await expect(module.locator('.auxiliary-source-note')).toHaveText('教练模式：隐藏标准 ID 与审计字段');
  await expect(module.locator('.auxiliary-mode-meta')).toHaveCount(0);
  await page.locator('#mode-toggle').click();
  await expect(module.locator('.auxiliary-source-note')).toHaveText('数据源：composer.auxiliaryRules.upper');
  await expect(module.locator('.auxiliary-mode-meta')).toHaveCount(9);
  await expect(module.locator('.auxiliary-mode-meta').first()).toContainText('equipmentClass');
  const detailLink=module.locator('[data-aux-entry="houzu_sanji"] .auxiliary-detail-link');
  await expect(detailLink).toHaveAttribute('href','#/library?focus=houzu_sanji');
  await detailLink.click();
  await expect(page).toHaveURL(/#\/library\?focus=houzu_sanji$/);
  await expect(page.locator('#global-drawer')).toContainText('哑铃俯身反向飞鸟');
  await expectNoOverflow(page,1080);
  await expectClean(diag);
});
