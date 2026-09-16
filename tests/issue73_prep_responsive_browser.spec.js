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

test('Issue 73: PREP CTA keeps a complete horizontal click target at mobile and desktop widths',async({page})=>{
  const diag=diagnostics(page);
  for(const width of [390,1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    await page.goto('/#/coach/f111/f111-01/l1');
    await expect(page.locator('.prep-slot-card')).toHaveCount(5);
    const detail=page.locator('.prep-detail-link').first();
    await expect(detail).toBeVisible();
    const metrics=await detail.evaluate(node=>{
      const parent=node.parentElement;
      return {
        whiteSpace:getComputedStyle(node).whiteSpace,
        width:node.getBoundingClientRect().width,
        height:node.getBoundingClientRect().height,
        parentDisplay:getComputedStyle(parent).display,
        parentColumns:getComputedStyle(parent).gridTemplateColumns,
        parentWidth:parent.getBoundingClientRect().width,
      };
    });
    expect(metrics.whiteSpace).toBe('nowrap');
    expect(metrics.width).toBeGreaterThan(70);
    expect(metrics.height).toBeLessThanOrEqual(48);
    expect(metrics.parentDisplay).toBe('grid');
    if(width<=620){
      expect(metrics.parentColumns.trim().split(/\s+/)).toHaveLength(1);
      expect(metrics.width).toBeGreaterThanOrEqual(metrics.parentWidth-2);
    }else{
      expect(metrics.parentColumns.trim().split(/\s+/)).toHaveLength(2);
    }
    await expectNoOverflow(page,width);
  }
  await expectClean(diag);
});

test('Issue 73: PREP replacement remains keyboard-operable after rerender',async({page})=>{
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
