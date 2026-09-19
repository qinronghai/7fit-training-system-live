const { test, expect } = require('@playwright/test');

function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  return errors;
}

async function expectNoPageErrors(errors) {
  expect(errors, `unexpected pageerror(s): ${errors.join(' | ')}`).toEqual([]);
}

async function firstReplaceablePrep(page) {
  const selects = page.locator('.prep-slot-select:not([disabled])');
  const count = await selects.count();
  for (let i = 0; i < count; i += 1) {
    const select = selects.nth(i);
    const current = await select.inputValue();
    const values = await select.locator('option').evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean));
    const target = values.find(value => value !== current);
    if (!target) continue;
    return {
      slotKey: await select.getAttribute('data-prep-slot'),
      sessionKey: await select.getAttribute('data-prep-session'),
      current,
      target,
    };
  }
  return null;
}

test('390px multi-template coach center renders registered templates without overflow', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach');
  await expect(page.getByRole('heading', { name: '7Fit Coach Center' })).toBeVisible();
  await expect(page.locator('[data-template-id]')).toHaveCount(5);
  await expect(page.locator('[data-template-id="f111"]')).toContainText('女性综合 1+1+1');
  await expect(page.locator('[data-template-id="body"]')).toContainText('健美式塑形');
  await expect(page.locator('[data-template-id="conditioning"]')).toContainText('体能训练');
  await expect(page.locator('[data-template-id="hyrox"]')).toContainText('已启用');
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

test('desktop F111 preset browser renders 8x4 matrix without horizontal overflow', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/coach/f111');

  await expect(page.locator('[data-f111-preset-matrix-shell]')).toBeVisible();
  await expect(page.locator('[data-f111-recipe-row]')).toHaveCount(8);
  await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(32);
  await expect(page.locator('[data-f111-preset-cell][data-recipe-id="F111-03"][data-level="L2"]')).toHaveAttribute('href', '#/coach/f111/f111-03/l2');
  await expect(page.locator('[data-f111-recipe-row="F111-03"]')).toContainText('髋铰链｜水平拉｜支撑');
  await expect(page.locator('[data-f111-mobile-fallback]')).toBeHidden();

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  await expectNoPageErrors(errors);
});

test('desktop F111 preset cell opens detail drawer without leaving browser context', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/coach/f111');

  const first = page.locator('[data-f111-preset-cell][data-recipe-id="F111-03"][data-level="L2"]');
  await first.click();

  await expect(page).toHaveURL(/#\/coach\/f111$/);
  await expect(page.locator('#global-drawer[data-f111-preset-drawer]')).toBeVisible();
  await expect(page.locator('#global-drawer')).toContainText('F111-03 · L2');
  await expect(page.locator('#global-drawer')).toContainText('髋铰链｜水平拉｜支撑');
  await expect(page.locator('#global-drawer [data-preview-slot="A"]')).toBeVisible();
  await expect(page.locator('#global-drawer [data-preview-slot="B"]')).toBeVisible();
  await expect(page.locator('#global-drawer .f111-preset-drawer-actions')).toContainText('开始课程');
  await expect(page.locator('[data-f111-preset-cell][data-recipe-id="F111-03"][data-level="L2"]')).toHaveAttribute('aria-selected','true');

  const second = page.locator('[data-f111-preset-cell][data-recipe-id="F111-07"][data-level="L3"]');
  await second.click();
  await expect(page.locator('#global-drawer')).toContainText('F111-07 · L3');
  await expect(page.locator('[data-f111-preset-cell][data-recipe-id="F111-07"][data-level="L3"]')).toHaveAttribute('aria-selected','true');

  await page.locator('[data-f111-preset-close]').click();
  await expect(page.locator('#global-drawer')).toBeHidden();
  await expect(page).toHaveURL(/#\/coach\/f111$/);
  await expect(page.locator('[data-f111-preset-cell][data-recipe-id="F111-07"][data-level="L3"]')).toBeFocused();
  await expectNoPageErrors(errors);
});

test('F111 preset filters combine Level and pattern groups deterministically', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/coach/f111');

  await expect(page.locator('[data-f111-result-count]')).toContainText('共 32 套预设');
  await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(32);

  await page.locator('[data-f111-filter-group="level"][data-f111-filter-value="L2"]').click();
  await expect(page.locator('[data-f111-result-count]')).toContainText('L2 · 共 8 套预设');
  await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(8);

  await page.locator('[data-f111-filter-group="lower"][data-f111-filter-value="髋铰链"]').click();
  await expect(page.locator('[data-f111-result-count]')).toContainText('L2 + 髋铰链 · 共 2 套预设');
  await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(2);
  await expect(page.locator('[data-f111-recipe-row]')).toHaveCount(2);

  await page.locator('[data-f111-filter-group="upper"][data-f111-filter-value="垂直推"]').click();
  await expect(page.locator('[data-f111-result-count]')).toContainText('共 1 套预设');
  await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(1);
  await expect(page.locator('[data-f111-recipe-row="F111-07"]')).toBeVisible();

  await page.locator('#f111-preset-search').fill('F111-03');
  await expect(page.locator('[data-f111-preset-empty]')).toBeVisible();
  await expect(page.locator('[data-f111-result-count]')).toContainText('共 0 套预设');

  await page.locator('[data-f111-filter-clear]').first().click();
  await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(32);
  await expect(page.locator('[data-f111-result-count]')).toContainText('共 32 套预设');
  await expectNoPageErrors(errors);
});

