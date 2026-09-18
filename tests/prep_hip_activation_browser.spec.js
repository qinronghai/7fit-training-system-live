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

test('hip-focused activation cards respect squat and hinge patterns at mobile width',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/system/prep?pattern=%E8%B9%B2&level=L1&tier=T1');
  await expect(page.locator('[data-prep-id="PREP-52"]')).toBeVisible();
  await expect(page.locator('[data-prep-id="PREP-16"]')).toBeVisible();
  await expect(page.locator('[data-prep-id="PREP-53"]')).toHaveCount(0);
  await expect(page.locator('[data-prep-id="PREP-54"]')).toHaveCount(0);
  await expectNoOverflow(page,390);

  await page.goto('/#/system/prep?pattern=%E9%AB%8B%E9%93%B0%E9%93%BE&level=L4&tier=T4');
  await expect(page.locator('[data-prep-id="PREP-54"]')).toBeVisible();
  await expectNoOverflow(page,390);
  expect(diag.pageErrors,'pageerror must stay empty').toEqual([]);
  expect(diag.consoleProblems,'console error/warning must stay empty').toEqual([]);
});

test('coach defaults progress by level and keep primer aligned to the lower mode',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});

  async function defaults(level){
    await page.goto(`/#/coach/f111/f111-07/${level}`);
    await expect(page.locator('[data-prep-slot-card]')).toHaveCount(5);
    return page.locator('[data-prep-slot-card]').evaluateAll(cards=>cards.map(card=>({
      key:card.getAttribute('data-prep-slot-card'),
      text:card.innerText,
    })));
  }

  const l3=await defaults('l3'),l4=await defaults('l4');
  expect(l3.map(card=>card.text)).not.toEqual(l4.map(card=>card.text));
  expect(l4.some(card=>/\bP[34]\b/.test(card.text))).toBeTruthy();
  expect(l3.find(card=>card.key==='PRIMER').text).not.toContain('弹力带前平举位肩外旋');
  await expectNoOverflow(page,390);
  expect(diag.pageErrors,'pageerror must stay empty').toEqual([]);
  expect(diag.consoleProblems,'console error/warning must stay empty').toEqual([]);
});
