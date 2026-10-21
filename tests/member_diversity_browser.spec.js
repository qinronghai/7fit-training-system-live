const { test, expect } = require('@playwright/test');

const API = 'https://ynsodlyanpmixbbxblqh.supabase.co/functions/v1/member-api';
const MEMBER_ID = 'e7000000-0000-4000-8000-000000000001';

test('F111 composer uses recent-three context to diversify support and CORE recommendations', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  await page.addInitScript(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({
    token: 'member-diversity-test-token', expiresAt: '2026-10-27T12:00:00.000Z',
  })));
  await page.route(`${API}**`, async route => {
    const url = new URL(route.request().url());
    const action = url.searchParams.get('action');
    if (action === 'get-member') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        member: { id: MEMBER_ID, displayName: '林同学', status: 'ACTIVE', trainingLevel: 'L2' },
      }) });
      return;
    }
    if (action === 'get-member-training-context') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ context: {
        schemaVersion: 1,
        memberId: MEMBER_ID,
        displayName: '林同学',
        trainingLevel: 'L2',
        lastCompletedSession: { sessionDate: '2026-10-20', sessionTitle: '全身稳定训练' },
        recentSessions: [],
        recentPatterns: [{ pattern: 'SQUAT', sessionsAgo: 0 }, { pattern: 'ANTI_EXTENSION', sessionsAgo: 1 }],
        recentActions: [
          { actionId: 'SUP-S2-01', actionNameSnapshot: '四足跪姿单手抬起', sessionsAgo: 0, countLast3: 1 },
          { actionId: 'CORE-L2-01', actionNameSnapshot: '死虫式', sessionsAgo: 0, countLast3: 2 },
        ],
        recentPrimaryMuscles: [],
      } }) });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: `unexpected action: ${action}` }) });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/coach/f111/compose?level=L2&lower=squat&upper=horizontal_pull&core=anti_extension&memberId=${MEMBER_ID}`);
  await expect(page.locator('[data-member-first-context]')).toContainText('最近完成');

  const supportName = await page.locator('.f111-slot-card[data-composer-slot="C"] .f111-slot-main h3').textContent();
  const coreName = await page.locator('.f111-slot-card[data-composer-slot="CORE"] .f111-slot-main h3').textContent();
  expect(supportName).not.toBe('四足跪姿单手抬起');
  expect(coreName).not.toBe('死虫式');
  await expect(page.locator('.f111-slot-card[data-composer-slot="C"]')).toContainText('多样性');
  await expect(page.locator('.f111-slot-card[data-composer-slot="CORE"]')).toContainText('多样性');
  expect(errors).toEqual([]);
});
