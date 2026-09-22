const { test, expect } = require('@playwright/test');

test('clicking a comparison image opens a large preview and can be closed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.addInitScript(() => {
    localStorage.setItem('7fit_case_admin_session', JSON.stringify({
      token: 'session-token',
      expiresAt: '2026-10-22T10:00:00.000Z',
    }));
  });

  const front = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="red"/></svg>';
  const side = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="green"/></svg>';
  const back = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160"><rect width="120" height="160" fill="blue"/></svg>';

  await page.route('**/functions/v1/case-api**', async route => {
    const action = new URL(route.request().url()).searchParams.get('action');
    if (action === 'admin-session') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    }
    if (action === 'list') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cases: [{
            id: '11111111-1111-4111-8111-111111111111',
            display_name: '测试会员',
            category: '体态调整',
            cover_view: 'back',
            process_text: '测试过程',
            metrics: [],
            status: 'published',
            case_assets: [
              { id: 'a1', kind: 'comparison_front', url: front, sort_order: 0 },
              { id: 'a2', kind: 'comparison_side', url: side, sort_order: 0 },
              { id: 'a3', kind: 'comparison_back', url: back, sort_order: 0 },
            ],
          }],
        }),
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/assets/real-results/?admin=1');
  await page.waitForFunction(() => document.documentElement.dataset.casePatchReady === '1');
  await page.locator('.card').click();
  await expect(page.locator('#detail')).toBeVisible();

  const image = page.locator('#detailBody .cmpimg img').first();
  const imageSrc = await image.getAttribute('src');
  await expect(image).toHaveAttribute('role', 'button');
  await expect(image).toHaveAttribute('tabindex', '0');
  await image.click();

  const lightbox = page.locator('#caseImageLightbox');
  await expect(lightbox).toBeVisible();
  await expect(lightbox.locator('img')).toHaveAttribute('src', imageSrc);
  await expect(lightbox).toContainText('点击空白处或按 Esc 关闭');

  await page.keyboard.press('Escape');
  await expect(lightbox).toBeHidden();
  await expect(page.locator('#detail')).toBeVisible();

  await image.focus();
  await page.keyboard.press('Enter');
  await expect(lightbox).toBeVisible();
  await lightbox.getByRole('button', { name: '关闭大图' }).click();
  await expect(lightbox).toBeHidden();
});
