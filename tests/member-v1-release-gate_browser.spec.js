const { test, expect } = require('@playwright/test');
const domainPromise = import('../supabase/functions/_shared/member-domain.mjs');

const API = 'https://ynsodlyanpmixbbxblqh.supabase.co/functions/v1/member-api';
const MEMBER_ID = 'e9000000-0000-4000-8000-000000000001';

test.beforeEach(async ({ page }) => {
  page.releasePageErrors = [];
  page.releaseConsoleErrors = [];
  page.on('pageerror', error => page.releasePageErrors.push(error.message || String(error)));
  page.on('console', message => { if (message.type() === 'error') page.releaseConsoleErrors.push(message.text()); });
  await page.addInitScript(() => localStorage.setItem('7fit_case_admin_session', JSON.stringify({
    token: 'member-release-gate-test-token', expiresAt: '2026-10-27T12:00:00.000Z',
  })));
});

test.afterEach(async ({ page }) => {
  expect(page.releasePageErrors).toEqual([]);
  expect(page.releaseConsoleErrors).toEqual([]);
});

async function installReleaseApi(page) {
  const domain = await domainPromise;
  const state = { members: [], sessions: [], itemsBySession: {}, calls: [], snapshots: [], completions: [] };
  const memberFrom = body => ({
    schemaVersion: 1,
    id: body.id || MEMBER_ID,
    displayName: body.displayName,
    status: 'ACTIVE',
    trainingLevel: body.trainingLevel || null,
    primaryGoal: body.primaryGoal || null,
    trainingProfile: body.trainingProfile || { schemaVersion: 1, experienceLevel: null, movementConstraints: [], preferredEquipment: [], notes: null },
    coachNotes: body.coachNotes || null,
    createdAt: '2026-09-27T09:00:00.000Z',
    updatedAt: '2026-09-27T09:00:00.000Z',
    archivedAt: null,
  });
  const response = (route, payload, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(payload) });

  await page.route(`${API}**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const action = url.searchParams.get('action');
    const body = request.method() === 'POST' ? request.postDataJSON() : null;
    state.calls.push({ action, body, query: Object.fromEntries(url.searchParams) });

    if (action === 'list-members') {
      const search = (url.searchParams.get('search') || '').toLocaleLowerCase();
      const includeArchived = url.searchParams.get('includeArchived') === 'true';
      const rows = state.members.filter(value => value.displayName.toLocaleLowerCase().includes(search)
        && (includeArchived || (value.status === 'ACTIVE' && !value.archivedAt)));
      return response(route, { members: rows.slice(0, Number(url.searchParams.get('limit')) || 100) });
    }
    if (action === 'get-member') {
      const member = state.members.find(value => value.id === url.searchParams.get('memberId'));
      return member ? response(route, { member }) : response(route, { error: 'member_not_found' }, 404);
    }
    if (action === 'save-member') {
      const member = memberFrom(body);
      state.members = [member];
      return response(route, { member });
    }
    if (action === 'get-member-training-context') {
      const member = state.members.find(value => value.id === url.searchParams.get('memberId'));
      if (!member) return response(route, { error: 'member_not_found' }, 404);
      const sessions = state.sessions.filter(value => value.memberId === member.id).map(value => ({
        ...value,
        items: state.itemsBySession[value.id] || [],
      }));
      const context = domain.deriveMemberTrainingContext(member, sessions, { generatedAt: '2026-09-27T15:00:00.000Z' });
      return response(route, { context });
    }
    if (action === 'list-sessions') {
      const memberId = url.searchParams.get('memberId');
      const offset = Number(url.searchParams.get('offset')) || 0;
      const limit = Number(url.searchParams.get('limit')) || 30;
      const sessions = state.sessions.filter(value => value.memberId === memberId)
        .sort((left, right) => String(right.sessionDate).localeCompare(String(left.sessionDate)));
      return response(route, { sessions: sessions.slice(offset, offset + limit) });
    }
    if (action === 'get-session') {
      const session = state.sessions.find(value => value.id === url.searchParams.get('sessionId'));
      if (!session) return response(route, { error: 'session_not_found' }, 404);
      return response(route, { session, items: state.itemsBySession[session.id] || [] });
    }
    if (action === 'save-planned-session') {
      const snapshot = body.snapshot;
      state.snapshots.push(snapshot);
      state.sessions.unshift({ ...snapshot.session, revision: 1 });
      state.itemsBySession[snapshot.session.id] = snapshot.items.map(item => ({ ...item }));
      return response(route, { sessionId: snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false });
    }
    if (action === 'complete-session') {
      const session = state.sessions.find(value => value.id === body.sessionId);
      if (!session) return response(route, { error: 'session_not_found' }, 404);
      const itemPatches = new Map((body.items || []).map(item => [item.id, item]));
      const before = state.itemsBySession[session.id] || [];
      state.completions.push(body);
      state.itemsBySession[session.id] = before.map(item => {
        const patch = itemPatches.get(item.id) || {};
        return {
          ...item,
          ...patch,
          performedActionId: patch.performedActionId || item.performedActionId || item.plannedActionId,
          performedActionSnapshot: patch.performedActionSnapshot || item.performedActionSnapshot || item.plannedActionSnapshot,
          completed: patch.completed ?? true,
        };
      });
      Object.assign(session, { status: 'COMPLETED', completedAt: '2026-09-27T14:30:00.000Z', revision: (session.revision || 1) + 1 });
      return response(route, { sessionId: session.id, status: 'COMPLETED', revision: session.revision, idempotentReplay: false });
    }
    throw new Error(`Unexpected release-gate member API action: ${action}`);
  });
  return state;
}

test('Member-first and Template-first F111 complete the local release flow', async ({ page }) => {
  const state = await installReleaseApi(page);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/#/coach/members');
  await page.locator('.member-center-heading [data-member-create]').click();
  const memberForm = page.locator('[data-member-form-dialog]');
  await memberForm.locator('[name="displayName"]').fill('林同学');
  await memberForm.locator('[name="trainingLevel"]').selectOption('L2');
  await memberForm.locator('[name="primaryGoal"]').fill('提升力量');
  await memberForm.locator('[data-member-form-submit]').click();
  await expect(page.locator(`[data-member-row="${MEMBER_ID}"]`)).toBeVisible();
  await page.locator(`[data-member-open="${MEMBER_ID}"]`).click();
  await expect(page.locator('[data-member-recent-empty]')).toContainText('暂无已完成训练');
  const nextSession = page.locator('[data-member-next-session]');
  await expect(nextSession).toHaveAttribute('href', `#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  await nextSession.click();
  const memberContext = page.locator('[data-member-first-context]');
  await expect(memberContext.getByRole('heading', { name: '正在为林同学 · L2 编排训练' })).toBeVisible();
  await expect(memberContext).toContainText('暂无已完成训练');

  await page.locator('[data-save-member-session]').click();
  const saveDialog = page.locator('[data-member-save-dialog]');
  const firstMemberSelect = saveDialog.locator('[data-member-save-select]');
  await expect(firstMemberSelect).toContainText('林同学');
  await firstMemberSelect.selectOption(MEMBER_ID);
  await saveDialog.locator('[data-member-save-submit]').click();
  await expect(saveDialog.locator('[data-member-save-status]')).toContainText('已保存到 林同学 · PLANNED');
  const firstSnapshot = state.snapshots[0];
  const firstSessionId = firstSnapshot.session.id;
  expect(firstSnapshot.session.status).toBe('PLANNED');
  expect(firstSnapshot.session.memberId).toBe(MEMBER_ID);
  await saveDialog.locator('[data-member-save-cancel]').click();

  await page.locator(`.member-first-context a[href="#/coach/members/${MEMBER_ID}"]`).click();
  await expect(page.locator(`[data-timeline-session="${firstSessionId}"] [data-session-status="PLANNED"]`)).toBeVisible();
  await page.locator(`[data-open-session-detail][data-session-id="${firstSessionId}"]`).click();
  const sessionDetail = page.locator('[data-member-session-detail]');
  const rows = sessionDetail.locator('[data-session-item]');
  await expect(rows.first()).toBeVisible();
  let targetRow = null;
  let replacementActionId = '';
  for (let index = 0; index < await rows.count(); index++) {
    const row = rows.nth(index);
    const select = row.locator('[data-session-replacement]');
    if (await select.count() && await select.locator('option').count() > 1) {
      targetRow = row;
      replacementActionId = await select.locator('option').nth(1).getAttribute('value');
      break;
    }
  }
  expect(targetRow, 'a saved primary action should have a same-pattern replacement').toBeTruthy();
  const plannedItemId = await targetRow.getAttribute('data-session-item');
  const replacement = targetRow.locator('[data-session-replacement]');
  await replacement.selectOption(replacementActionId);
  const replacementName = await page.evaluate(actionId => window.V14_DATA.actions[actionId].name, replacementActionId);
  await targetRow.locator('.member-session-actual summary').click();
  await targetRow.locator('[data-session-actual="sets"]').fill('3');
  await targetRow.locator('[data-session-actual="reps"]').fill('10');
  await targetRow.locator('[data-session-actual="loadKg"]').fill('20');
  await targetRow.locator('[data-session-actual="rir"]').fill('2');
  await targetRow.locator('[data-session-actual="rpe"]').fill('8');
  await targetRow.locator('[data-session-actual="note"]').fill('临场调整');
  await sessionDetail.locator('[data-session-complete]').click();
  await expect(sessionDetail).toContainText(`实际：${replacementName}`);
  await expect(page.locator(`[data-timeline-session="${firstSessionId}"] [data-session-status="COMPLETED"]`)).toBeVisible();

  const completedItem = state.itemsBySession[firstSessionId].find(item => item.id === plannedItemId);
  expect(completedItem.plannedActionId).not.toBe(completedItem.performedActionId);
  expect(completedItem.performedActionSnapshot.name).toBe(replacementName);
  expect(completedItem).toMatchObject({ sets: 3, reps: '10', loadKg: 20, rir: 2, rpe: 8, note: '临场调整' });
  const plannedBefore = firstSnapshot.items.find(item => item.id === plannedItemId);
  expect(completedItem.plannedActionSnapshot).toEqual(plannedBefore.plannedActionSnapshot);
  expect(state.completions).toHaveLength(1);
  expect(state.completions[0].expectedRevision).toBe(1);

  await sessionDetail.locator('[data-session-detail-close]').click();
  await expect(page.locator('[data-member-recent-context]')).toContainText(replacementName);

  const plannedActionBeforeMetadataChange = structuredClone(plannedBefore.plannedActionSnapshot);
  const performedActionBeforeMetadataChange = structuredClone(completedItem.performedActionSnapshot);
  const plannedActionId = plannedBefore.plannedActionId;
  const mutatedCatalogMetadata = await page.evaluate(({ plannedActionId: planId, performedActionId: actualId }) => {
    Object.assign(window.V14_DATA.actions[planId], {
      name: '目录更新后的计划动作', level: 'T1', primaryMuscles: ['新的主要肌群'],
    });
    Object.assign(window.V14_DATA.actions[actualId], {
      name: '目录更新后的实际动作', level: 'T1', primaryMuscles: ['新的实际肌群'],
    });
    return {
      planned: { name: window.V14_DATA.actions[planId].name, level: window.V14_DATA.actions[planId].level, primaryMuscles: window.V14_DATA.actions[planId].primaryMuscles },
      performed: { name: window.V14_DATA.actions[actualId].name, level: window.V14_DATA.actions[actualId].level, primaryMuscles: window.V14_DATA.actions[actualId].primaryMuscles },
    };
  }, { plannedActionId, performedActionId: replacementActionId });
  expect(mutatedCatalogMetadata).toEqual({
    planned: { name: '目录更新后的计划动作', level: 'T1', primaryMuscles: ['新的主要肌群'] },
    performed: { name: '目录更新后的实际动作', level: 'T1', primaryMuscles: ['新的实际肌群'] },
  });
  await page.locator(`[data-open-session-detail][data-session-id="${firstSessionId}"]`).click();
  await expect(sessionDetail).toContainText(`计划：${plannedActionBeforeMetadataChange.name}`);
  await expect(sessionDetail).toContainText(`实际：${performedActionBeforeMetadataChange.name}`);
  await expect(sessionDetail).not.toContainText('目录更新后的计划动作');
  await expect(sessionDetail).not.toContainText('目录更新后的实际动作');
  expect(completedItem.plannedActionSnapshot).toEqual(plannedActionBeforeMetadataChange);
  expect(completedItem.performedActionSnapshot).toEqual(performedActionBeforeMetadataChange);
  await sessionDetail.locator('[data-session-detail-close]').click();

  await page.locator('[data-member-next-session]').click();
  const refreshedContext = page.locator('[data-member-first-context]');
  await expect(refreshedContext).toContainText(firstSnapshot.session.sessionTitle);
  await expect(refreshedContext).toContainText(replacementName);
  expect(state.calls.filter(call => call.action === 'get-member-training-context').length).toBeGreaterThanOrEqual(4);

  await page.goto('/#/coach/f111?level=L3&lower=squat&upper=horizontal_pull&core=anti_extension');
  await page.locator('#copy-member-session').click();
  expect(state.calls.filter(call => call.action === 'save-planned-session')).toHaveLength(1);
  await page.locator('[data-save-member-session]').click();
  const templateSaveDialog = page.locator('[data-member-save-dialog]');
  const templateMemberSelect = templateSaveDialog.locator('[data-member-save-select]');
  await expect(templateMemberSelect).toContainText('林同学');
  await templateMemberSelect.selectOption(MEMBER_ID);
  await templateSaveDialog.locator('[data-member-save-submit]').click();
  await expect(templateSaveDialog.locator('[data-member-save-status]')).toContainText('已保存到 林同学 · PLANNED');
  expect(state.snapshots).toHaveLength(2);
  expect(state.snapshots[1].session.memberId).toBe(MEMBER_ID);
  expect(state.snapshots[1].session.status).toBe('PLANNED');
  expect(state.snapshots[1].session.id).not.toBe(firstSessionId);

  const plannedPrescriptions = new Map(firstSnapshot.items.map(item => [item.slotKey, item.plannedPrescriptionSnapshot]));
  expect(plannedPrescriptions.get('C').rawText).toBeTruthy();
  expect(plannedPrescriptions.get('D1').rawText).toBeTruthy();
  expect(plannedPrescriptions.get('D2').rawText).toBeTruthy();
  await page.evaluate(() => {
    Object.assign(window.V14_DATA.composer.prescriptionBySlot, {
      C: '后续变更的支撑处方', D1: '后续变更的辅助处方', D2: '后续变更的手臂处方',
    });
  });
  for (const item of state.itemsBySession[firstSessionId]) {
    expect(item.plannedPrescriptionSnapshot).toEqual(plannedPrescriptions.get(item.slotKey));
  }
});

