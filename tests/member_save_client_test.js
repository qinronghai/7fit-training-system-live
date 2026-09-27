const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const fixtureRoot = path.join(__dirname, 'fixtures', 'member-v1');
const resolved = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'f111-resolved-session.json'), 'utf8'));
const plannedFixture = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'f111-training-session.json'), 'utf8'));
const memberId = 'e1000000-0000-4000-8000-000000000001';
const otherMemberId = 'e1000000-0000-4000-8000-000000000011';
const fixedNow = new Date('2026-09-27T12:00:00.000Z');

function makeStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    values,
  };
}

async function loadClient({ storage, fetchImpl, domain }) {
  const window = {
    localStorage: storage,
    location: { origin: 'https://7fit.example' },
    crypto: webcrypto,
    V14_MEMBER_API_BASE: 'https://7fit.example/member-api',
    V14MemberDomainPromise: Promise.resolve(domain),
  };
  const context = { window, fetch: fetchImpl, crypto: webcrypto, Date, URL, Response, AbortSignal, TextEncoder, setTimeout, clearTimeout };
  for (const file of ['data/system-data.js', 'data/anatomy-data.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  }
  for (const file of ['api.js', 'snapshot-client.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'member', file), 'utf8');
    vm.runInNewContext(source, context, { filename: file });
  }
  return window;
}

async function main() {
  const domain = await import('../supabase/functions/_shared/member-domain.mjs');
  const storage = makeStorage({
    '7fit_case_admin_session': JSON.stringify({ token: 'opaque-staff-token', expiresAt: '2026-10-27T12:00:00.000Z' }),
  });
  const sent = [];
  let shouldDropNextSave = true;
  const fetchImpl = async (url, init = {}) => {
    const requestUrl = new URL(url);
    assert.equal(init.headers.authorization, 'Bearer opaque-staff-token');
    if (requestUrl.searchParams.get('action') === 'list-members') {
      return new Response(JSON.stringify({ members: [{ id: memberId, displayName: '林同学', status: 'ACTIVE' }] }), { status: 200 });
    }
    assert.equal(requestUrl.searchParams.get('action'), 'save-planned-session');
    const snapshot = JSON.parse(init.body).snapshot;
    sent.push(snapshot);
    if (shouldDropNextSave) {
      shouldDropNextSave = false;
      throw new TypeError('simulated response loss');
    }
    return new Response(JSON.stringify({ sessionId: snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: true }), { status: 200 });
  };

  const firstPage = await loadClient({ storage, fetchImpl, domain });
  const members = await firstPage.V14MemberAPI.listMembers({ limit: 10 });
  assert.equal(members[0].displayName, '林同学');
  const firstIntent = await firstPage.V14MemberSnapshots.prepareIntent(resolved, {
    memberId, sessionDate: '2026-09-27', now: fixedNow, createId: () => webcrypto.randomUUID(),
  });
  assert.equal(firstIntent.snapshot.session.status, 'PLANNED');
  assert.equal(firstIntent.snapshot.items.length, resolved.main.content.length);
  const action = firstIntent.snapshot.items.find(item => item.plannedActionSnapshot.primaryMuscles.length);
  assert(action, 'snapshot should preserve action anatomy');
  assert.equal(action.plannedActionSnapshot.actionId, action.plannedActionId);
  assert.deepEqual(Object.keys(action.plannedActionSnapshot).sort(), [
    'actionId', 'equipment', 'level', 'name', 'pattern', 'primaryMuscles', 'schemaVersion', 'secondaryMuscles', 'stationId',
  ].sort());
  assert(domain.validateTrainingSession(firstIntent.snapshot.session).ok);
  firstIntent.snapshot.items.forEach(item => assert(domain.validateTrainingSessionItem(item).ok));
  await assert.rejects(firstPage.V14MemberSnapshots.send(firstIntent), error => error.code === 'network_error');

  const refreshedPage = await loadClient({ storage, fetchImpl, domain });
  const retryIntent = await refreshedPage.V14MemberSnapshots.prepareIntent(resolved, {
    memberId, sessionDate: '2026-09-27', now: fixedNow, createId: () => { throw new Error('refresh created a second intent'); },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(retryIntent.snapshot)), JSON.parse(JSON.stringify(firstIntent.snapshot)));
  const replay = await refreshedPage.V14MemberSnapshots.send(retryIntent);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent[0], sent[1]);

  const midnightStorage = makeStorage({
    '7fit_case_admin_session': JSON.stringify({ token: 'midnight-staff-token', expiresAt: '2026-10-27T12:00:00.000Z' }),
  });
  const midnightRequests = [];
  let midnightServerCreated = false;
  const midnightFetch = async (url, init = {}) => {
    const requestUrl = new URL(url);
    assert.equal(requestUrl.searchParams.get('action'), 'save-planned-session');
    const snapshot = JSON.parse(init.body).snapshot;
    midnightRequests.push(snapshot);
    if (!midnightServerCreated) {
      midnightServerCreated = true;
      throw new TypeError('response lost after the server committed');
    }
    return new Response(JSON.stringify({ sessionId: snapshot.session.id, revision: 1, status: 'PLANNED', idempotentReplay: true }), { status: 200 });
  };
  const beforeMidnightPage = await loadClient({ storage: midnightStorage, fetchImpl: midnightFetch, domain });
  const beforeMidnight = await beforeMidnightPage.V14MemberSnapshots.prepareIntent(resolved, {
    memberId: otherMemberId, sessionDate: '2026-09-27', now: fixedNow,
  });
  await assert.rejects(beforeMidnightPage.V14MemberSnapshots.send(beforeMidnight), error => error.code === 'network_error');

  const afterMidnightPage = await loadClient({ storage: midnightStorage, fetchImpl: midnightFetch, domain });
  const nextDayNow = new Date('2026-09-28T08:00:00.000Z');
  const foundAfterMidnight = await afterMidnightPage.V14MemberSnapshots.findIntentForResolvedSession(resolved, {
    memberId: otherMemberId, sessionDate: '2026-09-28', now: nextDayNow,
  });
  assert.equal(foundAfterMidnight.status, 'PENDING');
  assert.equal(foundAfterMidnight.snapshot.session.sessionDate, '2026-09-27');
  const retryAfterMidnight = await afterMidnightPage.V14MemberSnapshots.prepareIntent(resolved, {
    memberId: otherMemberId, sessionDate: '2026-09-28', now: nextDayNow,
    createId: () => { throw new Error('midnight retry created a second intent'); },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(retryAfterMidnight.snapshot)), JSON.parse(JSON.stringify(beforeMidnight.snapshot)));
  const nextDayNewIntent = await afterMidnightPage.V14MemberSnapshots.prepareIntent(resolved, {
    memberId: otherMemberId, sessionDate: '2026-09-28', now: nextDayNow,
    allowNewAfterPendingIntentKey: beforeMidnight.key,
  });
  assert.notEqual(nextDayNewIntent.key, beforeMidnight.key);
  assert.notEqual(nextDayNewIntent.snapshot.session.id, beforeMidnight.snapshot.session.id);
  assert.equal(nextDayNewIntent.snapshot.session.sessionDate, '2026-09-28');
  const foundNextDayIntent = await afterMidnightPage.V14MemberSnapshots.findIntentForResolvedSession(resolved, {
    memberId: otherMemberId, sessionDate: '2026-09-28', now: nextDayNow,
  });
  assert.equal(foundNextDayIntent.key, nextDayNewIntent.key);
  await afterMidnightPage.V14MemberSnapshots.send(retryAfterMidnight);
  assert.equal(midnightRequests.length, 2);
  assert.deepEqual(midnightRequests[0], midnightRequests[1]);

  const anotherMemberIntent = await refreshedPage.V14MemberSnapshots.prepareIntent(resolved, {
    memberId: otherMemberId, sessionDate: '2026-09-27', now: fixedNow,
  });
  assert.notEqual(anotherMemberIntent.snapshot.session.id, retryIntent.snapshot.session.id);
  assert.notEqual(anotherMemberIntent.snapshot.session.idempotencyKey, retryIntent.snapshot.session.idempotencyKey);

  let releaseConcurrentWrite;
  const concurrentGate = new Promise(resolve => { releaseConcurrentWrite = resolve; });
  let concurrentRequests = 0;
  const concurrentPage = await loadClient({
    storage,
    domain,
    fetchImpl: async (_url, init) => {
      concurrentRequests++;
      const snapshot = JSON.parse(init.body).snapshot;
      await concurrentGate;
      return new Response(JSON.stringify({ sessionId: snapshot.session.id, revision: 1, status: 'PLANNED' }), { status: 200 });
    },
  });
  const firstConcurrentSend = concurrentPage.V14MemberSnapshots.send(anotherMemberIntent);
  const secondConcurrentSend = concurrentPage.V14MemberSnapshots.send(anotherMemberIntent);
  assert.equal(concurrentRequests, 1, 'concurrent duplicate clicks should share one in-flight request');
  releaseConcurrentWrite();
  await Promise.all([firstConcurrentSend, secondConcurrentSend]);
  assert.equal(concurrentRequests, 1);

  const expiredStorage = makeStorage({
    '7fit_case_admin_session': JSON.stringify({ token: 'expired-token', expiresAt: '2026-10-27T12:00:00.000Z' }),
  });
  const unauthorizedPage = await loadClient({
    storage: expiredStorage,
    domain,
    fetchImpl: async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 }),
  });
  await assert.rejects(unauthorizedPage.V14MemberAPI.listMembers(), error => error.code === 'unauthorized' && error.status === 401);
  assert.equal(expiredStorage.getItem('7fit_case_admin_session'), null);

  const completionBodies=[];
  const executionPage=await loadClient({
    storage,
    domain,
    fetchImpl:async(url,init)=>{
      assert.equal(new URL(url).searchParams.get('action'),'complete-session');
      completionBodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({status:'COMPLETED'}),{status:200});
    },
  });
  await executionPage.V14MemberAPI.completeSession(plannedFixture.session.id,1,[]);
  await executionPage.V14MemberAPI.completeSession(plannedFixture.session.id,1,[{id:plannedFixture.items[0].id,sets:3}]);
  assert.equal(completionBodies[0].completeAsPlanned,true);
  assert.equal(completionBodies[0].items,undefined);
  assert.deepEqual(completionBodies[1].items,[{id:plannedFixture.items[0].id,sets:3}]);

  console.log('member_save_client_test: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
