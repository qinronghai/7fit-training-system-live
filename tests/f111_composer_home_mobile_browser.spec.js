const { test, expect } = require('@playwright/test');

test('F111 home opens the free composer directly and keeps every chooser in a bottom sheet', async ({ page }) => {
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111');

  await expect(page.locator('.f111-compose-hero h1')).toHaveText('F111｜女性综合训练');
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);
  await expect(page.locator('.f111-preset-browser-section')).toHaveCount(0);
  await expect(page.locator('.coach-mode-switch')).toHaveCount(0);
  await expect(page.getByText('7Fit 推荐预设',{exact:true})).toHaveCount(0);
  await expect(page.locator('#page-subtitle')).toHaveText('女性综合 1+1+1');

  const levelLink=page.locator('.f111-level-switch a').filter({hasText:'L2'});
  await levelLink.click();
  await expect(page).toHaveURL(/#\/coach\/f111\?level=L2/);
  await expect(page.locator('.composer-slot-card')).toHaveCount(6);

  const drawer=page.locator('#f111-action-drawer');
  await page.locator('[data-f111-mode-drawer="upper"]').click();
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveClass(/is-open/);
  await expect(drawer.locator('#f111-action-drawer-title')).toHaveText('选择上肢模式');
  await drawer.locator('.f111-action-drawer-panel').evaluate(panel=>Promise.all(panel.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
  const sheet=await drawer.locator('.f111-action-drawer-panel').boundingBox();
  const radius=await drawer.locator('.f111-action-drawer-panel').evaluate(panel=>{
    const style=getComputedStyle(panel);
    return [style.borderTopLeftRadius,style.borderTopRightRadius,style.borderBottomRightRadius,style.borderBottomLeftRadius];
  });
  expect(sheet.y).toBeGreaterThan(0);
  expect(sheet.height).toBeLessThan(844);
  expect(sheet.x).toBe(0);
  expect(sheet.width).toBe(390);
  expect(Math.abs((sheet.y+sheet.height)-844)).toBeLessThan(2);
  expect(radius).toEqual(['28px','28px','0px','0px']);
  const current=drawer.locator('.f111-drawer-option.is-current');
  await expect(current).toHaveCount(1);
  await expect.poll(()=>current.evaluate(node=>getComputedStyle(node).borderWidth)).toBe('1px');
  await drawer.locator('.f111-action-drawer-close').click();

  const cardio=page.locator('.post-cardio-section');
  await cardio.scrollIntoViewIfNeeded();
  const cardioChoice=cardio.locator('[data-f111-option-drawer]').first();
  await cardioChoice.click();
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveClass(/is-open/);
  await expect(drawer.locator('#f111-action-drawer-title')).toHaveText('器械');
  await drawer.locator('[data-f111-option-choice]').filter({hasText:'楼梯机'}).click();
  await expect(drawer).toBeHidden();
  await expect(cardio.locator('.post-cardio-summary')).toContainText('楼梯机');
  await expect(page.locator('.post-cardio-section [data-f111-option-drawer]')).toHaveCount(3);

  const result=await page.evaluate(()=>({
    viewportWidth:window.innerWidth,
    width:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    timeBadgeHeight:document.querySelector('.f111-strength-section .time-badge').getBoundingClientRect().height,
    timeBadgeLineHeight:parseFloat(getComputedStyle(document.querySelector('.f111-strength-section .time-badge')).lineHeight),
    timeBadgeWhiteSpace:getComputedStyle(document.querySelector('.f111-strength-section .time-badge')).whiteSpace,
    chipSize:parseFloat(getComputedStyle(document.querySelector('.f111-compose-hero .chip')).fontSize),
    supportGap:getComputedStyle(document.querySelector('.f111-strength-grid')).rowGap,
    coreHeader:getComputedStyle(document.querySelector('.f111-support-grid .composer-slot-head>div')).display,
    coreHeaderRows:Array.from(document.querySelectorAll('.f111-support-grid .f111-slot-card')).map(card=>{
      const [label,grade]=card.querySelectorAll('.composer-slot-head>div>*');
      const labelRect=label.getBoundingClientRect(),gradeRect=grade.getBoundingClientRect();
      return {
        labelRight:labelRect.right,
        gradeLeft:gradeRect.left,
        verticalOverlap:Math.min(labelRect.bottom,gradeRect.bottom)-Math.max(labelRect.top,gradeRect.top),
      };
    }),
  }));
  expect(result.viewportWidth).toBe(390);
  expect(result.scrollWidth).toBeLessThanOrEqual(result.width);
  expect(result.timeBadgeHeight).toBeLessThanOrEqual(30);
  expect(result.timeBadgeWhiteSpace).toBe('nowrap');
  expect(result.chipSize).toBeGreaterThanOrEqual(10);
  expect(result.coreHeader).toBe('flex');
  expect(result.coreHeaderRows).toHaveLength(2);
  expect(result.coreHeaderRows.every(row=>row.labelRight<=row.gradeLeft+1&&row.verticalOverlap>0)).toBeTruthy();
  expect(errors).toEqual([]);

  await page.setViewportSize({width:1200,height:900});
  await page.goto('/#/coach/f111/compose');
  await page.locator('[data-f111-mode-drawer="upper"]').click();
  await expect(page.locator('#f111-action-drawer')).toBeVisible();
  await expect(page.locator('#f111-action-drawer')).toHaveClass(/is-open/);
  const desktopSheet=await page.locator('#f111-action-drawer .f111-action-drawer-panel').boundingBox();
  expect(desktopSheet.height).toBe(900);
  expect(desktopSheet.width).toBeGreaterThanOrEqual(360);
  expect(errors).toEqual([]);
});
