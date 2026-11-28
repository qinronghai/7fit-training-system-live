import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import { createMemberApi } from '../supabase/functions/member-api/service.mjs';

const root = new URL('../', import.meta.url);
const port = Number(process.argv[2] || 4174);
const origin = `http://127.0.0.1:${port}`;
const apiPath = '/__dev/member-api';
const domainPath = 'supabase/functions/_shared/member-domain.mjs';
const readFixture = async name => JSON.parse(await readFile(new URL(`tests/fixtures/member-v1/${name}.json`, root), 'utf8'));
const fixture = await readFixture('member-active');
const completed = await readFixture('replaced-action-completed');
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
const memberStatus = member => member.archivedAt ? 'ARCHIVED' : member.status;
const members = new Map(samples.map(([displayName, trainingLevel, primaryGoal, status = 'ACTIVE'], index) => {
  const id = index === 0 ? fixture.id : `e2000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  return [id, {
    ...fixture, id, displayName, trainingLevel, primaryGoal,
    status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
    archivedAt: status === 'ARCHIVED' ? fixture.updatedAt : null,
    trainingProfile: { ...fixture.trainingProfile, movementConstraints: [], preferredEquipment: [] },
  }];
}));
const sessions = new Map([[completed.session.id, completed]]);

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

const memberApi = createMemberApi({ auth: { verify: () => ({ ok: true }) }, repository });
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};

createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  try {
    const url = new URL(request.url, origin);
    if (request.headers.host !== url.host || url.origin !== origin) {
      response.writeHead(403).end();
      return;
    }
    if (url.pathname === apiPath) {
      if ((request.headers.origin && request.headers.origin !== origin) || request.headers['sec-fetch-site'] === 'cross-site') {
        response.writeHead(403).end();
        return;
      }
      const options = { method: request.method, headers: request.headers };
      if (request.method === 'POST') Object.assign(options, { body: Readable.toWeb(request), duplex: 'half' });
      const result = await memberApi(new Request(url, options));
      response.writeHead(result.status, { 'Content-Type': result.headers.get('Content-Type') }).end(await result.text());
      return;
    }
    const path = decodeURIComponent(url.pathname);
    const index = path === '/' || path === '/index.html';
    const file = index ? 'index.html' : path === '/js/member/member-domain.mjs' ? domainPath : path.slice(1);
    const asset = /^(assets|data|js)\//.test(file);
    if ((!index && !asset && file !== domainPath) || file.split('/').includes('..') || file.includes('\\')) {
      response.writeHead(404).end();
      return;
    }
    const content = await readFile(new URL(file.split('/').map(encodeURIComponent).join('/'), root));
    const body = index
      ? content.toString('utf8').replace('</head>', `<script>window.V14_MEMBER_API_BASE = location.origin + '${apiPath}';</script></head>`)
      : content;
    response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400).end();
  }
}).listen(port, '127.0.0.1', () => console.log(`7Fit member development preview · ${origin}/#/coach/members`));