test('Member-first context shows all recent actions including a late-sorting performed replacement', async ({ page }) => {
  const state = await installReleaseApi(page);
  state.members.push({ id: MEMBER_ID, displayName: '上下文验收会员', trainingLevel: 'L2', status: 'ACTIVE' });
  const sessionId = 'e9000000-0000-4000-8000-000000000002';
  state.sessions.push({
    id: sessionId,
    memberId: MEMBER_ID,
    sessionDate: '2026-09-28',
    createdAt: '2026-09-28T09:00:00.000Z',
    completedAt: '2026-09-28T10:00:00.000Z',
    status: 'COMPLETED',
    templateKey: 'f111',
    sessionTitle: 'F111 验收课',
  });
  const actualNames = ['Action B', 'Action C', 'Action D', 'Action E', 'Action F', 'Z Actual Replacement'];
  state.itemsBySession[sessionId] = actualNames.map((name, sortOrder) => {
    const actionId = `actual-${sortOrder}`;
    const actualSnapshot = {
      actionId,
      name,
      pattern: ['SQUAT', 'HORIZONTAL_PULL', 'HIP_HINGE', 'VERTICAL_PULL', 'ANTI_ROTATION', 'SQUAT'][sortOrder],
      primaryMuscles: ['Test muscle'],
    };
    const isReplacement = sortOrder === actualNames.length - 1;
    return {
      id: `item-${sortOrder}`,
      phase: sortOrder === 0 ? 'PRIMARY' : sortOrder === 1 ? 'SECONDARY' : sortOrder === 5 ? 'CORE' : 'ACCESSORY',
      sortOrder,
      completed: true,
      plannedActionId: isReplacement ? 'planned-squat' : actionId,
      plannedActionSnapshot: isReplacement ? { ...actualSnapshot, actionId: 'planned-squat', name: 'Original Planned Squat' } : actualSnapshot,
      performedActionId: actionId,
      performedActionSnapshot: actualSnapshot,
    };
  });

  await page.goto(`/#/coach/f111?memberId=${MEMBER_ID}&level=L2`);
  const context = page.locator('[data-member-first-context]');
  const recentActionList = context.locator('.member-first-context-columns section').first().locator('li');
  await expect(context).toContainText('F111 验收课');
  await expect(recentActionList).toHaveCount(actualNames.length);
  await expect(context).toContainText('Z Actual Replacement');
  await expect(context).not.toContainText('Original Planned Squat');
});
