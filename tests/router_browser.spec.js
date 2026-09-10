const { test, expect } = require('@playwright/test');

function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  return errors;
}

async function expectNoPageErrors(errors) {
  expect(errors, `unexpected pageerror(s): ${errors.join(' | ')}`).toEqual([]);
}

async function firstReplaceable(page, selector) {
  const selects = page.locator(selector);
  const count = await selects.count();
  for (let i = 0; i < count; i += 1) {
    const select = selects.nth(i);
    const current = await select.inputValue();
    const values = await select.locator('option').evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean));
    const target = values.find(value => value !== current);
    if (!target) continue;
    return { select, current, target };
  }
  return null;
}

async function firstReplaceablePrep(page) {
  const hit = await firstReplaceable(page, '.prep-slot-select:not([disabled])');
  if (!hit) return null;
  return {
    ...hit,
    slotKey: await hit.select.getAttribute('data-prep-slot'),
    sessionKey: await hit.select.getAttribute('data-prep-session'),
  };
}

test('390px canonical and legacy F111 preset routes render the same session', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111/f111-06/l3');
  await expect(page.locator('h1')).toContainText('F111-06');
  const canonicalIds = await page.locator('.session-swap').evaluateAll(nodes => nodes.map(node => node.value));
  expect(canonicalIds).toHaveLength(6);
  const levelHrefs = await page.locator('.level-switch a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(levelHrefs).toEqual([
    '#/coach/f111/f111-06/l1',
    '#/coach/f111/f111-06/l2',
    '#/coach/f111/f111-06/l3',
    '#/coach/f111/f111-06/l4',
  ]);
  await expect(page.locator('.back-link')).toHaveAttribute('href', '#/coach/f111');

  await page.goto('/#/coach/f111-06/l3');
  await expect(page.locator('h1')).toContainText('F111-06');
  const legacyIds = await page.locator('.session-swap').evaluateAll(nodes => nodes.map(node => node.value));
  expect(legacyIds).toEqual(canonicalIds);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expectNoPageErrors(errors);
});

