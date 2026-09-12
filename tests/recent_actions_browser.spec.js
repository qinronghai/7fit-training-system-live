const { test, expect } = require('@playwright/test');

function errors(page){const list=[];page.on('pageerror',e=>list.push(e.message||String(e)));return list;}
async function width390(page){
  const w=await page.evaluate(()=>({s:document.documentElement.scrollWidth,c:document.documentElement.clientWidth}));
  expect(w.c).toBe(390);expect(w.s).toBe(w.c);
}
async function seedAndQuickSwap(page,selectSelector,quickScope,resetSelector){
  const select=page.locator(selectSelector).first();
  const current=await select.inputValue();
  const values=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
  const target=values.find(v=>v!==current);
  expect(target,'requires replaceable candidate').toBeTruthy();
  await select.selectOption(target);
  await page.locator(resetSelector).click();
  const quick=page.locator(quickScope).getByRole('button',{name:/最近：/}).filter({hasText:''}).first();
  await expect(quick).toBeVisible();
  expect(await quick.getAttribute('data-recent-action')).toBe(target);
  await quick.click();
  return target;
}

test('F111 Body Conditioning expose legal one-tap recent quick swap at 390px',async({page})=>{
  const pageErrors=errors(page);
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/coach/f111/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  const f111Target=await seedAndQuickSwap(page,'.composer-slot-select','.composer-slot-card','#reset-composer');
  await expect(page.locator('.composer-slot-select').filter({has:page.locator(`option[value="${f111Target}"]`)}).first()).toHaveValue(f111Target);
  await width390(page);

  await page.goto('/#/coach/body/body-02/l3');
  const bodyTarget=await seedAndQuickSwap(page,'.body-slot-select','.body-slot-card','#reset-body-session');
  await expect(page.locator('.body-slot-select').filter({has:page.locator(`option[value="${bodyTarget}"]`)}).first()).toHaveValue(bodyTarget);
  await width390(page);

  await page.goto('/#/coach/conditioning/con-03/l2');
  const conditioningTarget=await seedAndQuickSwap(page,'.conditioning-station-select','.conditioning-station-card','#reset-conditioning-session');
  await expect(page.locator('.conditioning-station-select').filter({has:page.locator(`option[value="${conditioningTarget}"]`)}).first()).toHaveValue(conditioningTarget);
  await width390(page);

  const snapshot=await page.evaluate(()=>window.V15State.snapshot().recentActions);
  expect(snapshot.some(x=>x.templateId==='f111')).toBeTruthy();
  expect(snapshot.some(x=>x.templateId==='body')).toBeTruthy();
  expect(snapshot.some(x=>x.templateId==='conditioning')).toBeTruthy();
  expect(pageErrors,pageErrors.join(' | ')).toEqual([]);
});
