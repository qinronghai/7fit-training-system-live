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
    await expect(index).toContainText('12｜下肢辅助与容量动作');
    await expect(index).toContainText('21 个唯一动作');
    await expect(index).toContainText('固定器械 7 · 绳索 / 龙门架辅助 10 · 自由重量 3 · 自重 1');
    await expect(index).toContainText('23 个唯一动作');
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
  await expect(module.locator('[data-aux-entry]')).toHaveCount(21);
  await expect(module).toContainText('同一动作只展示一次');
  const facePull=module.locator('[data-aux-entry="mianla"]');
  await expect(facePull.locator('[data-aux-pool="horizontal_pull"]')).toBeVisible();
  await expect(facePull.locator('[data-aux-pool="vertical_pull"]')).toBeVisible();
  await expect(facePull.locator('[data-aux-pool="vertical_push"]')).toBeVisible();
  await expect(module.locator('[data-aux-filter="pool"]')).toHaveValue('');
  await module.locator('[data-aux-pool-button="horizontal_pull"]').click();
  await expect(module.locator('[data-aux-filter="pool"]')).toHaveValue('horizontal_pull');
  await expect(module.locator('[data-aux-visible-count]')).toHaveText('10 个');
  await expect(module.locator('[data-aux-entry]:not([hidden])')).toHaveCount(10);
  // 俯身Y举 is bodyweight: its class must reach the filter instead of being dropped.
  await expect(module.locator('[data-aux-filter="equipmentClass"] option[value="bodyweight"]')).toHaveCount(1);
  await module.locator('[data-aux-filter="pool"]').selectOption('');
  await module.locator('[data-aux-filter="equipmentClass"]').selectOption('bodyweight');
  await expect(module.locator('[data-aux-visible-count]')).toHaveText('1 个');
  await expect(module.locator('[data-aux-entry]:not([hidden])')).toHaveCount(1);
  await expect(module.locator('[data-aux-entry="fushen_y_ju"]')).toBeVisible();
  await expectNoOverflow(page,390);
  await expectClean(diag);
});

test('Issues 79/122: lower module is organized by functional family and equipment is a filter',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:1080,height:844});
  await page.goto('/#/system/patterns?focus=aux-lower');
  const module=page.locator('[data-auxiliary-module="aux-lower"]');
  await expect(module).toBeVisible();
  await expect(module.locator('[data-aux-entry]')).toHaveCount(23);
  await expect(module).toContainText('固定器械只是器械筛选');
  await expect(module.locator('[data-auxiliary-subgroup="KNEE_FLEXION"]')).toContainText('膝屈');
  await expect(module.locator('[data-aux-entry="tui_wanju"]')).toBeVisible();
  await expect(module.locator('[data-aux-filter="family"]')).toHaveValue('');
  await module.locator('[data-aux-filter="family"]').selectOption('KNEE_FLEXION');
  await expect(module.locator('[data-aux-visible-count]')).toHaveText('1 个');
  await expect(module.locator('[data-aux-entry="tui_wanju"]')).toBeVisible();
  await expect(module.locator('[data-aux-entry="tui_qushen"]')).toBeHidden();
  await module.locator('[data-aux-filter="family"]').selectOption('');
  await module.locator('[data-aux-filter="equipmentClass"]').selectOption('cable_station');
  const visibleCable=module.locator('[data-aux-entry]:not([hidden])');
  expect(await visibleCable.count()).toBeGreaterThanOrEqual(2);
  await expect(module.locator('[data-aux-entry="xiao_longmen_wai_zhan"]')).toBeVisible();
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
  await expect(module.locator('.auxiliary-mode-meta')).toHaveCount(21);
  await expect(module.locator('.auxiliary-mode-meta').first()).toContainText('equipmentClass');
  const detailLink=module.locator('[data-aux-entry="houzu_sanji"] .auxiliary-detail-link');
  await expect(detailLink).toHaveAttribute('href','#/library?focus=houzu_sanji');
  await detailLink.click();
  await expect(page).toHaveURL(/#\/library\?focus=houzu_sanji$/);
  await expect(page.locator('#global-drawer')).toContainText('哑铃俯身反向飞鸟');
  await expectNoOverflow(page,1080);
  await expectClean(diag);
});

test('Issues 79/122: F111 D1 consumes shared lower candidates while D2 keeps its upper pool',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:1080,height:844});
  await page.goto('/#/coach/f111/f111-01/l3');

  const d2=page.locator('.session-slot[data-slot="F111-01-L3__3"]');
  await expect(d2.locator('.slot-kicker')).toHaveText('D2｜上肢辅助');
  const d2Options=await d2.locator('select option').evaluateAll(nodes=>nodes.map(node=>node.value));
  expect(d2Options[0]).toBe('houzu_sanji');
  expect(d2Options).toContain('fushen_y_ju');
  expect(d2Options).toContain('V13_HR_SCAP_ROW');
  expect(d2Options).toContain('dixie_mianla_shangju');
  // 飞机拉背 / 俯卧撑 are tiered main lifts: the legacy V10 list offered them as D2 swaps.
  expect(d2Options).not.toContain('feiji_labei');
  expect(d2Options).not.toContain('fuwoceng');

  const d1=page.locator('.session-slot[data-slot="F111-01-L3__2"]');
  await expect(d1.locator('.slot-kicker')).toHaveText('D1｜下肢辅助');
  const d1Options=await d1.locator('select option').evaluateAll(nodes=>nodes.map(node=>node.value));
  expect(d1Options[0]).toBe('tui_qushen');
  expect(d1Options).toContain('tunbu_houti');
  expect(d1Options).toContain('shengsuo_kuan_neishou');
  expect(d1Options).toContain('tui_wanju');
  // Main-only / high-fatigue lower lifts must not leak into D1.
  expect(d1Options).not.toContain('hake_shendun');
  expect(d1Options).not.toContain('gangling_yingla');
  await expect(d1.locator('.lower-assistance-browse')).toBeVisible();

  await expectNoOverflow(page,1080);
  await expectClean(diag,'F111 preset D slots');
});


test('Issues 79/122: F111 D1 can enter module 12, choose a legal action, and return',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:1080,height:844});
  await page.goto('/#/coach/f111/f111-01/l3');
  const d1=page.locator('.session-slot[data-slot="F111-01-L3__2"]');
  await d1.locator('.lower-assistance-browse').click();

  const module=page.locator('[data-auxiliary-module="aux-lower"]');
  await expect(module).toBeVisible();
  await expect(module.locator('.auxiliary-replacement-context')).toContainText('F111 D1｜替换模式');
  await expect(module).toHaveAttribute('data-replacement-session','F111-01-L3');

  const candidate=module.locator('[data-aux-entry="shengsuo_kuan_neishou"]');
  await expect(candidate).toBeVisible();
  await expect(candidate.locator('[data-aux-select-action="shengsuo_kuan_neishou"]')).toBeVisible();
  await candidate.locator('[data-aux-select-action="shengsuo_kuan_neishou"]').click();

  await expect(page).toHaveURL(/#\/coach\/f111\/f111-01\/l3$/);
  await expect(page.locator('.session-swap[data-slot-key="F111-01-L3__2"]')).toHaveValue('shengsuo_kuan_neishou');
  await expectNoOverflow(page,1080);
  await expectClean(diag);
});
