const assert = require('node:assert/strict');

const domainPromise = import('../supabase/functions/_shared/member-domain.mjs');
const member = { id: 'member-context-fixture', displayName: '林同学', trainingLevel: 'L2' };

function action(actionId, pattern, name = actionId) {
  return { schemaVersion: 1, actionId, name, pattern, level: 'L2', primaryMuscles: [`${actionId} muscle`], secondaryMuscles: [], equipment: '哑铃', stationId: null };
}

function item({ id, phase, actionId, pattern, name, plannedActionId, plannedPattern, plannedName, performed = false, completed = true, sortOrder = 0 }) {
  const plannedId = plannedActionId || actionId;
  const plannedSnapshot = action(plannedId, plannedPattern || pattern, plannedName || name || plannedId);
  return {
    id,
    phase,
    sortOrder,
    completed,
    plannedActionId: plannedId,
    plannedActionSnapshot: plannedSnapshot,
    performedActionId: performed ? actionId : null,
    performedActionSnapshot: performed ? action(actionId, pattern, name || actionId) : null,
  };
}

function session(id, sessionDate, status, items = []) {
  return {
    id,
    sessionDate,
    status,
    completedAt: status === 'COMPLETED' ? `${sessionDate}T12:00:00.000Z` : null,
    templateKey: 'f111',
    sessionTitle: `Session ${id}`,
    items,
  };
}

