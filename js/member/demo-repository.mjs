const samples = [
  ['林同学', 'L3', '提升下肢力量'],
  ['陈同学', 'L1', '建立每周训练习惯，提升基础力量'],
  ['周同学', 'L3', '提升全身力量'],
  ['许同学', 'L2', '改善核心稳定'],
  ['张同学', 'L1', '掌握深蹲和髋铰链，打好力量基础'],
  ['王同学', 'L2', '提升上肢力量'],
  ['郑同学', 'L2', '改善单腿稳定'],
  ['李同学', 'L1', '提高基础体能'],
  ['吴同学', 'L2', '提升肩背力量'],
  ['何同学', 'L1', '建立力量训练基础'],
  ['黄同学', 'L2', '提升下肢稳定'],
  ['赵同学', 'L3', '提高全身力量'],
  ['钱同学', 'L2', '改善下肢稳定', 'ARCHIVED'],
  ['孙同学', 'L1', '适应基础训练', 'INACTIVE'],
];
const sampleMember = {
  schemaVersion: 1,
  id: 'd1000000-0000-4000-8000-000000000001',
  createdAt: '2026-11-25T00:00:00.000Z',
  updatedAt: '2026-11-25T00:00:00.000Z',
  coachNotes: null,
  trainingProfile: {
    schemaVersion: 1,
    experienceLevel: null,
    movementConstraints: [],
    preferredEquipment: [],
    notes: null,
  },
};

const memberStatus = member => member.archivedAt ? 'ARCHIVED' : member.status;

export function createDemoMembers(fixture = sampleMember) {
  return samples.map(([displayName, trainingLevel, primaryGoal, status = 'ACTIVE'], index) => ({
    ...fixture,
    id: index === 0 ? fixture.id : `d2000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    displayName,
    trainingLevel,
    primaryGoal,
    status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    archivedAt: status === 'ARCHIVED' ? fixture.updatedAt : null,
    trainingProfile: { ...fixture.trainingProfile, movementConstraints: [], preferredEquipment: [] },
  }));
}

export function createDemoRepository({ members: initialMembers, sessions: initialSessions }) {
  const members = new Map(initialMembers.map(member => [member.id, member]));
  const sessions = new Map(initialSessions.map(record => [record.session.id, record]));

  function matchingSessions(memberId, status) {
    return [...sessions.values()].filter(({ session }) => session.memberId === memberId && (!status || session.status === status))
      .sort((a, b) => b.session.sessionDate.localeCompare(a.session.sessionDate)
        || b.session.createdAt.localeCompare(a.session.createdAt) || a.session.id.localeCompare(b.session.id));
  }

  function requirePlannedSession(id, revision) {
    const record = sessions.get(id);
    if (!record) throw new Error('MEMBER_SESSION_NOT_FOUND');
    if (record.session.revision !== revision) throw new Error('MEMBER_REVISION_CONFLICT');
    if (record.session.status !== 'PLANNED') throw new Error('MEMBER_INVALID_TRANSITION');
    return record;
  }

  const repository = {
    async listMembers({ status, search, limit, offset }) {
      const query = search.toLocaleLowerCase();
      return [...members.values()].filter(member => (status === 'ALL' || memberStatus(member) === status)
        && member.displayName.toLocaleLowerCase().includes(query))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-CN') || a.id.localeCompare(b.id))
        .slice(offset, offset + limit);
    },
    async countMembers() {
      const counts = { ACTIVE: 0, ARCHIVED: 0, INACTIVE: 0 };
      for (const member of members.values()) counts[memberStatus(member)]++;
      return counts;
    },
    async getMember(id) { return members.get(id); },
    async saveMember(member) { members.set(member.id, member); return member; },
    async updateMember(id, patch) { return Object.assign(members.get(id), patch); },
    async listSessions({ memberId, status, limit, offset }) {
      return matchingSessions(memberId, status).slice(offset, offset + limit).map(({ session }) => session);
    },
    async getSession(id) { return sessions.get(id); },
    async getCompletedSessionsForContext(memberId, limit) {
      return matchingSessions(memberId, 'COMPLETED').slice(0, limit).map(({ session, items }) => ({ ...session, items }));
    },
    async savePlannedSession({ session, items }) {
      const existing = [...sessions.values()].find(value => value.session.idempotencyKey === session.idempotencyKey);
      if (existing && existing.session.id !== session.id) throw new Error('MEMBER_IDEMPOTENCY_CONFLICT');
      if (existing) return { sessionId: session.id, revision: existing.session.revision, status: existing.session.status, idempotentReplay: true };
      if (sessions.has(session.id)) throw new Error('MEMBER_IDEMPOTENCY_CONFLICT');
      sessions.set(session.id, { session, items });
      return { sessionId: session.id, revision: session.revision, status: session.status };
    },
    async updateSession(id, revision, patch, updatedAt) {
      const session = sessions.get(id)?.session;
      if (!session || session.revision !== revision || session.status !== 'PLANNED') return null;
      return Object.assign(session, patch, { revision: revision + 1, updatedAt });
    },
    async completeSession({ sessionId, expectedRevision, completedAt, items }) {
      const record = requirePlannedSession(sessionId, expectedRevision);
      const revision = expectedRevision + 1;
      Object.assign(record.session, { status: 'COMPLETED', revision, completedAt, updatedAt: completedAt });
      record.items = items;
      return { sessionId, revision, status: 'COMPLETED' };
    },
    async cancelSession({ sessionId, expectedRevision }) {
      const { session } = requirePlannedSession(sessionId, expectedRevision);
      const revision = expectedRevision + 1;
      Object.assign(session, { status: 'CANCELLED', revision, updatedAt: new Date().toISOString() });
      return { sessionId, revision, status: 'CANCELLED' };
    },
    async deletePlannedSession({ sessionId, expectedRevision }) {
      requirePlannedSession(sessionId, expectedRevision);
      sessions.delete(sessionId);
      return { sessionId, revision: expectedRevision + 1, status: 'DELETED', deleted: true };
    },
  };

  return {
    repository,
    snapshot: () => ({ members: [...members.values()], sessions: [...sessions.values()] }),
  };
}
