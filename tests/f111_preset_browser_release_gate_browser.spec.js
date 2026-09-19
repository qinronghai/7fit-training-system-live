const { test, expect } = require('@playwright/test');

function diagnostics(page) {
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error?.stack || error?.message || error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function expectClean(diag) {
  expect(diag.pageErrors, `pageerror(s): ${diag.pageErrors.join(' | ')}`).toEqual([]);
  expect(diag.consoleErrors, `console error(s): ${diag.consoleErrors.join(' | ')}`).toEqual([]);
}

async function expectNoOverflow(page, width) {
  const measured = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(measured.clientWidth).toBe(width);
  expect(measured.scrollWidth).toBe(measured.clientWidth);
}

test('F111 Preset Browser V2 exposes and resolves all 32 canonical states', async ({ page }) => {
  const diag = diagnostics(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/coach/f111');

  await expect(page.locator('[data-f111-preset-matrix-shell]')).toBeVisible();
  await expect(page.locator('[data-f111-recipe-row]')).toHaveCount(8);
  await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(32);

  const result = await page.evaluate(() => {
    const B = window.V14CoachModules.F111PresetBrowser;
    const index = B.buildIndex();
    const states = index.map(state => {
      const preview = B.resolvePreview(state.recipeId, state.level);
      return {
        key: state.key,
        recipeId: state.recipeId,
        level: state.level,
        href: state.href,
        patterns: state.patterns,
        previewKey: preview.key,
        sectionKeys: preview.sections.map(section => section.key),
        source: preview.source,
      };
    });
    return {
      count: states.length,
      uniqueKeys: new Set(states.map(state => state.key)).size,
      states,
    };
  });

  expect(result.count).toBe(32);
  expect(result.uniqueKeys).toBe(32);

  for (const state of result.states) {
    expect(state.previewKey).toBe(state.key);
    expect(state.href).toBe(`#/coach/f111/${state.recipeId.toLowerCase()}/${state.level.toLowerCase()}`);
    expect(state.sectionKeys).toContain('PREP');
    expect(state.sectionKeys).toContain('A');
    expect(state.sectionKeys).toContain('B');
    expect(state.sectionKeys).toContain('SUPPORT');
    expect(state.sectionKeys).toContain('CORE');

    const cell = page.locator(
      `[data-f111-preset-cell][data-recipe-id="${state.recipeId}"][data-level="${state.level}"]`
    );
    await expect(cell).toHaveCount(1);
    await expect(cell).toHaveAttribute('href', state.href);
  }

  await expectNoOverflow(page, 1280);
  await expectClean(diag);
});

test('F111 Preset Browser V2 filter truth table stays deterministic', async ({ page }) => {
  const diag = diagnostics(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/coach/f111');

  const rows = await page.evaluate(() => {
    const C = window.V14CoachModules.F111PresetControls;
    const B = window.V14CoachModules.F111PresetBrowser;
    const all = B.buildIndex();

    function run({ q = '', level = 'ALL', lower = [], upper = [], support = [] }) {
      C.clear();
      C.setSearch(q);
      C.setLevel(level);
      lower.forEach(value => C.toggle('lower', value));
      upper.forEach(value => C.toggle('upper', value));
      support.forEach(value => C.toggle('support', value));
      const filtered = C.filter(all);
      return {
        count: filtered.length,
        keys: filtered.map(item => item.key),
      };
    }

    return {
      all: run({}),
      level: run({ level: 'L2' }),
      lower: run({ lower: ['髋铰链'] }),
      upper: run({ upper: ['垂直拉'] }),
      support: run({ support: ['单侧支撑'] }),
      lowerOr: run({ lower: ['髋铰链', '单腿'] }),
      crossAnd: run({ lower: ['髋铰链'], upper: ['垂直推'] }),
      lowerSupport: run({ lower: ['髋铰链'], support: ['支撑'] }),
      exact: run({ level: 'L3', lower: ['单腿'], upper: ['垂直拉'], support: ['支撑'] }),
      search: run({ q: 'F111-03' }),
      searchAnd: run({ q: 'F111-03', level: 'L2', lower: ['髋铰链'], upper: ['水平拉'] }),
      none: run({ level: 'L2', lower: ['髋铰链'], upper: ['垂直拉'] }),
    };
  });

  expect(rows.all.count).toBe(32);
  expect(rows.level.count).toBe(8);
  expect(rows.lower.count).toBe(8);
  expect(rows.upper.count).toBe(12);
  expect(rows.support.count).toBe(8);
  expect(rows.lowerOr.count).toBe(16);
  expect(rows.crossAnd.count).toBe(4);
  expect(rows.lowerSupport.count).toBe(4);
  expect(rows.exact).toEqual({ count: 1, keys: ['F111-08:L3'] });
  expect(rows.search.count).toBe(4);
  expect(rows.searchAnd).toEqual({ count: 1, keys: ['F111-03:L2'] });
  expect(rows.none.count).toBe(0);

  await page.evaluate(() => window.V14CoachModules.F111PresetControls.clear());
  await expectClean(diag);
});

test('F111 Preset Browser V2 has no page overflow at required desktop and mobile widths', async ({ page }) => {
  const diag = diagnostics(page);

  for (const width of [1080, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/coach/f111');
    await expect(page.locator('[data-f111-preset-matrix-shell]')).toBeVisible();
    await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(32);
    await expectNoOverflow(page, width);
  }

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/#/coach/f111');
    await expect(page.locator('[data-f111-preset-matrix-shell]')).toBeHidden();
    await expect(page.locator('[data-f111-mobile-list]')).toBeVisible();
    await expect(page.locator('[data-f111-mobile-row]')).toHaveCount(8);
    await expect(page.locator('[data-f111-mobile-preset]')).toHaveCount(32);
    await expectNoOverflow(page, width);

    await page.locator('[data-f111-filter-group="level"][data-f111-filter-value="L2"]').click();
    await expect(page.locator('[data-f111-mobile-row]')).toHaveCount(8);
    await expect(page.locator('[data-f111-mobile-preset]')).toHaveCount(8);
    await expectNoOverflow(page, width);

    await page.locator('[data-f111-filter-clear]').first().click();
  }

  await expectClean(diag);
});

test('Issue #149 Desktop UI Polish improves F111 readability without changing the mobile layout', async ({ page }) => {
  const diag = diagnostics(page);

  for (const width of [1080, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#/coach/f111');

    const metrics = await page.evaluate(() => {
      const computed = selector => getComputedStyle(document.querySelector(selector));
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      const main = rect('#app-main');
      const appColumn = rect('.app-column');
      const chip = rect('[data-f111-filter-group="level"][data-f111-filter-value="L2"]');
      const row = rect('[data-f111-recipe-row]');
      return {
        mainWidth: main.width,
        appColumnWidth: appColumn.width,
        chipHeight: chip.height,
        matrixRowHeight: row.height,
        styles: {
          body: computed('.f111-preset-browser-section').fontSize,
          heroLead: computed('.coach-home-lead').fontSize,
          heroSummary: computed('.coach-home-intro .intro-summary').fontSize,
          heroPoint: computed('.intro-points article p').fontSize,
          search: computed('.f111-preset-search input').fontSize,
          chip: computed('.f111-preset-filter-chip').fontSize,
          recipeId: computed('.f111-preset-recipe span').fontSize,
          recipe: computed('.f111-preset-recipe strong').fontSize,
          level: computed('.f111-preset-level-head b').fontSize,
          levelHint: computed('.f111-preset-level-head small').fontSize,
          cell: computed('.f111-preset-cell').fontSize,
        },
      };
    });

    expect(metrics.mainWidth).toBeGreaterThanOrEqual(metrics.appColumnWidth - 32);
    expect(metrics.chipHeight).toBeGreaterThanOrEqual(36);
    expect(metrics.chipHeight).toBeLessThanOrEqual(40);
    expect(metrics.matrixRowHeight).toBeGreaterThanOrEqual(58);
    expect(metrics.matrixRowHeight).toBeLessThanOrEqual(64);
    expect(parseFloat(metrics.styles.body)).toBeGreaterThanOrEqual(15);
    expect(parseFloat(metrics.styles.body)).toBeLessThanOrEqual(16);
    expect(parseFloat(metrics.styles.heroLead)).toBeGreaterThanOrEqual(15);
    expect(parseFloat(metrics.styles.heroSummary)).toBeGreaterThanOrEqual(13);
    expect(parseFloat(metrics.styles.heroPoint)).toBeGreaterThanOrEqual(13);
    expect(parseFloat(metrics.styles.search)).toBeGreaterThanOrEqual(14);
    expect(parseFloat(metrics.styles.search)).toBeLessThanOrEqual(15);
    expect(parseFloat(metrics.styles.chip)).toBeGreaterThanOrEqual(13);
    expect(parseFloat(metrics.styles.chip)).toBeLessThanOrEqual(14);
    expect(parseFloat(metrics.styles.recipeId)).toBeGreaterThanOrEqual(12);
    expect(parseFloat(metrics.styles.recipeId)).toBeLessThanOrEqual(13);
    expect(parseFloat(metrics.styles.recipe)).toBeGreaterThanOrEqual(15);
    expect(parseFloat(metrics.styles.recipe)).toBeLessThanOrEqual(16);
    expect(parseFloat(metrics.styles.level)).toBeGreaterThanOrEqual(14);
    expect(parseFloat(metrics.styles.level)).toBeLessThanOrEqual(15);
    expect(parseFloat(metrics.styles.levelHint)).toBeGreaterThanOrEqual(13);
    expect(parseFloat(metrics.styles.levelHint)).toBeLessThanOrEqual(14);
    expect(parseFloat(metrics.styles.cell)).toBeGreaterThanOrEqual(13);
    expect(parseFloat(metrics.styles.cell)).toBeLessThanOrEqual(14);

    const chip = page.locator('[data-f111-filter-group="level"][data-f111-filter-value="L2"]');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-f111-result-count] b')).toContainText('共 8 套预设');
    await expect(page.locator('[data-f111-preset-cell]')).toHaveCount(8);
    await expectNoOverflow(page, width);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111');
  const mobileMetrics = await page.evaluate(() => ({
    matrixDisplay: getComputedStyle(document.querySelector('[data-f111-preset-matrix-shell]')).display,
    mobileListDisplay: getComputedStyle(document.querySelector('[data-f111-mobile-list]')).display,
    chipHeight: document.querySelector('[data-f111-filter-group="level"][data-f111-filter-value="L2"]').getBoundingClientRect().height,
    mobileRowHeight: document.querySelector('[data-f111-mobile-row]').getBoundingClientRect().height,
  }));
  expect(mobileMetrics.matrixDisplay).toBe('none');
  expect(mobileMetrics.mobileListDisplay).toBe('grid');
  expect(mobileMetrics.chipHeight).toBeGreaterThanOrEqual(34);
  expect(mobileMetrics.mobileRowHeight).toBeGreaterThanOrEqual(50);
  await expectNoOverflow(page, 390);
  await expectClean(diag);
});

test('Desktop Drawer and Mobile Bottom Sheet render the same resolved preset preview', async ({ page }) => {
  const diag = diagnostics(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/coach/f111');
  const desktopTrigger = page.locator(
    '[data-f111-preset-cell][data-recipe-id="F111-03"][data-level="L2"]'
  );
  await desktopTrigger.click();

  const desktopDrawer = page.locator('#global-drawer[data-f111-preset-drawer]');
  await expect(desktopDrawer).toBeVisible();
  await expect(desktopDrawer).not.toHaveAttribute('aria-modal', 'true');
  await expect(desktopTrigger).toHaveAttribute('aria-selected', 'true');
  const desktopMatrix = page.locator('[data-f111-preset-matrix-shell]');
  await expect(desktopMatrix).toBeVisible();
  await expect(desktopMatrix.locator('[data-f111-recipe-row]')).toHaveCount(8);
  await expect(desktopMatrix.locator('[data-f111-preset-cell]')).toHaveCount(32);
  await expectNoOverflow(page, 1280);

  const desktopPreview = await desktopDrawer.locator('[data-preview-slot]').evaluateAll(nodes =>
    nodes.map(node => ({
      key: node.getAttribute('data-preview-slot'),
      name: node.querySelector('b')?.textContent?.trim() || '',
      rx: node.querySelector('small')?.textContent?.trim() || '',
    }))
  );
  const desktopStart = await desktopDrawer.locator('[data-preset-start]').getAttribute('href');
  expect(desktopPreview.length).toBeGreaterThanOrEqual(6);

  await page.keyboard.press('Escape');
  await expect(desktopDrawer).toBeHidden();
  await expect(desktopTrigger).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator('[data-f111-filter-group="level"][data-f111-filter-value="L2"]').click();
  const mobileTrigger = page.locator(
    '[data-f111-mobile-preset][data-recipe-id="F111-03"][data-level="L2"]'
  );
  await mobileTrigger.click();

  const mobileSheet = page.locator('#global-drawer[data-f111-preset-drawer]');
  await expect(mobileSheet).toBeVisible();
  await expect(mobileSheet).toHaveAttribute('aria-modal', 'true');
  await expect(mobileSheet.locator('.f111-preset-sheet-handle')).toBeVisible();
  expect(await page.locator('.app-shell').evaluate(node => node.hasAttribute('inert'))).toBeTruthy();

  const mobilePreview = await mobileSheet.locator('[data-preview-slot]').evaluateAll(nodes =>
    nodes.map(node => ({
      key: node.getAttribute('data-preview-slot'),
      name: node.querySelector('b')?.textContent?.trim() || '',
      rx: node.querySelector('small')?.textContent?.trim() || '',
    }))
  );
  const mobileStart = await mobileSheet.locator('[data-preset-start]').getAttribute('href');

  expect(mobilePreview).toEqual(desktopPreview);
  expect(mobileStart).toBe(desktopStart);
  expect(mobileStart).toBe('#/coach/f111/f111-03/l2');

  await mobileSheet.locator('[data-f111-preset-close]').click();
  await expect(mobileSheet).toBeHidden();
  expect(await page.locator('.app-shell').evaluate(node => node.hasAttribute('inert'))).toBeFalsy();
  await expect(mobileTrigger).toBeFocused();
  await expectNoOverflow(page, 390);
  await expectClean(diag);
});

test('Preset Browser V2 recent-use recovery and canonical handoff remain safe', async ({ page }) => {
  const diag = diagnostics(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/#/coach/f111');

  const storageKey = await page.evaluate(() => window.V14CoachModules.F111PresetControls.STORAGE_KEY);
  await page.evaluate(key => {
    localStorage.setItem(key, JSON.stringify([
      { recipeId: 'F111-99', level: 'L2', usedAt: '2099-01-01T00:00:00.000Z' },
      { recipeId: 'F111-07', level: 'L3', usedAt: '2026-09-19T23:30:00.000Z' },
      { recipeId: 'F111-07', level: 'L3', usedAt: '2026-09-19T22:30:00.000Z' },
      { recipeId: 'F111-03', level: 'L2', usedAt: 'not-a-date' },
    ]));
  }, storageKey);
  await page.reload();

  await expect(page.locator('[data-f111-recent]')).toHaveCount(1);
  await expect(page.locator('[data-f111-recent][data-recipe-id="F111-07"][data-level="L3"]')).toBeVisible();

  const normalized = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), storageKey);
  expect(normalized).toEqual([
    { recipeId: 'F111-07', level: 'L3', usedAt: '2026-09-19T23:30:00.000Z' },
  ]);

  await page.locator('[data-f111-recent][data-recipe-id="F111-07"][data-level="L3"]').click();
  const drawer = page.locator('#global-drawer[data-f111-preset-drawer]');
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-preset-start]')).toHaveAttribute('href', '#/coach/f111/f111-07/l3');
  await expect(drawer.locator('[data-preset-replace]')).toHaveAttribute('href', '#/coach/f111/f111-07/l3');

  const composerHref = await drawer.locator('.f111-preset-cta.tertiary').getAttribute('href');
  expect(composerHref).toContain('#/coach/f111/compose?');
  expect(composerHref).toContain('level=L3');
  expect(composerHref).toContain('lower=hinge');
  expect(composerHref).toContain('upper=vertical_push');

  await expectClean(diag);
});
