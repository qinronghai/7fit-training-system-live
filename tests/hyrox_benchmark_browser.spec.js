const { test, expect } = require('@playwright/test');

function capturePageErrors(page){
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message||String(error)));
  return errors;
}
async function expect390NoOverflow(page){
  const width=await page.evaluate(()=>({
    scrollWidth:document.documentElement.scrollWidth,
    clientWidth:document.documentElement.clientWidth,
  }));
  expect(width.clientWidth).toBe(390);
  expect(width.scrollWidth).toBe(width.clientWidth);
}
async function calibrate(page){
  await page.locator('[data-hyrox-sled-push]').fill('42');
  await page.locator('[data-hyrox-sled-pull]').fill('36');
  await page.locator('[data-hyrox-sled-version]').fill('7fit-turf-v1');
  await page.locator('[data-hyrox-save-calibration]').click();
  await expect(page.locator('[data-hyrox-benchmark-panel]')).toBeVisible();
}
async function fillBenchmark(page,total,baseSeconds){
  await page.locator('[data-hyrox-benchmark-total]').fill(total);
  for(let i=1;i<=8;i+=1){
    const id='H'+i;
    const sec=baseSeconds+i*5;
    const min=Math.floor(sec/60),remain=String(sec%60).padStart(2,'0');
    await page.locator('[data-hyrox-benchmark-time="'+id+'"]').fill(min+':'+remain);
  }
}

test('HYROX Benchmark history compares only exact specs and stays mobile-safe',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/hyrox/benchmark/b3');
  await calibrate(page);

  await expect(page.getByText('尚无成绩',{exact:true})).toBeVisible();
  await fillBenchmark(page,'27:36',100);
  await page.locator('[data-hyrox-benchmark-save]').click();
  await expect(page.locator('[data-hyrox-benchmark-summary]')).toContainText('27:36');
  await expect(page.locator('[data-hyrox-benchmark-summary]')).toContainText('新基准');
  await expect(page.locator('[data-hyrox-benchmark-history] article')).toHaveCount(1);

  await fillBenchmark(page,'26:52',95);
  await page.locator('[data-hyrox-benchmark-save]').click();
  const summary=page.locator('[data-hyrox-benchmark-summary]');
  await expect(summary).toContainText('26:52');
  await expect(summary).toContainText('27:36');
  await expect(summary).toContainText('↑ 0:44');
  await expect(page.locator('[data-hyrox-benchmark-history] article')).toHaveCount(2);
  await expect(page.getByText('当前短板：',{exact:false})).toBeVisible();

  const h6Load=page.locator('[data-hyrox-load="H6"]');
  await h6Load.fill('99');
  await h6Load.press('Tab');
  await expect(page.getByText('规格变化，建立新基准',{exact:true})).toBeVisible();
  await expect(page.locator('[data-hyrox-benchmark-summary]')).toHaveCount(0);

  let dialogText='';
  await Promise.all([
    page.waitForEvent('dialog').then(async dialog=>{dialogText=dialog.message();await dialog.accept();}),
    page.locator('[data-hyrox-benchmark-delete]').first().click(),
  ]);
  expect(dialogText).toContain('Benchmark');
  await expect(page.locator('[data-hyrox-benchmark-history] article')).toHaveCount(1);

  await expect390NoOverflow(page);
  expect(errors,'unexpected HYROX Benchmark page errors: '+errors.join(' | ')).toEqual([]);
});

test('HYROX Skill remains usable without benchmark history interaction',async({page})=>{
  const errors=capturePageErrors(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#/coach/hyrox/skill/l2');
  await expect(page.locator('[data-hyrox-benchmark-panel]')).toHaveCount(0);
  await expect(page.locator('[data-hyrox-station-card]')).toHaveCount(3);
  await expect390NoOverflow(page);
  expect(errors,'unexpected HYROX Skill page errors: '+errors.join(' | ')).toEqual([]);
});
