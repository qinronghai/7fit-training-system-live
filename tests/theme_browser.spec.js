const { test, expect } = require('@playwright/test');

test('follows the device until a manual theme choice is saved', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/#/coach');

  const root = page.locator('html');
  const toggle = page.getByRole('button', { name: '深色模式', exact: true });
  await expect(root).toHaveCSS('color-scheme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveCSS('color-scheme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.focus();
  await toggle.press('Space');
  await expect(root).toHaveCSS('color-scheme', 'dark');
  await expect(toggle).toBeFocused();

  await page.reload({ waitUntil: 'commit' });
  await expect(root).toHaveCSS('color-scheme', 'dark');
  await page.emulateMedia({ colorScheme: 'dark' });
  await toggle.click();
  await page.reload();
  await expect(root).toHaveCSS('color-scheme', 'light');
});

test('switches mobile navigation, composer cards and drawers together', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/#/coach/f111');

  const card = page.locator('.f111-slot-card').first();
  const nav = page.locator('.mobile-nav');
  const toggle = page.getByRole('button', { name: '深色模式', exact: true });
  const lightCard = await card.evaluate(node => getComputedStyle(node).backgroundColor);
  const lightNav = await nav.evaluate(node => getComputedStyle(node).backgroundColor);
  const drawerTrigger = page.locator('[data-f111-mode-drawer="lower"]').first();
  const panel = page.locator('.f111-action-drawer-panel');

  await drawerTrigger.click();
  const lightPanel = await panel.evaluate(node => getComputedStyle(node).backgroundColor);
  await panel.locator('.f111-action-drawer-close').click();

  await toggle.click();
  await expect(card).not.toHaveCSS('background-color', lightCard);
  await expect(nav).not.toHaveCSS('background-color', lightNav);
  await drawerTrigger.click();
  await expect(panel).toBeVisible();
  await expect(panel).not.toHaveCSS('background-color', lightPanel);
  expect(await page.locator('html').evaluate(node => node.scrollWidth)).toBe(375);
});
