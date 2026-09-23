const { test, expect } = require('@playwright/test');

async function expectNoOverflow(page,width){
  const measured=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(measured.clientWidth).toBe(width);
  expect(measured.scrollWidth).toBe(measured.clientWidth);
}

function pageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  return errors;
}

test('F111 home opens the free-composition page without the preset browser',async({page})=>{
  const errors=pageErrors(page);
  for(const width of [360,390,430,1080]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/coach/f111');
    await expect(page.locator('.f111-compose-hero h1')).toHaveText('F111｜女性综合训练');
    await expect(page.locator('.composer-slot-card')).toHaveCount(6);
    await expect(page.locator('[data-f111-preset-browser],.coach-mode-switch')).toHaveCount(0);
    await expect(page.getByText('7Fit 推荐预设',{exact:true})).toHaveCount(0);
    await expect(page.locator('#page-subtitle')).toHaveText('女性综合 1+1+1');
    await expectNoOverflow(page,width);
  }
  expect(errors).toEqual([]);
});

test('legacy composer URLs remain valid aliases',async({page})=>{
  const errors=pageErrors(page);
  const urls=[
    '/#/coach/f111/compose?level=L3&lower=single_leg_hinge&upper=horizontal_push',
    '/#/coach/compose?level=L3&lower=single_leg_hinge&upper=horizontal_push',
  ];
  for(const url of urls){
    await page.goto(url);
    await expect(page.locator('.composer-slot-card')).toHaveCount(6);
    await expect(page.getByText('L3｜单腿拉 + 水平推',{exact:false})).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('legacy individual preset detail routes remain available',async({page})=>{
  const errors=pageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/f111-07/l3');
  await expect(page.locator('h1')).toContainText('F111-07');
  await expect(page.locator('.session-slot')).toHaveCount(6);
  await expect(page.locator('.back-link')).toHaveAttribute('href','#/coach/f111');
  await expect(page.locator('.back-link')).toContainText('返回 F111 编课');
  await page.locator('.back-link').click();
  await expect(page.locator('.f111-compose-hero')).toBeVisible();
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);
  expect(errors).toEqual([]);
});