test('F111 preset recent use persists, dedupes and drops stale entries', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/coach/f111');

  const cell = page.locator('[data-f111-preset-cell][data-recipe-id="F111-03"][data-level="L2"]');
  await cell.click();
  await expect(page.locator('[data-f111-recent][data-recipe-id="F111-03"][data-level="L2"]')).toBeVisible();
  await page.locator('[data-f111-preset-close]').click();

  await cell.click();
  await page.locator('[data-f111-preset-close]').click();
  let recent = await page.evaluate(() => JSON.parse(localStorage.getItem(window.V14CoachModules.F111PresetControls.STORAGE_KEY) || '[]'));
  expect(recent.filter(item => item.recipeId === 'F111-03' && item.level === 'L2')).toHaveLength(1);

  await page.reload();
  await expect(page.locator('[data-f111-recent][data-recipe-id="F111-03"][data-level="L2"]')).toBeVisible();

  await page.evaluate(() => {
    const key = window.V14CoachModules.F111PresetControls.STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify([
      { recipeId: 'F111-99', level: 'L2', usedAt: '2099-01-01T00:00:00.000Z' },
      { recipeId: 'F111-03', level: 'L2', usedAt: '2026-09-19T00:00:00.000Z' },
    ]));
  });
  await page.reload();
  await expect(page.locator('[data-f111-recent]')).toHaveCount(1);
  recent = await page.evaluate(() => JSON.parse(localStorage.getItem(window.V14CoachModules.F111PresetControls.STORAGE_KEY) || '[]'));
  expect(recent).toHaveLength(1);
  expect(recent[0].recipeId).toBe('F111-03');
  await expectNoPageErrors(errors);
});

test('390px F111 preset browser uses Level-first grouped list without horizontal overflow', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111');

  await expect(page.locator('[data-f111-preset-matrix-shell]')).toBeHidden();
  await expect(page.locator('[data-f111-mobile-list]')).toBeVisible();
  await expect(page.locator('[data-f111-mobile-row]')).toHaveCount(8);
  await expect(page.locator('[data-f111-mobile-preset]')).toHaveCount(32);
  await expect(page.locator('[data-f111-mobile-group]')).toHaveCount(4);

  let widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);

  await page.locator('[data-f111-filter-group="level"][data-f111-filter-value="L2"]').click();
  await expect(page.locator('[data-f111-mobile-row]')).toHaveCount(8);
  await expect(page.locator('[data-f111-mobile-preset]')).toHaveCount(8);
  expect(await page.locator('[data-f111-mobile-preset]').evaluateAll(nodes => nodes.every(node => node.dataset.level === 'L2'))).toBeTruthy();

  const target = page.locator('[data-f111-mobile-preset][data-recipe-id="F111-03"][data-level="L2"]');
  await expect(target).toContainText('水平拉 · 支撑');
  await target.click();

  await expect(page).toHaveURL(/#\/coach\/f111$/);
  await expect(page.locator('#global-drawer[data-f111-preset-drawer]')).toBeVisible();
  await expect(page.locator('#global-drawer')).toContainText('F111-03 · L2');
  await page.locator('[data-f111-preset-close]').click();

  widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  await expectNoPageErrors(errors);
});

