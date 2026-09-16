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

test('Issue 13: Maintenance exposes honest review metadata and responsive filters',async({page})=>{
  const diag=diagnostics(page);
  for(const width of [390,1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/maintenance');
    await expect(page.locator('[data-content-review-panel]')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Content Review 元数据'})).toBeVisible();
    await page.locator('[data-content-review-filter="domain"]').selectOption('');
    await page.locator('[data-content-review-filter="status"]').selectOption('pending');
    await page.locator('[data-content-review-filter="evidenceLevel"]').selectOption('');
    await expect(page.locator('[data-content-review-count]')).toContainText('待审核');
    await expect(page.locator('[data-content-review-row]')).toHaveCount(80);
    await page.locator('[data-content-review-filter="domain"]').selectOption('actions');
    await expect(page.locator('[data-content-review-row]')).toHaveCount(80);
    const domains=await page.locator('[data-content-review-row]').evaluateAll(rows=>rows.map(row=>row.dataset.domain));
    expect(new Set(domains)).toEqual(new Set(['actions']));
    await page.locator('[data-content-review-filter="status"]').selectOption('reviewed');
    await expect(page.locator('[data-content-review-empty]')).toBeVisible();
    await expect(page.locator('[data-content-review-empty]')).toContainText('没有符合条件的内容');
    await expectNoOverflow(page,width);
  }
  const bodyText=await page.locator('body').innerText();
  expect(bodyText).not.toContain('\\n');
  expect(diag.pageErrors,'pageerror must stay empty').toEqual([]);
  expect(diag.consoleProblems,'console error/warning must stay empty').toEqual([]);
});
