const { test, expect } = require('@playwright/test');

test('the default directory uses the real API only after authorizing this browser', async ({ page }) => {
  const code = 'menroll_' + 'x'.repeat(43);
  const expiresAt = new Date(Date.now() + 30 * 86400 * 1000).toISOString();
  const requests = [];
  let deviceToken = null;
  await page.route('**/functions/v1/member-api**', async route => {
    const request = route.request();
    const action = new URL(request.url()).searchParams.get('action');
    requests.push(action);
    if (action === 'redeem-device') {
      const body = request.postDataJSON();
      expect(body.code).toBe(code);
      expect(body.token).toMatch(/^mdev_[A-Za-z0-9_-]{43}$/);
      expect(request.headers().authorization).toBeUndefined();
      if (deviceToken) expect(body.token).toBe(deviceToken);
      deviceToken = body.token;
      if (requests.length === 1) return route.abort();
      return route.fulfill({ json: { expiresAt } });
    }
    expect(request.headers().authorization).toBe(`Bearer ${deviceToken}`);
    return route.fulfill({ json: {
      counts: { ACTIVE: 2, ARCHIVED: 0, INACTIVE: 0 },
      members: [{ id: 'e1000000-0000-4000-8000-000000000001', displayName: '正式库验收样例', status: 'ACTIVE' }],
    } });
  });

  await page.goto('/#/coach/members');
  await expect(page.locator('[data-member-auth-recovery]')).toContainText('设备授权链接');
  await expect(page.getByText('示例数据', { exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);

  await page.goto(`/?activate-device=1#/coach/members?device-access=${code}`);
  await expect(page.locator('[data-member-error]')).toContainText('会员列表暂时无法读取');
  await expect(page).toHaveURL(/\/#\/coach\/members$/);
  await page.reload();
  await expect(page.locator('[data-member-count="TOTAL"]')).toHaveText('2');
  await expect(page.getByRole('link', { name: '正式库验收样例' })).toBeVisible();
  await expect(page.locator('[data-member-auth-recovery]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: '正式库验收样例' })).toBeVisible();
  expect(requests).toEqual(['redeem-device', 'redeem-device', 'list-members', 'list-members']);
  expect(await page.evaluate(() => sessionStorage.getItem('7fit_member_pending_device'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('7fit_case_admin_session'))).toBeNull();
});
