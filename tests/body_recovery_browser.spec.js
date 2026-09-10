const { test, expect } = require('@playwright/test');

async function expectRecovery(page){
  const recovery=page.locator('.body-recovery-section');
  await expect(recovery).toHaveCount(1);
  await expect(recovery).toContainText('训练后恢复｜约 5–8 分钟');
  await expect(recovery).toContainText('力量训练结束后进行低强度恢复与呼吸整理；如需拉伸，按当日训练肌群由教练人工选择。');
  await expect(recovery).toContainText('恢复内容不计入 Direct Work Sets。');
  const width=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
  expect(width.clientWidth).toBe(390);
  expect(width.scrollWidth).toBe(width.clientWidth);
}

test('Body Session and Composer show the same fixed Recovery presentation at 390px',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/coach/body/body-02/l3');
  await expectRecovery(page);

  await page.goto('/#/coach/body/compose?family=BODY-02&level=L3');
  await expect(page.getByRole('heading',{name:'Body 自由编课'})).toBeVisible();
  await expectRecovery(page);

  expect(errors,`unexpected Body Recovery pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});
