const { test, expect } = require('@playwright/test');

const API = 'https://ynsodlyanpmixbbxblqh.supabase.co/functions/v1/member-api';
const MEMBER_ID = 'e1000000-0000-4000-8000-000000000001';
const ARCHIVED_ID = 'e1000000-0000-4000-8000-000000000002';
const CREATED_ID = 'e1000000-0000-4000-8000-000000000099';
const COPY_TARGET_ID = 'e1000000-0000-4000-8000-000000000098';
const completedCopyFixture = require('./fixtures/member-v1/replaced-action-completed.json');

function member(id, displayName, status = 'ACTIVE', archivedAt = null) {
  return {
    schemaVersion: 1, id, displayName, status, trainingLevel: 'L2', primaryGoal: '提高力量',
    trainingProfile: { schemaVersion: 1, experienceLevel: 'BEGINNER', movementConstraints: [], preferredEquipment: ['哑铃'], notes: null },
    coachNotes: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-27T00:00:00.000Z', archivedAt,
  };
}

function plannedItem(sessionId, action = { id: 'barbell_front_squat', name: '杠铃前蹲', pattern: '蹲', level: 'L2', primaryMuscles: ['股四头肌'], secondaryMuscles: ['臀大肌'], equipment: '杠铃', stationId: 'RACK-1' }) {
  return {
    id: 'e3000000-0000-4000-8000-000000000001', sessionId, schemaVersion: 1, phase: 'PRIMARY', slotKey: 'A', sortOrder: 0,
    plannedActionId: action.id,
    plannedActionSnapshot: { schemaVersion: 1, actionId: action.id, name: action.name, pattern: action.pattern, level: action.level, primaryMuscles: action.primaryMuscles, secondaryMuscles: action.secondaryMuscles, equipment: action.equipment, stationId: action.stationId },
    performedActionId: null, performedActionSnapshot: null,
    plannedPrescriptionSnapshot: { schemaVersion: 1, sets: null, reps: null, rir: null, restSeconds: null, tempo: null, loadPrescription: null, rawText: '4 组 × 8 次' },
    performedPrescription: null, sets: null, reps: null, loadKg: null, rir: null, rpe: null, completed: false, note: null,
  };
}

function sourceDetailForCopy(status, sessionId) {
  const fixture = JSON.parse(JSON.stringify(completedCopyFixture));
  const summary = sessionSummaries.find(value => value.id === sessionId);
  fixture.session = {
    ...fixture.session,
    id: sessionId,
    memberId: MEMBER_ID,
    sessionDate: summary.sessionDate,
    status,
    sessionTitle: summary.sessionTitle,
    completedAt: status === 'COMPLETED' ? fixture.session.completedAt : null,
  };
  fixture.items = fixture.items.map(item => {
    const source = { ...item, sessionId };
    if (status === 'PLANNED') {
      Object.assign(source, {
        performedActionId: null, performedActionSnapshot: null, performedPrescription: null,
        sets: null, reps: null, loadKg: null, rir: null, rpe: null, completed: false, note: null,
      });
    }
    return source;
  });
  return { session: fixture.session, items: fixture.items };
}

const activeMember = member(MEMBER_ID, '林同学');
const archivedMember = member(ARCHIVED_ID, '王同学', 'INACTIVE', '2026-09-20T00:00:00.000Z');
const sessionSummaries = [
  { id: 'e2000000-0000-4000-8000-000000000001', memberId: MEMBER_ID, sessionDate: '2026-09-27', status: 'PLANNED', templateKey: 'f111', sessionTitle: '下肢力量', focusSnapshot: { schemaVersion: 1, patterns: ['SQUAT'], primaryMuscles: ['股四头肌'] }, revision: 1 },
  { id: 'e2000000-0000-4000-8000-000000000002', memberId: MEMBER_ID, sessionDate: '2026-09-24', status: 'COMPLETED', templateKey: 'f111', sessionTitle: '全身塑形', focusSnapshot: { schemaVersion: 1, patterns: ['SQUAT'], primaryMuscles: ['股四头肌'] }, revision: 2, completedAt: '2026-09-24T11:00:00.000Z' },
  { id: 'e2000000-0000-4000-8000-000000000003', memberId: MEMBER_ID, sessionDate: '2026-09-18', status: 'CANCELLED', templateKey: 'f111', sessionTitle: '上肢训练', focusSnapshot: { schemaVersion: 1, patterns: ['PUSH'], primaryMuscles: ['胸大肌'] }, revision: 2 },
];

const context = {
  schemaVersion: 1, memberId: MEMBER_ID, displayName: '林同学', trainingLevel: 'L2',
  lastCompletedSession: { id: sessionSummaries[1].id, sessionDate: '2026-09-24', templateKey: 'f111', sessionTitle: '全身塑形', completedAt: '2026-09-24T11:00:00.000Z', sessionsAgo: 0 },
  recentSessions: [{ id: sessionSummaries[1].id, sessionDate: '2026-09-24', templateKey: 'f111', sessionTitle: '全身塑形', completedAt: '2026-09-24T11:00:00.000Z', sessionsAgo: 0 }],
  recentPatterns: [{ pattern: 'SQUAT', sessionsAgo: 0, countLast3: 3 }],
  recentActions: [{ actionId: 'barbell_front_squat', actionNameSnapshot: '杠铃前蹲', sessionsAgo: 0, countLast3: 2 }],
  recentPrimaryMuscles: [{ muscle: '股四头肌', sessionsAgo: 0, countLast3: 2 }], generatedAt: '2026-09-27T12:00:00.000Z',
};

test.beforeEach(async ({ page }) => {
  page.memberPageErrors = [];
  page.memberConsoleErrors = [];
  page.on('pageerror', error => page.memberPageErrors.push(error.message || String(error)));
  page.on('console', message => { if (message.type() === 'error') page.memberConsoleErrors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({
    token: 'member-center-test-token', expiresAt: '2026-10-27T12:00:00.000Z',
  })));
});

test.afterEach(async ({ page }) => {
  expect(page.memberPageErrors).toEqual([]);
  expect(page.memberConsoleErrors).toEqual([]);
});

