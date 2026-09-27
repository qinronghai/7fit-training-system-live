export const CONTRACT_VERSION = 1;
export const LOAD_PHASES = Object.freeze(['PRIMARY', 'SECONDARY', 'ACCESSORY', 'CORE', 'CONDITIONING']);
export const NON_LOAD_PHASES = Object.freeze(['FOAM', 'PREP', 'MOBILITY']);

const MEMBER_KEYS = new Set(['schemaVersion', 'id', 'displayName', 'status', 'trainingLevel', 'primaryGoal', 'trainingProfile', 'coachNotes', 'createdAt', 'updatedAt', 'archivedAt']);
const PROFILE_KEYS = new Set(['schemaVersion', 'experienceLevel', 'movementConstraints', 'preferredEquipment', 'notes']);
const SESSION_KEYS = new Set(['schemaVersion', 'id', 'memberId', 'sessionDate', 'status', 'templateKey', 'templateVersion', 'levelSnapshot', 'sessionTitle', 'focusSnapshot', 'resolvedSessionSnapshot', 'memberCopyText', 'coachNote', 'createdAt', 'updatedAt', 'completedAt', 'idempotencyKey']);
const ITEM_KEYS = new Set(['schemaVersion', 'id', 'sessionId', 'phase', 'slotKey', 'sortOrder', 'plannedActionId', 'plannedActionSnapshot', 'performedActionId', 'performedActionSnapshot', 'plannedPrescriptionSnapshot', 'performedPrescription', 'sets', 'reps', 'loadKg', 'rir', 'rpe', 'completed', 'note']);
const ACTION_KEYS = new Set(['schemaVersion', 'actionId', 'name', 'pattern', 'level', 'primaryMuscles', 'secondaryMuscles', 'equipment', 'stationId']);
const PRESCRIPTION_KEYS = new Set(['schemaVersion', 'sets', 'reps', 'rir', 'restSeconds', 'tempo', 'loadPrescription', 'rawText']);
const TRAINING_LEVELS = new Set(['L1', 'L2', 'L3', 'L4']);
const SESSION_STATUSES = new Set(['PLANNED', 'COMPLETED', 'CANCELLED']);
const PHASES = new Set([...LOAD_PHASES, ...NON_LOAD_PHASES, 'UNKNOWN']);
const F111_PHASES = Object.freeze({
  A: 'PRIMARY',
  B: 'SECONDARY',
  SUPPORT: 'ACCESSORY',
  '2': 'ACCESSORY',
  '3': 'ACCESSORY',
  C: 'ACCESSORY',
  D1: 'ACCESSORY',
  D2: 'ACCESSORY',
  CORE: 'CORE',
  PRIMARY: 'PRIMARY',
  SECONDARY: 'SECONDARY',
  ACCESSORY: 'ACCESSORY',
  CONDITIONING: 'CONDITIONING',
  FOAM: 'FOAM',
  PREP: 'PREP',
  MOBILITY: 'MOBILITY',
});

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keysAreKnown(value, allowed, path, errors) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${path}.${key}: unknown field`);
}

function requireKeys(value, required, path, errors) {
  for (const key of required) if (!(key in value)) errors.push(`${path}.${key}: required field missing`);
}

function requiredString(value, path, errors, max = 240) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) errors.push(`${path}: expected non-empty string`);
}

function optionalString(value, path, errors, max = 4000) {
  if (value !== undefined && value !== null && (typeof value !== 'string' || value.length > max)) errors.push(`${path}: expected string or null`);
}

function validTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
}

function requiredUuid(value, path, errors) {
  if (!validUuid(value)) errors.push(`${path}: expected UUID`);
}

function result(errors) {
  return { ok: errors.length === 0, errors };
}

function validateTrainingProfile(value, errors) {
  if (!isRecord(value)) {
    errors.push('trainingProfile: expected object');
    return;
  }
  keysAreKnown(value, PROFILE_KEYS, 'trainingProfile', errors);
  requireKeys(value, PROFILE_KEYS, 'trainingProfile', errors);
  if (value.schemaVersion !== 1) errors.push('trainingProfile.schemaVersion: expected 1');
  if (value.experienceLevel !== null && value.experienceLevel !== undefined && !['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(value.experienceLevel)) errors.push('trainingProfile.experienceLevel: invalid value');
  for (const key of ['movementConstraints', 'preferredEquipment']) {
    if (!Array.isArray(value[key])) errors.push(`trainingProfile.${key}: expected array`);
    else if (value[key].some(item => typeof item !== 'string' || !item.trim())) errors.push(`trainingProfile.${key}: expected non-empty strings`);
  }
  optionalString(value.notes, 'trainingProfile.notes', errors, 2000);
}

export function validateMember(value) {
  const errors = [];
  if (!isRecord(value)) return result(['member: expected object']);
  keysAreKnown(value, MEMBER_KEYS, 'member', errors);
  if (value.schemaVersion !== CONTRACT_VERSION) errors.push('schemaVersion: expected 1');
  requiredUuid(value.id, 'id', errors);
  requiredString(value.displayName, 'displayName', errors, 120);
  if (!['ACTIVE', 'INACTIVE'].includes(value.status)) errors.push('status: expected ACTIVE or INACTIVE');
  if (value.trainingLevel !== null && value.trainingLevel !== undefined && !TRAINING_LEVELS.has(value.trainingLevel)) errors.push('trainingLevel: expected L1-L4 or null');
  optionalString(value.primaryGoal, 'primaryGoal', errors, 240);
  validateTrainingProfile(value.trainingProfile, errors);
  optionalString(value.coachNotes, 'coachNotes', errors);
  if (!validTimestamp(value.createdAt)) errors.push('createdAt: expected ISO timestamp');
  if (!validTimestamp(value.updatedAt)) errors.push('updatedAt: expected ISO timestamp');
  if (value.archivedAt !== undefined && value.archivedAt !== null && !validTimestamp(value.archivedAt)) errors.push('archivedAt: expected ISO timestamp or null');
  return result(errors);
}

function validateFocusSnapshot(value, errors) {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    errors.push('focusSnapshot: expected version 1 object');
    return;
  }
  const allowed = new Set(['schemaVersion', 'patterns', 'primaryMuscles']);
  keysAreKnown(value, allowed, 'focusSnapshot', errors);
  for (const key of ['patterns', 'primaryMuscles']) {
    if (!Array.isArray(value[key]) || value[key].some(item => typeof item !== 'string' || !item.trim())) errors.push(`focusSnapshot.${key}: expected string array`);
  }
}

export function validateTrainingSession(value) {
  const errors = [];
  if (!isRecord(value)) return result(['trainingSession: expected object']);
  keysAreKnown(value, SESSION_KEYS, 'trainingSession', errors);
  requireKeys(value, SESSION_KEYS, 'trainingSession', errors);
  if (value.schemaVersion !== CONTRACT_VERSION) errors.push('schemaVersion: expected 1');
  requiredUuid(value.id, 'id', errors);
  requiredUuid(value.memberId, 'memberId', errors);
  if (!validDate(value.sessionDate)) errors.push('sessionDate: expected YYYY-MM-DD date');
  if (!SESSION_STATUSES.has(value.status)) errors.push('status: expected PLANNED, COMPLETED, or CANCELLED');
  requiredString(value.templateKey, 'templateKey', errors, 120);
  optionalString(value.templateVersion, 'templateVersion', errors, 120);
  if (value.levelSnapshot !== undefined && value.levelSnapshot !== null && !TRAINING_LEVELS.has(value.levelSnapshot)) errors.push('levelSnapshot: expected L1-L4 or null');
  requiredString(value.sessionTitle, 'sessionTitle', errors, 240);
  validateFocusSnapshot(value.focusSnapshot, errors);
  if (!isRecord(value.resolvedSessionSnapshot)) errors.push('resolvedSessionSnapshot: expected immutable object');
  optionalString(value.memberCopyText, 'memberCopyText', errors, 12000);
  optionalString(value.coachNote, 'coachNote', errors);
  if (!validTimestamp(value.createdAt)) errors.push('createdAt: expected ISO timestamp');
  if (!validTimestamp(value.updatedAt)) errors.push('updatedAt: expected ISO timestamp');
  if (value.status === 'COMPLETED') {
    if (!validTimestamp(value.completedAt)) errors.push('completedAt: required for COMPLETED');
  } else if (value.completedAt !== undefined && value.completedAt !== null) {
    errors.push('completedAt: must be null unless status is COMPLETED');
  }
  optionalString(value.idempotencyKey, 'idempotencyKey', errors, 200);
  if (value.idempotencyKey && value.idempotencyKey.length < 8) errors.push('idempotencyKey: minimum length is 8');
  return result(errors);
}

function validateActionSnapshot(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path}: expected action snapshot object`);
    return;
  }
  keysAreKnown(value, ACTION_KEYS, path, errors);
  requireKeys(value, ACTION_KEYS, path, errors);
  if (value.schemaVersion !== 1) errors.push(`${path}.schemaVersion: expected 1`);
  requiredString(value.actionId, `${path}.actionId`, errors, 160);
  requiredString(value.name, `${path}.name`, errors, 240);
  requiredString(value.pattern, `${path}.pattern`, errors, 120);
  optionalString(value.level, `${path}.level`, errors, 80);
  for (const key of ['primaryMuscles', 'secondaryMuscles']) {
    if (!Array.isArray(value[key]) || value[key].some(item => typeof item !== 'string' || !item.trim())) errors.push(`${path}.${key}: expected string array`);
  }
  optionalString(value.equipment, `${path}.equipment`, errors, 240);
  optionalString(value.stationId, `${path}.stationId`, errors, 160);
}

