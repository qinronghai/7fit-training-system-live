const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const fixtureRoot = path.join(__dirname, 'fixtures', 'member-v1');

function loadF111Resolver() {
  global.window = global;
  const root = path.join(__dirname, '..');
  const files = [
    'data/system-data.js', 'data/anatomy-data.js', 'js/prep-grade.js', 'js/anatomy.js',
    'js/prep-resolver.js', 'js/composer.js', 'js/resolved-session.js', 'js/conflict-core.js',
    'js/conflict-service.js', 'js/conflict-plugins/f111.js', 'js/conflict.js',
    'js/template-resolver.js', 'js/resolvers/f111.js',
  ];
  for (const file of files) vm.runInThisContext(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
}

async function main() {
  const domain = await import('../supabase/functions/_shared/member-domain.mjs');
  const member = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'member-active.json'), 'utf8'));
  const planned = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'f111-training-session.json'), 'utf8'));
  const replaced = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'replaced-action-completed.json'), 'utf8'));
  const resolved = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'f111-resolved-session.json'), 'utf8'));
  loadF111Resolver();
  const actualResolved = window.V15TemplateResolver.resolve('f111', { mode: 'preset', recipeId: 'F111-06', level: 'L3' });
  assert.deepEqual(actualResolved, resolved, 'the checked-in fixture must match the current F111 ResolvedSession');

  assert.equal(domain.CONTRACT_VERSION, 1);
  assert.equal(domain.validateMember(member).ok, true);
  assert.equal(domain.validateTrainingSession(planned.session).ok, true);
  planned.items.forEach(item => assert.equal(domain.validateTrainingSessionItem(item).ok, true));
  assert.equal(domain.validateTrainingSession(replaced.session).ok, true);
  replaced.items.forEach(item => assert.equal(domain.validateTrainingSessionItem(item).ok, true));

  assert.equal(domain.validateMember({ ...member, status: 'ARCHIVED' }).ok, false);
  assert.equal(domain.validateMember({ ...member, primaryGoal: '' }).ok, false);
  assert.equal(domain.validateTrainingSession({ ...planned.session, status: 'CANCELLED', completedAt: '2026-09-27T10:00:00.000Z' }).ok, false);
  assert.equal(domain.validateTrainingSession({ ...planned.session, status: 'COMPLETED', completedAt: null }).ok, false);
  assert.equal(domain.validateTrainingSession({ ...planned.session, sessionDate: '2026-02-31' }).ok, false);
  assert.equal(domain.validateTrainingSession({ ...planned.session, idempotencyKey: '' }).ok, false);
  assert.equal(domain.validateTrainingSession({ ...planned.session, idempotencyKey: null }).ok, false);

  const phaseCases = [
    ['A', 'PRIMARY'], ['B', 'SECONDARY'], ['SUPPORT', 'ACCESSORY'],
    ['2', 'ACCESSORY'], ['3', 'ACCESSORY'], ['C', 'ACCESSORY'],
    ['D1', 'ACCESSORY'], ['D2', 'ACCESSORY'], ['CORE', 'CORE'],
    ['CONDITIONING', 'CONDITIONING'], ['FOAM', 'FOAM'], ['PREP', 'PREP'],
    ['MOBILITY', 'MOBILITY'], ['legacy-label', 'UNKNOWN'],
  ];
  for (const [input, expected] of phaseCases) {
    assert.equal(domain.canonicalPhase(input), expected, `phase ${input}`);
  }

  const snapshot = domain.buildTrainingSessionSnapshot(actualResolved, {
    sessionId: planned.session.id,
    memberId: planned.session.memberId,
    sessionDate: planned.session.sessionDate,
    createdAt: planned.session.createdAt,
    updatedAt: planned.session.updatedAt,
    idempotencyKey: planned.session.idempotencyKey,
    itemIds: planned.items.map(item => item.id),
    actionsById: window.V14_DATA.actions,
    anatomyById: window.V14_ANATOMY.records,
  });
  assert.deepEqual(snapshot, planned);
  assert(snapshot.items.every(item => /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(item.id)),
    'database item identifiers must be UUIDs');
  assert.throws(() => domain.buildTrainingSessionSnapshot(actualResolved, {
    sessionId: planned.session.id,
    memberId: planned.session.memberId,
    sessionDate: planned.session.sessionDate,
    createdAt: planned.session.createdAt,
    updatedAt: planned.session.updatedAt,
    actionsById: window.V14_DATA.actions,
    anatomyById: window.V14_ANATOMY.records,
  }), error => error.code === 'INVALID_SNAPSHOT_INPUT');
  assert.throws(() => domain.buildTrainingSessionSnapshot(actualResolved, {
    sessionId: planned.session.id,
    memberId: planned.session.memberId,
    sessionDate: planned.session.sessionDate,
    createdAt: planned.session.createdAt,
    updatedAt: planned.session.updatedAt,
    itemIds: planned.items.map(item => item.id),
    actionsById: window.V14_DATA.actions,
    anatomyById: window.V14_ANATOMY.records,
  }), error => error.code === 'INVALID_SNAPSHOT_INPUT');
  const frozenSnapshot = JSON.stringify(snapshot);
  actualResolved.main.content[0].name = 'Changed after save';
  assert.equal(JSON.stringify(snapshot), frozenSnapshot, 'saved snapshots must not retain live resolver references');

  const replacedItem = replaced.items.find(item => item.plannedActionId !== item.performedActionId);
  assert(replacedItem, 'fixture must preserve both sides of a replaced action');
  assert.notDeepEqual(replacedItem.plannedActionSnapshot, replacedItem.performedActionSnapshot);
  assert.equal(domain.validateTrainingSessionItem({ ...replacedItem, performedActionId: 'different-action' }).ok, false);

  const unknownPhaseItem = {
    ...replaced.items[0], id: 'member-v1-session-unknown-item', phase: 'UNKNOWN', plannedActionId: 'unknown-action',
    plannedActionSnapshot: { ...replaced.items[0].plannedActionSnapshot, actionId: 'unknown-action', name: 'Unknown action' },
  };
  const excludedPhaseItems = ['FOAM', 'PREP', 'MOBILITY'].map((phase, index) => ({
    ...replaced.items[1], id: `member-v1-session-${phase.toLowerCase()}`, sortOrder: 20 + index, phase,
    plannedActionId: `ignored-${phase}`,
    plannedActionSnapshot: { ...replaced.items[1].plannedActionSnapshot, actionId: `ignored-${phase}`, name: `Ignored ${phase}`, pattern: `Ignored ${phase}`, primaryMuscles: [`Ignored ${phase} muscle`] },
  }));
  const context = domain.deriveMemberTrainingContext(member, [
    { ...replaced.session, items: [...replaced.items, unknownPhaseItem, ...excludedPhaseItems] },
    { ...planned.session, status: 'CANCELLED', completedAt: null, items: planned.items },
    { ...planned.session, id: '0f000000-0000-4000-8000-000000000020', sessionDate: '2026-09-20', status: 'COMPLETED', completedAt: '2026-09-20T11:00:00.000Z', items: planned.items.map(item => ({ ...item, completed: true })) },
  ], { generatedAt: '2026-09-27T12:00:00.000Z' });
  assert.equal(context.schemaVersion, 1);
  assert.equal(context.memberId, member.id);
  assert.equal(context.recentSessions.length, 2);
  assert.equal(context.recentSessions[0].id, replaced.session.id);
  assert(!context.recentActions.some(item => item.actionId === 'unknown-action'));
  assert(!context.recentActions.some(item => item.actionId.startsWith('ignored-')));
  assert(!context.recentPrimaryMuscles.some(item => item.muscle.startsWith('Ignored ')));
  const performedSignal = context.recentActions.find(item => item.actionId === replacedItem.performedActionId);
  assert.equal(performedSignal.actionNameSnapshot, replacedItem.performedActionSnapshot.name);
  assert.equal(performedSignal.sessionsAgo, 0);
  assert.equal(performedSignal.countLast3, 1);

  console.log('member_domain_test: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
