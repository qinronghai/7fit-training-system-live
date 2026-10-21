const { test, expect } = require('@playwright/test');

test('F111 support card exposes rationale, member feeling, alternatives and full manual choices', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111/compose?level=L1&lower=squat&upper=horizontal_pull&core=anti_extension');

  const card = page.locator('.f111-slot-card[data-composer-slot="C"]');
  await expect(card).toContainText('推荐依据');
  await expect(card).toContainText('会员感受');
  await expect(card).toContainText('同目的替代');
  await expect(card).toContainText('疲劳');

  await card.locator('[data-f111-action-drawer="C"]').click();
  const drawer = page.locator('#f111-action-drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('.f111-drawer-action')).toHaveCount(31);
  await expect(drawer.locator('.f111-drawer-action.is-disabled')).toHaveCount(0);
  await expect(drawer.locator('.f111-drawer-action').filter({ hasText: '侧平板抬上侧腿' })).toContainText('需确认');
});
