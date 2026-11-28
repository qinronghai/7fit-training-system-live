const { test, expect } = require('@playwright/test');

const composeUrl = '/index.html#/coach/f111/compose?level=L2&lower=squat&upper=horizontal_pull&core=anti_extension';

async function openComposer(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(composeUrl);
  await expect(page.locator('.f111-prep-section')).toBeVisible();
  await expect(page.locator('.f111-strength-section')).toBeVisible();
}

test('F111 shows two main cards, four accessory rows, and a reachable action bar', async ({ page }, testInfo) => {
  for (const width of [320, 390, 428, 1440]) {
    await openComposer(page, width);
    const prep = page.locator('.f111-prep-section');
    const main = page.locator('.f111-strength-grid .f111-slot-card');
    const accessories = page.locator('.f111-accessory-list .f111-slot-card');
    await expect(prep.locator('.f111-foam-card').first()).toBeHidden();
    await expect(prep.locator('.prep-slot-card')).toHaveCount(5);
    await expect(prep.locator('.prep-slot-card').first()).toBeVisible();
    await expect(prep.locator('.prep-slot-card p').first()).toHaveCSS('font-size', '12px');
    await expect(main).toHaveCount(2);
    await expect(accessories).toHaveCount(4);
    await expect(main.first().locator('h3 a')).toHaveAttribute('href', /#\/library\?focus=/);
    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('#mobile-nav').getBoundingClientRect();
      const footer = document.querySelector('.f111-course-output-section').getBoundingClientRect();
      return {
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
        footerBottom: footer.bottom,
        navTop: nav.top,
        viewportHeight: window.innerHeight,
        targets: [...document.querySelectorAll('.f111-strength-section button')].map(button => button.getBoundingClientRect().height),
      };
    });
    expect(geometry.page).toBe(geometry.viewport);
    expect(geometry.targets).toHaveLength(6);
    expect(geometry.targets.every(height => height >= 44)).toBe(true);
    // On phones the copy/save bar replaces the tab bar and sits on the bottom edge.
    if (width < 980) expect(geometry.footerBottom).toBeCloseTo(geometry.viewportHeight, 0);
    await page.screenshot({ path: testInfo.outputPath(`f111-${width}.png`) });
  }
});

test('F111 mobile text wraps and the saved courses disclosure stays above the action bar', async ({ page }) => {
  for (const width of [320, 360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/?viewport=${width}#/coach/f111?level=L4&lower=single_leg_squat&upper=horizontal_push&core=anti_extension`);
    const lower = page.locator('[data-f111-mode-drawer="lower"] b');
    await expect(lower).toHaveText('单腿蹲 单侧膝主导');
    expect(await lower.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
    const names = await page.locator('.f111-strength-grid h3').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    expect(names[0]).toBeCloseTo(names[1], 0);
    const warmup = page.locator('[data-f111-disclosure="warmup"] .prep-slot-card');
    const edges = await warmup.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().left));
    expect(new Set(edges).size).toBe(1);
    const save = page.getByRole('button', { name: '保存到会员', exact: true });
    expect(await save.evaluate(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().height <= parseFloat(getComputedStyle(node).lineHeight);
    })).toBe(true);
    const saved = page.locator('.f111-inline-saved-list > summary');
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await saved.click({ timeout: 3000 });
    await expect(page.locator('.f111-inline-saved-list')).toHaveAttribute('open', '');
  }
});

test('replacement and C/CORE action drawers still open, select, and close', async ({ page }) => {
  await openComposer(page, 390);
  const actionDrawer = page.locator('#f111-action-drawer');
  const foam = page.locator('[data-f111-disclosure="foam"]');
  await foam.locator('summary').click();

  const foamCard = page.locator('.f111-foam-card').first();
  const foamButton = foamCard.locator('[data-replacement-drawer]');
  await foamButton.click();
  await expect(actionDrawer).toBeVisible();
  await expect(actionDrawer.locator('#f111-action-drawer-title')).toHaveText('泡沫轴｜替换动作');
  const foamChoice = actionDrawer.locator('.f111-drawer-action:not([disabled]):not(.is-current)').first();
  await expect(foamChoice).toBeVisible();
  await foamChoice.click();
  await expect(actionDrawer).toBeHidden();
  await expect(foamButton).toBeFocused();
  await expect(foam).toHaveAttribute('open', '');

  const warmupCard = page.locator('.prep-slot-card').first();
  await warmupCard.locator('[data-replacement-drawer]').click();
  await expect(actionDrawer).toBeVisible();
  const warmupChoice = actionDrawer.locator('.f111-drawer-action:not([disabled]):not(.is-current)').first();
  await expect(warmupChoice).toBeVisible();
  await warmupChoice.click();
  await expect(actionDrawer).toBeHidden();

  const supportTrigger = page.locator('.f111-slot-card[data-composer-slot="C"] [data-f111-action-drawer="C"]');
  await supportTrigger.click();
  await expect(actionDrawer).toBeVisible();
  await expect(actionDrawer.locator('.f111-drawer-group-head h3')).toHaveText([
    'S1｜基础静态支撑', 'S2｜减少支点', 'S3｜动态支撑', 'S4｜位移支撑', 'S5｜旋转支撑', 'S6｜单侧支撑',
  ]);
  const supportChoice = actionDrawer.locator('.f111-drawer-action:not(.is-disabled):not(.is-current)').first();
  await supportChoice.click();
  await expect(actionDrawer).toBeHidden();

  await page.locator('.f111-slot-card[data-composer-slot="CORE"] [data-f111-action-drawer="CORE"]').click();
  await expect(actionDrawer).toBeVisible();
  await expect(actionDrawer.locator('.f111-drawer-group-head h3')).toHaveText([
    'CORE-L1｜基础控制', 'CORE-L2｜标准抗伸展', 'CORE-L3｜多方向稳定', 'CORE-L4｜高负荷整合',
  ]);
  await page.keyboard.press('Escape');
  await expect(actionDrawer).toBeHidden();
});