async function mockMemberApi(page, state = {}) {
  state.members ||= JSON.parse(JSON.stringify([activeMember, archivedMember]));
  state.sessions ||= JSON.parse(JSON.stringify(sessionSummaries));
  state.calls ||= [];
  state.completions ||= [];
  state.completionAttempts ||= [];
  state.savedSnapshots ||= [];
  await page.route(`${API}**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.searchParams.get('action');
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    state.calls.push({ action, query: Object.fromEntries(url.searchParams), body });
    const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (action === 'list-members') {
      if (state.listWait) await state.listWait;
      if (state.unauthorizedList) return respond({ error: 'unauthorized' }, 401);
      if (state.failList) return respond({ error: 'network_unavailable' }, 503);
      const search = (url.searchParams.get('search') || '').toLocaleLowerCase();
      const status = url.searchParams.get('status') || (url.searchParams.get('includeArchived') === 'true' ? 'ALL' : 'ACTIVE');
      const offset = Number(url.searchParams.get('offset')) || 0;
      const results = state.members.filter(value => (status === 'ALL'
        || (status === 'ACTIVE' && value.status === 'ACTIVE' && !value.archivedAt)
        || (status === 'ARCHIVED' && !!value.archivedAt)
        || (status === 'INACTIVE' && value.status === 'INACTIVE' && !value.archivedAt))
        && value.displayName.toLocaleLowerCase().includes(search))
        .sort((left, right) => left.displayName.localeCompare(right.displayName));
      return respond({ members: results.slice(offset, offset + (Number(url.searchParams.get('limit')) || 100)) });
    }
    if (action === 'get-member') {
      if (state.memberWait) await state.memberWait;
      if (state.failMember) return respond({ error: 'unauthorized' }, 401);
      const value = state.members.find(row => row.id === url.searchParams.get('memberId'));
      return value ? respond({ member: value }) : respond({ error: 'member_not_found' }, 404);
    }
    if (action === 'save-member') {
      const prior = state.members.find(value => value.id === body.id);
      const value = { ...member(prior?.id || CREATED_ID, body.displayName), ...prior, ...body, id: prior?.id || CREATED_ID, status: prior?.status || 'ACTIVE', archivedAt: prior?.archivedAt || null, updatedAt: '2026-09-27T13:00:00.000Z' };
      state.members = prior ? state.members.map(row => row.id === prior.id ? value : row) : [value, ...state.members];
      return respond({ member: value });
    }
    if (action === 'archive-member' || action === 'restore-member') {
      if (state.mutationWaits?.[action]) await state.mutationWaits[action];
      const value = state.members.find(row => row.id === body.id);
      if (!value) return respond({ error: 'member_not_found' }, 404);
      Object.assign(value, action === 'archive-member'
        ? { status: 'INACTIVE', archivedAt: '2026-09-27T13:00:00.000Z' }
        : { status: 'ACTIVE', archivedAt: null });
      return respond({ member: value });
    }
    if (action === 'get-member-training-context') {
      if (state.contextWait) await state.contextWait;
      if (state.failContext) return respond({ error: state.unauthorizedContext ? 'unauthorized' : 'network_unavailable' }, state.unauthorizedContext ? 401 : 503);
      const value = Object.hasOwn(state, 'context') ? state.context : context;
      return respond({ context: { ...value, memberId: url.searchParams.get('memberId') } });
    }
    if (action === 'list-sessions') {
      const offset = Number(url.searchParams.get('offset')) || 0;
      const limit = Number(url.searchParams.get('limit')) || 30;
      return respond({ sessions: state.sessions.slice(offset, offset + limit) });
    }
    if (action === 'get-session') {
      const requestedId = url.searchParams.get('sessionId');
      if (state.sessionDetailsById?.[requestedId]) return respond(state.sessionDetailsById[requestedId]);
      const session = state.sessions.find(value => value.id === requestedId) || sessionSummaries[1];
      const defaultItems = [plannedItem(session.id)];
      const items = state.itemsBySession?.[session.id] || (session.status === 'COMPLETED'
        ? defaultItems.map(value => ({ ...value, performedActionId: value.plannedActionId, performedActionSnapshot: value.plannedActionSnapshot, completed: true, sets: 4, reps: '8', loadKg: 40 }))
        : defaultItems);
      return respond({ session, items });
    }
    if (action === 'save-planned-session') {
      state.savedSnapshots.push(JSON.parse(JSON.stringify(body.snapshot)));
      return respond({ sessionId: body.snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false });
    }
    if (action === 'complete-session') {
      const session = state.sessions.find(value => value.id === body.sessionId);
      if (!session) return respond({ error: 'session_not_found' }, 404);
      state.completionAttempts.push(body);
      if (state.failComplete) return respond({ error: 'internal_error' }, 503);
      if (session.status === 'COMPLETED') return respond({ sessionId: session.id, status: 'COMPLETED', revision: session.revision, idempotentReplay: true });
      state.completions.push(body);
      const items = state.itemsBySession?.[session.id] || [plannedItem(session.id)];
      const patches = new Map((body.items || []).map(value => [value.id, value]));
      state.itemsBySession ||= {};
      state.itemsBySession[session.id] = items.map(value => {
        const patch = patches.get(value.id) || {};
        return {
          ...value, ...patch,
          performedActionId: patch.performedActionId ?? value.performedActionId ?? value.plannedActionId,
          performedActionSnapshot: patch.performedActionSnapshot ?? value.performedActionSnapshot ?? value.plannedActionSnapshot,
          completed: patch.completed ?? true,
        };
      });
      Object.assign(session, { status: 'COMPLETED', revision: (session.revision || 1) + 1, completedAt: '2026-09-27T13:00:00.000Z' });
      if (state.dropFirstCompletionResponse && !state.completionResponseDropped) {
        state.completionResponseDropped = true;
        return route.abort();
      }
      return respond({ sessionId: session.id, status: 'COMPLETED', revision: session.revision, idempotentReplay: false });
    }
    if (action === 'cancel-session') {
      const session = state.sessions.find(value => value.id === body.sessionId);
      if (!session) return respond({ error: 'session_not_found' }, 404);
      Object.assign(session, { status: 'CANCELLED', revision: (session.revision || 1) + 1 });
      return respond({ sessionId: session.id, status: 'CANCELLED', revision: session.revision });
    }
    throw new Error(`unexpected member API action ${action}`);
  });
  return state;
}

test('Member Center searches active members on the server and switches to the archived list', async ({ page }) => {
  const state = await mockMemberApi(page);
  await page.goto('/#/coach/members');
  await expect(page.getByRole('heading', { name: '会员训练' })).toBeVisible();
  await expect(page.getByText('林同学')).toBeVisible();
  await expect(page.getByText('王同学')).toHaveCount(0);

  await page.locator('[data-member-search]').fill('林');
  await expect(page.locator('[data-member-row]')).toHaveCount(1);
  expect(state.calls.some(call => call.action === 'list-members' && call.query.search === '林')).toBeTruthy();

  await page.locator('[data-member-search]').fill('');
  await page.locator('[data-member-filter="ARCHIVED"]').click();
  await expect(page.getByText('王同学')).toBeVisible();
  expect(state.calls.some(call => call.action === 'list-members' && call.query.status === 'ARCHIVED')).toBeTruthy();
});

test('member status filtering happens before paging and archived members beyond the first page are reachable', async ({ page }, testInfo) => {
  const active = Array.from({ length: 105 }, (_, index) => member(
    `e5000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    `Active ${String(index + 1).padStart(3, '0')}`,
  ));
  const archived = Array.from({ length: 105 }, (_, index) => member(
    `e6000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    `Archived ${String(index + 1).padStart(3, '0')}`,
    'INACTIVE', '2026-09-20T00:00:00.000Z',
  ));
  const state = await mockMemberApi(page, { members: [...active, ...archived] });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/coach/members');
  await expect(page.locator('[data-member-row]')).toHaveCount(100);
  await page.locator('[data-member-filter="ARCHIVED"]').click();
  await expect(page.locator('[data-member-row]')).toHaveCount(100);
  await expect(page.getByText('Archived 001')).toBeVisible();
  const loadMore = page.locator('[data-member-load-more-members]');
  await expect(loadMore).toBeVisible();
  await loadMore.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('member-archive-pagination-390x844.png') });
  await loadMore.click();
  await expect(page.locator('[data-member-row]')).toHaveCount(105);
  await expect(page.getByText('Archived 105')).toBeVisible();
  expect(state.calls.some(call => call.action === 'list-members'
    && call.query.status === 'ARCHIVED' && call.query.offset === '100')).toBeTruthy();
});

test('expired staff sessions offer PIN verification recovery from both the member list and detail', async ({ page }) => {
  const state = await mockMemberApi(page, { unauthorizedList: true, failMember: true });
  await page.goto('/#/coach/members');
  let recovery = page.locator('[data-member-auth-recovery]');
  await expect(recovery).toContainText('馆主管理 PIN 验证');
  await expect(recovery.locator('[data-member-auth-link]')).toHaveAttribute('target', '_blank');
  await expect(page.locator('[data-member-retry]')).toBeVisible();
  page.memberConsoleErrors=[];

  state.unauthorizedList = false;
  await page.evaluate(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({ token: 'member-center-recovered-token', expiresAt: '2026-10-27T12:00:00.000Z' })));
  await page.locator('[data-member-retry]').click();
  await expect(page.locator(`[data-member-row="${MEMBER_ID}"]`)).toBeVisible();

  await page.evaluate(memberId => { location.hash = `#/coach/members/${memberId}`; }, MEMBER_ID);
  recovery = page.locator('[data-member-auth-recovery]');
  await expect(recovery).toContainText('馆主管理 PIN 验证');
  await expect(page.locator('[data-member-detail-retry]')).toBeVisible();
  page.memberConsoleErrors=[];
  state.failMember = false;
  await page.evaluate(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({ token: 'member-center-recovered-token', expiresAt: '2026-10-27T12:00:00.000Z' })));
  await page.locator('[data-member-detail-retry]').click();
  await expect(page.getByRole('heading', { name: '林同学' })).toBeVisible();
});

