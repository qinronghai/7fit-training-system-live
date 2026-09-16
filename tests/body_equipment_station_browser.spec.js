const { test, expect } = require('@playwright/test');

async function expectNoHorizontalOverflow(page){
  const dimensions=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
}

test('Body shows an actionable physical-station gate for manual swaps',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-01/l2');
  await expect(page.locator('.body-editor')).toBeVisible();

  const gate=page.locator('[data-body-station-gate]').filter({hasText:'坐姿腿弯举'}).first();
  await expect(page.locator('[data-body-station-gate]')).not.toHaveCount(0);
  await expect(gate.locator('summary')).toContainText('器械站点 Gate');
  await expect(gate).toContainText('同一台物理器械');
  await expect(gate).toContainText('腿屈伸一体机');
  await expect(gate).toContainText('坐姿腿弯举');
  await expect(gate).toContainText('默认不允许重复占用');
  await gate.locator('summary').click();
  await expect(gate.locator('[data-body-station-blocked]')).toBeVisible();
  await expectNoHorizontalOverflow(page);

  for(const width of [1080,1280,1440]){
    await page.setViewportSize({width,height:900});
    await page.goto('/#/coach/body/body-01/l2');
    await expect(page.locator('[data-body-station-gate]')).not.toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-03/l2');
  await expect(page.locator('.body-station-audit.unverified')).not.toHaveCount(0);
  await expect(page.locator('.body-station-audit.unverified').first()).toContainText('未核验');
  await expectNoHorizontalOverflow(page);
});
