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
async function firstReplaceable(page,selector,slotAttr){
  const selects=page.locator(selector);
  for(let i=0;i<await selects.count();i+=1){
    const select=selects.nth(i);
    const current=await select.inputValue();
    const values=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));
    const target=values.find(value=>value!==current);
    if(target)return {select,current,target,key:await select.getAttribute(slotAttr)};
  }
  return null;
}

test('F111 recent quick swap survives reset and refresh at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/f111-06/l3');

  const hit=await firstReplaceable(page,'.session-swap','data-slot-key');
  expect(hit,'F111 needs a replaceable slot').toBeTruthy();
  await hit.select.selectOption(hit.target);
  await expect(page.locator(`.session-swap[data-slot-key="${hit.key}"]`)).toHaveValue(hit.target);

  await page.locator('#reset-session').click();
  await expect(page.locator(`.session-swap[data-slot-key="${hit.key}"]`)).not.toHaveValue(hit.target);
  const quick=page.locator(`[data-recent-f111-preset][data-slot-key="${hit.key}"][data-recent-action="${hit.target}"]`);
  await expect(quick).toBeVisible();

  await page.reload();
  await expect(page.locator(`[data-recent-f111-preset][data-slot-key="${hit.key}"][data-recent-action="${hit.target}"]`)).toBeVisible();
  await page.locator(`[data-recent-f111-preset][data-slot-key="${hit.key}"][data-recent-action="${hit.target}"]`).click();
  await expect(page.locator(`.session-swap[data-slot-key="${hit.key}"]`)).toHaveValue(hit.target);
  await expect(page.locator('.conflict-box')).toBeVisible();

  const recent=await page.evaluate(()=>window.V15State.listRecentActions({templateId:'f111'}));
  expect(recent.some(item=>item.actionId===hit.target)).toBeTruthy();
  await expect390(page);
  expect(errors,errors.join(' | ')).toEqual([]);
});

test('Body recent quick swap stays inside current legal slot context',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-02/l3');

  const hit=await firstReplaceable(page,'.body-slot-select','data-body-slot');
  expect(hit,'Body needs a replaceable slot').toBeTruthy();
  await hit.select.selectOption(hit.target);
  await expect(page.locator(`.body-slot-select[data-body-slot="${hit.key}"]`)).toHaveValue(hit.target);

  await page.locator('#reset-body-session').click();
  await expect(page.locator(`.body-slot-select[data-body-slot="${hit.key}"]`)).not.toHaveValue(hit.target);
  const quick=page.locator(`[data-recent-body][data-body-slot="${hit.key}"][data-recent-action="${hit.target}"]`);
  await expect(quick).toBeVisible();
  await quick.click();

  await expect(page.locator(`.body-slot-select[data-body-slot="${hit.key}"]`)).toHaveValue(hit.target);
  await expect(page.locator('.session-volume-summary')).toBeVisible();
  await expect(page.locator('.body-anatomy-summary')).toBeVisible();
  await expect(page.locator('.conflict-box')).toBeVisible();

  const contexts=await page.evaluate(()=>window.V15State.listRecentActions({templateId:'body'}).map(x=>x.contextKey));
  expect(contexts.some(key=>key.includes(`BODY-02:L3:${hit.key}`))).toBeTruthy();
  await expect390(page);
  expect(errors,errors.join(' | ')).toEqual([]);
});

test('Conditioning recent quick swap is Protocol and Station scoped',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/compose?family=CON-03&level=L2&protocol=CIRCUIT');

  const hit=await firstReplaceable(page,'.conditioning-station-select','data-conditioning-station');
  expect(hit,'Conditioning needs a replaceable Station').toBeTruthy();
  await hit.select.selectOption(hit.target);
  await expect(page.locator(`.conditioning-station-select[data-conditioning-station="${hit.key}"]`)).toHaveValue(hit.target);

  await page.locator('#reset-conditioning-session').click();
  await expect(page.locator(`.conditioning-station-select[data-conditioning-station="${hit.key}"]`)).not.toHaveValue(hit.target);
  const quick=page.locator(`[data-recent-conditioning][data-conditioning-station="${hit.key}"][data-recent-action="${hit.target}"]`);
  await expect(quick).toBeVisible();
  await quick.click();

  await expect(page.locator(`.conditioning-station-select[data-conditioning-station="${hit.key}"]`)).toHaveValue(hit.target);
  await expect(page.locator('.conditioning-protocol-panel')).toContainText('循环');
  await expect(page.locator('.conflict-box')).toBeVisible();
  await expect(page.getByText('NO POST CARDIO',{exact:false}).first()).toBeVisible();

  const contexts=await page.evaluate(()=>window.V15State.listRecentActions({templateId:'conditioning'}).map(x=>x.contextKey));
  expect(contexts.some(key=>key.includes(`CON-03:L2:CIRCUIT:${hit.key}`))).toBeTruthy();

  await page.locator('[data-conditioning-compose-protocol]').selectOption('DENSITY');
  await expect(page).toHaveURL(/protocol=DENSITY/);
  await expect(page.locator(`[data-recent-conditioning][data-conditioning-station="${hit.key}"][data-recent-action="${hit.target}"]`)).toHaveCount(0);

  await expect390(page);
  expect(errors,errors.join(' | ')).toEqual([]);
});
