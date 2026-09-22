import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sha256Hex,
  constantTimeEqual,
  createOpaqueToken,
  hashSessionToken,
  pinMatches,
  createSessionRecord,
  isSessionActive,
} from '../supabase/functions/case-api/auth.mjs';

test('pinMatches accepts only the hash of the exact PIN', async () => {
  const expectedHash = await sha256Hex('123456');

  assert.equal(await pinMatches('123456', expectedHash), true);
  assert.equal(await pinMatches('123457', expectedHash), false);
  assert.equal(await pinMatches('123456 ', expectedHash), false);
});

test('constantTimeEqual compares equal-length values without changing their meaning', () => {
  assert.equal(constantTimeEqual('abc123', 'abc123'), true);
  assert.equal(constantTimeEqual('abc123', 'abc124'), false);
  assert.equal(constantTimeEqual('abc123', 'abc12'), false);
});

test('opaque session tokens are random-looking and hashed before persistence', async () => {
  const first = await createOpaqueToken();
  const second = await createOpaqueToken();

  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]+$/);
  assert.equal((await hashSessionToken(first)).length, 64);
  assert.notEqual(await hashSessionToken(first), first);
});

test('session records are active until expiry and inactive after revocation', () => {
  const now = new Date('2026-09-22T10:00:00.000Z');
  const record = createSessionRecord('hashed-token', now, 30 * 24 * 60 * 60);

  assert.equal(record.token_hash, 'hashed-token');
  assert.equal(isSessionActive(record, now), true);
  assert.equal(isSessionActive(record, new Date('2026-10-22T10:00:00.000Z')), false);
  assert.equal(isSessionActive({ ...record, revoked_at: now.toISOString() }, now), false);
});