test('a late member detail response cannot replace the page after navigating away', async ({ page }) => {
  let releaseMember;
  const memberWait = new Promise(resolve => { releaseMember = resolve; });
  const state = await mockMemberApi(page, { memberWait });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await expect.poll(() => state.calls.some(call => call.action === 'get-member')).toBeTruthy();

  await page.evaluate(() => { location.hash = '#/coach/f111?level=L3&lower=squat&upper=horizontal_pull&core=anti_extension'; });
  await expect(page.locator('[data-save-member-session]')).toBeVisible();
  releaseMember();
  await expect(page.locator('[data-member-center-page]')).toHaveCount(0);
  await expect(page.locator('[data-save-member-session]')).toBeVisible();
});

test('Coach Center exposes the Member Training entry in its existing workflow', async ({ page }) => {
  await mockMemberApi(page);
  await page.goto('/#/coach');
  await expect(page.getByRole('heading', { name: '会员训练记录' })).toBeVisible();
  await expect(page.getByRole('link', { name: /打开会员训练/ })).toHaveAttribute('href', '#/coach/members');
});

test('Member Center creates, edits, archives, and restores a member through explicit actions', async ({ page }) => {
  const state = await mockMemberApi(page);
  await page.goto('/#/coach/members');
  await page.locator('[data-member-create]').click();
  const form = page.locator('[data-member-form-dialog]');
  await expect(form).toBeVisible();
  await form.locator('[name="displayName"]').fill('赵同学');
  await form.locator('[name="primaryGoal"]').fill('提升下肢力量');
  await form.locator('[name="trainingLevel"]').selectOption('L3');
  await form.locator('[data-member-form-submit]').click();
  await expect(form).not.toBeVisible();
  expect(state.calls.some(call => call.action === 'save-member' && call.body.displayName === '赵同学')).toBeTruthy();
  await expect(page.locator(`[data-member-row="${CREATED_ID}"]`)).toBeVisible();

  await page.locator(`[data-member-open="${CREATED_ID}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/members/${CREATED_ID}$`));
  await page.locator(`[data-member-edit="${CREATED_ID}"]`).first().click();
  await page.locator('[data-member-form-dialog] [name="displayName"]').fill('赵同学（已更新）');
  await page.locator('[data-member-form-submit]').click();
  await expect(page.getByRole('heading', { name: '赵同学（已更新）' })).toBeVisible();

  await page.locator('[data-member-archive]').click();
  const archiveDialog = page.locator('[data-member-archive-dialog]');
  await expect(archiveDialog).toBeVisible();
  await archiveDialog.locator('[data-member-archive-confirm]').click();
  await expect(page.locator('[data-member-restore]')).toBeVisible();
  expect(state.calls.some(call => call.action === 'archive-member')).toBeTruthy();
  await page.locator('[data-member-restore]').click();
  await expect(page.locator('[data-member-archive]')).toBeVisible();
  expect(state.calls.some(call => call.action === 'restore-member')).toBeTruthy();
});

