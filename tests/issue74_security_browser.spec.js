const { test, expect } = require('@playwright/test');

function diagnostics(page){
  const pageErrors=[],consoleProblems=[];
  page.on('pageerror',error=>pageErrors.push(error.message||String(error)));
  page.on('console',message=>{
    if(['error','warning'].includes(message.type()))consoleProblems.push(message.type()+': '+message.text());
  });
  return {pageErrors,consoleProblems};
}

async function expectClean(diag,label){
  expect(diag.pageErrors,`${label} pageerror(s): ${diag.pageErrors.join(' | ')}`).toEqual([]);
  expect(diag.consoleProblems,`${label} console problem(s): ${diag.consoleProblems.join(' | ')}`).toEqual([]);
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

test('Issue 74 treats XSS search text and malformed routes as inert safe fallbacks',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/library');

  const payload='<img src=x onerror="window.__issue74Xss=1"><script>window.__issue74Xss=1</script>';
  await expect(page.locator('#action-search')).toHaveAttribute('maxlength','200');
  await page.locator('#action-search').fill(payload);
  await expect(page.locator('#action-search')).toHaveValue(payload.slice(0,200));
  expect(await page.locator('#action-results [onerror]').count()).toBe(0);
  expect(await page.locator('#action-results script').count()).toBe(0);
  expect(await page.evaluate(()=>window.__issue74Xss)).toBeUndefined();
  const overlongSearch='q'.repeat(3000);
  await page.locator('#action-search').fill(overlongSearch);
  await expect(page.locator('#action-search')).toHaveValue(overlongSearch.slice(0,200));
  await expectNoOverflow(page,390);

  for(const route of [
    '/#/library?focus=not-a-real-action%F0%9F',
    '/#/library?q=%E0%A4%A',
    '/#/coach/not-a-template/l9',
    '/#/coach/body/BODY-99/l9',
    '/#/coach/body/body-01/l9',
    '/#/coach/%E0%A4%A',
  ]){
    await page.goto(route);
    if(route.includes('/#/library')){
      await expect(page.getByRole('heading',{name:'动作与编课搜索'})).toBeVisible();
    }else{
      await expect(page.locator('#page-title')).toHaveText('页面不存在');
      await expect(page.getByRole('link',{name:'返回编课中心'})).toBeVisible();
    }
    await expectNoOverflow(page,390);
  }
  await expectClean(diag,'Issue 74 route/XSS');
});

test('Issue 74 rejects a 3000-character saved name and keeps cross-template context isolated',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-01/l1');

  const longName='x'.repeat(3000);
  await page.locator('[data-save-session-name]').fill(longName);
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('[data-saved-session-status]')).toContainText('不能超过 120 个字符');
  await expect(page.locator('.saved-session-card')).toHaveCount(0);

  await page.locator('[data-save-session-name]').fill('Body · Issue 74 boundary');
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expect(page.locator('.saved-session-card-head span')).toHaveText('Body · L1');
  await expect(page.locator('[data-saved-restore]')).toContainText('恢复到 Body L1');

  await page.goto('/#/coach/conditioning/con-01/l1');
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expect(page.locator('.saved-session-card-head span')).toHaveText('Body · L1');
  await expect(page.locator('.saved-session-notice')).toHaveCount(0);
  await expect(page.locator('[data-saved-restore]')).toContainText('恢复到 Body L1');

  await page.goto('/#/coach/f111/f111-01/l1');
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expect(page.locator('.saved-session-notice')).toHaveCount(0);
  await expect(page.locator('[data-saved-restore]')).toContainText('恢复到 Body L1');
  await expectNoOverflow(page,390);
  await expectClean(diag,'Issue 74 saved context');
});

test('Issue 74 preserves the saved record on cancelled or failed delete and restore',async({page})=>{
  const diag=diagnostics(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/body/body-02/l2');
  await page.locator('[data-save-session-name]').fill('Issue 74 failure recovery');
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('.saved-session-card')).toHaveCount(1);

  let dialogMessage='';
  await Promise.all([
    page.waitForEvent('dialog').then(async dialog=>{dialogMessage=dialog.message();await dialog.dismiss();}),
    page.locator('[data-saved-delete]').click(),
  ]);
  expect(dialogMessage).toContain('Body · L2');
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expect(page.locator('[data-saved-session-status]')).toContainText('已取消删除');

  await page.evaluate(()=>{
    window.V15SavedSessions.remove=()=>false;
    window.V15SavedSessions.restore=()=>({ok:false,message:'模拟恢复失败'});
  });
  await Promise.all([
    page.waitForEvent('dialog').then(dialog=>dialog.accept()),
    page.locator('[data-saved-delete]').click(),
  ]);
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expect(page.locator('[data-saved-session-status]')).toContainText('删除失败');

  await page.locator('[data-saved-restore]').click();
  await expect(page.locator('[data-saved-session-status]')).toContainText('模拟恢复失败');
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await expectNoOverflow(page,390);
  await expectClean(diag,'Issue 74 failure recovery');
});

test('storage write failure preserves a record across reload and allows a later confirmed delete',async({page})=>{
  await page.goto('/#/coach/body/body-02/l2');
  await page.locator('[data-save-session-name]').fill('storage transaction test');
  await page.locator('[data-save-current-session]').click();
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('quota exceeded','QuotaExceededError');};});
  await Promise.all([
    page.waitForEvent('dialog').then(dialog=>dialog.accept()),
    page.locator('[data-saved-delete]').click(),
  ]);
  await expect(page.locator('[data-saved-session-status]')).toContainText('存储写入失败');
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.saved-session-card')).toHaveCount(1);
  await Promise.all([
    page.waitForEvent('dialog').then(dialog=>dialog.accept()),
    page.locator('[data-saved-delete]').click(),
  ]);
  await expect(page.locator('.saved-session-card')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.saved-session-card')).toHaveCount(0);
});

test('Issue 74 covered Coach, Body, Conditioning and Library routes have no overflow at required widths',async({page})=>{
  const diag=diagnostics(page);
  const routes=['/#/coach','/#/coach/f111/f111-01/l1','/#/coach/body/body-01/l1','/#/coach/conditioning/con-01/l1','/#/library'];
  for(const width of [390,1080,1280,1440]){
    await page.setViewportSize({width,height:844});
    for(const route of routes){
      await page.goto(route);
      await expectNoOverflow(page,width);
    }
  }
  await expectClean(diag,'Issue 74 responsive matrix');
});
