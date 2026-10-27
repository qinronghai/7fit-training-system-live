const { test, expect } = require('@playwright/test');

test('coach flow keeps a contextual feedback action available on desktop and mobile', async ({ page }) => {
  await page.goto('/#/coach');

  const feedback = page.getByRole('button', { name: '反馈问题' });
  await expect(feedback).toBeVisible();
  await expect(feedback).toHaveCSS('font-size', '11px');
  await feedback.click();

  const dialog = page.getByRole('dialog', { name: '反馈问题' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('页面：编课中心');
  await expect(dialog).toContainText('反馈内容会带上当前页面和时间');
  await expect(dialog.getByRole('link', { name: '联系产品负责人' })).toBeHidden();
  await expect(dialog.locator('[data-feedback-contact]')).toHaveCSS('display', 'none');

  await dialog.getByLabel('问题描述').fill('选择模板后无法进入下一步');
  await dialog.getByRole('button', { name: '复制反馈内容' }).click();
  await expect(dialog).toContainText('反馈内容已复制');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.getByRole('button', { name: '反馈问题' })).toBeVisible();
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
});

test('invalid route explains the impact and offers recovery plus feedback', async ({ page }) => {
  await page.goto('/#/not-a-real-route');

  await expect(page.getByRole('heading', { name: '页面不存在' })).toBeVisible();
  await expect(page.getByText('当前内容没有被修改。')).toBeVisible();
  await expect(page.getByRole('link', { name: '返回编课中心' })).toBeVisible();
  await expect(page.locator('.empty-state-actions').getByRole('button', { name: '反馈问题' })).toBeVisible();
});
