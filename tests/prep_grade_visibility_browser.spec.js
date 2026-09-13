const {test,expect}=require('@playwright/test');

test('L3 PREP core selector visibly preserves P3 P2 P1 at 390px',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message||String(e)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  const select=page.locator('.prep-slot-select[data-prep-slot="CORE-ACT"]');
  await expect(select).toBeVisible();
  const labels=await select.locator('option').allTextContents();
  expect(labels.some(x=>x.startsWith('P3｜'))).toBeTruthy();
  expect(labels.some(x=>x.startsWith('P2｜'))).toBeTruthy();
  expect(labels.some(x=>x.startsWith('P1｜'))).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  expect(errors).toEqual([]);
});
