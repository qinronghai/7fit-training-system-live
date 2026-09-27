import {
  deriveMemberTrainingContext,
  validateMember,
  validateTrainingSession,
  validateTrainingSessionItem,
} from '../_shared/member-domain.mjs';

const MEMBER_INPUT_KEYS = new Set(['id', 'displayName', 'trainingLevel', 'primaryGoal', 'trainingProfile', 'coachNotes']);
const SESSION_PATCH_KEYS = new Set(['sessionDate', 'coachNote', 'memberCopyText']);
const PERFORMED_ITEM_KEYS = new Set(['id', 'performedActionId', 'performedActionSnapshot', 'performedPrescription', 'sets', 'reps', 'loadKg', 'rir', 'rpe', 'completed', 'note']);
const SESSION_SUMMARY_KEYS = Object.freeze([
  'id', 'memberId', 'sessionDate', 'status', 'templateKey', 'templateVersion',
  'levelSnapshot', 'sessionTitle', 'focusSnapshot', 'schemaVersion', 'revision',
  'createdAt', 'updatedAt', 'completedAt',
]);
const EMPTY_PROFILE = Object.freeze({
  schemaVersion: 1,
  experienceLevel: null,
  movementConstraints: [],
  preferredEquipment: [],
  notes: null,
});
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function apiError(error, status, fields) {
  const body = { error };
  if (fields?.length) body.fields = fields;
  return json(body, status);
}

function dateNow(now) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function boundedLimit(value, fallback = 30) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 100);
}

function boundedOffset(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 10000) : 0;
}

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readValidationErrors(result) {
  return result.errors.map(message => message.split(':')[0]);
}

function normalizeMember(input, existing, timestamp, createId) {
  if (!isRecord(input)) return { error: 'invalid_member', fields: ['body'] };
  const unknownKeys = Object.keys(input).filter(key => !MEMBER_INPUT_KEYS.has(key));
  if (unknownKeys.length) return { error: 'invalid_member', fields: unknownKeys };
  if (input.id != null && !isUuid(input.id)) return { error: 'invalid_member', fields: ['id'] };

  const priorProfile = existing?.trainingProfile || EMPTY_PROFILE;
  const suppliedProfile = input.trainingProfile;
  const trainingProfile = suppliedProfile === undefined
    ? { ...EMPTY_PROFILE, ...priorProfile }
    : isRecord(suppliedProfile)
      ? { ...EMPTY_PROFILE, ...priorProfile, ...suppliedProfile }
      : suppliedProfile;
  const member = {
    schemaVersion: 1,
    id: existing?.id || input.id || createId(),
    displayName: typeof input.displayName === 'string' ? input.displayName.trim() : existing?.displayName,
    status: existing?.status || 'ACTIVE',
    trainingLevel: input.trainingLevel === undefined ? (existing?.trainingLevel ?? null) : input.trainingLevel,
    primaryGoal: input.primaryGoal === undefined ? (existing?.primaryGoal ?? null) : input.primaryGoal,
    trainingProfile,
    coachNotes: input.coachNotes === undefined ? (existing?.coachNotes ?? null) : input.coachNotes,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    archivedAt: existing?.archivedAt ?? null,
  };
  const checked = validateMember(member);
  if (!checked.ok) return { error: 'invalid_member', fields: readValidationErrors(checked) };
  return { member };
}

function normalizeSnapshot(snapshot) {
  if (!isRecord(snapshot)
    || Object.keys(snapshot).some(key => !['schemaVersion', 'session', 'items'].includes(key))
    || snapshot.schemaVersion !== 1
    || !isRecord(snapshot.session)
    || !Array.isArray(snapshot.items)
    || snapshot.items.length < 1
    || snapshot.items.length > 80) {
    return { ok: false, fields: ['snapshot'] };
  }
  const sessionCheck = validateTrainingSession(snapshot.session);
  if (!sessionCheck.ok || snapshot.session.status !== 'PLANNED') return { ok: false, fields: ['session'] };
  const fields = [];
  snapshot.items.forEach((item, index) => {
    const checked = validateTrainingSessionItem(item);
    if (!checked.ok) {
      fields.push(`items.${index}`);
      return;
    }
    if (item.sessionId !== snapshot.session.id) fields.push(`items.${index}.sessionId`);
    if (item.completed !== false || item.performedActionId !== null || item.performedActionSnapshot !== null) fields.push(`items.${index}.plannedState`);
  });
  return { ok: fields.length === 0, fields };
}

