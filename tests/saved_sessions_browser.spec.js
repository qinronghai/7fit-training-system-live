const { test, expect } = require('@playwright/test');

function capturePageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  return errors;
}

async function expect390NoOverflow(page){
  const width=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(width.clientWidth).toBe(390);
  expect(width.scrollWidth).toBe(width.clientWidth);
}

async function pickAlternate(select){
  const current=await select.inputValue();
  const values=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));
  return values.find(value=>value!==current)||null;
}

async function firstReplaceable(page,selector){
  const selects=page.locator(selector);
  for(let i=0;i<await selects.count();i+=1){
    const select=selects.nth(i);
    const target=await pickAlternate(select);
    if(target)return {select,target,current:await select.inputValue()};
  }
  return null;
}

test('F111 saved session round-trip survives refresh, PREP, rename and delete at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/f111-01/l2');

  const formal=await firstReplaceable(page,'.session-swap');
  expect(formal,'F111 needs a replaceable formal slot').toBeTruthy();
  await formal.select.selectOption(formal.target);

  const prep=await firstReplaceable(page,'.prep-slot-select');
  expect(prep,'F111 needs a replaceable PREP slot').toBeTruthy();
  await prep.select.selectOption(prep.target);

  await page.locator('[data-save-session-name]').fill('F111 周六保存课');
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expect(page.locator('.saved-session-card h3')).toHaveText('F111 周六保存课');

  await page.reload();
  await expect(page.locator('.saved-session-card h3')).toHaveText('F111 周六保存课');

  await page.locator('#reset-session').click();
  await expect(formal.select).not.toHaveValue(formal.target);
  await page.locator('[data-saved-restore]').click();
  await expect(page.locator('.session-swap').filter({has:page.locator(`option[value="${formal.target}"]`)}).first()).toHaveValue(formal.target);
  await expect(page.locator('.prep-slot-select').filter({has:page.locator(`option[value="${prep.target}"]`)}).first()).toHaveValue(prep.target);
  await expect(page.locator('.saved-session-notice')).toContainText('已恢复保存课程');

  const rename=page.locator('[data-saved-rename-input]');
  await rename.fill('F111 已重命名');
  await page.locator('[data-saved-rename]').click();
  await expect(page.locator('.saved-session-card h3')).toHaveText('F111 已重命名');

  await page.locator('[data-saved-delete]').click();
  await expect(page.locator('.saved-session-card')).toHaveCount(0);
  await expect(page.locator('.saved-session-empty')).toBeVisible();
  await expect390NoOverflow(page);
  expect(errors,`unexpected F111 Save/Restore pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});

test('Body saved session restores current manual slot intent at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-02/l3');

  const formal=await firstReplaceable(page,'.body-slot-select');
  expect(formal,'Body needs a replaceable slot').toBeTruthy();
  await formal.select.selectOption(formal.target);
  const card=formal.select.locator('xpath=ancestor::article[contains(@class,"body-slot-card")]');
  await expect(card.locator('.body-slot-head small')).toHaveText('手动选择');

  await page.locator('[data-save-session-name]').fill('Body 保存课');
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('.saved-session-card h3')).toHaveText('Body 保存课');

  await page.locator('#reset-body-session').click();
  await expect(page.locator('.body-slot-select').filter({has:page.locator(`option[value="${formal.target}"]`)}).first()).not.toHaveValue(formal.target);

  await page.locator('[data-saved-restore]').click();
  const restored=page.locator('.body-slot-select').filter({has:page.locator(`option[value="${formal.target}"]`)}).first();
  await expect(restored).toHaveValue(formal.target);
  await expect(restored.locator('xpath=ancestor::article[contains(@class,"body-slot-card")]').locator('.body-slot-head small')).toHaveText('手动选择');
  await expect(page.locator('.saved-session-notice')).toBeVisible();
  await expect390NoOverflow(page);
  expect(errors,`unexpected Body Save/Restore pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});

test('Conditioning saved session restores Protocol route and Station intent at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/compose?family=CON-03&level=L2&protocol=CIRCUIT');

  const station=await firstReplaceable(page,'.conditioning-station-select');
  expect(station,'Conditioning needs a replaceable Station').toBeTruthy();
  await station.select.selectOption(station.target);

  await page.locator('[data-save-session-name]').fill('Conditioning Circuit 保存课');
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('.saved-session-card h3')).toHaveText('Conditioning Circuit 保存课');

  await page.locator('[data-conditioning-compose-protocol]').selectOption('DENSITY');
  await expect(page).toHaveURL(/protocol=DENSITY/);
  await expect(page.locator('[data-conditioning-compose-protocol]')).toHaveValue('DENSITY');

  await page.locator('[data-saved-restore]').click();
  await expect(page).toHaveURL(/family=CON-03&level=L2&protocol=CIRCUIT/);
  await expect(page.locator('[data-conditioning-compose-protocol]')).toHaveValue('CIRCUIT');
  const restored=page.locator('.conditioning-station-select').filter({has:page.locator(`option[value="${station.target}"]`)}).first();
  await expect(restored).toHaveValue(station.target);
  await expect(restored.locator('xpath=ancestor::article[contains(@class,"conditioning-station-card")]').locator('.conditioning-station-head small')).toHaveText('手动选择');
  await expect(page.locator('.saved-session-notice')).toBeVisible();
  await expect(page.getByText('NO POST CARDIO',{exact:false}).first()).toBeVisible();
  await expect390NoOverflow(page);
  expect(errors,`unexpected Conditioning Save/Restore pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});
