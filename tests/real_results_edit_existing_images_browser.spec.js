const { test, expect } = require('@playwright/test');

test('editing a cloud case shows existing comparison images and uses 修改案例', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await page.addInitScript(() => {
    localStorage.setItem('7fit_case_admin_key', 'test-key');
  });

  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6W1sAAAAASUVORK5CYII=';

  await page.route('**/functions/v1/case-api**', async route => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action');
    if (action === 'verify-admin') {
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
            category: '减脂塑形',
            height_cm: 162,
            start_weight_kg: 55,
            age: 35,
            cover_view: 'front',
            process_text: '测试过程',
            metrics: [],
            status: 'published',
            created_at: '2026-09-19T00:00:00Z',
            updated_at: '2026-09-19T00:00:00Z',
            case_assets: [
              { id: 'a1', kind: 'comparison_front', storage_path: 'front.png', sort_order: 0, url: pixel },
              { id: 'a2', kind: 'comparison_side', storage_path: 'side.png', sort_order: 0, url: pixel },
              { id: 'a3', kind: 'comparison_back', storage_path: 'back.png', sort_order: 0, url: pixel }
            ]
          }]
        })
      });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/assets/real-results/?admin=1');
  await page.waitForFunction(() => document.documentElement.dataset.casePatchReady === '1');
  await expect(page.locator('.card')).toHaveCount(1);

  await page.click('.card');
  await expect(page.locator('#detail')).toBeVisible();
  await page.click('.edit-case-btn');

  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#form .paneltop h2')).toHaveText('编辑案例');
  await expect(page.locator('#form .primary')).toHaveText('修改案例');

  for (const view of ['front', 'side', 'back']) {
    const host = page.locator('#form [data-existing="' + view + '"]');
    await expect(host.locator('img')).toHaveCount(1);
    await expect(host).toContainText('当前已上传');
    await expect(host).toContainText('重新选择图片后将替换');
  }

  await page.click('#cancel');
  await page.click('#openUpload');
  await expect(page.locator('#form .primary')).toHaveText('保存案例');
  await expect(page.locator('#form [data-existing] img')).toHaveCount(0);
});