function mapRepositoryError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || error?.details || '');
  if (message.includes('MEMBER_IDEMPOTENCY_CONFLICT') || message.includes('MEMBER_COMPLETION_CONFLICT') || code === '23505') {
    return { status: 409, error: 'duplicate_request' };
  }
  if (message.includes('MEMBER_REVISION_CONFLICT') || code === '40001') return { status: 409, error: 'stale_update' };
  if (message.includes('MEMBER_INVALID_TRANSITION')) return { status: 409, error: 'invalid_status_transition' };
  if (message.includes('MEMBER_NOT_ACTIVE')) return { status: 409, error: 'member_inactive' };
  if (message.includes('MEMBER_NOT_FOUND') || message.includes('MEMBER_SESSION_NOT_FOUND') || code === 'P0002' || code === '23503') {
    return { status: 404, error: message.includes('SESSION') ? 'session_not_found' : 'member_not_found' };
  }
  if (message.includes('MEMBER_INVALID_SNAPSHOT')) return { status: 400, error: 'invalid_snapshot' };
  if (message.includes('MEMBER_INVALID_PLANNED') || message.includes('MEMBER_INVALID_COMPLETION')) return { status: 400, error: 'invalid_session' };
  if (code === '23514' || code === '22P02' || code === '22023') return { status: 400, error: 'invalid_session' };
  return { status: 500, error: 'internal_error' };
}

function sessionSummary(session) {
  const output = {};
  for (const key of SESSION_SUMMARY_KEYS) if (session?.[key] !== undefined) output[key] = session[key];
  return output;
}

function safeExpectedRevision(value) {
  return Number.isInteger(value) && value > 0;
}

function buildPerformedItems(session, storedItems, inputItems) {
  if (!Array.isArray(storedItems) || storedItems.length < 1 || storedItems.length > 80) return { error: 'invalid_session', fields: ['items'] };
  const patches = new Map();
  if (inputItems !== undefined) {
    if (!Array.isArray(inputItems)) return { error: 'invalid_session', fields: ['items'] };
    for (const patch of inputItems) {
      if (!isRecord(patch) || Object.keys(patch).some(key => !PERFORMED_ITEM_KEYS.has(key)) || !isUuid(patch.id) || patches.has(patch.id)) {
        return { error: 'invalid_session', fields: ['items'] };
      }
      patches.set(patch.id, patch);
    }
  }
  const storedIds = new Set(storedItems.map(item => item.id));
  if ([...patches.keys()].some(id => !storedIds.has(id))) return { error: 'invalid_session', fields: ['items.id'] };

  const items = storedItems.map(item => {
    const patch = patches.get(item.id) || {};
    return {
      schemaVersion: 1,
      id: item.id,
      sessionId: session.id,
      phase: item.phase,
      slotKey: item.slotKey ?? null,
      sortOrder: item.sortOrder,
      plannedActionId: item.plannedActionId ?? null,
      plannedActionSnapshot: item.plannedActionSnapshot ?? null,
      performedActionId: Object.prototype.hasOwnProperty.call(patch, 'performedActionId')
        ? patch.performedActionId
        : item.performedActionId ?? item.plannedActionId ?? null,
      performedActionSnapshot: Object.prototype.hasOwnProperty.call(patch, 'performedActionSnapshot')
        ? patch.performedActionSnapshot
        : Object.prototype.hasOwnProperty.call(patch, 'performedActionId')
          ? null
          : item.performedActionSnapshot ?? item.plannedActionSnapshot ?? null,
      plannedPrescriptionSnapshot: item.plannedPrescriptionSnapshot,
      performedPrescription: Object.prototype.hasOwnProperty.call(patch, 'performedPrescription')
        ? patch.performedPrescription
        : item.performedPrescription ?? item.plannedPrescriptionSnapshot,
      sets: patch.sets === undefined ? (item.sets ?? null) : patch.sets,
      reps: patch.reps === undefined ? (item.reps ?? null) : patch.reps,
      loadKg: patch.loadKg === undefined ? (item.loadKg ?? null) : patch.loadKg,
      rir: patch.rir === undefined ? (item.rir ?? null) : patch.rir,
      rpe: patch.rpe === undefined ? (item.rpe ?? null) : patch.rpe,
      completed: patch.completed ?? (item.completed === true || session.status === 'COMPLETED' ? item.completed : true),
      note: patch.note === undefined ? (item.note ?? null) : patch.note,
    };
  });
  for (const item of items) {
    const checked = validateTrainingSessionItem(item);
    if (!checked.ok) return { error: 'invalid_session', fields: [`items.${item.sortOrder}`] };
  }
  return { items };
}

