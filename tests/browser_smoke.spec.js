const { test, expect } = require('@playwright/test');

function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  return errors;
}

async function expectNoPageErrors(errors) {
  expect(errors, `unexpected pageerror(s): ${errors.join(' | ')}`).toEqual([]);
}

test('coach route loads in Chromium with no pageerror', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach');
  await expect(page.getByRole('heading', { name: '女性综合 1+1+1' })).toBeVisible();
  await expect(page.getByRole('link', { name: '自由组合编课' })).toBeVisible();
  await expectNoPageErrors(errors);
});

test('free composer route loads in Chromium with no pageerror', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/compose');
  await expect(page.getByText('20 种基础组合', { exact: false })).toBeVisible();
  await expect(page.getByText('自由组合编课', { exact: false }).first()).toBeVisible();
  await expectNoPageErrors(errors);
});

test('L3 single-leg hinge x horizontal push renders six slots and supports one swap', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');

  await expect(page).toHaveURL(/lower=single_leg_hinge/);
  await expect(page).toHaveURL(/upper=horizontal_push/);
  await expect(page).toHaveURL(/level=L3/);
  await expect(page.locator('.session-slot')).toHaveCount(6);

  const swaps = page.locator('.session-swap');
  const count = await swaps.count();
  let changed = false;

  for (let i = 0; i < count; i += 1) {
    const swap = swaps.nth(i);
    const options = swap.locator('option');
    if ((await options.count()) < 2) continue;

    const current = await swap.inputValue();
    const values = await options.evaluateAll(nodes => nodes.map(node => node.value));
    const target = values.find(value => value && value !== current);
    if (!target) continue;

    await swap.selectOption(target);
    await expect(swap).toHaveValue(target);
    changed = true;
    break;
  }

  expect(changed, 'expected at least one Composer slot to expose a valid alternate option').toBeTruthy();
  await expect(page.locator('.session-slot')).toHaveCount(6);
  await expectNoPageErrors(errors);
});

test('390px composer viewport has no horizontal overflow or pageerror', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  await expect(page.locator('.session-slot')).toHaveCount(6);

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
  await expectNoPageErrors(errors);
});