test('canonical F111 composer works and F111 home emits canonical links', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/f111');
  await expect(page.locator('a[href="#/coach/f111/compose"]')).toHaveCount(2);
  await expect(page.locator('a[href^="#/coach/f111/f111-01/l"]')).toHaveCount(4);
  await expect(page.locator('a[href^="#/coach/compose"]')).toHaveCount(0);

  await page.goto('/#/coach/f111/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);
  await expect(page.getByText('L3｜单腿拉 + 水平推', { exact: false })).toBeVisible();
  await expect(page.locator('.coach-mode-switch a').last()).toHaveAttribute('href', '#/coach/f111/compose');
  const composerLevelHrefs = await page.locator('.composer-level-switch a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  expect(composerLevelHrefs.every(href => href && href.startsWith('#/coach/f111/compose?'))).toBeTruthy();
  await expect(page.locator('a[href^="#/coach/compose"]')).toHaveCount(0);

  await page.goto('/#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);
  await expectNoPageErrors(errors);
});

test('#30 canonical and legacy F111 URLs share formal and PREP state through reload at 390px', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // Preset: canonical mutation -> reload -> legacy alias sees the same V15 namespace state.
  await page.goto('/#/coach/f111/f111-06/l3');
  const presetFormal = await firstReplaceable(page, '.session-swap');
  expect(presetFormal, 'expected a replaceable preset strength slot').toBeTruthy();
  const presetSessionKey = await presetFormal.select.getAttribute('data-session');
  const presetSlotKey = await presetFormal.select.getAttribute('data-slot-key');
  await presetFormal.select.selectOption(presetFormal.target);
  await expect(page.locator(`.session-swap[data-slot-key="${presetSlotKey}"]`)).toHaveValue(presetFormal.target);

  const presetPrep = await firstReplaceablePrep(page);
  expect(presetPrep, 'expected a replaceable preset PREP slot').toBeTruthy();
  await presetPrep.select.selectOption(presetPrep.target);
  await expect(page.locator(`.prep-slot-select[data-prep-slot="${presetPrep.slotKey}"]`)).toHaveValue(presetPrep.target);

  await page.reload();
  await expect(page.locator(`.session-swap[data-slot-key="${presetSlotKey}"]`)).toHaveValue(presetFormal.target);
  await expect(page.locator(`.prep-slot-select[data-prep-slot="${presetPrep.slotKey}"]`)).toHaveValue(presetPrep.target);
  const presetState = await page.evaluate(({sessionKey,slotKey,prepSlot}) => ({
    formal: window.V15State.getSelections('f111', sessionKey)[String(slotKey).split('__').pop()],
    prep: window.V15State.getPrepSelections('f111', sessionKey)[prepSlot],
  }), {sessionKey:presetSessionKey,slotKey:presetSlotKey,prepSlot:presetPrep.slotKey});
  expect(presetState.formal).toEqual({actionId:presetFormal.target,source:'manual'});
  expect(presetState.prep).toEqual({actionId:presetPrep.target,source:'manual'});

  await page.goto('/#/coach/f111-06/l3');
  await expect(page.locator(`.session-swap[data-slot-key="${presetSlotKey}"]`)).toHaveValue(presetFormal.target);
  await expect(page.locator(`.prep-slot-select[data-prep-slot="${presetPrep.slotKey}"]`)).toHaveValue(presetPrep.target);
  await page.goBack();
  await expect(page).toHaveURL(/#\/coach\/f111\/f111-06\/l3/);
  await expect(page.locator(`.session-swap[data-slot-key="${presetSlotKey}"]`)).toHaveValue(presetFormal.target);

  // Composer: canonical mutation -> reload -> legacy alias sees the same V15 namespace state.
  const canonicalComposer='/#/coach/f111/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3';
  const legacyComposer='/#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3';
  await page.goto(canonicalComposer);
  const composerFormal = await firstReplaceable(page, '.composer-slot-select');
  expect(composerFormal, 'expected a replaceable composer strength slot').toBeTruthy();
  const composerKey = await composerFormal.select.getAttribute('data-composer-key');
  const composerSlotKey = await composerFormal.select.getAttribute('data-slot-key');
  await composerFormal.select.selectOption(composerFormal.target);
  await expect(page.locator(`.composer-slot-select[data-slot-key="${composerSlotKey}"]`)).toHaveValue(composerFormal.target);

  const composerPrep = await firstReplaceablePrep(page);
  expect(composerPrep, 'expected a replaceable composer PREP slot').toBeTruthy();
  await composerPrep.select.selectOption(composerPrep.target);
  await expect(page.locator(`.prep-slot-select[data-prep-slot="${composerPrep.slotKey}"]`)).toHaveValue(composerPrep.target);

  await page.reload();
  await expect(page.locator(`.composer-slot-select[data-slot-key="${composerSlotKey}"]`)).toHaveValue(composerFormal.target);
  await expect(page.locator(`.prep-slot-select[data-prep-slot="${composerPrep.slotKey}"]`)).toHaveValue(composerPrep.target);
  const composerState = await page.evaluate(({sessionKey,slotKey,prepSlot}) => ({
    formal: window.V15State.getSelections('f111', sessionKey)[slotKey],
    prep: window.V15State.getPrepSelections('f111', sessionKey)[prepSlot],
  }), {sessionKey:composerKey,slotKey:composerSlotKey,prepSlot:composerPrep.slotKey});
  expect(composerState.formal).toEqual({actionId:composerFormal.target,source:'manual'});
  expect(composerState.prep).toEqual({actionId:composerPrep.target,source:'manual'});

  await page.goto(legacyComposer);
  await expect(page.locator(`.composer-slot-select[data-slot-key="${composerSlotKey}"]`)).toHaveValue(composerFormal.target);
  await expect(page.locator(`.prep-slot-select[data-prep-slot="${composerPrep.slotKey}"]`)).toHaveValue(composerPrep.target);

  const widths = await page.evaluate(() => ({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
  await expectNoPageErrors(errors);
});

test('Body and Conditioning compose routes are safe non-F111 landings', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/body/compose');
  await expect(page.getByRole('heading', { name: '健美式塑形' })).toBeVisible();
  await expect(page.getByText('具体编排引擎将在对应模板任务中接入', { exact: false })).toBeVisible();
  await expect(page.locator('.composer-slot-card')).toHaveCount(0);

  await page.goto('/#/coach/conditioning/compose');
  await expect(page.getByRole('heading', { name: '体能训练' })).toBeVisible();
  await expect(page.getByText('具体编排引擎将在对应模板任务中接入', { exact: false })).toBeVisible();
  await expect(page.locator('.composer-slot-card')).toHaveCount(0);
  await expectNoPageErrors(errors);
});

test('canonical F111 navigation supports back/forward and invalid nested routes fail safely', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/f111');
  await page.goto('/#/coach/f111/f111-01/l1');
  await expect(page.locator('.session-slot')).toHaveCount(6);
  await page.goBack();
  await expect(page.getByRole('heading', { name: '女性综合 1+1+1' })).toBeVisible();
  await page.goForward();
  await expect(page.locator('.session-slot')).toHaveCount(6);

  await page.goto('/#/coach/f111/f111-99/l3');
  await expect(page.locator('#page-title')).toHaveText('页面不存在');
  await expect(page.locator('.empty-state b')).toHaveText('页面不存在');
  await expectNoPageErrors(errors);
});