test('a delayed archive response cannot rerender Coach Home over another area', async ({ page }) => {
  let releaseArchive;
  const archiveWait = new Promise(resolve => { releaseArchive = resolve; });
  const state = await mockMemberApi(page, { mutationWaits: { 'archive-member': archiveWait } });
  await page.goto('/#/coach/members');
  await page.locator(`[data-member-archive="${MEMBER_ID}"]`).click();
  const dialog = page.locator('[data-member-archive-dialog]');
  await dialog.locator('[data-member-archive-confirm]').click();
  await expect.poll(() => state.calls.filter(call => call.action === 'archive-member')).toHaveLength(1);
  await dialog.locator('[data-member-archive-cancel]').click();
  await page.goto('/#/library');
  await expect(page.locator('#page-title')).toHaveText('搜索');

  releaseArchive();
  await expect.poll(() => state.members.find(value => value.id === MEMBER_ID)?.archivedAt).toBeTruthy();
  await expect(page.locator('#page-title')).toHaveText('搜索');
  await expect(page.locator('#app-main .coach-member-entry')).toHaveCount(0);
});

test('a delayed restore response cannot rerender Coach Home over another area', async ({ page }) => {
  let releaseRestore;
  const restoreWait = new Promise(resolve => { releaseRestore = resolve; });
  const state = await mockMemberApi(page, { mutationWaits: { 'restore-member': restoreWait } });
  await page.goto('/#/coach/members');
  await page.locator('[data-member-filter="ARCHIVED"]').click();
  await page.locator(`[data-member-restore="${ARCHIVED_ID}"]`).click();
  await expect.poll(() => state.calls.filter(call => call.action === 'restore-member')).toHaveLength(1);
  await page.goto('/#/library');
  await expect(page.locator('#page-title')).toHaveText('搜索');

  releaseRestore();
  await expect.poll(() => state.members.find(value => value.id === ARCHIVED_ID)?.archivedAt).toBeNull();
  await expect(page.locator('#page-title')).toHaveText('搜索');
  await expect(page.locator('#app-main .coach-member-entry')).toHaveCount(0);
});

