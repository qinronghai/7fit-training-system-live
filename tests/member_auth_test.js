const assert = require('node:assert/strict');

async function main() {
  const shared = await import('../supabase/functions/_shared/staff-auth.mjs');
  const compatibility = await import('../supabase/functions/case-api/auth.mjs');
  assert.equal(typeof shared.createStaffAuthService, 'function');
  assert.equal(compatibility.createAdminAuthService, shared.createStaffAuthService);

  const records = new Map();
  const store = {
    async insert(record) { records.set(record.token_hash, { ...record }); },
    async findByHash(hash) { return records.get(hash) || null; },
    async revokeByHash(hash, revokedAt) {
      const record = records.get(hash);
      if (record) record.revoked_at = revokedAt;
    },
  };
  let now = new Date('2026-09-27T10:00:00.000Z');
  const expectedPinHash = await shared.sha256Hex('123456');
  const service = shared.createStaffAuthService({ expectedPinHash, store, now: () => now });
  const login = await service.login('123456');
  assert.equal(login.status, 200);
  assert.equal(login.body.session.expiresAt, '2026-10-27T10:00:00.000Z');
  assert.equal(JSON.stringify(login.body).includes('token_hash'), false);
  assert.equal((await service.verify(`Bearer ${login.body.session.token}`)).ok, true);
  const storedHash = [...records.keys()][0];
  assert.notEqual(storedHash, login.body.session.token);
  now = new Date('2026-10-27T10:00:00.000Z');
  assert.equal((await service.verify(`Bearer ${login.body.session.token}`)).ok, false);
  now = new Date('2026-09-27T10:00:00.000Z');
  await service.logout(`Bearer ${login.body.session.token}`);
  assert.equal((await service.verify(`Bearer ${login.body.session.token}`)).ok, false);
  assert.equal((await service.login('000000')).status, 401);

  console.log('member_auth_test: PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
