const { test, expect } = require('@playwright/test');

const widths = [320, 350, 375, 390, 430, 600];

for (const width of widths) {
  test(`real results stays responsive at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/assets/real-results/?admin=1');
    await page.waitForSelector('.topbar', { timeout: 10_000 });
    await page.waitForSelector('.filters', { timeout: 10_000 });

    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      body: document.body.scrollWidth - document.body.clientWidth,
    }));
    expect(overflow.doc).toBeLessThanOrEqual(1);
    expect(overflow.body).toBeLessThanOrEqual(1);

    const upload = page.locator('#openUpload');
    await expect(upload).toBeVisible();
    const uploadBox = await upload.boundingBox();
    expect(uploadBox.width).toBeLessThan(width * 0.42);
    expect(uploadBox.height).toBeLessThanOrEqual(42);
    expect(await upload.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');

    const topbar = page.locator('.topbar');
    const topbarBox = await topbar.boundingBox();
    expect(topbarBox.x).toBeGreaterThanOrEqual(0);
    expect(topbarBox.x + topbarBox.width).toBeLessThanOrEqual(width + 1);

    const filters = page.locator('.filter');
    const count = await filters.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      expect(await filters.nth(i).evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');
      const box = await filters.nth(i).boundingBox();
      expect(box.height).toBeLessThanOrEqual(40);
    }

    const viewportBucket = await page.evaluate(() => document.documentElement.dataset.viewport);
    if (width <= 350) expect(viewportBucket).toBe('xxs');
    else if (width <= 390) expect(viewportBucket).toBe('xs');
    else if (width <= 600) expect(viewportBucket).toBe('sm');
  });
}
