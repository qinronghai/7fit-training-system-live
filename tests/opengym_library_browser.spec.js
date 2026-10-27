const { test, expect } = require('@playwright/test');

test('OpenGym candidates are searchable and show a no-media review gate', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/library?source=opengym&kind=action');

  await expect(page.getByRole('heading', { name: '动作与编课搜索' })).toBeVisible();
  await expect(page.locator('[data-filter="source"]')).toHaveValue('opengym');
  await expect(page.locator('[data-search-group="opengym"]')).toBeVisible();

  await page.locator('#action-search').fill('kettlebell goblet squat');
  const row = page.locator('[data-search-result-kind="opengym-action"]').first();
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator('#global-drawer')).toContainText('候选资料，不可直接编排');
  await expect(page.locator('#global-drawer')).toContainText('相似动作 / 替代候选');
  await expect(page.locator('#global-drawer [data-opengym-related-id]')).toHaveCount(4, { timeout: 5000 });
  await expect(page.locator('#global-drawer')).toContainText('未导入 OpenGym 图片/动画');
  await expect(page.locator('#global-drawer [data-media-status="not-imported"]')).toBeVisible();
  await expect(page.locator('#global-drawer')).toContainText('查看 OpenGym 原始条目');

  expect(errors, errors.join(' | ')).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
