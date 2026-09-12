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
async function replaceSelect(select){
  const current=await select.inputValue();
  const values=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));
  const target=values.find(value=>value!==current);
  if(!target)return null;
  await select.selectOption(target);
  return {current,target};
}
async function firstReplaceable(page,selector){
  const selects=page.locator(selector);
  for(let i=0;i<await selects.count();i+=1){
    const select=selects.nth(i),changed=await replaceSelect(select);
    if(changed)return {select,...changed};
  }
  return null;
}
async function saveNamed(page,name){
  const panel=page.locator('.saved-sessions-section');
  await expect(panel).toBeVisible();
  await panel.locator('[data-saved-name]').fill(name);
  await panel.locator('[data-save-current-session]').click();
  const card=panel.locator('.saved-session-card').filter({has:page.locator(`input[value="${name}"]`)});
  await expect(panel.locator('.saved-session-card')).toContainText(name);
  return card;
}

test('F111 preset SavedSession restores formal + PREP intent after reset at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/f111-06/l3');

  const formal=await firstReplaceable(page,'.session-swap');
  expect(formal,'F111 preset requires a replaceable formal slot').toBeTruthy();
  const formalSlot=await formal.select.getAttribute('data-slot-key');
  const prep=await firstReplaceable(page,'.prep-slot-select:not([disabled])');
  expect(prep,'F111 preset requires a replaceable PREP slot').toBeTruthy();
  const prepSlot=await prep.select.getAttribute('data-prep-slot');

  await saveNamed(page,'F111 保存测试');
  await page.reload();
  await expect(page.locator('.saved-session-card')).toContainText('F111 保存测试');

  await page.locator('#reset-session').click();
  await expect(page.locator(`.session-swap[data-slot-key="${formalSlot}"]`)).not.toHaveValue(formal.target);

  await page.locator('.saved-session-card').filter({hasText:'F111 保存测试'}).locator('[data-saved-restore]').click();
  await expect(page.locator(`.session-swap[data-slot-key="${formalSlot}"]`)).toHaveValue(formal.target);
  await expect(page.locator(`.prep-slot-select[data-prep-slot="${prepSlot}"]`)).toHaveValue(prep.target);
  await expect(page.locator('.saved-session-notice')).toContainText('已恢复');
  await expect390NoOverflow(page);
  expect(errors,`unexpected F111 SavedSession pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});

test('Body SavedSession supports save, restore, rename and delete at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-02/l3');

  const formal=await firstReplaceable(page,'.body-slot-select');
  expect(formal,'Body requires replaceable formal slot').toBeTruthy();
  const slotKey=await formal.select.getAttribute('data-body-slot');
  await saveNamed(page,'Body 保存测试');

  await page.locator('#reset-body-session').click();
  await expect(page.locator(`.body-slot-select[data-body-slot="${slotKey}"]`)).not.toHaveValue(formal.target);

  let card=page.locator('.saved-session-card').filter({hasText:'Body 保存测试'});
  await card.locator('[data-saved-restore]').click();
  await expect(page.locator(`.body-slot-select[data-body-slot="${slotKey}"]`)).toHaveValue(formal.target);

  card=page.locator('.saved-session-card').filter({hasText:'Body 保存测试'});
  await card.locator('[data-saved-rename-input]').fill('Body 已重命名');
  await card.locator('[data-saved-rename]').click();
  await expect(page.locator('.saved-session-card')).toContainText('Body 已重命名');

  await page.reload();
  card=page.locator('.saved-session-card').filter({hasText:'Body 已重命名'});
  await expect(card).toHaveCount(1);
  await card.locator('[data-saved-delete]').click();
  await expect(page.locator('.saved-session-card').filter({hasText:'Body 已重命名'})).toHaveCount(0);

  await expect390NoOverflow(page);
  expect(errors,`unexpected Body SavedSession pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});

test('Conditioning SavedSession restores Station + PREP intent and protocol context at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/con-03/l2');

  await expect(page.locator('[data-conditioning-session="CON-03-L2-CIRCUIT"]')).toBeVisible();
  const station=await firstReplaceable(page,'.conditioning-station-select');
  expect(station,'Conditioning requires replaceable Station').toBeTruthy();
  const stationKey=await station.select.getAttribute('data-conditioning-station');
  const prep=await firstReplaceable(page,'.conditioning-prep-select:not([disabled])');
  expect(prep,'Conditioning requires replaceable PREP slot').toBeTruthy();
  const prepSlot=await prep.select.getAttribute('data-conditioning-prep-slot');

  await saveNamed(page,'Conditioning 保存测试');
  await page.locator('#reset-conditioning-session').click();
  await expect(page.locator(`.conditioning-station-select[data-conditioning-station="${stationKey}"]`)).not.toHaveValue(station.target);

  await page.locator('.saved-session-card').filter({hasText:'Conditioning 保存测试'}).locator('[data-saved-restore]').click();
  await expect(page.locator(`.conditioning-station-select[data-conditioning-station="${stationKey}"]`)).toHaveValue(station.target);
  await expect(page.locator(`.conditioning-prep-select[data-conditioning-prep-slot="${prepSlot}"]`)).toHaveValue(prep.target);
  await expect(page.locator('.conditioning-protocol-panel')).toContainText('循环');
  await expect(page.locator('.saved-session-notice')).toContainText('已恢复');

  const restored=await page.evaluate(()=>({
    state:window.V15State.getSession('conditioning','CON-03-L2-CIRCUIT'),
    resolved:window.V14CoachModules.ConditioningSession.context(window.V14Router.parseHash(location.hash)).session,
  }));
  expect(restored.state.input.protocolId).toBe('CIRCUIT');
  expect(restored.resolved.domainContext.protocolId).toBe('CIRCUIT');
  await expect390NoOverflow(page);
  expect(errors,`unexpected Conditioning SavedSession pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});
