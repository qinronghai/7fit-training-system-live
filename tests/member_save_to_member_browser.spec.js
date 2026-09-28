const { test, expect } = require('@playwright/test');

const API = 'https://ynsodlyanpmixbbxblqh.supabase.co/functions/v1/member-api';
const members = [
  { id: 'e1000000-0000-4000-8000-000000000001', displayName: '林同学', status: 'ACTIVE' },
  { id: 'e1000000-0000-4000-8000-000000000011', displayName: '王同学', status: 'ACTIVE' },
];

test.beforeEach(async ({ page }) => {
  page.memberPageErrors = [];
  page.on('pageerror', error => page.memberPageErrors.push(error.message || String(error)));
});

test.afterEach(async ({ page }) => {
  expect(page.memberPageErrors).toEqual([]);
});

async function installStaffSession(page) {
  await page.addInitScript(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({
    token: 'member-save-test-token', expiresAt: '2026-10-27T12:00:00.000Z',
  })));
}

async function mockMemberApi(page, handler, availableMembers = members, state = {}) {
  const calls = [];
  await page.route(`${API}**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.searchParams.get('action');
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    calls.push({ action, body, search: url.searchParams.get('search') || '', memberId: url.searchParams.get('memberId') || '', authorization: request.headers().authorization });
    if (action === 'list-members') {
      const search = (url.searchParams.get('search') || '').toLocaleLowerCase();
      if (search) state.memberSearchStarted = true;
      const limit = Number(url.searchParams.get('limit')) || 100;
      const filtered = availableMembers.filter(member => String(member.displayName || '').toLocaleLowerCase().includes(search));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ members: filtered.slice(0, limit) }) });
      return;
    }
    if (action === 'get-member') {
      if (state.memberSearchStarted && url.searchParams.get('memberId') === state.delayGetMemberId && state.getMemberWait) await state.getMemberWait;
      const member = availableMembers.find(value => value.id === url.searchParams.get('memberId')) || null;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ member }) });
      return;
    }
    if (action === 'get-member-training-context') {
      const member = availableMembers.find(value => value.id === url.searchParams.get('memberId')) || availableMembers[0];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ context: {
        schemaVersion: 1, memberId: member.id, displayName: member.displayName, trainingLevel: 'L3',
        lastCompletedSession: null, recentSessions: [], recentPatterns: [], recentActions: [], recentPrimaryMuscles: [],
      } }) });
      return;
    }
    await handler({ route, action, body, calls });
  });
  return calls;
}

async function openAndSave(page, memberId = members[0].id) {
  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('select')).toContainText('林同学');
  await dialog.locator('select').selectOption(memberId);
  await dialog.locator('[data-member-save-submit]').click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText('已保存');
  return dialog;
}

async function checkSavedSnapshot(page, route, memberId) {
  await installStaffSession(page);
  const captured = [];
  await mockMemberApi(page, async ({ route: requestRoute, action, body, calls }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    captured.push(body.snapshot);
    await requestRoute.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false,
    }) });
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message || String(error)));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route);
  await openAndSave(page, memberId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(captured).toHaveLength(1);
  const snapshot = captured[0];
  expect(snapshot.session.memberId).toBe(memberId);
  expect(snapshot.session.status).toBe('PLANNED');
  expect(snapshot.session.idempotencyKey.length).toBeGreaterThanOrEqual(8);
  expect(snapshot.items.length).toBeGreaterThanOrEqual(5);
  expect(snapshot.items.every(item => item.completed === false)).toBeTruthy();
  const action = snapshot.items.find(item => item.plannedActionSnapshot.primaryMuscles.length);
  expect(action.plannedActionSnapshot).toMatchObject({
    schemaVersion: 1,
    actionId: action.plannedActionId,
    name: expect.any(String),
    pattern: expect.any(String),
    primaryMuscles: expect.any(Array),
    secondaryMuscles: expect.any(Array),
  });
  expect(action.plannedPrescriptionSnapshot).toHaveProperty('rawText');
  expect(errors).toEqual([]);
  return captured;
}

test('preset F111 requires an explicit member save and stores a full PLANNED snapshot', async ({ page }) => {
  await installStaffSession(page);
  const captured = [];
  await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    captured.push(body.snapshot);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false,
    }) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111/f111-06/l3');
  const displayedPrescriptions = await page.evaluate(() => Object.fromEntries(
    ['SUPPORT', '2', '3'].map(slotKey => [slotKey, window.V14ModuleCopy.prescriptionForF111Slot(slotKey)]),
  ));
  await openAndSave(page, members[0].id);
  expect(captured).toHaveLength(1);
  const snapshot = captured[0];
  for (const slotKey of ['SUPPORT', '2', '3']) {
    const displayed = displayedPrescriptions[slotKey];
    expect(displayed, `${slotKey} must have a displayed/copy prescription`).toBeTruthy();
    expect(snapshot.items.find(item => item.slotKey === slotKey).plannedPrescriptionSnapshot.rawText).toBe(displayed);
  }
});

test('Composer F111 copy and cancel do not save; explicit save works', async ({ page }) => {
  await installStaffSession(page);
  const saved = [];
  const calls = await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    saved.push(body.snapshot);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false,
    }) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111?level=L3&lower=squat&upper=horizontal_pull&core=anti_extension');
  await page.locator('#copy-member-session').click();
  expect(calls.filter(call => call.action === 'save-planned-session')).toHaveLength(0);

  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  await expect(dialog).toBeVisible();
  await dialog.locator('[data-member-save-cancel]').click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('[data-save-member-session]')).toBeFocused();
  expect(calls.filter(call => call.action === 'save-planned-session')).toHaveLength(0);

  await openAndSave(page, members[1].id);
  expect(saved).toHaveLength(1);
  expect(saved[0].session.memberId).toBe(members[1].id);
  expect(saved[0].session.status).toBe('PLANNED');
  const details = saved[0].session.resolvedSessionSnapshot.memberDetails;
  expect(details.warmups.length).toBeGreaterThan(0);
  expect(details.foam.length).toBeGreaterThan(0);
  expect(details.recoveryDetails.length).toBeGreaterThan(0);
  expect(saved[0].items.filter(item => item.phase === 'PREP')).toHaveLength(details.warmups.length);
  expect(saved[0].items.map(item => item.sortOrder)).toEqual(saved[0].items.map((_, index) => index));
  expect(details.warmups[0]).toMatchObject({
    actionId: expect.any(String),
    prepId: expect.any(String),
    slotKey: expect.any(String),
    prescription: expect.any(String),
    sequencePhase: expect.any(String),
  });
  const prepValidation = await page.evaluate(async snapshot => {
    const domain = await window.V14MemberDomainPromise;
    return snapshot.items.filter(item => item.phase === 'PREP').map(item => domain.validateTrainingSessionItem(item).ok);
  }, saved[0]);
  expect(prepValidation.length).toBe(details.warmups.length);
  expect(prepValidation.every(Boolean)).toBeTruthy();
});

test('refresh after an unknown save result retries the same intent without creating a duplicate', async ({ page }) => {
  await installStaffSession(page);
  const requests = [];
  const rowsByIntent = new Map();
  let dropResponse = true;
  await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    const snapshot = body.snapshot;
    requests.push(snapshot);
    const key = `${snapshot.session.memberId}:${snapshot.session.idempotencyKey}`;
    if (!rowsByIntent.has(key)) rowsByIntent.set(key, snapshot);
    if (dropResponse) {
      dropResponse = false;
      await route.abort();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: rowsByIntent.get(key).session.id, revision: 1, status: 'PLANNED', idempotentReplay: true,
    }) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111/f111-06/l3');
  await page.locator('[data-save-member-session]').click();
  let dialog = page.locator('[data-member-save-dialog]');
  await dialog.locator('select').selectOption(members[0].id);
  await dialog.locator('[data-member-save-submit]').click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText(/重试|确认|网络|失败/);

  await page.reload();
  await page.locator('[data-save-member-session]').click();
  dialog = page.locator('[data-member-save-dialog]');
  await expect(dialog.locator('select')).toHaveValue(members[0].id);
  await dialog.locator('[data-member-save-submit]').click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText('已保存');
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(rowsByIntent.size).toBe(1);
});

test('a pending save from an earlier date can explicitly start a separate session', async ({ page }) => {
  await installStaffSession(page);
  const snapshots = [];
  await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    snapshots.push(body.snapshot);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false,
    }) });
  });
  await page.goto('/#/coach/f111?level=L3&lower=squat&upper=horizontal_pull&core=anti_extension');
  const priorIntent = await page.evaluate(async memberId => {
    const pad = value => String(value).padStart(2, '0');
    const format = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const today = new Date();
    const priorDay = new Date(today);
    priorDay.setDate(priorDay.getDate() - 1);
    const route = window.V14Router.parseHash(location.hash);
    const resolvedSession = window.V14CoachModules.ComposerView.composerContext(route).resolvedSession;
    const intent = await window.V14MemberSnapshots.prepareIntent(resolvedSession, { memberId, sessionDate: format(priorDay) });
    return { intent, today: format(today) };
  }, members[0].id);

  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  await dialog.locator('[data-member-save-select]').selectOption(members[0].id);
  const newSession = dialog.locator('[data-member-save-new-intent]');
  await expect(newSession).toBeVisible();
  await expect(newSession).toContainText('另建今天的课程');
  await expect(dialog.locator('[data-member-save-status]')).toContainText('提交结果未确认');
  await newSession.click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText('保存结果仍未确认');
  const submit = dialog.locator('[data-member-save-submit]');
  await expect(submit).toHaveText('保存新训练课');
  await submit.click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText('已保存');

  expect(snapshots).toHaveLength(1);
  expect(snapshots[0].session.sessionDate).toBe(priorIntent.today);
  expect(snapshots[0].session.id).not.toBe(priorIntent.intent.snapshot.session.id);
  expect(snapshots[0].session.idempotencyKey).not.toBe(priorIntent.intent.snapshot.session.idempotencyKey);
});

test('a saved preset can explicitly start a new save intent for another member', async ({ page }) => {
  await installStaffSession(page);
  const snapshots = [];
  await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    snapshots.push(body.snapshot);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: snapshots.length > 1,
    }) });
  });
  await page.goto('/#/coach/f111/f111-06/l3');
  const initialDialog = await openAndSave(page, members[0].id);
  await initialDialog.locator('[data-member-save-cancel]').click();
  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  await expect(dialog.locator('[data-member-save-status]')).toContainText('已保存');
  await dialog.locator('[data-member-save-new-intent]').click();
  await dialog.locator('select').selectOption(members[1].id);
  await dialog.locator('[data-member-save-submit]').click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText('已保存');
  expect(snapshots).toHaveLength(2);
  expect(snapshots[0].session.memberId).toBe(members[0].id);
  expect(snapshots[1].session.memberId).toBe(members[1].id);
  expect(snapshots[1].session.id).not.toBe(snapshots[0].session.id);
  expect(snapshots[1].session.idempotencyKey).not.toBe(snapshots[0].session.idempotencyKey);
});

test('Member-first save ignores another member’s saved intent and selects the routed member', async ({ page }) => {
  await installStaffSession(page);
  const snapshots = [];
  await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    snapshots.push(body.snapshot);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false,
    }) });
  });
  const routedMember = members[1];
  await page.goto(`/#/coach/f111?memberId=${routedMember.id}&level=L3&lower=squat&upper=horizontal_pull&core=anti_extension`);
  await page.evaluate(async otherMemberId => {
    const route = window.V14Router.parseHash(location.hash);
    const resolved = window.V14CoachModules.ComposerView.composerContext(route).resolvedSession;
    const intent = await window.V14MemberSnapshots.prepareIntent(resolved, { memberId: otherMemberId });
    const store = JSON.parse(localStorage.getItem(window.V14MemberSnapshots.STORAGE_KEY));
    store[intent.key] = { ...intent, status: 'SAVED', savedSessionId: intent.snapshot.session.id };
    localStorage.setItem(window.V14MemberSnapshots.STORAGE_KEY, JSON.stringify(store));
  }, members[0].id);

  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  const select = dialog.locator('[data-member-save-select]');
  await expect(select).toHaveValue(routedMember.id);
  await expect(dialog.locator('[data-member-save-status]')).not.toContainText('已保存到 林同学');
  await dialog.locator('[data-member-save-submit]').click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText('已保存到 王同学 · PLANNED');
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0].session.memberId).toBe(routedMember.id);
});