function validatePrescription(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path}: expected prescription snapshot object`);
    return;
  }
  keysAreKnown(value, PRESCRIPTION_KEYS, path, errors);
  requireKeys(value, PRESCRIPTION_KEYS, path, errors);
  if (value.schemaVersion !== 1) errors.push(`${path}.schemaVersion: expected 1`);
  if (value.sets !== null && (!Number.isInteger(value.sets) || value.sets < 0)) errors.push(`${path}.sets: expected non-negative integer or null`);
  if (value.reps !== null && !(Number.isInteger(value.reps) && value.reps >= 0) && !(typeof value.reps === 'string' && value.reps.length <= 80)) errors.push(`${path}.reps: expected non-negative integer, string, or null`);
  for (const key of ['rir']) if (value[key] !== null && (typeof value[key] !== 'number' || value[key] < 0 || value[key] > 10)) errors.push(`${path}.${key}: expected 0-10 or null`);
  if (value.restSeconds !== null && (!Number.isInteger(value.restSeconds) || value.restSeconds < 0 || value.restSeconds > 7200)) errors.push(`${path}.restSeconds: expected non-negative seconds or null`);
  for (const key of ['tempo', 'loadPrescription', 'rawText']) optionalString(value[key], `${path}.${key}`, errors, key === 'rawText' ? 240 : 240);
}

export function validateTrainingSessionItem(value) {
  const errors = [];
  if (!isRecord(value)) return result(['trainingSessionItem: expected object']);
  keysAreKnown(value, ITEM_KEYS, 'trainingSessionItem', errors);
  requireKeys(value, ITEM_KEYS, 'trainingSessionItem', errors);
  if (value.schemaVersion !== CONTRACT_VERSION) errors.push('schemaVersion: expected 1');
  requiredUuid(value.id, 'id', errors);
  requiredUuid(value.sessionId, 'sessionId', errors);
  if (!PHASES.has(value.phase)) errors.push('phase: expected a canonical phase or UNKNOWN');
  optionalString(value.slotKey, 'slotKey', errors, 80);
  if (!Number.isInteger(value.sortOrder) || value.sortOrder < 0) errors.push('sortOrder: expected non-negative integer');
  optionalString(value.plannedActionId, 'plannedActionId', errors, 160);
  if (value.plannedActionSnapshot !== null) validateActionSnapshot(value.plannedActionSnapshot, 'plannedActionSnapshot', errors);
  optionalString(value.performedActionId, 'performedActionId', errors, 160);
  if (value.performedActionSnapshot !== null) validateActionSnapshot(value.performedActionSnapshot, 'performedActionSnapshot', errors);
  if ((value.plannedActionId === null) !== (value.plannedActionSnapshot === null)) errors.push('plannedActionId and plannedActionSnapshot must both be null or both be present');
  if (value.plannedActionId && value.plannedActionSnapshot?.actionId !== value.plannedActionId) errors.push('plannedActionSnapshot.actionId must match plannedActionId');
  if ((value.performedActionId === null) !== (value.performedActionSnapshot === null)) errors.push('performedActionId and performedActionSnapshot must both be null or both be present');
  if (value.performedActionId && value.performedActionSnapshot?.actionId !== value.performedActionId) errors.push('performedActionSnapshot.actionId must match performedActionId');
  validatePrescription(value.plannedPrescriptionSnapshot, 'plannedPrescriptionSnapshot', errors);
  if (value.performedPrescription !== null) validatePrescription(value.performedPrescription, 'performedPrescription', errors);
  if (value.sets !== null && (!Number.isInteger(value.sets) || value.sets < 0)) errors.push('sets: expected non-negative integer or null');
  if (value.reps !== null && !(Number.isInteger(value.reps) && value.reps >= 0) && !(typeof value.reps === 'string' && value.reps.length <= 80)) errors.push('reps: expected non-negative integer, string, or null');
  if (value.loadKg !== null && (typeof value.loadKg !== 'number' || value.loadKg < 0 || value.loadKg > 2000)) errors.push('loadKg: expected 0-2000 or null');
  for (const key of ['rir', 'rpe']) if (value[key] !== null && (typeof value[key] !== 'number' || value[key] < 0 || value[key] > 10)) errors.push(`${key}: expected 0-10 or null`);
  if (typeof value.completed !== 'boolean') errors.push('completed: expected boolean');
  optionalString(value.note, 'note', errors, 2000);
  return result(errors);
}

export function canonicalPhase(value) {
  if (typeof value !== 'string') return 'UNKNOWN';
  const key = value.trim().toUpperCase();
  return F111_PHASES[key] || 'UNKNOWN';
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values) {
  return [...new Set(asArray(values).filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))];
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function lookup(record, key) {
  if (record instanceof Map) return record.get(key);
  return record && typeof record === 'object' ? record[key] : undefined;
}

function actionSnapshot(slot, options) {
  const actionId = slot.actionId;
  const source = lookup(options.actionsById, actionId) || {};
  const anatomy = lookup(options.anatomyById, actionId) || {};
  const primary = uniqueStrings(anatomy.primary);
  const secondary = uniqueStrings(anatomy.secondary);
  return {
    schemaVersion: CONTRACT_VERSION,
    actionId,
    name: source.name || slot.name,
    pattern: source.pattern || slot.pattern || 'UNKNOWN',
    level: source.tier || source.grade || null,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    equipment: source.equipment || null,
    stationId: source.stationId || null,
  };
}

function prescriptionSnapshot(rawText) {
  return {
    schemaVersion: CONTRACT_VERSION,
    sets: null,
    reps: null,
    rir: null,
    restSeconds: null,
    tempo: null,
    loadPrescription: null,
    rawText: typeof rawText === 'string' && rawText.trim() ? rawText : null,
  };
}

export function buildTrainingSessionSnapshot(resolvedSession, options = {}) {
  if (!isRecord(resolvedSession) || !isRecord(resolvedSession.main) || resolvedSession.main.kind !== 'SLOT' || !Array.isArray(resolvedSession.main.content)) {
    throw Object.assign(new TypeError('Only slot-based ResolvedSessions can be snapshotted in Member V1.'), { code: 'UNSUPPORTED_RESOLVED_SESSION' });
  }
  for (const key of ['sessionId', 'memberId', 'sessionDate', 'createdAt', 'updatedAt']) {
    if (typeof options[key] !== 'string' || !options[key]) throw Object.assign(new TypeError(`${key} is required to build a stable session snapshot.`), { code: 'INVALID_SNAPSHOT_INPUT' });
  }
  if (!validUuid(options.sessionId) || !validUuid(options.memberId)) throw Object.assign(new TypeError('sessionId and memberId must be UUIDs.'), { code: 'INVALID_SNAPSHOT_INPUT' });
  if (!Array.isArray(options.itemIds) || options.itemIds.length !== resolvedSession.main.content.length || options.itemIds.some(id => !validUuid(id))) {
    throw Object.assign(new TypeError('itemIds must contain one UUID for each ResolvedSession slot.'), { code: 'INVALID_SNAPSHOT_INPUT' });
  }
  const title = typeof resolvedSession.title === 'string' && resolvedSession.title.trim() ? resolvedSession.title : resolvedSession.templateId;
  const session = {
    schemaVersion: CONTRACT_VERSION,
    id: options.sessionId,
    memberId: options.memberId,
    sessionDate: options.sessionDate,
    status: 'PLANNED',
    templateKey: resolvedSession.templateId,
    templateVersion: resolvedSession.resolverVersion || null,
    levelSnapshot: TRAINING_LEVELS.has(resolvedSession.level) ? resolvedSession.level : null,
    sessionTitle: title,
    focusSnapshot: {
      schemaVersion: CONTRACT_VERSION,
      patterns: uniqueStrings(resolvedSession.prepContext?.mainPatterns),
      primaryMuscles: uniqueStrings(resolvedSession.anatomyContext?.primary),
    },
    resolvedSessionSnapshot: cloneJson(resolvedSession),
    memberCopyText: null,
    coachNote: null,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
    completedAt: null,
    idempotencyKey: options.idempotencyKey || null,
  };
  const items = resolvedSession.main.content.map((slot, sortOrder) => {
    if (!slot || typeof slot.actionId !== 'string' || !slot.actionId) throw Object.assign(new TypeError(`ResolvedSession slot ${sortOrder} has no actionId.`), { code: 'INVALID_RESOLVED_SESSION' });
    return {
      schemaVersion: CONTRACT_VERSION,
      id: options.itemIds[sortOrder],
      sessionId: options.sessionId,
      phase: canonicalPhase(slot.key),
      slotKey: typeof slot.key === 'string' ? slot.key : null,
      sortOrder,
      plannedActionId: slot.actionId,
      plannedActionSnapshot: actionSnapshot(slot, options),
      performedActionId: null,
      performedActionSnapshot: null,
      plannedPrescriptionSnapshot: prescriptionSnapshot(slot.prescription),
      performedPrescription: null,
      sets: null,
      reps: null,
      loadKg: null,
      rir: null,
      rpe: null,
      completed: false,
      note: null,
    };
  });
  return { schemaVersion: CONTRACT_VERSION, session, items };
}

function recentSession(session, sessionsAgo) {
  return {
    id: session.id,
    sessionDate: session.sessionDate,
    templateKey: session.templateKey,
    sessionTitle: session.sessionTitle,
    completedAt: session.completedAt,
    sessionsAgo,
  };
}

function compareSessions(left, right) {
  const leftDate = `${left.sessionDate || ''}T${left.completedAt || left.updatedAt || left.createdAt || ''}`;
  const rightDate = `${right.sessionDate || ''}T${right.completedAt || right.updatedAt || right.createdAt || ''}`;
  return rightDate.localeCompare(leftDate) || String(right.id).localeCompare(String(left.id));
}

function countBySession(selectedSessions, keyForItem, snapshotForItem) {
  const records = new Map();
  selectedSessions.forEach((session, sessionsAgo) => {
    const seen = new Set();
    for (const item of asArray(session.items).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
      if (item.completed !== true) continue;
      if (!LOAD_PHASES.includes(canonicalPhase(item.phase))) continue;
      const snapshot = snapshotForItem(item);
      if (!snapshot || typeof snapshot !== 'object') continue;
      const key = keyForItem(item, snapshot);
      if (typeof key !== 'string' || !key.trim()) continue;
      if (!records.has(key)) records.set(key, { sessionsAgo, countLast3: 0 });
      const entry = records.get(key);
      entry.sessionsAgo = Math.min(entry.sessionsAgo, sessionsAgo);
      if (!seen.has(key)) {
        entry.countLast3 += 1;
        seen.add(key);
      }
    }
  });
  return records;
}

function effectiveActionSnapshot(item) {
  if (item.performedActionId || item.performedActionSnapshot) {
    if (!item.performedActionSnapshot || (item.performedActionId && item.performedActionSnapshot.actionId !== item.performedActionId)) return null;
    return item.performedActionSnapshot;
  }
  if (!item.plannedActionSnapshot || (item.plannedActionId && item.plannedActionSnapshot.actionId !== item.plannedActionId)) return null;
  return item.plannedActionSnapshot;
}

export function deriveMemberTrainingContext(member, sessions, options = {}) {
  const completed = asArray(sessions)
    .filter(session => session && session.status === 'COMPLETED' && validTimestamp(session.completedAt))
    .slice()
    .sort(compareSessions);
  const selected = completed.slice(0, 3);
  const recentSessions = selected.map(recentSession);
  const patternRecords = countBySession(selected, (_item, snapshot) => snapshot.pattern, effectiveActionSnapshot);
  const actionRecords = countBySession(selected, (_item, snapshot) => snapshot.actionId, effectiveActionSnapshot);
  const recentPatterns = [...patternRecords.entries()]
    .filter(([pattern]) => pattern !== 'UNKNOWN')
    .map(([pattern, counts]) => ({ pattern, ...counts }))
    .sort((a, b) => a.sessionsAgo - b.sessionsAgo || a.pattern.localeCompare(b.pattern));
  const recentActions = [...actionRecords.entries()].map(([actionId, counts]) => {
    const item = selected[counts.sessionsAgo]?.items?.find(candidate => effectiveActionSnapshot(candidate)?.actionId === actionId);
    const snapshot = item && effectiveActionSnapshot(item);
    return { actionId, actionNameSnapshot: snapshot?.name || actionId, ...counts };
  }).sort((a, b) => a.sessionsAgo - b.sessionsAgo || a.actionNameSnapshot.localeCompare(b.actionNameSnapshot));
  const muscleMap = new Map();
  selected.forEach((session, sessionsAgo) => {
    const seen = new Set();
    for (const item of asArray(session.items)) {
      if (item.completed !== true) continue;
      if (!LOAD_PHASES.includes(canonicalPhase(item.phase))) continue;
      const snapshot = effectiveActionSnapshot(item);
      if (!snapshot) continue;
      for (const muscle of uniqueStrings(snapshot?.primaryMuscles)) {
        if (!muscleMap.has(muscle)) muscleMap.set(muscle, { muscle, sessionsAgo, countLast3: 0 });
        const record = muscleMap.get(muscle);
        record.sessionsAgo = Math.min(record.sessionsAgo, sessionsAgo);
        if (!seen.has(muscle)) {
          record.countLast3 += 1;
          seen.add(muscle);
        }
      }
    }
  });
  const recentPrimaryMuscles = [...muscleMap.values()].sort((a, b) => a.sessionsAgo - b.sessionsAgo || a.muscle.localeCompare(b.muscle));
  return {
    schemaVersion: CONTRACT_VERSION,
    memberId: member?.id || null,
    displayName: member?.displayName || '未知会员',
    trainingLevel: TRAINING_LEVELS.has(member?.trainingLevel) ? member.trainingLevel : null,
    lastCompletedSession: recentSessions[0] || null,
    recentSessions,
    recentPatterns,
    recentActions,
    recentPrimaryMuscles,
    generatedAt: options.generatedAt || new Date().toISOString(),
  };
}
