/**
 * Server-side authentication helpers.
 *
 * Real usernames/passwords are never committed to the repository. They live
 * only in the `AUTH_USERS` environment variable (a JSON array of
 * `{ username, passwordHash, role, displayName }` objects), and session
 * tokens are signed with the `AUTH_SECRET` environment variable. Use
 * `scripts/hash-password.js` to generate a `passwordHash` value for
 * `AUTH_USERS`.
 */
const crypto = require('crypto');

const TOKEN_VERSION = 1;
const SCRYPT_KEYLEN = 64;

function normalizeUsername(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function titleCase(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function hashPassword(password, salt) {
  const useSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), useSalt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt:${useSalt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    if (!expected.length) return false;
    const actual = crypto.scryptSync(String(password), salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_) {
    return false;
  }
}

function parseUsersConfig(raw) {
  if (!raw) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    throw new Error('AUTH_USERS is not valid JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('AUTH_USERS must be a JSON array of user objects.');
  }
  return parsed
    .filter(u => u && typeof u.username === 'string' && typeof u.passwordHash === 'string' && typeof u.role === 'string')
    .map(u => ({
      username: u.username,
      normalizedUsername: normalizeUsername(u.username),
      passwordHash: u.passwordHash,
      role: u.role,
      displayName: typeof u.displayName === 'string' && u.displayName.trim() ? u.displayName.trim() : titleCase(u.username),
    }));
}

function findUser(users, username) {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  return (users || []).find(u => u.normalizedUsername === normalized) || null;
}

function base64UrlEncode(input) {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(data, secret) {
  return base64UrlEncode(crypto.createHmac('sha256', secret).update(data).digest());
}

function createSessionToken(payload, secret, ttlMs) {
  const body = {
    v: TOKEN_VERSION,
    username: payload.username,
    role: payload.role,
    displayName: payload.displayName,
    iat: Date.now(),
    exp: Date.now() + ttlMs,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(body));
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token, secret) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expectedSignature = sign(encodedPayload, secret);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (_) {
    return null;
  }
  if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
  if (payload.role !== 'admin' && payload.role !== 'visitor' && payload.role !== 'worker') return null;
  return payload;
}

module.exports = {
  normalizeUsername,
  hashPassword,
  verifyPassword,
  parseUsersConfig,
  findUser,
  createSessionToken,
  verifySessionToken,
};
