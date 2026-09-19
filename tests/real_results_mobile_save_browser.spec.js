const { test, expect } = require('@playwright/test');

test('mobile save button always responds and can complete cloud save', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.addInitScript(() => {
    localStorage.setItem('7fit_case_admin_key', 'test-key');
  });

  await page.route('**/functions/v1/case-api**', async route => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action');
    if (action === 'list') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ cases: [] }) });
    }
    if (action === 'verify-admin') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    if (action === 'save-case') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ case: { id: '11111111-1111-4111-8111-111111111111' } })
      });
    }
    if (action === 'upload') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ asset: { id: 'asset-1', url: 'https://example.invalid/image.jpg' } })
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/assets/real-results/?admin=1');
  await page.waitForSelector('#openUpload');
  await page.waitForFunction(() => document.documentElement.dataset.casePatchReady === '1');
  await page.click('#openUpload');
  await expect(page.locator('#modal')).toBeVisible();

  // Regression: Safari native required validation used to swallow this click.
  await page.click('#form .primary');
  await expect(page.locator('#toast')).toContainText('请先填写会员显示名称');

  await page.fill('#form input[name="name"]', '测试会员');
  await page.check('#form input[name="coverView"][value="front"]');

  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6W1sAAAAASUVORK5CYII=',
    'base64'
  );
  await page.setInputFiles('#form input[name="frontImage"]', {
    name: 'front.png',
    mimeType: 'image/png',
    buffer: png,
  });

  await page.click('#form .primary');
  await expect(page.locator('#toast')).toContainText('案例已上传到云端', { timeout: 10_000 });
  await expect(page.locator('#modal')).toBeHidden();
});
