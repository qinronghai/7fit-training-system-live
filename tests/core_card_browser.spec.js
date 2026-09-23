const {test,expect}=require('@playwright/test');

for(const width of [390,1280]){
  test(`CORE action can be changed through its grouped action drawer at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await page.goto('/#/coach/f111/compose?level=L3&lower=single_leg_squat&upper=horizontal_push&core=anti_extension');
    const card=page.locator('[data-composer-slot="CORE"]');
    const before=await page.locator('[data-composer-slot="A"] select').inputValue();
    const select=card.locator('.composer-slot-select');
    const current=await select.inputValue();
    const choices=await select.locator('option').evaluateAll(nodes=>nodes.filter(node=>!node.disabled).map(node=>({value:node.value,label:node.textContent.trim()})));
    const target=choices.find(choice=>choice.value!==current);
    expect(target,'CORE should expose another legal action in the current course').toBeTruthy();
    await card.locator('[data-f111-action-drawer="CORE"]').click();
    const drawer=page.locator('#f111-action-drawer');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.f111-drawer-group-head h3')).toHaveText([
      'CORE-L1｜基础控制','CORE-L2｜标准抗伸展','CORE-L3｜多方向稳定','CORE-L4｜高负荷整合',
    ]);
    await drawer.locator(`[data-f111-action-choice="${target.value}"]`).click();
    await expect(drawer).toBeHidden();
    await expect(card.locator('.composer-slot-select')).toHaveValue(target.value);
    await expect(page.locator('[data-composer-slot="A"] select')).toHaveValue(before);
    const composerKey=await select.getAttribute('data-composer-key');
    await expect.poll(()=>page.evaluate(({composerKey,target})=>
      window.V14State.getComposerSelections(composerKey).CORE===target,{composerKey,target:target.value}
    )).toBe(true);
    await page.reload();
    await expect(page.locator('[data-composer-slot="CORE"] .composer-slot-select')).toHaveValue(target.value);
    await expect(page.locator('[data-composer-slot="A"] select')).toHaveValue(before);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