test('360px F111 preset browser keeps compact ALL-level rows usable', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/#/coach/f111');

  await expect(page.locator('[data-f111-mobile-row]')).toHaveCount(8);
  await expect(page.locator('[data-f111-mobile-preset]')).toHaveCount(32);
  const firstRow = page.locator('[data-f111-mobile-row]').first();
  await expect(firstRow.locator('[data-f111-mobile-preset]')).toHaveCount(4);

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(360);
  await expectNoPageErrors(errors);
});

test('390px F111 preset detail opens as modal bottom sheet with fixed CTA and focus return', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111');

  await page.locator('[data-f111-filter-group="level"][data-f111-filter-value="L2"]').click();
  const target = page.locator('[data-f111-mobile-preset][data-recipe-id="F111-03"][data-level="L2"]');
  await expect(target).toBeVisible();
  await target.click();

  const drawer = page.locator('#global-drawer[data-f111-preset-drawer]');
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute('aria-modal','true');
  await expect(drawer.locator('.f111-preset-sheet-handle')).toBeVisible();
  await expect(drawer).toContainText('F111-03 · L2');
  await expect(drawer).toContainText('髋铰链');
  await expect(drawer.locator('.f111-preset-cta.primary')).toContainText('开始课程');
  await expect(drawer.locator('.f111-preset-cta.primary')).toBeVisible();

  expect(await page.locator('body').evaluate(node => node.classList.contains('drawer-open'))).toBeTruthy();
  expect(await page.locator('.app-shell').evaluate(node => node.hasAttribute('inert'))).toBeTruthy();

  const geometry = await drawer.evaluate(node => {
    const body = node.querySelector('.f111-preset-drawer-body').getBoundingClientRect();
    const head = node.querySelector('.f111-preset-drawer-head').getBoundingClientRect();
    const cta = node.querySelector('.f111-preset-drawer-actions').getBoundingClientRect();
    return {bodyTop:body.top,headTop:head.top,headBottom:head.bottom,ctaBottom:cta.bottom,viewport:window.innerHeight};
  });
  expect(geometry.headTop).toBeGreaterThan(0);
  expect(geometry.bodyTop).toBeGreaterThan(geometry.headTop);
  expect(geometry.ctaBottom).toBeLessThanOrEqual(geometry.viewport + 1);

  await drawer.locator('[data-f111-preset-close]').click();
  await expect(drawer).toBeHidden();
  expect(await page.locator('body').evaluate(node => node.classList.contains('drawer-open'))).toBeFalsy();
  expect(await page.locator('.app-shell').evaluate(node => node.hasAttribute('inert'))).toBeFalsy();
  await expect(page.locator('[data-f111-mobile-preset][data-recipe-id="F111-03"][data-level="L2"]')).toBeFocused();

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
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

test('Body, Conditioning and HYROX homes are active while Posture remains future', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.goto('/#/coach/body');
  await expect(page.getByRole('heading', { name: '健美式塑形' })).toBeVisible();
  await expect(page.locator('[data-body-mode]')).toHaveCount(6);
  await expect(page.locator('.body-family-card')).toHaveCount(4);
  // Body picks Family × Level on this page; it is no longer the only template
  // that needs a separate Family page before a session.
  await expect(page.getByText('选择本节训练 Family 与等级', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /进入 Body 自由编课/ })).toBeVisible();

  await page.goto('/#/coach/conditioning');
  await expect(page.getByRole('heading', { name: '体能训练' })).toBeVisible();
  await expect(page.locator('.conditioning-family-card')).toHaveCount(4);
  await expect(page.getByText('选择体能目标 / 等级', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '构建课程 →', exact: true })).toBeVisible();

  await page.goto('/#/coach/hyrox');
  await expect(page.getByRole('heading', { name: 'HYROX 训练' })).toBeVisible();
  await expect(page.locator('.hyrox-type-card')).toHaveCount(4);
  await expect(page.getByText('不加入 1km 跑步', { exact: false })).toBeVisible();

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