test('Member detail leads with recent training context and opens session detail with keyboard focus return', async ({ page }) => {
  const state = await mockMemberApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await expect(page.getByRole('heading', { name: '林同学' })).toBeVisible();
  const recent = page.locator('[data-member-recent-context]');
  await expect(recent).toBeVisible();
  await expect(recent.getByText('杠铃前蹲')).toBeVisible();
  expect(await recent.evaluate(node => node.compareDocumentPosition(document.querySelector('[data-member-profile]')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await expect(page.locator('[data-member-timeline] [data-session-status="PLANNED"]')).toBeVisible();
  await expect(page.locator('[data-member-timeline] [data-session-status="CANCELLED"]')).toBeVisible();
  expect(state.calls.some(call => call.action === 'get-member-training-context')).toBeTruthy();

  const trigger = page.locator('[data-open-session-detail]').first();
  await trigger.focus();
  await page.keyboard.press('Enter');
  const detail = page.locator('[data-member-session-detail]');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('杠铃前蹲');
  await page.keyboard.press('Escape');
  await expect(detail).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

async function copySourceRecordToCurrentMember(page, testInfo, status, sessionId) {
  const source = sourceDetailForCopy(status, sessionId);
  const original = JSON.parse(JSON.stringify(source));
  const state = await mockMemberApi(page, {
    members: [activeMember, archivedMember, member(COPY_TARGET_ID, '赵同学')],
    sessionDetailsById: { [sessionId]: source },
  });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);

  const plannedRow = page.locator(`[data-timeline-session="${sessionSummaries[0].id}"]`);
  const completedRow = page.locator(`[data-timeline-session="${sessionSummaries[1].id}"]`);
  const cancelledRow = page.locator(`[data-timeline-session="${sessionSummaries[2].id}"]`);
  await expect(plannedRow.locator('[data-copy-session-to-member]')).toHaveCount(1);
  await expect(completedRow.locator('[data-copy-session-to-member]')).toHaveCount(1);
  await expect(cancelledRow.locator('[data-copy-session-to-member]')).toHaveCount(0);
  await expect(plannedRow.locator('[data-copy-session-to-member]')).toHaveText('复制给会员');
  await expect(completedRow.locator('[data-copy-session-to-member]')).toHaveText('复制给会员');

  for (const viewport of [
    { width: 390, height: 844, name: '390x844' },
    { width: 1440, height: 1000, name: '1440x1000' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const row = page.locator(`[data-timeline-session="${sessionId}"]`);
    await row.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`member-copy-${status.toLowerCase()}-${viewport.name}.png`) });
  }

  const row = page.locator(`[data-timeline-session="${sessionId}"]`);
  await row.locator('[data-copy-session-to-member]').click();
  const dialog = page.locator('[data-member-save-dialog]');
  await expect.poll(() => state.calls.filter(call => call.action === 'save-planned-session')).toHaveLength(1);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-member-copy-feedback]')).toContainText('已复制给 林同学');
  await expect(page.locator(`[data-timeline-session="${state.savedSnapshots[0].session.id}"] [data-session-status]`)).toHaveAttribute('data-session-status', 'PLANNED');

  expect(state.calls.filter(call => call.action === 'get-session' && call.query.sessionId === sessionId)).toHaveLength(1);
  expect(state.calls.filter(call => call.action === 'save-planned-session')).toHaveLength(1);
  expect(state.calls.filter(call => call.action === 'list-members')).toHaveLength(0);
  expect(state.savedSnapshots).toHaveLength(1);
  const copied = state.savedSnapshots[0];
  expect(copied.session.memberId).toBe(MEMBER_ID);
  expect(copied.session.status).toBe('PLANNED');
  expect(copied.session.id).not.toBe(sessionId);
  expect(copied.session.idempotencyKey).not.toBe(source.session.idempotencyKey);
  expect(copied.items.map(item => ({
    phase: item.phase,
    slotKey: item.slotKey,
    sortOrder: item.sortOrder,
    plannedActionId: item.plannedActionId,
    plannedActionSnapshot: item.plannedActionSnapshot,
    plannedPrescriptionSnapshot: item.plannedPrescriptionSnapshot,
  }))).toEqual(original.items.map(item => ({
    phase: item.phase,
    slotKey: item.slotKey,
    sortOrder: item.sortOrder,
    plannedActionId: item.plannedActionId,
    plannedActionSnapshot: item.plannedActionSnapshot,
    plannedPrescriptionSnapshot: item.plannedPrescriptionSnapshot,
  })));
  for (const item of copied.items) {
    expect(item.id).not.toBe(original.items.find(sourceItem => sourceItem.sortOrder === item.sortOrder).id);
    expect(item.sessionId).toBe(copied.session.id);
    expect(item).toMatchObject({ performedActionId: null, performedActionSnapshot: null, performedPrescription: null, sets: null, reps: null, loadKg: null, rir: null, rpe: null, completed: false, note: null });
  }
  expect(source).toEqual(original);

  await row.locator('[data-copy-session-to-member]').click();
  await expect(page.locator('[data-member-copy-feedback]')).toContainText('今天已复制过这份计划');
  expect(state.calls.filter(call => call.action === 'save-planned-session')).toHaveLength(1);
  expect(state.savedSnapshots).toHaveLength(1);
}

async function copyFromSessionDrawerToCurrentMember(page, testInfo, status, sessionId) {
  const source = sourceDetailForCopy(status, sessionId);
  const state = await mockMemberApi(page, {
    sessionDetailsById: { [sessionId]: source },
  });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);

  const row = page.locator(`[data-timeline-session="${sessionId}"]`);
  await row.locator('[data-open-session-detail]').click();
  const detail = page.locator('[data-member-session-detail]');
  await expect(detail).toBeVisible();
  const copyButton = detail.locator('[data-session-copy-to-member]');
  await expect(copyButton).toHaveCount(1);
  await expect(copyButton).toHaveText('复制给会员');

  for (const viewport of [
    { width: 390, height: 844, name: '390x844' },
    { width: 1440, height: 1000, name: '1440x1000' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await copyButton.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`member-copy-drawer-${status.toLowerCase()}-${viewport.name}.png`) });
  }

  await copyButton.click();
  await expect.poll(() => state.savedSnapshots).toHaveLength(1);
  await expect(detail.locator('[data-member-copy-status]')).toContainText('已复制给 林同学');
  const copied = state.savedSnapshots[0];
  expect(copied.session.memberId).toBe(MEMBER_ID);
  expect(copied.session.status).toBe('PLANNED');
  expect(copied.session.id).not.toBe(sessionId);
  expect(copied.items.map(item => ({
    plannedActionId: item.plannedActionId,
    plannedActionSnapshot: item.plannedActionSnapshot,
    plannedPrescriptionSnapshot: item.plannedPrescriptionSnapshot,
    performedActionId: item.performedActionId,
    performedActionSnapshot: item.performedActionSnapshot,
    performedPrescription: item.performedPrescription,
    sets: item.sets,
    reps: item.reps,
    loadKg: item.loadKg,
    completed: item.completed,
    note: item.note,
  }))).toEqual(source.items.map(item => ({
    plannedActionId: item.plannedActionId,
    plannedActionSnapshot: item.plannedActionSnapshot,
    plannedPrescriptionSnapshot: item.plannedPrescriptionSnapshot,
    performedActionId: null,
    performedActionSnapshot: null,
    performedPrescription: null,
    sets: null,
    reps: null,
    loadKg: null,
    completed: false,
    note: null,
  })));
  expect(state.calls.filter(call => call.action === 'list-members')).toHaveLength(0);
  await expect(page.locator(`[data-timeline-session="${copied.session.id}"] [data-session-status]`)).toHaveAttribute('data-session-status', 'PLANNED');
}

test('a planned training record can be copied to the current member from its detail drawer', async ({ page }, testInfo) => {
  await copyFromSessionDrawerToCurrentMember(page, testInfo, 'PLANNED', sessionSummaries[0].id);
});

test('a completed training record can be copied to the current member from its detail drawer using only the original plan', async ({ page }, testInfo) => {
  await copyFromSessionDrawerToCurrentMember(page, testInfo, 'COMPLETED', sessionSummaries[1].id);
});

test('a cancelled training record cannot be copied from its detail drawer', async ({ page }) => {
  await mockMemberApi(page);
  await page.goto(`/#/coach/members/${MEMBER_ID}`);

  const row = page.locator(`[data-timeline-session="${sessionSummaries[2].id}"]`);
  await row.locator('[data-open-session-detail]').click();
  const detail = page.locator('[data-member-session-detail]');
  await expect(detail).toBeVisible();
  await expect(detail.locator('[data-session-copy-to-member]')).toHaveCount(0);
});

test('a planned training record can be copied to the member on the current detail page', async ({ page }, testInfo) => {
  await copySourceRecordToCurrentMember(page, testInfo, 'PLANNED', sessionSummaries[0].id);
});

test('a completed training record copies only its original plan to the member on the current detail page', async ({ page }, testInfo) => {
  await copySourceRecordToCurrentMember(page, testInfo, 'COMPLETED', sessionSummaries[1].id);
});