async function readBody(request) {
  try {
    const value = await request.json();
    return isRecord(value) ? value : null;
  } catch (_) {
    return null;
  }
}

export function createMemberApi({ auth, repository, now = () => new Date(), createId = () => crypto.randomUUID() }) {
  if (!auth || typeof auth.verify !== 'function' || !repository) throw new TypeError('Member API requires auth and repository services.');

  return async function handleMemberRequest(request) {
    if (request.method === 'OPTIONS') return json({ ok: true });
    if (!['GET', 'POST'].includes(request.method)) return apiError('invalid_request', 405);

    const authorization = request.headers.get('authorization');
    let verified;
    try {
      verified = await auth.verify(authorization);
    } catch (_) {
      verified = { ok: false };
    }
    if (!verified?.ok) return apiError('unauthorized', 401);

    const url = new URL(request.url);
    const action = url.searchParams.get('action') || '';
    const body = request.method === 'POST' ? await readBody(request) : {};
    if (request.method === 'POST' && !body) return apiError('invalid_request', 400);
    const timestamp = dateNow(now);

    try {
      if (request.method === 'GET' && action === 'list-members') {
        const requestedStatus = url.searchParams.get('status') || '';
        if (requestedStatus && !['ACTIVE', 'ARCHIVED', 'INACTIVE'].includes(requestedStatus)) {
          return apiError('invalid_request', 400, ['status']);
        }
        const options = {
          status: requestedStatus || (['1', 'true'].includes((url.searchParams.get('includeArchived') || '').toLowerCase()) ? 'ALL' : 'ACTIVE'),
          includeArchived: ['1', 'true'].includes((url.searchParams.get('includeArchived') || '').toLowerCase()),
          search: (url.searchParams.get('search') || '').trim().slice(0, 120),
          limit: boundedLimit(url.searchParams.get('limit')),
          offset: boundedOffset(url.searchParams.get('offset')),
        };
        return json({ members: await repository.listMembers(options) });
      }

      if (request.method === 'GET' && action === 'get-member') {
        const id = url.searchParams.get('memberId') || '';
        if (!isUuid(id)) return apiError('invalid_member', 400, ['memberId']);
        const member = await repository.getMember(id);
        return member ? json({ member }) : apiError('member_not_found', 404);
      }

      if (request.method === 'POST' && action === 'save-member') {
        const id = body.id || '';
        if (id && !isUuid(id)) return apiError('invalid_member', 400, ['id']);
        const existing = id ? await repository.getMember(id) : null;
        const normalized = normalizeMember(body, existing, timestamp, createId);
        if (normalized.error) return apiError(normalized.error, 400, normalized.fields);
        return json({ member: await repository.saveMember(normalized.member) });
      }

      if (request.method === 'POST' && ['archive-member', 'restore-member'].includes(action)) {
        const id = body.id || '';
        if (!isUuid(id)) return apiError('invalid_member', 400, ['id']);
        const member = await repository.getMember(id);
        if (!member) return apiError('member_not_found', 404);
        const patch = action === 'archive-member'
          ? { status: 'INACTIVE', archivedAt: member.archivedAt || timestamp, updatedAt: timestamp }
          : { status: 'ACTIVE', archivedAt: null, updatedAt: timestamp };
        return json({ member: await repository.updateMember(id, patch) });
      }

      if (request.method === 'GET' && action === 'list-sessions') {
        const memberId = url.searchParams.get('memberId') || '';
        if (!isUuid(memberId)) return apiError('invalid_member', 400, ['memberId']);
        if (!await repository.getMember(memberId)) return apiError('member_not_found', 404);
        const status = url.searchParams.get('status') || '';
        if (status && !['PLANNED', 'COMPLETED', 'CANCELLED'].includes(status)) return apiError('invalid_session', 400, ['status']);
        const rows = await repository.listSessions({
          memberId,
          status: status || null,
          limit: boundedLimit(url.searchParams.get('limit')),
          offset: boundedOffset(url.searchParams.get('offset')),
        });
        return json({ sessions: rows.map(sessionSummary) });
      }

      if (request.method === 'GET' && action === 'get-session') {
        const id = url.searchParams.get('sessionId') || '';
        if (!isUuid(id)) return apiError('invalid_session', 400, ['sessionId']);
        const result = await repository.getSession(id);
        return result ? json({ session: result.session, items: result.items }) : apiError('session_not_found', 404);
      }

      if (request.method === 'POST' && action === 'save-planned-session') {
        const checked = normalizeSnapshot(body.snapshot);
        if (!checked.ok) return apiError('invalid_snapshot', 400, checked.fields);
        const member = await repository.getMember(body.snapshot.session.memberId);
        if (!member) return apiError('member_not_found', 404);
        if (member.status !== 'ACTIVE' || member.archivedAt) return apiError('member_inactive', 409);
        const result = await repository.savePlannedSession(body.snapshot);
        return json({
          sessionId: result.sessionId,
          revision: result.revision,
          status: result.status,
          idempotentReplay: result.idempotentReplay === true,
        });
      }

      if (request.method === 'POST' && action === 'update-session') {
        const id = body.sessionId || '';
        const expectedRevision = body.expectedRevision;
        if (!isUuid(id) || !safeExpectedRevision(expectedRevision) || !isRecord(body.patch)) return apiError('invalid_session', 400);
        const keys = Object.keys(body.patch);
        if (!keys.length || keys.some(key => !SESSION_PATCH_KEYS.has(key))) return apiError('invalid_session', 400, ['patch']);
        if (body.patch.sessionDate !== undefined && !parseDate(body.patch.sessionDate)) return apiError('invalid_session', 400, ['sessionDate']);
        for (const key of ['coachNote', 'memberCopyText']) {
          const max = key === 'coachNote' ? 4000 : 12000;
          if (body.patch[key] !== undefined && body.patch[key] !== null && (typeof body.patch[key] !== 'string' || body.patch[key].length > max)) {
            return apiError('invalid_session', 400, [key]);
          }
        }
        const updated = await repository.updateSession(id, expectedRevision, body.patch, timestamp);
        if (updated) return json({ session: updated });
        const existing = await repository.getSession(id);
        if (!existing) return apiError('session_not_found', 404);
        if (existing.session.revision !== expectedRevision) return apiError('stale_update', 409);
        return apiError('invalid_status_transition', 409);
      }

      if (request.method === 'POST' && action === 'complete-session') {
        const id = body.sessionId || '';
        const expectedRevision = body.expectedRevision;
        if (!isUuid(id) || !safeExpectedRevision(expectedRevision)) return apiError('invalid_session', 400);
        if (body.items === undefined && body.completeAsPlanned !== true) return apiError('invalid_session', 400, ['items']);
        const existing = await repository.getSession(id);
        if (!existing) return apiError('session_not_found', 404);
        if (existing.session.status === 'CANCELLED') return apiError('invalid_status_transition', 409);
        const normalized = buildPerformedItems(existing.session, existing.items, body.items);
        if (normalized.error) return apiError(normalized.error, 400, normalized.fields);
        const result = await repository.completeSession({
          sessionId: id,
          expectedRevision,
          completedAt: timestamp,
          items: normalized.items,
        });
        return json(result);
      }

      if (request.method === 'POST' && action === 'cancel-session') {
        const id = body.sessionId || '';
        if (!isUuid(id) || !safeExpectedRevision(body.expectedRevision)) return apiError('invalid_session', 400);
        return json(await repository.cancelSession({ sessionId: id, expectedRevision: body.expectedRevision }));
      }

      if (request.method === 'GET' && action === 'get-member-training-context') {
        const memberId = url.searchParams.get('memberId') || '';
        if (!isUuid(memberId)) return apiError('invalid_member', 400, ['memberId']);
        const member = await repository.getMember(memberId);
        if (!member) return apiError('member_not_found', 404);
        const sessions = await repository.getCompletedSessionsForContext(memberId, 3);
        return json({ context: deriveMemberTrainingContext(member, sessions, { generatedAt: timestamp }) });
      }

      return apiError('not_found', 404);
    } catch (error) {
      const mapped = mapRepositoryError(error);
      return apiError(mapped.error, mapped.status);
    }
  };
}

export { SESSION_SUMMARY_KEYS };
