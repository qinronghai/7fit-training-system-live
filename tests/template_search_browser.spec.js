const { test, expect } = require('@playwright/test');

function capturePageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  return errors;
}
async function expect390(page){
  const width=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(width.clientWidth).toBe(390);
  expect(width.scrollWidth).toBe(width.clientWidth);
}

test('template-aware search finds actions and legal multi-template coach entries at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/library');

  await expect(page.getByRole('heading',{name:'动作与编课搜索'})).toBeVisible();
  await expect(page.locator('[data-filter="templateId"]')).toBeVisible();
  await expect(page.locator('[data-filter="kind"]')).toBeVisible();

  await page.locator('#action-search').fill('滑雪机');
  await page.locator('[data-filter="templateId"]').selectOption('conditioning');
  await expect(page.locator('[data-search-result-id="huaxueji_jiange"]')).toBeVisible();
  await page.locator('[data-search-result-id="huaxueji_jiange"]').click();
  await expect(page.locator('#global-drawer')).toContainText('滑雪机间歇');
  await page.locator('#global-drawer [data-close-drawer]').click();

  await page.locator('#action-search').fill('BODY-02');
  await page.locator('[data-filter="templateId"]').selectOption('body');
  await page.locator('[data-filter="kind"]').selectOption('session');
  const bodyLink=page.locator('[data-search-result-kind="body-family"]').first();
  await expect(bodyLink).toBeVisible();
  await bodyLink.click();
  await expect(page).toHaveURL(/#\/coach\/body\/compose\?family=BODY-02&level=L1/);
  await expect(page.getByRole('heading',{name:'Body 自由编课'})).toBeVisible();

  await page.goto('/#/library');
  await page.locator('#action-search').fill('CON-03');
  await page.locator('[data-filter="templateId"]').selectOption('conditioning');
  await page.locator('[data-filter="kind"]').selectOption('session');
  const conditioningLink=page.locator('[data-search-result-kind="conditioning-protocol"]').first();
  await expect(conditioningLink).toBeVisible();
  await conditioningLink.click();
  await expect(page).toHaveURL(/#\/coach\/conditioning\/compose\?family=CON-03&level=L1&protocol=/);
  await expect(page.getByRole('heading',{name:'Conditioning 自由编课'})).toBeVisible();

  await page.goto('/#/library');
  await page.locator('#action-search').fill('单腿拉');
  await page.locator('[data-filter="templateId"]').selectOption('f111');
  await page.locator('[data-filter="kind"]').selectOption('session');
  const f111Link=page.locator('[data-search-result-kind="f111-combination"]').first();
  await expect(f111Link).toBeVisible();
  await f111Link.click();
  await expect(page).toHaveURL(/#\/coach\/f111\/compose\?/);
  await expect(page.getByRole('heading',{name:'自由组合编课'})).toBeVisible();

  await expect390(page);
  expect(errors,errors.join(' | ')).toEqual([]);
});
