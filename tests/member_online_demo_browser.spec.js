const { test, expect } = require('@playwright/test');

test('public member page can read and change isolated samples without a staff session', async ({ page, browser }) => {
  const memberRequests = [];
  await page.route('**/functions/v1/member-api**', route => {
    memberRequests.push(route.request().url());
    return route.abort();
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/members');
  await expect(page.getByText('示例数据', { exact: true })).toBeVisible();
  await expect(page.getByText('馆主管理 PIN')).toHaveCount(0);
  await expect(page.locator('[data-member-count="TOTAL"]')).toHaveText('14');
  await page.getByRole('button', { name: '新增会员', exact: true }).click();
  await page.getByLabel('会员姓名', { exact: true }).fill('本地体验会员');
  await page.getByRole('button', { name: '保存资料', exact: true }).click();
  await expect(page.locator('[data-member-count="TOTAL"]')).toHaveText('15');

  await page.reload();
  await expect(page.getByRole('link', { name: '本地体验会员' })).toBeVisible();
  await page.getByRole('link', { name: '本地体验会员' }).click();
  await expect(page.getByRole('heading', { name: '本地体验会员' })).toBeVisible();
  await expect(page.getByText('示例数据', { exact: true })).toBeVisible();
  await page.locator('.member-more summary').click();
  await page.getByRole('button', { name: '归档', exact: true }).click();
  await page.getByRole('button', { name: '确认归档' }).click();
  await expect(page.locator('[data-member-restore]')).toBeAttached();
  await page.locator('.member-more summary').click();
  await page.getByRole('button', { name: '恢复会员' }).click();
  await expect(page.locator('[data-member-archive]')).toBeAttached();

  const memberUrl = page.url();
  await page.locator('[data-member-next-session]').click();
  await expect(page.locator('[data-save-member-session]')).toContainText('本地体验会员');
  await page.locator('[data-save-member-session]').click();
  const save = page.locator('[data-member-save-dialog]');
  await expect(save).toContainText('示例数据');
  await save.locator('[data-member-save-select]').selectOption({ label: '本地体验会员' });
  await save.locator('[data-member-save-submit]').click();
  await expect(save.locator('[data-member-save-status]')).toContainText('待训练');
  await page.goto(memberUrl);
  await expect(page.locator('[data-timeline-session] [data-session-status="PLANNED"]')).toBeVisible();
  expect(memberRequests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('7fit_case_admin_session'))).toBeNull();

  const other = await browser.newPage({ baseURL: 'http://127.0.0.1:4173' });
  try {
    await other.addInitScript(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({
      token: 'expired-staff-session', expiresAt: '2000-01-01T00:00:00.000Z',
    })));
    await other.goto('/#/coach/members');
    await expect(other.locator('[data-member-count="TOTAL"]')).toHaveText('14');
    await expect(other.getByRole('link', { name: '本地体验会员' })).toHaveCount(0);
  } finally {
    await other.close();
  }
});
