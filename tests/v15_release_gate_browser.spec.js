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
async function expectNoErrors(errors,label){
  expect(errors,`${label} pageerror(s): ${errors.join(' | ')}`).toEqual([]);
}

test('V15 release: legacy/canonical F111 parity and direct refresh remain safe at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/coach/f111/f111-06/l3');
  const canonical=await page.locator('.session-swap').evaluateAll(nodes=>nodes.map(node=>node.value));
  expect(canonical).toHaveLength(6);
  await page.reload();
  await expect(page.locator('.session-swap')).toHaveCount(6);
  await expect390(page);

  await page.goto('/#/coach/f111-06/l3');
  const legacy=await page.locator('.session-swap').evaluateAll(nodes=>nodes.map(node=>node.value));
  expect(legacy).toEqual(canonical);
  await expect390(page);

  const canonicalComposer='/#/coach/f111/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3';
  const legacyComposer='/#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3';
  await page.goto(canonicalComposer);
  const canonicalComposerIds=await page.locator('.composer-slot-select').evaluateAll(nodes=>nodes.map(node=>node.value));
  expect(canonicalComposerIds).toHaveLength(6);
  await page.reload();
  await expect(page.locator('.composer-slot-select')).toHaveCount(6);
  await page.goto(legacyComposer);
  const legacyComposerIds=await page.locator('.composer-slot-select').evaluateAll(nodes=>nodes.map(node=>node.value));
  expect(legacyComposerIds).toEqual(canonicalComposerIds);
  await expect390(page);
  await expectNoErrors(errors,'F111 release');
});

test('V15 release: cross-template back forward refresh and Posture future route are stable',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/coach');
  await expect(page.locator('.template-card')).toHaveCount(4);
  await page.goto('/#/coach/body/body-02/l3');
  await expect(page.locator('.body-slot-card')).toHaveCount(6);
  await page.goto('/#/coach/conditioning/con-03/l2');
  await expect(page.locator('.conditioning-station-card')).toHaveCount(3);

  await page.goBack();
  await expect(page).toHaveURL(/#\/coach\/body\/body-02\/l3/);
  await expect(page.locator('.body-slot-card')).toHaveCount(6);
  await page.goForward();
  await expect(page).toHaveURL(/#\/coach\/conditioning\/con-03\/l2/);
  await expect(page.locator('.conditioning-station-card')).toHaveCount(3);

  await page.reload();
  await expect(page.locator('.conditioning-protocol-panel')).toBeVisible();

  await page.goto('/#/coach/posture');
  await expect(page.getByRole('heading',{name:'体态调整'})).toBeVisible();
  await expect(page.getByText('即将开放',{exact:false}).first()).toBeVisible();
  await expect390(page);
  await expectNoErrors(errors,'cross-template navigation');
});

test('V15 release: invalid template routes fail closed without corrupting active State',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/coach/body/body-99/l3');
  await expect(page.locator('#page-title')).toHaveText('页面不存在');
  await expect(page.locator('.empty-state b')).toHaveText('页面不存在');

  await page.goto('/#/coach/conditioning/con-03/l9');
  await expect(page.locator('#page-title')).toHaveText('页面不存在');

  await page.goto('/#/coach/not-a-template/anything');
  await expect(page.locator('#page-title')).toHaveText('页面不存在');

  const snapshot=await page.evaluate(()=>window.V15State.snapshot());
  expect(snapshot.schemaVersion).toBe(1);
  expect(Object.keys(snapshot.templates).sort()).toEqual(['body','conditioning','f111']);
  await expect390(page);
  await expectNoErrors(errors,'invalid route');
});

test('V15 release: all three composers and SavedSession list are operable at 390px',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/coach/f111/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);
  await expect(page.locator('[data-save-current-session]')).toBeVisible();
  await expect390(page);

  await page.goto('/#/coach/body/compose?family=BODY-02&level=L3');
  await expect(page.locator('.body-slot-card')).toHaveCount(6);
  await expect(page.locator('[data-save-current-session]')).toBeVisible();
  await expect390(page);

  await page.goto('/#/coach/conditioning/compose?family=CON-03&level=L2&protocol=CIRCUIT');
  await expect(page.locator('.conditioning-station-card')).toHaveCount(3);
  await expect(page.locator('[data-save-current-session]')).toBeVisible();
  await page.locator('[data-save-session-name]').fill('Release Gate Saved Session');
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expect390(page);

  await page.goto('/#/coach');
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expect(page.locator('[data-saved-restore]')).toBeVisible();
  await expect(page.locator('[data-saved-rename]')).toBeVisible();
  await expect(page.locator('[data-saved-delete]')).toBeVisible();
  await expect390(page);
  await expectNoErrors(errors,'composer/save list');
});
