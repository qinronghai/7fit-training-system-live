import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminAuthService, sha256Hex } from '../supabase/functions/case-api/auth.mjs';

function memoryStore() {
  const records = new Map();
  return {
    async insert(record) {
      records.set(record.token_hash, { ...record });
    },
    async findByHash(tokenHash) {
      return records.get(tokenHash) || null;
    },
    async revokeByHash(tokenHash, revokedAt) {
      const record = records.get(tokenHash);
      if (record) record.revoked_at = revokedAt;
    },
  };
}

test('admin auth service returns a session for the correct PIN', async () => {
  const now = new Date('2026-09-22T10:00:00.000Z');
  const service = createAdminAuthService({
    expectedPinHash: await sha256Hex('123456'),
    store: memoryStore(),
    now: () => now,
  });

  const result = await service.login('123456');

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.match(result.body.session.token, /^[A-Za-z0-9_-]+$/);
  assert.equal(result.body.session.expiresAt, '2026-10-22T10:00:00.000Z');
});

test('admin auth service rejects an incorrect PIN without creating a session', async () => {
  let inserted = false;
  const store = memoryStore();
  const originalInsert = store.insert;
  store.insert = async (record) => {
    inserted = true;
    return originalInsert(record);
  };
  const service = createAdminAuthService({
    expectedPinHash: await sha256Hex('123456'),
    store,
    now: () => new Date('2026-09-22T10:00:00.000Z'),
  });

  const result = await service.login('123457');

  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: 'invalid_pin' });
  assert.equal(inserted, false);
});

test('admin auth service verifies an active session and rejects missing bearer tokens', async () => {
  const store = memoryStore();
  const service = createAdminAuthService({
    expectedPinHash: await sha256Hex('123456'),
    store,
    now: () => new Date('2026-09-22T10:00:00.000Z'),
  });
  const login = await service.login('123456');

  assert.equal((await service.verify(`Bearer ${login.body.session.token}`)).ok, true);
  assert.equal((await service.verify('')).ok, false);
  assert.equal((await service.verify('Basic not-a-session')).ok, false);
});

test('admin auth service revokes a session so later verification fails', async () => {
  const now = new Date('2026-09-22T10:00:00.000Z');
  const store = memoryStore();
  const service = createAdminAuthService({
    expectedPinHash: await sha256Hex('123456'),
    store,
    now: () => now,
  });
  const login = await service.login('123456');
  const authorization = `Bearer ${login.body.session.token}`;

  assert.equal((await service.logout(authorization)).status, 200);
  assert.equal((await service.verify(authorization)).ok, false);
});
