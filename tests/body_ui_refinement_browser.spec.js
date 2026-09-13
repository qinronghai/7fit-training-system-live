const {test,expect}=require('@playwright/test');

test('Body training UI prioritizes grouped plan before analysis at 390px',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message||String(e)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-02/l3');

  const plan=page.locator('.body-training-plan');
  const analysis=page.locator('.body-analysis-stack');
  await expect(plan).toBeVisible();
  await expect(analysis).toBeVisible();
  await expect(plan.locator('.body-slot-group')).toHaveCount(4);
  await expect(plan.getByRole('heading',{name:'主训练'})).toBeVisible();
  await expect(plan.getByRole('heading',{name:'辅助训练'})).toBeVisible();
  await expect(plan.getByRole('heading',{name:'孤立补充'})).toBeVisible();
  await expect(plan.getByRole('heading',{name:'可选加练'})).toBeVisible();

  const order=await page.evaluate(()=> {
    const p=document.querySelector('.body-training-plan');
    const a=document.querySelector('.body-analysis-stack');
    return p.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(order).toBeTruthy();

  const visibleText=await plan.innerText();
  for(const internal of ['PRIMARY','SECONDARY','ACCESSORY','ISOLATION-1','ISOLATION-2','OPTIONAL']){
    expect(visibleText).not.toContain(internal);
  }
  const width=await page.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
  expect(width.sw).toBe(width.cw);
  expect(errors).toEqual([]);
});
