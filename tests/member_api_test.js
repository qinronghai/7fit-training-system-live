const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fixtureRoot = path.join(__dirname, 'fixtures', 'member-v1');
const memberFixture = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'member-active.json'), 'utf8'));
const plannedFixture = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'f111-training-session.json'), 'utf8'));
const replacedFixture = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'replaced-action-completed.json'), 'utf8'));
const NOW = new Date('2026-09-27T12:00:00.000Z');

function makeRequest(action, { method = 'GET', body, token = 'valid', query = '' } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return new Request(`https://7fit.example/functions/v1/member-api?action=${action}${query}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function createAuth() {
  return { async verify(header) { return { ok: header === 'Bearer valid' }; } };
}

function repository(overrides = {}) {
  return {
    async listMembers() { return []; },
    async getMember() { return null; },
    async saveMember(value) { return value; },
    async updateMember(_id, value) { return value; },
    async listSessions() { return []; },
    async getSession() { return null; },
    async getCompletedSessionsForContext() { return []; },
    async savePlannedSession() { return { sessionId: plannedFixture.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false }; },
    async updateSession() { return null; },
    async completeSession() { return { sessionId: plannedFixture.session.id, revision: 2, status: 'COMPLETED', idempotentReplay: false }; },
    async cancelSession() { return { sessionId: plannedFixture.session.id, revision: 2, status: 'CANCELLED' }; },
    ...overrides,
  };
}

async function call(api, action, options) {
  const response = await api(makeRequest(action, options));
  return { response, body: await response.json() };
}

async function main() {
  const { createMemberApi } = await import('../supabase/functions/member-api/service.mjs');
  const { createStaffAuthService, sha256Hex } = await import('../supabase/functions/_shared/staff-auth.mjs');

  let memberReads = 0;
  const unauthenticated = createMemberApi({ auth: createAuth(), repository: repository({ async listMembers() { memberReads += 1; return []; } }), now: () => NOW });
  const denied = await call(unauthenticated, 'list-members', { token: '' });
  assert.equal(denied.response.status, 401);
  assert.deepEqual(denied.body, { error: 'unauthorized' });
  assert.equal(memberReads, 0);

  const staffRecords = new Map();
  const staffStore = {
    async insert(record) { staffRecords.set(record.token_hash, record); },
    async findByHash(tokenHash) { return staffRecords.get(tokenHash) || null; },
    async revokeByHash(tokenHash, revokedAt) {
      const record = staffRecords.get(tokenHash);
      if (record && !record.revoked_at) record.revoked_at = revokedAt;
    },
  };
  const staffAuth = createStaffAuthService({ expectedPinHash: await sha256Hex('123456'), store: staffStore, now: () => NOW });
  const staffLogin = await staffAuth.login('123456');
  assert.equal(staffLogin.status, 200);
  let staffReads = 0;
  let staffWrites = 0;
  const staffApi = createMemberApi({
    auth: staffAuth, now: () => NOW,
    repository: repository({
      async listMembers() { staffReads += 1; return []; },
      async saveMember(value) { staffWrites += 1; return value; },
    }),
  });
  const staffToken = staffLogin.body.session.token;
  const validStaffRead = await call(staffApi, 'list-members', { token: staffToken });
  assert.equal(validStaffRead.response.status, 200);
  assert.equal(staffReads, 1);
  await staffAuth.logout(`Bearer ${staffToken}`);
  const revokedStaffRead = await call(staffApi, 'list-members', { token: staffToken });
  const revokedStaffWrite = await call(staffApi, 'save-member', {
    method: 'POST', token: staffToken, body: { displayName: '不应写入', trainingLevel: 'L2' },
  });
  assert.equal(revokedStaffRead.response.status, 401);
  assert.equal(revokedStaffWrite.response.status, 401);
  assert.equal(staffReads, 1);
  assert.equal(staffWrites, 0);

  let createdMember;
  const memberApi = createMemberApi({
    auth: createAuth(),
    repository: repository({ async getMember() { return null; }, async saveMember(value) { createdMember = value; return value; } }),
    now: () => NOW,
    createId: () => 'e1000000-0000-4000-8000-000000000099',
  });
  const savedMember = await call(memberApi, 'save-member', {
    method: 'POST', body: { displayName: '  新会员  ', trainingLevel: 'L2', primaryGoal: '力量入门' },
  });
  assert.equal(savedMember.response.status, 200);
  assert.equal(createdMember.displayName, '新会员');
  assert.equal(createdMember.id, 'e1000000-0000-4000-8000-000000000099');
  assert.equal(createdMember.status, 'ACTIVE');
  assert.deepEqual(createdMember.trainingProfile.movementConstraints, []);
  assert.equal(createdMember.createdAt, NOW.toISOString());

  let writes = 0;
  const invalidMemberApi = createMemberApi({ auth: createAuth(), repository: repository({ async saveMember() { writes += 1; } }), now: () => NOW });
  const invalidMember = await call(invalidMemberApi, 'save-member', {
    method: 'POST', body: { displayName: '错误会员', trainingProfile: { privateUiBlob: { x: 1 } } },
  });
  assert.equal(invalidMember.response.status, 400);
  assert.equal(invalidMember.body.error, 'invalid_member');
  assert.equal(writes, 0);

  let listOptions;
  const listApi = createMemberApi({ auth: createAuth(), repository: repository({ async listMembers(options) { listOptions = options; return [memberFixture]; } }), now: () => NOW });
  const listResult = await call(listApi, 'list-members', { query: '&status=ARCHIVED&search=%E6%9E%97&limit=999&offset=25' });
  assert.equal(listResult.response.status, 200);
  assert.equal(listOptions.status, 'ARCHIVED');
  assert.equal(listOptions.search, '林');
  assert.equal(listOptions.limit, 100);
  assert.equal(listOptions.offset, 25);

  const invalidMemberStatus = await call(listApi, 'list-members', { query: '&status=EVERYONE' });
  assert.equal(invalidMemberStatus.response.status, 400);
  assert.equal(invalidMemberStatus.body.error, 'invalid_request');

  let updates = 0;
  let memberRecord = { ...memberFixture };
  const archiveApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getMember() { return memberRecord; },
      async updateMember(_id, patch) { updates += 1; memberRecord = { ...memberRecord, ...patch }; return memberRecord; },
    }),
  });
  const archived = await call(archiveApi, 'archive-member', { method: 'POST', body: { id: memberFixture.id } });
  assert.equal(archived.body.member.status, 'INACTIVE');
  assert.equal(archived.body.member.archivedAt, NOW.toISOString());
  const restored = await call(archiveApi, 'restore-member', { method: 'POST', body: { id: memberFixture.id } });
  assert.equal(restored.body.member.status, 'ACTIVE');
  assert.equal(restored.body.member.archivedAt, null);
  assert.equal(updates, 2);

  let savedSnapshot;
  const saveSessionApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async getMember() { return memberFixture; }, async savePlannedSession(snapshot) { savedSnapshot = snapshot; return { sessionId: snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false }; } }),
  });
  const savedSession = await call(saveSessionApi, 'save-planned-session', { method: 'POST', body: { snapshot: plannedFixture } });
  assert.equal(savedSession.response.status, 200);
  assert.deepEqual(savedSnapshot, plannedFixture);

  const persistedByIntent = new Map();
  const replayApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getMember() { return memberFixture; },
      async savePlannedSession(snapshot) {
        const key = `${snapshot.session.memberId}:${snapshot.session.idempotencyKey}`;
        const existing = persistedByIntent.get(key);
        if (existing) return { ...existing, idempotentReplay: true };
        const created = { sessionId: snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: false };
        persistedByIntent.set(key, created);
        return created;
      },
    }),
  });
  const firstPlannedWrite = await call(replayApi, 'save-planned-session', { method: 'POST', body: { snapshot: plannedFixture } });
  const replayedPlannedWrite = await call(replayApi, 'save-planned-session', { method: 'POST', body: { snapshot: plannedFixture } });
  assert.equal(firstPlannedWrite.response.status, 200);
  assert.equal(firstPlannedWrite.body.idempotentReplay, false);
  assert.equal(replayedPlannedWrite.response.status, 200);
  assert.equal(replayedPlannedWrite.body.idempotentReplay, true);
  assert.equal(replayedPlannedWrite.body.sessionId, firstPlannedWrite.body.sessionId);
  assert.equal(persistedByIntent.size, 1);

  let missingIdempotencyWrites = 0;
  const missingIdempotencyApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async getMember() { return memberFixture; }, async savePlannedSession() { missingIdempotencyWrites += 1; return {}; } }),
  });
  const missingIdempotencySnapshot = {
    ...plannedFixture,
    session: { ...plannedFixture.session, idempotencyKey: null },
  };
  const missingIdempotency = await call(missingIdempotencyApi, 'save-planned-session', {
    method: 'POST', body: { snapshot: missingIdempotencySnapshot },
  });
  assert.equal(missingIdempotency.response.status, 400);
  assert.equal(missingIdempotency.body.error, 'invalid_snapshot');
  assert.equal(missingIdempotencyWrites, 0);

  const duplicateApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async getMember() { return memberFixture; }, async savePlannedSession() { throw { code: '23505', message: 'MEMBER_IDEMPOTENCY_CONFLICT: private sql details' }; } }),
  });
  const duplicate = await call(duplicateApi, 'save-planned-session', { method: 'POST', body: { snapshot: plannedFixture } });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error, 'duplicate_request');
  assert.equal(JSON.stringify(duplicate.body).includes('private sql details'), false);

  let unknownSnapshotWrites = 0;
  const unknownSnapshotApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async getMember() { return memberFixture; }, async savePlannedSession() { unknownSnapshotWrites += 1; return {}; } }),
  });
  const unknownSnapshot = await call(unknownSnapshotApi, 'save-planned-session', {
    method: 'POST', body: { snapshot: { ...plannedFixture, privateUiBlob: true } },
  });
  assert.equal(unknownSnapshot.response.status, 400);
  assert.equal(unknownSnapshot.body.error, 'invalid_snapshot');
  assert.equal(unknownSnapshotWrites, 0);

  const invalidNullItem = await call(unknownSnapshotApi, 'save-planned-session', {
    method: 'POST', body: { snapshot: { ...plannedFixture, items: [null] } },
  });
  assert.equal(invalidNullItem.response.status, 400);
  assert.equal(invalidNullItem.body.error, 'invalid_snapshot');
  assert.equal(unknownSnapshotWrites, 0);

  let completion;
  const completeApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getSession() { return { session: plannedFixture.session, items: plannedFixture.items }; },
      async completeSession(value) { completion = value; return { sessionId: value.sessionId, revision: 2, status: 'COMPLETED' }; },
    }),
  });
  const completed = await call(completeApi, 'complete-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 1, completeAsPlanned: true },
  });
  assert.equal(completed.response.status, 200);
  assert.equal(completion.items.length, plannedFixture.items.length);
  assert.deepEqual(completion.items[0].performedActionSnapshot, completion.items[0].plannedActionSnapshot);
  assert.deepEqual(completion.items[0].performedPrescription, completion.items[0].plannedPrescriptionSnapshot);
  assert.equal(completion.items.every(item => item.completed), true);

  let nullPerformedPrescription;
  const optionalPrescriptionApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getSession() { return { session: plannedFixture.session, items: plannedFixture.items }; },
      async completeSession(value) { nullPerformedPrescription = value.items[0].performedPrescription; return { sessionId: value.sessionId, revision: 2, status: 'COMPLETED' }; },
    }),
  });
  const omittedActualPrescription = await call(optionalPrescriptionApi, 'complete-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 1, items: [{ id: plannedFixture.items[0].id, performedPrescription: null }] },
  });
  assert.equal(omittedActualPrescription.response.status, 200);
  assert.equal(nullPerformedPrescription, null);

  const repeatCompletionApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getSession() { return { session: { ...plannedFixture.session, status: 'COMPLETED', revision: 2, completedAt: NOW.toISOString() }, items: completion.items }; },
      async completeSession(value) { return { sessionId: value.sessionId, revision: 2, status: 'COMPLETED', completedAt: NOW.toISOString(), idempotentReplay: true }; },
    }),
  });
  const repeatedCompletion = await call(repeatCompletionApi, 'complete-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 1, completeAsPlanned: true },
  });
  assert.equal(repeatedCompletion.response.status, 200);
  assert.equal(repeatedCompletion.body.idempotentReplay, true);

  let replacementCompletion;
  const replacement = replacedFixture.items.find(item => item.plannedActionId !== item.performedActionId);
  const replacementApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getSession() { return { session: plannedFixture.session, items: plannedFixture.items }; },
      async completeSession(value) { replacementCompletion = value; return { sessionId: value.sessionId, revision: 2, status: 'COMPLETED' }; },
    }),
  });
  const replaced = await call(replacementApi, 'complete-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 1, items: [{
      id: replacement.id,
      performedActionId: replacement.performedActionId,
      performedActionSnapshot: replacement.performedActionSnapshot,
      performedPrescription: replacement.performedPrescription,
      sets: replacement.sets, reps: replacement.reps, loadKg: replacement.loadKg,
      rir: replacement.rir, rpe: replacement.rpe, completed: true,
    }] },
  });
  const replacedSavedItem = replacementCompletion.items.find(item => item.id === replacement.id);
  assert.equal(replaced.response.status, 200);
  assert.equal(replacedSavedItem.plannedActionId, replacement.plannedActionId);
  assert.equal(replacedSavedItem.performedActionId, replacement.performedActionId);

  let cancelledRequest;
  const cancelApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async cancelSession(value) { cancelledRequest = value; return { sessionId: value.sessionId, revision: 2, status: 'CANCELLED' }; } }),
  });
  const cancelled = await call(cancelApi, 'cancel-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 1 },
  });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.body.status, 'CANCELLED');
  assert.equal(cancelledRequest.expectedRevision, 1);

  let forbiddenCompleteCalls = 0;
  const cancelledSessionApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getSession() { return { session: { ...plannedFixture.session, status: 'CANCELLED', revision: 2 }, items: plannedFixture.items }; },
      async completeSession() { forbiddenCompleteCalls += 1; return {}; },
    }),
  });
  const completeCancelled = await call(cancelledSessionApi, 'complete-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 2, completeAsPlanned: true },
  });
  assert.equal(completeCancelled.response.status, 409);
  assert.equal(completeCancelled.body.error, 'invalid_status_transition');
  assert.equal(forbiddenCompleteCalls, 0);

  const staleApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async updateSession() { return null; }, async getSession() { return { session: { ...plannedFixture.session, revision: 2 }, items: plannedFixture.items }; } }),
  });
  const stale = await call(staleApi, 'update-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 1, patch: { coachNote: 'updated' } },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.error, 'stale_update');

  const sharedSession = { ...structuredClone(plannedFixture.session), revision: 1 };
  let updateWriters = 0;
  let releaseSharedRevision;
  const bothWritersLoadedRevision = new Promise(resolve => { releaseSharedRevision = resolve; });
  const concurrentUpdateApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getSession() { return { session: { ...sharedSession }, items: plannedFixture.items }; },
      async updateSession(id, expectedRevision, patch, updatedAt) {
        updateWriters += 1;
        if (updateWriters === 2) releaseSharedRevision();
        await bothWritersLoadedRevision;
        if (id !== sharedSession.id || sharedSession.revision !== expectedRevision || sharedSession.status !== 'PLANNED') return null;
        Object.assign(sharedSession, patch, { revision: expectedRevision + 1, updatedAt });
        return { ...sharedSession };
      },
    }),
  });
  const concurrentWrites = await Promise.all(['第一位教练更新', '第二位教练更新'].map(coachNote => call(concurrentUpdateApi, 'update-session', {
    method: 'POST', body: { sessionId: sharedSession.id, expectedRevision: 1, patch: { coachNote } },
  })));
  const concurrentWinner = concurrentWrites.find(result => result.response.status === 200);
  const concurrentLoser = concurrentWrites.find(result => result.response.status === 409);
  assert.ok(concurrentWinner);
  assert.equal(concurrentLoser.body.error, 'stale_update');
  assert.equal(sharedSession.revision, 2);
  assert.equal(sharedSession.coachNote, concurrentWinner.body.session.coachNote);
  assert.equal(concurrentWrites.filter(result => result.response.status === 200).length, 1);
  assert.equal(concurrentWrites.filter(result => result.response.status === 409).length, 1);

  let invalidDateWrites = 0;
  const invalidDateApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async updateSession() { invalidDateWrites += 1; return plannedFixture.session; } }),
  });
  const invalidDate = await call(invalidDateApi, 'update-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 1, patch: { sessionDate: '2026-02-31' } },
  });
  assert.equal(invalidDate.response.status, 400);
  assert.equal(invalidDate.body.error, 'invalid_session');
  assert.equal(invalidDateWrites, 0);

  const sessionSummaryApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async getMember() { return memberFixture; }, async listSessions() { return [{ ...plannedFixture.session, revision: 3, resolvedSessionSnapshot: { veryLarge: true }, items: plannedFixture.items }]; } }),
  });
  const sessionList = await call(sessionSummaryApi, 'list-sessions', { query: `&memberId=${memberFixture.id}&limit=999` });
  assert.equal(sessionList.response.status, 200);
  assert.equal(sessionList.body.sessions[0].revision, 3);
  assert.equal('resolvedSessionSnapshot' in sessionList.body.sessions[0], false);
  assert.equal('items' in sessionList.body.sessions[0], false);

  const transitionApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({ async cancelSession() { throw { code: '23514', message: 'MEMBER_INVALID_TRANSITION: sql internal' }; } }),
  });
  const forbiddenTransition = await call(transitionApi, 'cancel-session', {
    method: 'POST', body: { sessionId: plannedFixture.session.id, expectedRevision: 1 },
  });
  assert.equal(forbiddenTransition.response.status, 409);
  assert.equal(forbiddenTransition.body.error, 'invalid_status_transition');
  assert.equal(JSON.stringify(forbiddenTransition.body).includes('sql internal'), false);

  let contextSessionsRead = false;
  const contextApi = createMemberApi({
    auth: createAuth(), now: () => NOW,
    repository: repository({
      async getMember() { return memberFixture; },
      async getCompletedSessionsForContext(_id, limit) { contextSessionsRead = limit === 3; return [{ ...replacedFixture.session, items: replacedFixture.items }]; },
    }),
  });
  const context = await call(contextApi, 'get-member-training-context', { query: `&memberId=${memberFixture.id}` });
  assert.equal(context.response.status, 200);
  assert.equal(contextSessionsRead, true);
  assert.equal(context.body.context.memberId, memberFixture.id);
  assert(context.body.context.recentActions.some(item => item.actionId === replacement.performedActionId));

  console.log('member_api_test: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
