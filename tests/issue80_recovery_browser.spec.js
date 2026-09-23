const { test, expect } = require('@playwright/test');

function diagnostics(page){
  const pageErrors=[],consoleProblems=[];
  page.on('pageerror',error=>pageErrors.push(error.message||String(error)));
  page.on('console',msg=>{if(['error','warning'].includes(msg.type()))consoleProblems.push(msg.type()+': '+msg.text());});
  return {pageErrors,consoleProblems};
}

async function expectNoOverflow(page,width){
  const sizes=await page.evaluate(()=>({
    htmlScroll:document.documentElement.scrollWidth,
    htmlClient:document.documentElement.clientWidth,
    bodyScroll:document.body.scrollWidth,
  }));
  expect(sizes.htmlClient).toBe(width);
  expect(sizes.htmlScroll).toBe(sizes.htmlClient);
  expect(sizes.bodyScroll).toBeLessThanOrEqual(sizes.htmlClient);
}

async function expectRecovery(page,{compact=false}={}){
  const section=page.locator('[data-f111-recovery]');
  await expect(section).toHaveCount(1);
  await expect(section.getByRole('heading',{name:compact?'训练后拉伸｜约 5–8 分钟':'完成拉伸｜约 5–8 分钟'})).toBeVisible();
  await expect(section).toContainText('训练结束后完成 3 个主要部位拉伸。');
  if(compact){
    const rows=section.locator('.recovery-row[data-recovery-card]');
    await expect(rows).toHaveCount(3);
    await expect(section.locator('.recovery-detail-link')).toHaveCount(0);
    const rowText=await rows.allTextContents();
    expect(rowText.every(text=>!text.includes('主要部位'))).toBe(true);
    for(let i=0;i<3;i++){
      await expect(rows.nth(i).locator('.recovery-row-region')).not.toBeEmpty();
      await expect(rows.nth(i).locator('.recovery-row-main b')).not.toBeEmpty();
      await expect(rows.nth(i).locator('.recovery-prescription')).toContainText('45 秒');
    }
  }else{
    const cards=section.locator('[data-recovery-card]');
    await expect(cards).toHaveCount(3);
    for(let i=0;i<3;i++)await expect(cards.nth(i)).toContainText('45 秒');
    await expect(section.getByRole('link',{name:'查看动作详情'})).toHaveCount(3);
  }
  await expect(section).not.toContainText('2F 体能热身大厅');
  await expect(section).not.toContainText('一次上楼');
  return section;
}

test('Issue 80: preset and composer render three data-driven Recovery cards',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:1080,height:844});

  await page.goto('/#/coach/f111/f111-01/l1');
  await expectRecovery(page);
  await expectNoOverflow(page,1080);

  await page.goto('/#/coach/f111/compose?level=L1&lower=squat&upper=horizontal_push&core=anti_extension');
  await expectRecovery(page,{compact:true});
  await expectNoOverflow(page,1080);

  expect(diag.pageErrors,`pageerror(s): ${diag.pageErrors.join(' | ')}`).toEqual([]);
  expect(diag.consoleProblems,`console problem(s): ${diag.consoleProblems.join(' | ')}`).toEqual([]);
});

test('Issue 80: Recovery is one column on mobile and three columns on desktop',async({page})=>{
  const diag=diagnostics(page);
  for(const width of [390,1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/coach/f111/f111-04/l3');
    const section=await expectRecovery(page);
    const columns=await section.locator('.recovery-grid').evaluate(node=>getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
    expect(columns).toBe(width===390?1:3);
    await expectNoOverflow(page,width);
  }
  expect(diag.pageErrors,`pageerror(s): ${diag.pageErrors.join(' | ')}`).toEqual([]);
  expect(diag.consoleProblems,`console problem(s): ${diag.consoleProblems.join(' | ')}`).toEqual([]);
});

test('Issue 80: compact recovery rows open the existing Library drawer',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/compose?level=L3&lower=single_leg_hinge&upper=horizontal_push&core=anti_extension');
  const section=await expectRecovery(page,{compact:true});
  const firstLink=section.locator('.recovery-row[data-recovery-card]').first();
  const actionName=await firstLink.locator('.recovery-row-main b').innerText();
  await expect(firstLink).toHaveAttribute('href',/#\/library\?focus=.+/);
  await firstLink.click();
  await expect(page).toHaveURL(/#\/library\?focus=.+/);
  await expect(page.locator('#global-drawer')).toBeVisible();
  await expect(page.locator('#global-drawer')).toContainText(actionName);
  await expectNoOverflow(page,390);
  expect(diag.pageErrors,`pageerror(s): ${diag.pageErrors.join(' | ')}`).toEqual([]);
  expect(diag.consoleProblems,`console problem(s): ${diag.consoleProblems.join(' | ')}`).toEqual([]);
});