test('Member with no completed history can still enter F111 at her training level', async ({ page }) => {
  const state = await mockMemberApi(page, {
    sessions: [],
    context: { ...context, lastCompletedSession: null, recentSessions: [], recentPatterns: [], recentActions: [], recentPrimaryMuscles: [] },
  });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await expect(page.locator('[data-member-recent-empty]')).toContainText('暂无已完成训练');
  const nextSession = page.locator('[data-member-next-session]');
  await expect(nextSession).toHaveAttribute('href', `#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  await nextSession.click();
  const panel = page.locator('[data-member-first-context]');
  await expect(panel.getByRole('heading', { name: '正在为林同学 · L2 编排训练' })).toBeVisible();
  await expect(panel).toContainText('暂无已完成训练');
  expect(state.calls.filter(call => call.action === 'get-member-training-context')).toHaveLength(2);
});

test('A planned session can be completed in one action with planned items preserved', async ({ page }, testInfo) => {
  const state = await mockMemberApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await page.locator(`[data-open-session-detail][data-session-id="${sessionSummaries[0].id}"]`).click();
  const detail = page.locator('[data-member-session-detail]');
  await expect(detail).toBeVisible();
  const execution = detail.locator('[data-session-execution]');
  await expect(execution).toBeVisible();
  await expect(execution.locator('[data-session-planned-prescription]')).toContainText('计划处方：4 组 × 8 次');
  await page.screenshot({ path: testInfo.outputPath('member-session-execution-390x844.png') });
  await detail.locator('[data-session-complete]').click();

  await expect(detail).toContainText('已完成');
  await expect(page.locator(`[data-timeline-session="${sessionSummaries[0].id}"] [data-session-status="COMPLETED"]`)).toBeVisible();
  expect(state.completions).toHaveLength(1);
  expect(state.completions[0].completeAsPlanned).toBe(true);
  expect(state.completions[0].items).toBeUndefined();
  const item = state.itemsBySession[sessionSummaries[0].id][0];
  expect(item.plannedActionId).toBe('barbell_front_squat');
  expect(item.performedActionId).toBe(item.plannedActionId);
  expect(item.performedActionSnapshot).toEqual(item.plannedActionSnapshot);
});

test('A planned session can save an on-site replacement and optional actual values', async ({ page }) => {
  const replacementAction = { id: 'hake_shendun', name: '哈克深蹲', pattern: '蹲', level: 'T3', primaryMuscles: ['股四头肌', '臀大肌'], secondaryMuscles: ['内收肌群'], equipment: '哈克深蹲机', stationId: null };
  const state = await mockMemberApi(page, { itemsBySession: { [sessionSummaries[0].id]: [plannedItem(sessionSummaries[0].id, replacementAction)] } });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await page.locator(`[data-open-session-detail][data-session-id="${sessionSummaries[0].id}"]`).click();
  const detail = page.locator('[data-member-session-detail]');
  const replacement = detail.locator('[data-session-replacement]');
  await replacement.selectOption('gaojiaobei_shendun');
  await detail.locator('.member-session-actual summary').click();
  await detail.locator('[data-session-actual="sets"]').fill('3');
  await detail.locator('[data-session-actual="reps"]').fill('10');
  await detail.locator('[data-session-actual="loadKg"]').fill('20');
  await detail.locator('[data-session-actual="rir"]').fill('2.5');
  await detail.locator('[data-session-actual="rpe"]').fill('8');
  await detail.locator('[data-session-actual="note"]').fill('临时调整');
  await detail.locator('[data-session-complete]').click();

  await expect(detail).toContainText('计划：哈克深蹲');
  await expect(detail).toContainText('实际：高脚杯深蹲');
  expect(state.completions).toHaveLength(1);
  const patch = state.completions[0].items[0];
  expect(patch.performedActionId).toBe('gaojiaobei_shendun');
  expect(patch.performedActionSnapshot).toMatchObject({ actionId: 'gaojiaobei_shendun', name: '高脚杯深蹲', pattern: '蹲' });
  expect(patch).toMatchObject({ sets: 3, reps: '10', loadKg: 20, rir: 2.5, rpe: 8, note: '临时调整' });
  const saved = state.itemsBySession[sessionSummaries[0].id][0];
  expect(saved.plannedActionId).toBe('hake_shendun');
  expect(saved.plannedActionSnapshot.name).toBe('哈克深蹲');
  expect(saved.performedActionSnapshot.name).toBe('高脚杯深蹲');
});

test('A planned session requires an explicit second action before cancellation', async ({ page }) => {
  const state = await mockMemberApi(page);
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await page.locator(`[data-open-session-detail][data-session-id="${sessionSummaries[0].id}"]`).click();
  const detail = page.locator('[data-member-session-detail]');
  await detail.locator('[data-session-cancel-request]').click();
  await expect(detail.locator('[data-session-cancel-confirmation]')).toBeVisible();
  await detail.locator('[data-session-cancel-confirm]').click();

  await expect(detail).toContainText('已取消');
  await expect(page.locator(`[data-timeline-session="${sessionSummaries[0].id}"] [data-session-status="CANCELLED"]`)).toBeVisible();
  expect(state.calls.some(call => call.action === 'cancel-session' && call.body.expectedRevision === 1)).toBeTruthy();
  expect(state.completions).toHaveLength(0);
});

test('closing a completed session returns keyboard focus to the rebuilt timeline trigger', async ({ page }) => {
  const state = await mockMemberApi(page);
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  const sessionId = sessionSummaries[0].id;
  await page.locator(`[data-open-session-detail][data-session-id="${sessionId}"]`).click();
  const detail = page.locator('[data-member-session-detail]');
  await detail.locator('[data-session-complete]').click();
  await expect(page.locator(`[data-timeline-session="${sessionId}"] [data-session-status="COMPLETED"]`)).toBeVisible();
  await detail.locator('[data-session-detail-close]').click();
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return active?.matches('[data-open-session-detail]') ? active.dataset.sessionId : '';
  })).toBe(sessionId);
  expect(state.completions).toHaveLength(1);
});

test('closing a cancelled session returns keyboard focus to the rebuilt timeline trigger', async ({ page }) => {
  const state = await mockMemberApi(page);
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  const sessionId = sessionSummaries[0].id;
  await page.locator(`[data-open-session-detail][data-session-id="${sessionId}"]`).click();
  const detail = page.locator('[data-member-session-detail]');
  await detail.locator('[data-session-cancel-request]').click();
  await detail.locator('[data-session-cancel-confirm]').click();
  await expect(page.locator(`[data-timeline-session="${sessionId}"] [data-session-status="CANCELLED"]`)).toBeVisible();
  await detail.locator('[data-session-detail-close]').click();
  await expect.poll(() => page.evaluate(() => {
    const active = document.activeElement;
    return active?.matches('[data-open-session-detail]') ? active.dataset.sessionId : '';
  })).toBe(sessionId);
  expect(state.calls.filter(call => call.action === 'cancel-session')).toHaveLength(1);
});

test('A failed completion can be retried without changing the planned session', async ({ page }) => {
  const state = await mockMemberApi(page, { failComplete: true });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await page.locator(`[data-open-session-detail][data-session-id="${sessionSummaries[0].id}"]`).click();
  const detail = page.locator('[data-member-session-detail]');
  await detail.locator('[data-session-complete]').click();
  await expect(detail.locator('[data-session-mutation-error]')).toContainText('暂时无法确认');
  expect(page.memberConsoleErrors).toContain('Failed to load resource: the server responded with a status of 503 (Service Unavailable)');
  page.memberConsoleErrors=[];
  await expect(page.locator(`[data-timeline-session="${sessionSummaries[0].id}"] [data-session-status="PLANNED"]`)).toBeVisible();
  expect(state.completions).toHaveLength(0);

  state.failComplete = false;
  await detail.locator('[data-session-complete]').click();
  await expect(detail).toContainText('已完成');
  expect(state.completionAttempts).toHaveLength(2);
  expect(state.completions).toHaveLength(1);
});

test('A lost completion response can be retried without creating a duplicate completion', async ({ page }) => {
  const state = await mockMemberApi(page, { dropFirstCompletionResponse: true });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await page.locator(`[data-open-session-detail][data-session-id="${sessionSummaries[0].id}"]`).click();
  const detail = page.locator('[data-member-session-detail]');
  const originalRequest = { completeAsPlanned: true };
  await detail.locator('[data-session-complete]').click();
  await expect(detail.locator('[data-session-mutation-error]')).toContainText('没有收到保存结果');
  expect(page.memberConsoleErrors).toContain('Failed to load resource: net::ERR_FAILED');
  page.memberConsoleErrors=[];
  expect(state.sessions.find(value => value.id === sessionSummaries[0].id).status).toBe('COMPLETED');

  await detail.locator('[data-session-complete]').click();
  await expect(detail).toContainText('已完成');
  expect(state.completionAttempts).toHaveLength(2);
  expect(state.completions).toHaveLength(1);
  expect(state.completionAttempts[0]).toMatchObject(originalRequest);
  expect(state.completionAttempts[1]).toEqual(state.completionAttempts[0]);
});

test('Member-first F111 opens at the member level with fresh context and unchanged resolver selections', async ({ page }, testInfo) => {
  const state = await mockMemberApi(page);
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  const baseline = await page.evaluate(() => {
    const route = window.V14Router.parseHash('#/coach/f111?level=L2');
    return window.V14CoachModules.ComposerView.composerContext(route).resolvedSession.main.content.map(slot => [slot.key, slot.actionId]);
  });
  const nextSession = page.locator('[data-member-next-session]');
  await expect(nextSession).toHaveAttribute('href', `#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  await nextSession.click();
  const panel = page.locator('[data-member-first-context]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: '正在为林同学 · L2 编排训练' })).toBeVisible();
  await expect(panel).toContainText('全身塑形');
  await expect(panel).toContainText('杠铃前蹲');
  await expect(panel).not.toContainText('下肢力量');
  await expect(panel).not.toContainText('上肢训练');
  expect(state.calls.some(call => call.action === 'get-member-training-context' && call.query.memberId === MEMBER_ID)).toBeTruthy();
  const memberRoute = await page.evaluate(() => {
    const route = window.V14Router.parseHash(location.hash);
    return {
      memberId: route.query.memberId,
      level: window.V14CoachModules.ComposerView.composerContext(route).level,
      slots: window.V14CoachModules.ComposerView.composerContext(route).resolvedSession.main.content.map(slot => [slot.key, slot.actionId]),
    };
  });
  expect(memberRoute.memberId).toBe(MEMBER_ID);
  expect(memberRoute.level).toBe('L2');
  expect(memberRoute.slots).toEqual(baseline);

  for (const size of [{ width: 360, height: 844 }, { width: 390, height: 844 }, { width: 430, height: 932 }, { width: 1080, height: 900 }, { width: 1280, height: 900 }, { width: 1440, height: 960 }]) {
    await page.setViewportSize(size);
    await page.goto(`/#/coach/members/${MEMBER_ID}`);
    await page.locator('[data-member-next-session]').click();
    const contextPanel = page.locator('[data-member-first-context]');
    await expect(contextPanel.getByRole('heading', { name: '正在为林同学 · L2 编排训练' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
      contextWidth: document.querySelector('[data-member-first-context]').clientWidth,
      contextContentWidth: document.querySelector('[data-member-first-context]').scrollWidth,
    }));
    expect(dimensions.pageWidth, `page overflow at ${size.width}px`).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.contextContentWidth, `member context overflow at ${size.width}px`).toBeLessThanOrEqual(dimensions.contextWidth);
    await page.screenshot({ path: testInfo.outputPath(`member-first-f111-${size.width}x${size.height}.png`) });
    await expect(page.locator(`.f111-level-switch a[href*="level=L3"]`)).toHaveAttribute('href', /memberId=/);
  }
});

test('Member-first F111 remains usable and can retry when context loading fails', async ({ page }) => {
  const state = await mockMemberApi(page, { failContext: true });
  await page.goto(`/#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  const panel = page.locator('[data-member-first-context]');
  await expect(panel.getByRole('alert')).toContainText('会员训练上下文暂时无法读取');
  await expect(page.locator('.f111-level-switch a.active')).toHaveText('L2');
  expect(page.memberConsoleErrors).toContain('Failed to load resource: the server responded with a status of 503 (Service Unavailable)');
  page.memberConsoleErrors=[];

  state.failContext = false;
  await panel.locator('[data-member-context-retry]').click();
  await expect(panel.getByRole('heading', { name: '正在为林同学 · L2 编排训练' })).toBeVisible();
  await expect(panel).toContainText('全身塑形');
  expect(state.calls.filter(call => call.action === 'get-member-training-context')).toHaveLength(2);
});

test('Member-first F111 offers PIN verification recovery when the staff session expires', async ({ page }) => {
  const state = await mockMemberApi(page, { failContext: true, unauthorizedContext: true });
  await page.goto(`/#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  const panel = page.locator('[data-member-first-context]');
  await expect(panel.getByRole('alert')).toContainText('教练登录已失效');
  await expect(panel.locator('[data-member-auth-link]')).toHaveAttribute('target', '_blank');
  page.memberConsoleErrors=[];
  state.failContext = false;
  state.unauthorizedContext = false;
  await page.evaluate(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({ token: 'member-center-recovered-token', expiresAt: '2026-10-27T12:00:00.000Z' })));
  await panel.locator('[data-member-context-retry]').click();
  await expect(panel).toContainText('全身塑形');
  page.memberConsoleErrors=[];
});

test('Member-first F111 reloads context after leaving Coach for another area', async ({ page }) => {
  const state = await mockMemberApi(page);
  await page.goto(`/#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  const panel = page.locator('[data-member-first-context]');
  await expect(panel).toContainText('全身塑形');
  expect(state.calls.filter(call => call.action === 'get-member-training-context')).toHaveLength(1);

  await page.goto('/#/system/patterns');
  await expect(page.getByRole('region', { name: '训练模式与进阶路线' })).toBeVisible();
  state.context = {
    ...context,
    lastCompletedSession: { ...context.lastCompletedSession, sessionTitle: '刚更新的训练记录' },
    recentSessions: [{ ...context.recentSessions[0], sessionTitle: '刚更新的训练记录' }],
    recentActions: [{ ...context.recentActions[0], actionNameSnapshot: '刚更新的动作' }],
  };

  await page.goto(`/#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  await expect(page.locator('[data-member-first-context]')).toContainText('刚更新的训练记录');
  await expect(page.locator('[data-member-first-context]')).toContainText('刚更新的动作');
  expect(state.calls.filter(call => call.action === 'get-member-training-context')).toHaveLength(2);
});

test('Member-first F111 updates a persistent live region when context loads', async ({ page }) => {
  let releaseContext;
  const contextWait = new Promise(resolve => { releaseContext = resolve; });
  await mockMemberApi(page, { contextWait });
  await page.goto(`/#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  const panel = page.locator('[data-member-first-context]');
  const liveRegion = panel.locator('[data-member-context-live]');
  await expect(liveRegion).toContainText('正在读取会员训练上下文');
  const liveRegionHandle = await liveRegion.elementHandle();
  releaseContext();
  await expect(liveRegion).toContainText('全身塑形');
  expect(await liveRegionHandle.evaluate(node => node.isConnected)).toBe(true);
  await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
});

test('Member Center exposes loading, empty, and recoverable error states', async ({ page }) => {
  let releaseList;
  const listWait = new Promise(resolve => { releaseList = resolve; });
  const state = await mockMemberApi(page, { members: [], failList: true, listWait });
  await page.goto('/#/coach/members');
  await expect(page.locator('[data-member-loading]')).toBeVisible();
  releaseList();
  await expect(page.locator('[data-member-error]')).toBeVisible();
  expect(page.memberConsoleErrors).toContain('Failed to load resource: the server responded with a status of 503 (Service Unavailable)');
  page.memberConsoleErrors=[];
  state.failList = false;
  await page.locator('[data-member-retry]').click();
  await expect(page.locator('[data-member-empty]')).toBeVisible();
});

test('Member timeline loads older sessions in bounded pages', async ({ page }) => {
  const sessions = Array.from({ length: 61 }, (_, index) => ({
    ...sessionSummaries[1],
    id: `e2000000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    sessionDate: new Date(Date.UTC(2026, 8, 27 - index)).toISOString().slice(0, 10),
    sessionTitle: `训练 ${index + 1}`,
  }));
  const state = await mockMemberApi(page, { sessions });
  await page.goto(`/#/coach/members/${MEMBER_ID}`);

  await expect(page.locator('[data-member-timeline] [data-session-status]')).toHaveCount(30);
  await expect(page.locator('[data-member-load-more]')).toBeVisible();
  expect(state.calls.some(call => call.action === 'list-sessions' && call.query.limit === '30' && call.query.offset === '0')).toBeTruthy();

  await page.locator('[data-member-load-more]').click();
  await expect(page.locator('[data-member-timeline] [data-session-status]')).toHaveCount(60);
  await expect(page.locator('[data-member-load-more]')).toBeVisible();

  await page.locator('[data-member-load-more]').click();
  await expect(page.locator('[data-member-timeline] [data-session-status]')).toHaveCount(61);
  await expect(page.locator('[data-member-load-more]')).toHaveCount(0);
  expect(state.calls.some(call => call.action === 'list-sessions' && call.query.limit === '30' && call.query.offset === '30')).toBeTruthy();
  expect(state.calls.some(call => call.action === 'list-sessions' && call.query.limit === '30' && call.query.offset === '60')).toBeTruthy();
});

test('Member detail and course sheet fit the required responsive viewport matrix', async ({ page }, testInfo) => {
  await mockMemberApi(page);
  const viewports = [
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1080, height: 900 },
    { width: 1280, height: 900 },
    { width: 1440, height: 960 },
  ];
  await page.setViewportSize(viewports[0]);
  await page.goto(`/#/coach/members/${MEMBER_ID}`);
  await expect(page.locator('[data-member-timeline]')).toBeVisible();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`member-detail-${viewport.width}x${viewport.height}.png`), fullPage: true });
    const trigger = page.locator('[data-open-session-detail]').first();
    await trigger.click();
    const detail = page.locator('[data-member-session-detail]');
    await expect(detail).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath(`member-course-${viewport.width}x${viewport.height}.png`), fullPage: true });
    await page.keyboard.press('Escape');
    await expect(detail).not.toBeVisible();
  }
  for (const viewport of [viewports[1], viewports[4]]) {
    await page.setViewportSize(viewport);
    await page.goto('/#/coach/members');
    await expect(page.locator('[data-member-row]')).toHaveCount(1);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath(`member-list-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }
});
