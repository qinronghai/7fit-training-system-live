const assert = require('node:assert/strict');

async function main() {
  const { createMemberApi } = await import('../supabase/functions/member-api/service.mjs');
  const { createMemberDeviceAuth } = await import('../supabase/functions/member-api/device-auth.mjs');
  const { sha256Hex } = await import('../supabase/functions/_shared/staff-auth.mjs');
  const code = 'menroll_' + 'a'.repeat(43);
  const token = 'mdev_' + 'b'.repeat(43);
  const different = 'mdev_' + 'c'.repeat(43);
  const expiresAt = '2030-01-01T00:00:00.000Z';
  const codeHash = await sha256Hex(code);
  const tokenHash = await sha256Hex(token);
  let consumed = false;
  const reads = [];
  const device = createMemberDeviceAuth({
    staffAuth: { async verify(header) { return { ok: header === 'Bearer legacy-staff-session' }; } },
    store: {
      async redeem(candidate, deviceHash) {
        assert.match(candidate, /^[a-f0-9]{64}$/);
        assert.match(deviceHash, /^[a-f0-9]{64}$/);
        if (!consumed && candidate === codeHash && deviceHash === tokenHash) consumed = true;
        return consumed && deviceHash === tokenHash ? expiresAt : null;
      },
      async hasDevice(candidate) { return consumed && candidate === tokenHash; },
    },
  });
  const api = createMemberApi({
    auth: device,
    repository: { async listMembers() { reads.push(true); return []; } },
  });
  const request = (action, { body, bearer } = {}) => api(new Request(`https://example.com/member-api?action=${action}`, {
    method: body ? 'POST' : 'GET',
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    body: body && JSON.stringify(body),
  }));
  assert.equal((await request('list-members')).status, 401);
  assert.equal((await request('list-members', { bearer: token })).status, 401);
  assert.equal((await request('redeem-device', { body: { code: 'invalid', token } })).status, 401);
  assert.equal(reads.length, 0);
  const redeemed = await request('redeem-device', { body: { code, token } });
  assert.equal(redeemed.status, 200);
  assert.deepEqual(await redeemed.json(), { expiresAt });
  assert.equal((await request('redeem-device', { body: { code, token: different } })).status, 401);
  assert.equal((await request('redeem-device', { body: { code, token } })).status, 200);
  assert.equal((await request('list-members', { bearer: token })).status, 200);
  assert.equal((await request('list-members', { bearer: 'legacy-staff-session' })).status, 200);
  assert.equal(reads.length, 2);
  console.log('member_device_auth_test: PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
