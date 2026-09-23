const { test, expect } = require('@playwright/test');

const composeUrl = '/index.html#/coach/f111/compose?level=L2&lower=squat&upper=horizontal_pull&core=anti_extension';

async function openComposer(page, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(composeUrl);
  await expect(page.locator('.f111-prep-section')).toBeVisible();
  await expect(page.locator('.f111-strength-section')).toBeVisible();
}

test('F111 prep and strength cards align replacement controls, typography, and surfaces at 390px and 428px', async ({ page }, testInfo) => {
  for (const width of [390, 428]) {
    await openComposer(page, width);

    const result = await page.evaluate(() => {
      const examples = [
        { name: 'foam', card: document.querySelector('.f111-foam-card'), title: document.querySelector('.f111-foam-main b'), button: document.querySelector('.f111-foam-card .f111-replace-trigger') },
        { name: 'warmup', card: document.querySelector('.prep-slot-card'), title: document.querySelector('.prep-slot-card .prep-card-action b'), button: document.querySelector('.prep-slot-card .f111-replace-trigger') },
        { name: 'strength', card: document.querySelector('.f111-slot-card[data-composer-slot="A"]'), title: document.querySelector('.f111-slot-card[data-composer-slot="A"] .f111-slot-main h3'), button: document.querySelector('.f111-slot-card[data-composer-slot="A"] .f111-replace-trigger') },
      ];
      const rect = element => {
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      };
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        columns: [
          getComputedStyle(document.querySelector('.f111-prep-section .foam-grid')).gridTemplateColumns.split(' ').length,
          getComputedStyle(document.querySelector('.f111-prep-section .prep-slot-grid')).gridTemplateColumns.split(' ').length,
          getComputedStyle(document.querySelector('.f111-strength-grid')).gridTemplateColumns.split(' ').length,
        ],
        cards: examples.map(({ name, card, title, button }) => {
          const buttonRect = rect(button);
          const labelRect = rect(button.querySelector('span'));
          const caretRect = rect(button.querySelector('i'));
          return {
            name,
            background: getComputedStyle(card).backgroundColor,
            titleSize: getComputedStyle(title).fontSize,
            button: {
              width: buttonRect.width,
              height: buttonRect.height,
              visualHeight: parseFloat(getComputedStyle(button, '::before').height),
              fontSize: getComputedStyle(button).fontSize,
              color: getComputedStyle(button.querySelector('span')).color,
              background: getComputedStyle(button.querySelector('span')).backgroundColor,
              padding: getComputedStyle(button.querySelector('span')).padding,
              centered: Math.abs((labelRect.x + caretRect.x + caretRect.width) / 2 - (buttonRect.x + buttonRect.width / 2)) < 1,
              touchExpansion: getComputedStyle(button, '::after').inset,
            },
            warmupButtonInHeader: name !== 'warmup' || !!button.closest('.prep-card-meta'),
          };
        }),
      };
    });

    expect(result.clientWidth, `viewport ${width}px`).toBe(width);
    expect(result.scrollWidth, `horizontal overflow at ${width}px`).toBe(result.clientWidth);
    expect(result.columns, `paired F111 grids at ${width}px`).toEqual([2, 2, 2]);
    expect(result.cards.map(card => card.background), `F111 card surfaces at ${width}px`).toEqual([
      'rgb(255, 255, 255)', 'rgb(255, 255, 255)', 'rgb(255, 255, 255)',
    ]);
    expect(result.cards.map(card => card.titleSize), `action title scale at ${width}px`).toEqual(['14px', '14px', '14px']);
    expect(result.cards.map(card => card.button), `replacement control geometry at ${width}px`).toEqual([
      { width: 44, height: 44, visualHeight: 28, fontSize: '9px', color: 'rgb(31, 27, 45)', background: 'rgba(0, 0, 0, 0)', padding: '0px', centered: true, touchExpansion: 'auto' },
      { width: 44, height: 44, visualHeight: 28, fontSize: '9px', color: 'rgb(31, 27, 45)', background: 'rgba(0, 0, 0, 0)', padding: '0px', centered: true, touchExpansion: 'auto' },
      { width: 44, height: 44, visualHeight: 28, fontSize: '9px', color: 'rgb(31, 27, 45)', background: 'rgba(0, 0, 0, 0)', padding: '0px', centered: true, touchExpansion: 'auto' },
    ]);
    expect(result.cards.map(card => card.warmupButtonInHeader)).toEqual([true, true, true]);

    await page.locator('.f111-prep-section').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`f111-mobile-${width}-prep.png`) });
    await page.locator('.f111-strength-section').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`f111-mobile-${width}-strength.png`) });
  }
});

test('replacement and C/CORE action drawers still open, select, and close', async ({ page }) => {
  await openComposer(page, 390);
  const actionDrawer = page.locator('#f111-action-drawer');

  const foamCard = page.locator('.f111-foam-card').first();
  const foamButton = foamCard.locator('[data-replacement-drawer]');
  await foamButton.click();
  await expect(actionDrawer).toBeVisible();
  await expect(actionDrawer.locator('#f111-action-drawer-title')).toHaveText('泡沫轴｜替换动作');
  const foamChoice = actionDrawer.locator('.f111-drawer-action:not([disabled]):not(.is-current)').first();
  await expect(foamChoice).toBeVisible();
  await foamChoice.click();
  await expect(actionDrawer).toBeHidden();

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
