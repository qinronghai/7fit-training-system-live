const {test,expect}=require('@playwright/test');

test('L3 PREP replacements display the grades of the course-matched options at 390px',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message||String(e)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  await page.locator('.f111-prep-section summary').click();
  const select=page.locator('.prep-slot-select[data-prep-slot="CORE-ACT"]');
  await expect(select).toBeVisible();
  const labels=await select.locator('option').allTextContents();
  expect(labels.length).toBeGreaterThan(1);
  expect(labels.every(label=>/^P[123]｜/.test(label))).toBeTruthy();
  await page.locator('[data-prep-slot-card="CORE-ACT"] .prep-replace-trigger').click();
  const drawer=page.locator('#f111-action-drawer');
  await expect(drawer.locator('.f111-drawer-action')).toHaveCount(labels.length);
  await expect(drawer.locator('.f111-drawer-action-detail').nth(1)).toContainText(/主项|辅项/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
});
