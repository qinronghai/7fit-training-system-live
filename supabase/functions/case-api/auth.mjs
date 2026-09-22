const textEncoder = new TextEncoder();

function asDate(value) {
  return value instanceof Date ? value : new Date(value);
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(String(value)));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function constantTimeEqual(left, right) {
  const a = textEncoder.encode(String(left));
  const b = textEncoder.encode(String(right));
  const length = Math.max(a.length, b.length);
  let difference = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

export function createOpaqueToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export function hashSessionToken(token) {
  return sha256Hex(token);
}

export async function pinMatches(pin, expectedHash) {
  if (!/^\d{6}$/.test(String(pin || '')) || !expectedHash) return false;
  return constantTimeEqual(await sha256Hex(pin), expectedHash);
}

export function createSessionRecord(tokenHash, now = new Date(), ttlSeconds = 30 * 24 * 60 * 60) {
  const createdAt = asDate(now);
  const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
  return {
    token_hash: tokenHash,
    created_at: createdAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    revoked_at: null,
  };
}

export function isSessionActive(record, now = new Date()) {
  if (!record || record.revoked_at) return false;
  const expiresAt = asDate(record.expires_at);
  return Number.isFinite(expiresAt.getTime()) && asDate(now).getTime() < expiresAt.getTime();
}