test('a delayed routed-member lookup cannot override a member explicitly selected after search', async ({ page }) => {
  await installStaffSession(page);
  let releaseLookup;
  const getMemberWait = new Promise(resolve => { releaseLookup = resolve; });
  const snapshots = [];
  const lookupState = { delayGetMemberId: members[0].id, getMemberWait };
  const calls = await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    snapshots.push(body.snapshot);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false,
    }) });
  }, members, lookupState);
  await page.goto(`/#/coach/f111?memberId=${members[0].id}&level=L3&lower=squat&upper=horizontal_pull&core=anti_extension`);
  await expect(page.locator('[data-member-first-context]')).toContainText('暂无已完成训练');
  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  const search = dialog.locator('[data-member-save-search]');
  const priorLookups = calls.filter(call => call.action === 'get-member' && call.memberId === members[0].id).length;
  await search.fill('王同学');
  await expect.poll(() => calls.filter(call => call.action === 'get-member' && call.memberId === members[0].id).length).toBeGreaterThan(priorLookups);
  const delayedLookupCount = calls.filter(call => call.action === 'get-member' && call.memberId === members[0].id).length - priorLookups;
  const select = dialog.locator('[data-member-save-select]');
  await expect(select.locator('option')).toHaveCount(2);
  await select.selectOption(members[1].id);

  let finishedDelayedLookups = 0;
  let releaseStarted = false;
  page.on('requestfinished', request => {
    if (!releaseStarted) return;
    const url = new URL(request.url());
    if (url.searchParams.get('action') === 'get-member' && url.searchParams.get('memberId') === members[0].id) finishedDelayedLookups++;
  });
  releaseStarted = true;
  releaseLookup();
  await expect.poll(() => finishedDelayedLookups).toBe(delayedLookupCount);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(select).toHaveValue(members[1].id);
  await dialog.locator('[data-member-save-submit]').click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText('已保存到 王同学');
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0].session.memberId).toBe(members[1].id);
});

