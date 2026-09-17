const {test,expect}=require('@playwright/test');

for(const width of [390,1280]){
  test(`core demand and action can be changed in the same card at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto('/#/coach/f111/compose?level=L3&lower=single_leg_squat&upper=horizontal_push&core=anti_extension');
    const card=page.locator('[data-composer-slot="CORE"]');
    const before=await page.locator('[data-composer-slot="A"] select').inputValue();
    await expect(card.getByRole('link',{name:'抗旋转',exact:true})).toBeVisible();
    await card.getByRole('link',{name:'抗旋转',exact:true}).click();
    await expect(page).toHaveURL(/core=anti_rotation/);
    await expect(card.getByRole('link',{name:'抗旋转',exact:true})).toHaveAttribute('aria-current','true');
    await expect(page.locator('[data-composer-slot="A"] select')).toHaveValue(before);
    const select=card.locator('select');
    const choices=await select.locator('option').evaluateAll(nodes=>nodes.map(n=>n.value));
    expect(choices.length).toBeGreaterThan(1);
    await select.selectOption(choices[choices.length-1]);
    await page.reload();
    await expect(card.locator('select')).toHaveValue(choices[choices.length-1]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await card.screenshot({path:`output/playwright/core-card-detail-${width}.png`});
    await page.screenshot({path:`output/playwright/core-card-${width}.png`,fullPage:true});
  });
}
