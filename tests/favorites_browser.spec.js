const { test, expect } = require('@playwright/test');

function capture(page){const e=[];page.on('pageerror',x=>e.push(x.message||String(x)));return e;}
async function expect390(page){
  const w=await page.evaluate(()=>({s:document.documentElement.scrollWidth,c:document.documentElement.clientWidth}));
  expect(w.c).toBe(390);expect(w.s).toBe(w.c);
}

test('favorites persist, restore through current routes, and expose stale handling at 390px',async({page})=>{
  const errors=capture(page);
  await page.setViewportSize({width:390,height:844});

  await page.goto('/#/library');
  await page.locator('#action-search').fill('BODY-02');
  await page.locator('[data-filter="templateId"]').selectOption('body');
  await page.locator('[data-filter="kind"]').selectOption('session');
  const bodyFavorite=page.locator('[data-favorite-toggle]').first();
  await expect(bodyFavorite).toBeVisible();
  await bodyFavorite.click();
  await expect(bodyFavorite).toHaveAttribute('aria-pressed','true');

  await page.reload();
  await expect(page.locator('[data-favorite-toggle]').first()).toHaveAttribute('aria-pressed','true');

  await page.goto('/#/library');
  await page.locator('#action-search').fill('滑雪机');
  await page.locator('[data-filter="templateId"]').selectOption('conditioning');
  await page.locator('[data-filter="kind"]').selectOption('action');
  const actionFavorite=page.locator('[data-favorite-toggle]').first();
  await actionFavorite.click();
  await expect(actionFavorite).toHaveAttribute('aria-pressed','true');

  await page.goto('/#/coach');
  await expect(page.getByRole('heading',{name:'常用收藏'})).toBeVisible();
  await expect(page.locator('.favorite-card')).toHaveCount(2);
  const bodyCard=page.locator('.favorite-card').filter({hasText:'BODY-02'}).first();
  await expect(bodyCard).toBeVisible();
  await bodyCard.locator('[data-favorite-open]').click();
  await expect(page).toHaveURL(/#\/coach\/body\/compose\?family=BODY-02&level=L1/);

  await page.evaluate(()=>{
    window.V15State.setFavorite({
      favoriteId:'body|body-family|body:BODY-99',
      schemaVersion:1,templateId:'body',entryKind:'body-family',entryId:'body:BODY-99',
      createdAt:new Date().toISOString()
    });
  });
  await page.goto('/#/coach');
  const stale=page.locator('.favorite-card').filter({hasText:'已失效'}).first();
  await expect(stale).toBeVisible();
  await stale.locator('[data-favorite-remove]').click();
  await expect(page.locator('.favorite-card').filter({hasText:'已失效'})).toHaveCount(0);

  await expect390(page);
  expect(errors,errors.join(' | ')).toEqual([]);
});