test('390px F111 PREP replacement persists through rerender and reload for preset and composer', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/#/coach/f111-06/l3');
  await expect(page.locator('.prep-slot-card')).toHaveCount(5);
  const preset = await firstReplaceablePrep(page);
  expect(preset, 'expected a replaceable preset PREP slot').toBeTruthy();
  await page.locator(`.prep-slot-select[data-prep-slot="${preset.slotKey}"]`).selectOption(preset.target);
  let presetSelect = page.locator(`.prep-slot-select[data-prep-slot="${preset.slotKey}"]`);
  await expect(presetSelect).toHaveValue(preset.target);
  await expect(page.locator(`[data-prep-slot-card="${preset.slotKey}"]`)).toContainText('手动选择');

  await page.reload();
  presetSelect = page.locator(`.prep-slot-select[data-prep-slot="${preset.slotKey}"]`);
  await expect(presetSelect).toHaveValue(preset.target);
  await expect(page.locator(`[data-prep-slot-card="${preset.slotKey}"]`)).toContainText('手动选择');

  const presetState = await page.evaluate(({ sessionKey, slotKey }) => window.V15State.getPrepSelections('f111', sessionKey)[slotKey], preset);
  expect(presetState).toEqual({ actionId: preset.target, source: 'manual' });
  await page.locator('#reset-session').click();
  await expect(page.locator(`[data-prep-slot-card="${preset.slotKey}"]`)).toContainText('系统推荐');

  await page.goto('/#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3');
  await expect(page.locator('.prep-slot-card')).toHaveCount(5);
  const composer = await firstReplaceablePrep(page);
  expect(composer, 'expected a replaceable Composer PREP slot').toBeTruthy();
  await page.locator(`.prep-slot-select[data-prep-slot="${composer.slotKey}"]`).selectOption(composer.target);
  let composerSelect = page.locator(`.prep-slot-select[data-prep-slot="${composer.slotKey}"]`);
  await expect(composerSelect).toHaveValue(composer.target);
  await expect(page.locator(`[data-prep-slot-card="${composer.slotKey}"]`)).toContainText('手动选择');

  await page.reload();
  composerSelect = page.locator(`.prep-slot-select[data-prep-slot="${composer.slotKey}"]`);
  await expect(composerSelect).toHaveValue(composer.target);
  await expect(page.locator(`[data-prep-slot-card="${composer.slotKey}"]`)).toContainText('手动选择');
  const composerState = await page.evaluate(({ sessionKey, slotKey }) => window.V15State.getPrepSelections('f111', sessionKey)[slotKey], composer);
  expect(composerState).toEqual({ actionId: composer.target, source: 'manual' });

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
  await expectNoPageErrors(errors);
});


