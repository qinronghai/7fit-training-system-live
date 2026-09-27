const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const fixtureRoot = path.join(__dirname, 'fixtures', 'member-v1');
const planned = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'f111-training-session.json'), 'utf8'));
const replaced = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'replaced-action-completed.json'), 'utf8'));
const NOW = new Date('2026-09-27T12:00:00.000Z');

function request(action, body) {
  return new Request(`https://7fit.example/member-api?action=${action}`, {
    method: 'POST',
    headers: { authorization: 'Bearer valid', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function repository(overrides = {}) {
  return {
    async getSession() { return { session: planned.session, items: planned.items }; },
    async completeSession(value) { return { sessionId: value.sessionId, revision: 2, status: 'COMPLETED', idempotentReplay: false }; },
    async cancelSession(value) { return { sessionId: value.sessionId, revision: value.expectedRevision + 1, status: 'CANCELLED' }; },
    ...overrides,
  };
}

async function call(api, action, body) {
  const response = await api(request(action, body));
  return { response, body: await response.json() };
}

async function main() {
  const { createMemberApi } = await import('../supabase/functions/member-api/service.mjs');
  const auth = { async verify(header) { return { ok: header === 'Bearer valid' }; } };

  let completed;
  const plannedCompletionApi = createMemberApi({
    auth, now: () => NOW,
    repository: repository({ async completeSession(value) { completed = value; return { sessionId: value.sessionId, revision: 2, status: 'COMPLETED' }; } }),
  });
  const oneClick = await call(plannedCompletionApi, 'complete-session', {
    sessionId: planned.session.id, expectedRevision: 1, completeAsPlanned: true,
  });
  assert.equal(oneClick.response.status, 200);
  assert.equal(completed.items.length, planned.items.length);
  completed.items.forEach((item, index) => {
    assert.equal(item.completed, true);
    assert.equal(item.performedActionId, planned.items[index].plannedActionId);
    assert.deepEqual(item.performedActionSnapshot, planned.items[index].plannedActionSnapshot);
    assert.deepEqual(item.performedPrescription, planned.items[index].plannedPrescriptionSnapshot);
  });

  let replacementCompletion;
  const changed = replaced.items.find(item => item.plannedActionId !== item.performedActionId);
  const replacementApi = createMemberApi({
    auth, now: () => NOW,
    repository: repository({ async completeSession(value) { replacementCompletion = value; return { sessionId: value.sessionId, revision: 2, status: 'COMPLETED' }; } }),
  });
  const withActuals = await call(replacementApi, 'complete-session', {
    sessionId: planned.session.id,
    expectedRevision: 1,
    items: [{
      id: changed.id,
      performedActionId: changed.performedActionId,
      performedActionSnapshot: changed.performedActionSnapshot,
      sets: 3,
      reps: '10',
      loadKg: 20,
      rir: 2,
      rpe: 8,
      note: '器械临时调整',
    }],
  });
  assert.equal(withActuals.response.status, 200);
  const changedItem = replacementCompletion.items.find(item => item.id === changed.id);
  assert.equal(changedItem.plannedActionId, changed.plannedActionId);
  assert.deepEqual(changedItem.plannedActionSnapshot, changed.plannedActionSnapshot);
  assert.equal(changedItem.performedActionId, changed.performedActionId);
  assert.deepEqual(changedItem.performedActionSnapshot, changed.performedActionSnapshot);
  assert.deepEqual({ sets: changedItem.sets, reps: changedItem.reps, loadKg: changedItem.loadKg, rir: changedItem.rir, rpe: changedItem.rpe, note: changedItem.note }, {
    sets: 3, reps: '10', loadKg: 20, rir: 2, rpe: 8, note: '器械临时调整',
  });
  const untouched = replacementCompletion.items.find(item => item.id !== changed.id);
  assert.equal(untouched.performedActionId, untouched.plannedActionId);
  assert.deepEqual(untouched.performedActionSnapshot, untouched.plannedActionSnapshot);
  assert.equal(untouched.completed, true);

  let cancelled;
  const cancelApi = createMemberApi({ auth, now: () => NOW, repository: repository({ async cancelSession(value) { cancelled = value; return { status: 'CANCELLED' }; } }) });
  const cancelledResponse = await call(cancelApi, 'cancel-session', { sessionId: planned.session.id, expectedRevision: 1 });
  assert.equal(cancelledResponse.body.status, 'CANCELLED');
  assert.equal(cancelled.expectedRevision, 1);

  let forbiddenTransitions = 0;
  const cancelledSessionApi = createMemberApi({
    auth, now: () => NOW,
    repository: repository({
      async getSession() { return { session: { ...planned.session, status: 'CANCELLED', revision: 2 }, items: planned.items }; },
      async completeSession() { forbiddenTransitions += 1; return {}; },
    }),
  });
  const forbidden = await call(cancelledSessionApi, 'complete-session', { sessionId: planned.session.id, expectedRevision: 2, completeAsPlanned: true });
  assert.equal(forbidden.response.status, 409);
  assert.equal(forbidden.body.error, 'invalid_status_transition');
  assert.equal(forbiddenTransitions, 0);

  const staleApi = createMemberApi({
    auth, now: () => NOW,
    repository: repository({ async completeSession() { throw { code: '40001', message: 'MEMBER_REVISION_CONFLICT' }; } }),
  });
  const stale = await call(staleApi, 'complete-session', { sessionId: planned.session.id, expectedRevision: 1, completeAsPlanned: true });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.body.error, 'stale_update');

  console.log('member_execution_test: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