test('save submit is disabled while the first member write is in flight', async ({ page }) => {
  await installStaffSession(page);
  let releaseSave;
  const pendingResponse = new Promise(resolve => { releaseSave = resolve; });
  const saved = [];
  await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    saved.push(body.snapshot);
    await pendingResponse;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false,
    }) });
  });
  await page.goto('/#/coach/f111/f111-06/l3');
  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  await dialog.locator('select').selectOption(members[0].id);
  const submit = dialog.locator('[data-member-save-submit]');
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect.poll(() => saved.length).toBe(1);
  await submit.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(saved).toHaveLength(1);
  releaseSave();
  await expect(dialog.locator('[data-member-save-status]')).toContainText('已保存');
  expect(saved).toHaveLength(1);
});

test('member selector fits mobile and desktop viewports', async ({ page }, testInfo) => {
  await installStaffSession(page);
  await mockMemberApi(page, async ({ route, action }) => {
    throw new Error(`unexpected member API action ${action}`);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/f111/f111-06/l3');
  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('select')).toContainText('林同学');
  await dialog.locator('select').selectOption(members[0].id);
  await expect(dialog.locator('[data-member-save-status]')).toContainText('确认会员后保存');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.screenshot({ path: testInfo.outputPath('member-save-selector-390x844.png') });
  await dialog.locator('[data-member-save-cancel]').click();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('[data-save-member-session]').click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('select')).toContainText('林同学');
  await dialog.locator('select').selectOption(members[0].id);
  await expect(dialog.locator('[data-member-save-status]')).toContainText('确认会员后保存');
  const bounds = await dialog.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(1280);
  expect(bounds.bottom).toBeLessThanOrEqual(900);
  await page.screenshot({ path: testInfo.outputPath('member-save-selector-1280x900.png') });
});