test('390px HYROX Skill, Mixed and Benchmark calibration workflow are operable', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/#/coach/hyrox/skill/l2');
  await expect(page.locator('.hyrox-station-card')).toHaveCount(3);
  await expect(page.locator('.hyrox-prep-card')).toHaveCount(5);
  await expect(page.getByText('Turf 8m', { exact: false }).first()).toBeVisible();
  let widths = await page.evaluate(() => ({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
  expect(widths.scrollWidth).toBe(widths.clientWidth);

  await page.goto('/#/coach/hyrox/mixed/l3');
  await expect(page.locator('.hyrox-station-card')).toHaveCount(5);
  await expect(page.locator('[data-hyrox-station-swap]')).toHaveCount(5);
  await expect(page.locator('[data-save-current-session]')).toBeVisible();

  await page.goto('/#/coach/hyrox/benchmark/b3');
  await expect(page.locator('.hyrox-resolver-block')).toBeVisible();
  await expect(page.getByText('雪橇场馆校准', { exact: true })).toBeVisible();
  await page.locator('[data-hyrox-sled-push]').fill('42');
  await page.locator('[data-hyrox-sled-pull]').fill('36');
  await page.locator('[data-hyrox-save-calibration]').click();
  await expect(page.locator('.hyrox-station-card')).toHaveCount(8);
  await expect(page.locator('[data-hyrox-station-swap]')).toHaveCount(0);
  await expect(page.getByText('6 趟｜48m', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('只有 Protocol、工作量、有效负重', { exact: false })).toBeVisible();

  widths = await page.evaluate(() => ({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
  await expectNoPageErrors(errors);
});


test('390px HYROX Benchmark history persists PB, deltas and weakness profile', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/hyrox/benchmark/b3');

  await page.locator('[data-hyrox-sled-push]').fill('42');
  await page.locator('[data-hyrox-sled-pull]').fill('36');
  await page.locator('[data-hyrox-save-calibration]').click();
  await expect(page.locator('.hyrox-station-card')).toHaveCount(8);

  await page.locator('[data-hyrox-history-athlete]').fill('Benchmark测试会员');
  await page.locator('[data-hyrox-history-load]').click();
  await expect(page.locator('.hyrox-benchmark-recorder')).toBeVisible();

  const first = {H1:'2:00',H2:'1:30',H3:'1:40',H4:'1:50',H5:'2:05',H6:'1:20',H7:'1:30',H8:'1:40'};
  await page.locator('[data-hyrox-benchmark-total]').fill('15:00');
  for (const [id,value] of Object.entries(first)) {
    await page.locator(`[data-hyrox-benchmark-time="${id}"]`).fill(value);
  }
  await page.locator('[data-hyrox-benchmark-rpe]').fill('8');
  await page.locator('[data-hyrox-benchmark-save]').click();

  await expect(page.locator('.hyrox-history-row')).toHaveCount(1);
  await expect(page.locator('.hyrox-benchmark-summary .hyrox-history-baseline')).toContainText('首次建立基准');
  await expect(page.locator('.hyrox-benchmark-kpi-grid')).toContainText('15:00');

  const second = {H1:'1:55',H2:'1:35',H3:'1:45',H4:'1:45',H5:'2:00',H6:'1:15',H7:'1:25',H8:'1:35'};
  await page.locator('[data-hyrox-benchmark-total]').fill('14:30');
  for (const [id,value] of Object.entries(second)) {
    await page.locator(`[data-hyrox-benchmark-time="${id}"]`).fill(value);
  }
  await page.locator('[data-hyrox-benchmark-save]').click();

  await expect(page.locator('.hyrox-history-row')).toHaveCount(2);
  await expect(page.locator('.hyrox-benchmark-kpi-grid')).toContainText('14:30');
  await expect(page.locator('.hyrox-benchmark-kpi-grid')).toContainText('15:00');
  await expect(page.locator('.hyrox-benchmark-kpi-grid')).toContainText('↑ 0:30');
  await expect(page.locator('.hyrox-ability-panel')).toContainText('当前短板：SLED');
  await expect(page.locator('.hyrox-history-station-grid')).toContainText('H2');
  await expect(page.locator('.hyrox-history-station-grid')).toContainText('↓ 0:05');

  const memberCopy = await page.evaluate(() => {
    const route = window.V14Router.parseHash('#/coach/hyrox/benchmark/b3');
    const ctx = window.V14CoachModules.HyroxSession.context(route);
    const payload = window.V14CoachModules.HyroxCopy.buildPayload(ctx.session, ctx.prep);
    return window.V14CoachModules.HyroxCopy.formatMember(payload);
  });
  expect(memberCopy).toContain('14:30');
  expect(memberCopy).toContain('↑ 0:30');
  expect(memberCopy).toContain('SLED');
  expect(memberCopy).not.toContain('comparisonKey');
  expect(memberCopy).not.toContain('schemaVersion');
  expect(memberCopy).not.toContain('HYROX|');

  await page.reload();
  await expect(page.locator('.hyrox-history-row')).toHaveCount(2);
  await expect(page.locator('.hyrox-benchmark-kpi-grid')).toContainText('14:30');

  const dismissDelete = page.waitForEvent('dialog').then(async dialog => {
    expect(dialog.message()).toContain('删除');
    expect(dialog.message()).toContain('恢复');
    await dialog.dismiss();
  });
  await page.locator('[data-hyrox-history-delete]').first().click();
  await dismissDelete;
  await expect(page.locator('.hyrox-history-row')).toHaveCount(2);

  const activeHistoryRows=page.locator('.hyrox-history-list > .hyrox-history-rows > .hyrox-history-row');
  const acceptDelete = page.waitForEvent('dialog').then(dialog => dialog.accept());
  await page.locator('[data-hyrox-history-delete]').first().click();
  await acceptDelete;
  await expect(activeHistoryRows).toHaveCount(1);
  await expect(page.locator('.hyrox-history-deleted')).toContainText('已删除记录');

  await page.locator('.hyrox-history-deleted summary').click();
  await page.locator('[data-hyrox-history-restore]').first().click();
  await expect(activeHistoryRows).toHaveCount(2);

  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
  await expectNoPageErrors(errors);
});
