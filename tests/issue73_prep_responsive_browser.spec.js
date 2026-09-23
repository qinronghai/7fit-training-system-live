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

async function expectClean(diag){
  expect(diag.pageErrors,'pageerror must stay empty').toEqual([]);
  expect(diag.consoleProblems,'console error/warning must stay empty').toEqual([]);
}

test('Issue 73: PREP cards and replacement controls remain usable at mobile and desktop widths',async({page})=>{
  const diag=diagnostics(page);
  for(const width of [390,1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/coach/f111/f111-01/l1');
    await expect(page.locator('.prep-slot-card')).toHaveCount(5);
    const card=page.locator('.prep-slot-card').first();
    const replacement=card.locator('[data-replacement-drawer]');
    await expect(card).toHaveAttribute('data-prep-detail-href',/^#\/system\/prep\?focus=/);
    await expect(replacement).toBeVisible();
    const metrics=await replacement.evaluate(node=>{
      return {
        width:node.getBoundingClientRect().width,
        height:node.getBoundingClientRect().height,
        color:getComputedStyle(node).color,
        whiteSpace:getComputedStyle(node).whiteSpace,
      };
    });
    expect(metrics.width).toBeGreaterThanOrEqual(40);
    expect(metrics.height).toBeGreaterThanOrEqual(28);
    expect(metrics.whiteSpace).toBe('nowrap');
    expect(metrics.color).not.toBe('rgba(0, 0, 0, 0)');
    await expectNoOverflow(page,width);
  }
  await expectClean(diag);
});

test('Issue 73: PREP replacement drawer applies a legal choice and survives reload',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/f111-06/l3');
  const card=page.locator('.prep-slot-card').filter({has:page.locator('.prep-slot-select:not([disabled])')}).first();
  const select=card.locator('.prep-slot-select');
  const slotKey=await select.getAttribute('data-prep-slot');
  const current=await select.inputValue();
  await card.locator('[data-replacement-drawer]').click();
  const drawer=page.locator('#f111-action-drawer');
  await expect(drawer).toBeVisible();
  const choice=drawer.locator('.f111-drawer-action:not([disabled]):not(.is-current)').first();
  const target=await choice.getAttribute('data-f111-action-choice');
  expect(target).toBeTruthy();
  expect(target).not.toBe(current);
  await choice.click();
  await expect(drawer).toBeHidden();
  const refreshed=page.locator('.prep-slot-select[data-prep-slot="'+slotKey+'"]');
  await expect(refreshed).toHaveValue(target);
  await page.reload();
  await expect(page.locator('.prep-slot-select[data-prep-slot="'+slotKey+'"]')).toHaveValue(target);
  await expectNoOverflow(page,390);
  await expectClean(diag);
});

test('Issue 73: action-library desktop filters adapt without fixed 130px columns or overflow',async({page})=>{
  const diag=diagnostics(page);
  for(const width of [1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/library');
    const controls=page.locator('.template-search-controls');
    await expect(controls).toBeVisible();
    await expect(page.locator('[data-filter]')).toHaveCount(8);
    const layout=await controls.evaluate(node=>({
      columns:getComputedStyle(node).gridTemplateColumns,
      boxes:Array.from(node.children).map(child=>child.getBoundingClientRect().width),
    }));
    expect(layout.columns).not.toContain('130px');
    expect(layout.boxes.every(value=>value>0&&value<=width)).toBeTruthy();
    await expectNoOverflow(page,width);
  }
  await expectClean(diag);
});