test('member selector searches the server directory beyond the first 100 members', async ({ page }) => {
  await installStaffSession(page);
  const directory = Array.from({ length: 140 }, (_, index) => ({
    id: `e1000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    displayName: `会员 ${index + 1}`,
    status: 'ACTIVE',
  }));
  const calls = await mockMemberApi(page, async ({ action }) => {
    throw new Error(`unexpected member API action ${action}`);
  }, directory);
  await page.goto('/#/coach/f111/f111-06/l3');
  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  await expect(dialog).toBeVisible();
  const search = dialog.locator('[data-member-save-search]');
  await search.fill('会员 140');
  await expect(dialog.locator('select')).toContainText('会员 140', { timeout: 3000 });
  expect(calls.some(call => call.action === 'list-members' && call.search === '会员 140')).toBeTruthy();
  await dialog.locator('select').selectOption(directory[139].id);
  await expect(dialog.locator('[data-member-save-status]')).toContainText('确认会员后保存');
});

test('Member-first selector preselects a routed member outside the first 100 rows', async ({ page }) => {
  await installStaffSession(page);
  const directory = Array.from({ length: 140 }, (_, index) => ({
    id: `e1000000-0000-4000-8000-${String(index + 300).padStart(12, '0')}`,
    displayName: `会员 ${index + 1}`,
    status: 'ACTIVE',
  }));
  const routedMember = directory[139];
  const snapshots = [];
  const calls = await mockMemberApi(page, async ({ route, action, body }) => {
    if (action !== 'save-planned-session') throw new Error(`unexpected member API action ${action}`);
    snapshots.push(body.snapshot);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false,
    }) });
  }, directory);

  await page.goto(`/#/coach/f111?memberId=${routedMember.id}&level=L3&lower=squat&upper=horizontal_pull&core=anti_extension`);
  await page.locator('[data-save-member-session]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  const select = dialog.locator('[data-member-save-select]');
  await expect(select.locator(`option[value="${routedMember.id}"]`)).toHaveCount(1);
  await expect(select).toHaveValue(routedMember.id);
  await expect(dialog.locator('[data-member-save-submit]')).toBeEnabled();
  expect(calls.some(call => call.action === 'get-member' && call.memberId === routedMember.id)).toBeTruthy();

  await dialog.locator('[data-member-save-submit]').click();
  await expect(dialog.locator('[data-member-save-status]')).toContainText(`已保存到 ${routedMember.displayName} · PLANNED`);
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0].session.memberId).toBe(routedMember.id);
});
