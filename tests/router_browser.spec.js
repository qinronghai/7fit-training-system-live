const { test, expect } = require('@playwright/test');

function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  return errors;
}

async function expectNoPageErrors(errors) {
  expect(errors, `unexpected pageerror(s): ${errors.join(' | ')}`).toEqual([]);
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
