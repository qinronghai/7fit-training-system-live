const { test, expect } = require('@playwright/test');

test('formal action detail shows the licensed Workout Guide animation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/library?focus=gangling_shendun');

  const drawer = page.locator('#global-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-media-source="workout-guide"]')).toBeVisible();
  await expect(drawer.locator('.workout-guide-frame')).toHaveCount(3);
  await expect(drawer).toContainText('CC BY-SA 4.0');
  await expect(drawer).toContainText('Bryl Lim');
  await expect(drawer.locator('.workout-guide-attribution a').first()).toHaveAttribute('href', /creativecommons\.org/);

  expect(errors, errors.join(' | ')).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
