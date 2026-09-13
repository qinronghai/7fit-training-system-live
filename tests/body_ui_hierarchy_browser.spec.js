const {test,expect}=require('@playwright/test');

test('Body session shows clear training hierarchy and no back-extension family stacking at 390px',async({page})=>{
  const errors=[]; page.on('pageerror',e=>errors.push(e.message||String(e)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-02/l3');

  await expect(page.locator('[data-body-group="main"]')).toBeVisible();
  await expect(page.locator('[data-body-group="accessory"]')).toBeVisible();
  await expect(page.locator('[data-body-group="isolation"]')).toBeVisible();
  await expect(page.getByRole('heading',{name:'主训练｜主项 + 次主项'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'辅助训练'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'孤立 / 补充'})).toBeVisible();

  const visibleNames=await page.locator('.body-slot-action b').allTextContents();
  expect(!(visibleNames.includes('山羊挺身负重主项')&&visibleNames.includes('山羊挺身'))).toBeTruthy();

  const width=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(width.clientWidth).toBe(390);
  expect(width.scrollWidth).toBe(width.clientWidth);
  expect(errors).toEqual([]);
});
