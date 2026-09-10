const { test, expect } = require('@playwright/test');

function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  return errors;
}

async function expectNoPageErrors(errors) {
  expect(errors, `unexpected pageerror(s): ${errors.join(' | ')}`).toEqual([]);
}

test('390px multi-template coach center renders four registry templates without overflow', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach');
  await expect(page.getByRole('heading', { name: '7Fit Coach Center' })).toBeVisible();
  await expect(page.locator('[data-template-id]')).toHaveCount(4);
  await expect(page.locator('[data-template-id="f111"]')).toContainText('女性综合 1+1+1');
  await expect(page.locator('[data-template-id="body"]')).toContainText('健美式塑形');
  await expect(page.locator('[data-template-id="conditioning"]')).toContainText('体能训练');
  await expect(page.locator('[data-template-id="posture"]')).toContainText('即将开放');
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
  await expectNoPageErrors(errors);
});

test('F111 template landing preserves legacy presets and composer entry', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/f111');
  await expect(page.getByRole('heading', { name: '女性综合 1+1+1' })).toBeVisible();
  await expect(page.getByText('8 个推荐预设', { exact: false })).toBeVisible();
  await expect(page.getByText('20 种自由组合', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: '自由组合编课', exact: true })).toBeVisible();
  await expectNoPageErrors(errors);
});

test('F111 preset page keeps legacy UI while new dispatcher resolves the same public session', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/f111-06/l3');
  await expect(page.locator('h1')).toContainText('F111-06');
  await expect(page.locator('.session-slot')).toHaveCount(6);

  const result = await page.evaluate(() => {
    const resolved = window.V15TemplateResolver.resolve('f111', {
      mode: 'preset',
      recipeId: 'F111-06',
      level: 'L3',
    });
    return {
      validation: window.V15ResolvedSession.validate(resolved),
      templateId: resolved.templateId,
      familyId: resolved.familyId,
      level: resolved.level,
      mainKind: resolved.main.kind,
      slotCount: resolved.main.content.length,
      actionIds: resolved.main.content.map(slot => slot.actionId),
    };
  });

  expect(result.validation).toEqual({ ok: true, errors: [] });
  expect(result.templateId).toBe('f111');
  expect(result.familyId).toBe('F111-06');
  expect(result.level).toBe('L3');
  expect(result.mainKind).toBe('SLOT');
  expect(result.slotCount).toBe(6);
  expect(result.actionIds.every(Boolean)).toBeTruthy();
  await expectNoPageErrors(errors);
});

test('Body, Conditioning and Posture template routes are safe generic landings', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/body');
  await expect(page.getByRole('heading', { name: '健美式塑形' })).toBeVisible();
  await expect(page.getByText('已启用', { exact: false }).first()).toBeVisible();

  await page.goto('/#/coach/conditioning');
  await expect(page.getByRole('heading', { name: '体能训练' })).toBeVisible();
  await expect(page.getByText('已启用', { exact: false }).first()).toBeVisible();

  await page.goto('/#/coach/posture');
  await expect(page.getByRole('heading', { name: '体态调整' })).toBeVisible();
  await expect(page.getByText('即将开放', { exact: false }).first()).toBeVisible();
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
  await expect(page.getByText('L3｜单腿拉 + 水平推', { exact: false })).toBeVisible();
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);

  const swaps = page.locator('.composer-slot-select');
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

    const slotKey = await swap.getAttribute('data-slot-key');
    await swap.selectOption(target);
    const refreshed = page.locator(`.composer-slot-select[data-slot-key="${slotKey}"]`);
    await expect(refreshed).toHaveValue(target);
    changed = true;
    break;
  }

  expect(changed, 'expected at least one Composer slot to expose a valid alternate option').toBeTruthy();
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);
  await expectNoPageErrors(errors);
});

test('390px composer viewport has no horizontal overflow or pageerror', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
  await expectNoPageErrors(errors);
});

test('L3 PREP matcher exposes P3 to P1 only, in downward order, at 390px', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/system/prep?pattern=%E8%B9%B2&level=L3&tier=T4');

  await expect(page.locator('.prep-match-summary b')).toContainText('L3 · PREP P3 → P2 → P1');
  const grades = await page.locator('.prep-action-card > div > span').allTextContents();
  expect(grades.length).toBeGreaterThan(0);
  expect(grades).not.toContain('P4');
  expect(grades.every(grade => ['P3','P2','P1'].includes(grade))).toBeTruthy();

  const rank = {P3:0,P2:1,P1:2};
  for (let i = 1; i < grades.length; i += 1) {
    expect(rank[grades[i]]).toBeGreaterThanOrEqual(rank[grades[i - 1]]);
  }

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
  await expectNoPageErrors(errors);
});