async function main() {
  const domain = await domainPromise;
  const empty = domain.deriveMemberTrainingContext(member, []);
  assert.equal(empty.lastCompletedSession, null, 'zero completions must produce an empty context');
  assert.deepEqual(empty.recentSessions, []);
  assert.deepEqual(empty.recentPatterns, []);

  const one = session('one', '2026-09-27', 'COMPLETED', [
    item({ id: 'one-squat-a', phase: 'A', actionId: 'squat', pattern: 'SQUAT' }),
    item({ id: 'one-squat-b', phase: 'PRIMARY', actionId: 'squat', pattern: 'SQUAT', sortOrder: 1 }),
    item({ id: 'one-pull', phase: 'B', actionId: 'vertical-pull', pattern: 'VERTICAL_PULL', name: '高位下拉' }),
    item({ id: 'one-hinge', phase: 'C', actionId: 'hinge', pattern: 'HIP_HINGE' }),
    item({ id: 'one-core', phase: 'CORE', actionId: 'dead-bug', pattern: 'ANTI_EXTENSION' }),
    item({ id: 'one-conditioning', phase: 'CONDITIONING', actionId: 'bike', pattern: 'CONDITIONING' }),
    item({ id: 'one-prep', phase: 'PREP', actionId: 'bird-dog', pattern: 'BIRD_DOG' }),
    item({ id: 'one-foam', phase: 'FOAM', actionId: 'foam-roll', pattern: 'FOAM' }),
    item({ id: 'one-mobility', phase: 'MOBILITY', actionId: '90-90', pattern: 'MOBILITY' }),
    item({ id: 'one-unknown', phase: 'UNKNOWN', actionId: 'unknown', pattern: 'UNKNOWN' }),
    item({ id: 'one-uncompleted', phase: 'PRIMARY', actionId: 'not-done', pattern: 'LUNGE', completed: false }),
    item({ id: 'one-replaced', phase: 'SECONDARY', actionId: 'goblet-squat', pattern: 'SQUAT', name: '杯式深蹲', plannedActionId: 'planned-hack-squat', plannedPattern: 'SQUAT', plannedName: '哈克深蹲', performed: true }),
  ]);
  const oneContext = domain.deriveMemberTrainingContext(member, [one]);
  assert.equal(oneContext.recentSessions.length, 1);
  assert.equal(oneContext.lastCompletedSession.id, 'one');
  assert.equal(oneContext.recentPatterns.find(record => record.pattern === 'SQUAT').countLast3, 1);
  assert.equal(oneContext.recentPatterns.find(record => record.pattern === 'SQUAT').sessionsAgo, 0);
  assert(oneContext.recentPatterns.some(record => record.pattern === 'VERTICAL_PULL'));
  assert(oneContext.recentPatterns.some(record => record.pattern === 'HIP_HINGE'));
  assert(oneContext.recentPatterns.some(record => record.pattern === 'ANTI_EXTENSION'));
  assert(oneContext.recentPatterns.some(record => record.pattern === 'CONDITIONING'));
  for (const ignored of ['BIRD_DOG', 'FOAM', 'MOBILITY', 'UNKNOWN', 'LUNGE']) {
    assert(!oneContext.recentPatterns.some(record => record.pattern === ignored), `${ignored} must not enter training load context`);
  }
  assert(oneContext.recentActions.some(record => record.actionId === 'goblet-squat' && record.actionNameSnapshot === '杯式深蹲'));
  assert(!oneContext.recentActions.some(record => record.actionId === 'planned-hack-squat'), 'performed action must replace planned action in context');

  const threeSessions = [
    session('three-newest', '2026-09-27', 'COMPLETED', [item({ id: 'three-a', phase: 'PRIMARY', actionId: 'repeat', pattern: 'SQUAT' })]),
    session('three-middle', '2026-09-25', 'COMPLETED', [item({ id: 'three-b', phase: 'PRIMARY', actionId: 'repeat', pattern: 'SQUAT' })]),
    session('three-oldest', '2026-09-23', 'COMPLETED', [item({ id: 'three-c', phase: 'PRIMARY', actionId: 'repeat', pattern: 'SQUAT' })]),
  ];
  const threeContext = domain.deriveMemberTrainingContext(member, threeSessions);
  assert.equal(threeContext.recentSessions.length, 3);
  assert.deepEqual(threeContext.recentSessions.map(value => value.id), ['three-newest', 'three-middle', 'three-oldest']);
  assert.deepEqual(threeContext.recentActions.find(record => record.actionId === 'repeat'), {
    actionId: 'repeat', actionNameSnapshot: 'repeat', sessionsAgo: 0, countLast3: 3,
  }, 'repeated action counts once per completed session');
  assert.equal(threeContext.recentPatterns.find(record => record.pattern === 'SQUAT').countLast3, 3);

  const fiveCompleted = [
    ...threeSessions,
    session('five-fourth', '2026-09-20', 'COMPLETED', [item({ id: 'five-fourth-item', phase: 'PRIMARY', actionId: 'older-fourth-only', pattern: 'OLDER_FOURTH' })]),
    session('five-fifth', '2026-09-18', 'COMPLETED', [item({ id: 'five-fifth-item', phase: 'PRIMARY', actionId: 'older-fifth-only', pattern: 'OLDER_FIFTH' })]),
    session('future-planned', '2026-09-29', 'PLANNED', [item({ id: 'planned-only', phase: 'PRIMARY', actionId: 'planned-only', pattern: 'PLANNED_ONLY' })]),
    session('newer-cancelled', '2026-09-30', 'CANCELLED', [item({ id: 'cancelled-only', phase: 'PRIMARY', actionId: 'cancelled-only', pattern: 'CANCELLED_ONLY' })]),
  ];
  const fiveContext = domain.deriveMemberTrainingContext(member, fiveCompleted);
  assert.deepEqual(fiveContext.recentSessions.map(value => value.id), ['three-newest', 'three-middle', 'three-oldest']);
  assert.equal(fiveContext.recentSessions.length, 3, 'five completed sessions must be bounded to the most recent three');
  assert(!fiveContext.recentPatterns.some(record => ['OLDER_FOURTH', 'OLDER_FIFTH', 'PLANNED_ONLY', 'CANCELLED_ONLY'].includes(record.pattern)));
  assert(!fiveContext.recentActions.some(record => ['older-fourth-only', 'older-fifth-only', 'planned-only', 'cancelled-only'].includes(record.actionId)));

  console.log('member_context_test: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
