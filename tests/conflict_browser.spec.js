const { test, expect } = require('@playwright/test');

function capturePageErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  return errors;
}

async function expectNoOverflow(page) {
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBe(widths.clientWidth);
  expect(widths.clientWidth).toBe(390);
}

async function presetWarnCandidate(page, sessionId) {
  return page.evaluate(sessionId => {
    const data = window.V14_DATA;
    const session = data.sessions[sessionId];
    const view = data.sessionViews[sessionId] || {};
    const baselineIds = session.slots.map(slot => slot.baselineId);
    const baseline = window.V14Conflict.evaluate(sessionId, baselineIds);

    for (let index = 0; index < session.slots.length; index += 1) {
      const slot = session.slots[index];
      const options = view.slotOptions?.[slot.slotKey] || [];
      for (const option of options) {
        if (!option?.id || option.id === baselineIds[index]) continue;
        const selected = baselineIds.slice();
        selected[index] = option.id;
        const result = window.V14Conflict.evaluate(sessionId, selected);
        const warning = result.issues.find(issue => issue.severity === 'warn');
        if (result.status === 'WARN' && result.hardCount === 0 && warning) {
          return {
            slotKey: slot.slotKey,
            target: option.id,
            baseline: baselineIds[index],
            warningTitle: warning.title,
            baselineStatus: baseline.status,
          };
        }
      }
    }
    return null;
  }, sessionId);
}

async function composerWarnCandidate(page) {
  return page.evaluate(() => {
    const input = {
      level: 'L3',
      lowerMode: 'single_leg_hinge',
      upperMode: 'horizontal_push',
      coreDemand: 'anti_extension',
      includeExpandedSupport: true,
    };
    const baseline = window.V14Composer.resolve(input);
    const baselineConflict = window.V14Conflict.evaluateComposer(baseline);

    for (const slot of baseline.slots) {
      const options = baseline.slotOptions?.[slot.slotKey] || [];
      for (const option of options) {
        if (!option?.id || option.id === slot.actionId) continue;
        const resolved = window.V14Composer.resolve({
          ...input,
          selections: { [slot.slotKey]: option.id },
        });
        const result = window.V14Conflict.evaluateComposer(resolved);
        const warning = result.issues.find(issue => issue.severity === 'warn');
        if (result.status === 'WARN' && result.hardCount === 0 && warning) {
          return {
            slotKey: slot.slotKey,
            target: option.id,
            baseline: slot.actionId,
            warningTitle: warning.title,
            baselineStatus: baselineConflict.status,
          };
        }
      }
    }
    return null;
  });
}

async function expectConflict(page, status, warningTitle = '') {
  const box = page.locator('.conflict-box');
  await expect(box).toBeVisible();
  await expect(box.locator('.conflict-top b')).toHaveText(status);
  await expect(box).toHaveClass(new RegExp(`\\b${status.toLowerCase()}\\b`));
  if (warningTitle) await expect(box).toContainText(warningTitle);
}

test('390px F111 preset and composer conflicts survive swap/reload and reset through V15', async ({ page }) => {
  const errors = capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  // Canonical preset: choose a legal replacement that produces WARN through the real select.
  await page.goto('/#/coach/f111-06/l3');
  const preset = await presetWarnCandidate(page, 'F111-06-L3');
  expect(preset, 'expected F111-06-L3 to expose at least one legal WARN-producing replacement').toBeTruthy();
  await expectConflict(page, preset.baselineStatus);

  const presetSelect = page.locator(`.session-swap[data-slot-key="${preset.slotKey}"]`);
  await presetSelect.selectOption(preset.target);
  await expect(page.locator(`.session-swap[data-slot-key="${preset.slotKey}"]`)).toHaveValue(preset.target);
  await expectConflict(page, 'WARN', preset.warningTitle);
  await expectNoOverflow(page);

  await page.reload();
  await expect(page.locator(`.session-swap[data-slot-key="${preset.slotKey}"]`)).toHaveValue(preset.target);
  await expectConflict(page, 'WARN', preset.warningTitle);

  await page.locator('#reset-session').click();
  await expect(page.locator(`.session-swap[data-slot-key="${preset.slotKey}"]`)).toHaveValue(preset.baseline);
  await expectConflict(page, preset.baselineStatus);

  // Canonical Composer: enable expanded SUPPORT so a legal out-of-normal-window choice can warn.
  await page.goto('/#/coach/compose?lower=single_leg_hinge&upper=horizontal_push&level=L3&es=1');
  const composer = await composerWarnCandidate(page);
  expect(composer, 'expected canonical L3 Composer to expose a legal WARN-producing replacement').toBeTruthy();
  await expectConflict(page, composer.baselineStatus);

  const composerSelect = page.locator(`.composer-slot-select[data-slot-key="${composer.slotKey}"]`);
  await composerSelect.selectOption(composer.target);
  await expect(page.locator(`.composer-slot-select[data-slot-key="${composer.slotKey}"]`)).toHaveValue(composer.target);
  await expectConflict(page, 'WARN', composer.warningTitle);
  await expectNoOverflow(page);

  await page.reload();
  await expect(page.locator(`.composer-slot-select[data-slot-key="${composer.slotKey}"]`)).toHaveValue(composer.target);
  await expectConflict(page, 'WARN', composer.warningTitle);

  await page.locator('#reset-composer').click();
  await expect(page.locator(`.composer-slot-select[data-slot-key="${composer.slotKey}"]`)).toHaveValue(composer.baseline);
  await expectConflict(page, composer.baselineStatus);
  await expectNoOverflow(page);

  expect(errors, `unexpected pageerror(s): ${errors.join(' | ')}`).toEqual([]);
});
