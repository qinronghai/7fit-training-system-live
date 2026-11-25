import { extractBearerToken, sha256Hex } from '../_shared/staff-auth.mjs';

const enrollmentPattern = /^menroll_[A-Za-z0-9_-]{43}$/;
const devicePattern = /^mdev_[A-Za-z0-9_-]{43}$/;

export function createMemberDeviceAuth({ staffAuth, store }) {
  return {
    async verify(authorization) {
      const token = extractBearerToken(authorization);
      if (!devicePattern.test(token)) return staffAuth.verify(authorization);
      return { ok: await store.hasDevice(await sha256Hex(token)) };
    },
    async redeemDevice(code, token) {
      if (typeof code !== 'string' || !enrollmentPattern.test(code)
        || typeof token !== 'string' || !devicePattern.test(token)) return null;
      const [enrollmentHash, deviceHash] = await Promise.all([sha256Hex(code), sha256Hex(token)]);
      return store.redeem(enrollmentHash, deviceHash);
    },
  };
}
