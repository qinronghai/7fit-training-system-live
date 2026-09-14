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

test('Issue 71: F111 PREP CTA stays horizontal and pages have no literal newline residue',async({page})=>{
  const diag=diagnostics(page);
  for(const width of [390,1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/coach/f111/f111-01/l1');
    await expect(page.locator('.prep-slot-card')).toHaveCount(5);
    const detail=page.locator('.prep-detail-link').first();
    await expect(detail).toBeVisible();
    const metrics=await detail.evaluate(node=>({
      whiteSpace:getComputedStyle(node).whiteSpace,
      width:node.getBoundingClientRect().width,
      height:node.getBoundingClientRect().height,
      text:node.textContent,
    }));
    expect(metrics.whiteSpace).toBe('nowrap');
    expect(metrics.width).toBeGreaterThan(70);
    expect(metrics.height).toBeLessThanOrEqual(48);
    expect(metrics.text).toContain('查看动作详情');
    const bodyText=await page.locator('body').innerText();
    expect(bodyText).not.toContain('\\n');
    await expectNoOverflow(page,width);
  }
  await expectClean(diag);
});

test('Issue 71: native PREP select exposes AX name and supports keyboard selection',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/f111/f111-06/l3');
  const selects=page.locator('.prep-slot-select:not([disabled])');
  let target=null;
  for(let i=0;i<await selects.count();i+=1){
    const select=selects.nth(i);
    const values=await select.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value).filter(Boolean));
    const current=await select.inputValue();
    const index=values.indexOf(current);
    if(values.length<2||index<0)continue;
    const direction=index<values.length-1?'ArrowDown':'ArrowUp';
    const expected=direction==='ArrowDown'?values[index+1]:values[index-1];
    target={slotKey:await select.getAttribute('data-prep-slot'),direction,expected};
    await expect(select).toHaveAttribute('aria-label',/热身动作替换/);
    await select.focus();
    await page.keyboard.press(direction);
    break;
  }
  expect(target,'expected one keyboard-replaceable PREP select').toBeTruthy();
  const refreshed=page.locator('.prep-slot-select[data-prep-slot="'+target.slotKey+'"]');
  await expect(refreshed).toHaveValue(target.expected);
  await expectNoOverflow(page,390);
  await expectClean(diag);
});

test('Issue 71: library filters are responsive at mobile and desktop audit widths',async({page})=>{
  const diag=diagnostics(page);
  for(const width of [390,1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/library');
    await expect(page.locator('.template-search-controls')).toBeVisible();
    await expect(page.locator('[data-filter]')).toHaveCount(8);
    const boxes=await page.locator('.template-search-controls > *').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().width));
    expect(boxes.every(value=>value>0&&value<=width)).toBeTruthy();
    await expectNoOverflow(page,width);
  }
  await expectClean(diag);
});

test('Issue 71: Conditioning L1 Primer is either legal or explicitly explained',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/conditioning/con-02/l1');
  const primer=page.locator('[data-conditioning-prep-slot-card="PRIMER"]');
  await expect(primer).toBeVisible();
  const select=primer.locator('.conditioning-prep-select');
  await expect(select).toHaveAttribute('aria-label',/Conditioning 热身动作替换/);
  if(await select.isDisabled()){
    await expect(primer.locator('[data-conditioning-prep-empty="PRIMER"]')).toContainText('当前等级、冲击和动作模式约束下没有合法 Primer');
    await expect(primer.locator('[data-conditioning-prep-empty="PRIMER"]')).toContainText('本槽可以安全跳过');
    await expect(primer.getByRole('link',{name:'查看 PREP 规则 / 人工安排参考'})).toBeVisible();
  }else{
    expect(await select.locator('option').count()).toBeGreaterThan(0);
  }
  await expectNoOverflow(page,390);
  await expectClean(diag);
});


test('Issue 71: primary routes never expose literal newline residue',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  for(const route of ['/#/coach','/#/system/prep','/#/rules/venue','/#/library','/#/maintenance/venue']){
    await page.goto(route);
    const bodyText=await page.locator('body').innerText();
    expect(bodyText,'literal newline residue on '+route).not.toContain('\\n');
    await expectNoOverflow(page,390);
  }
  await expectClean(diag);
});
