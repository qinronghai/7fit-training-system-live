const { test, expect } = require('@playwright/test');

test('real results uses a PIN login and remembers the admin session', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.clear());

  await page.route('**/functions/v1/case-api**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.searchParams.get('action');
    const auth = request.headers().authorization || '';
    if (action === 'list') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }) });
    }
    if (action === 'admin-session') {
      return route.fulfill({
        status: auth === 'Bearer session-token' ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(auth === 'Bearer session-token' ? { ok: true, expiresAt: '2026-10-22T10:00:00.000Z' } : { error: 'unauthorized' }),
      });
    }
    if (action === 'admin-login') {
      const body = JSON.parse(request.postData() || '{}');
      return route.fulfill({
        status: body.pin === '123456' ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(body.pin === '123456'
          ? { ok: true, session: { token: 'session-token', expiresAt: '2026-10-22T10:00:00.000Z' } }
          : { error: 'invalid_pin' }),
      });
    }
    if (action === 'admin-logout') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.goto('/assets/real-results/?admin=1');
  await page.waitForFunction(() => document.documentElement.dataset.casePatchReady === '1');

  await expect(page.locator('#openUpload')).toHaveText('馆主登录');
  await page.click('#openUpload');
  await expect(page.locator('#adminLoginModal')).toBeVisible();
  await page.fill('#adminPin', '123456');
  await page.click('#adminLoginSubmit');

  await expect(page.locator('#openUpload')).toHaveText('＋ 上传案例');
  await expect(page.locator('#adminLogout')).toBeVisible();
  expect(await page.evaluate(() => ({
    oldKey: localStorage.getItem('7fit_case_admin_key'),
    session: JSON.parse(localStorage.getItem('7fit_case_admin_session') || '{}'),
  }))).toEqual({
    oldKey: null,
    session: { token: 'session-token', expiresAt: '2026-10-22T10:00:00.000Z' },
  });

  await page.click('#adminLogout');
  await expect(page.locator('#openUpload')).toHaveText('馆主登录');
  expect(await page.evaluate(() => localStorage.getItem('7fit_case_admin_session'))).toBeNull();
});

test('real results restores a valid admin session after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({ token: 'session-token', expiresAt: '2026-10-22T10:00:00.000Z' })));

  await page.route('**/functions/v1/case-api**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.searchParams.get('action');
    if (action === 'list') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }) });
    if (action === 'admin-session') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, expiresAt: '2026-10-22T10:00:00.000Z' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.goto('/assets/real-results/?admin=1');
  await page.waitForFunction(() => document.documentElement.dataset.casePatchReady === '1');
  await expect(page.locator('#openUpload')).toHaveText('＋ 上传案例');
});

test('real results rejects a wrong PIN and clears an expired session', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.clear());

  await page.route('**/functions/v1/case-api**', async route => {
    const request = route.request();
    const action = new URL(request.url()).searchParams.get('action');
    if (action === 'list') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }) });
    if (action === 'admin-session') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) });
    if (action === 'admin-login') return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_pin' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
  });

  await page.goto('/assets/real-results/?admin=1');
  await page.waitForFunction(() => document.documentElement.dataset.casePatchReady === '1');
  await page.click('#openUpload');
  await page.fill('#adminPin', '000000');
  await page.click('#adminLoginSubmit');
  await expect(page.locator('#adminLoginError')).toHaveText('PIN 不正确，请重新输入');
  expect(await page.evaluate(() => localStorage.getItem('7fit_case_admin_session'))).toBeNull();

  await page.evaluate(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({ token: 'expired-token', expiresAt: '2026-10-22T10:00:00.000Z' })));
  await page.reload();
  await page.waitForFunction(() => document.documentElement.dataset.casePatchReady === '1');
  await expect(page.locator('#openUpload')).toHaveText('馆主登录');
  expect(await page.evaluate(() => localStorage.getItem('7fit_case_admin_session'))).toBeNull();
});
