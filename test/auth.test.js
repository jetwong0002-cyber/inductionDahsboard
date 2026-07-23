const assert = require('assert');
const {
  normalizeUsername,
  hashPassword,
  verifyPassword,
  parseUsersConfig,
  findUser,
  createSessionToken,
  verifySessionToken,
} = require('../lib/auth');

function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name);
    console.error(e.message);
    process.exitCode = 1;
  }
}

test('normalizeUsername trims, lowercases, and collapses whitespace', () => {
  assert.strictEqual(normalizeUsername('  Jet18  '), 'jet18');
  assert.strictEqual(normalizeUsername('Ah   Huat'), 'ah huat');
});

test('hashPassword + verifyPassword round-trip correctly', () => {
  const hash = hashPassword('correct-horse-battery-staple');
  assert.strictEqual(verifyPassword('correct-horse-battery-staple', hash), true);
  assert.strictEqual(verifyPassword('wrong-password', hash), false);
});

test('verifyPassword rejects malformed or missing hashes', () => {
  assert.strictEqual(verifyPassword('anything', ''), false);
  assert.strictEqual(verifyPassword('anything', 'not-a-real-hash'), false);
  assert.strictEqual(verifyPassword('anything', undefined), false);
});

test('parseUsersConfig parses valid JSON and fills in display names', () => {
  const users = parseUsersConfig(JSON.stringify([
    { username: 'jet18', passwordHash: hashPassword('pw'), role: 'admin' },
    { username: 'camilia01', passwordHash: hashPassword('pw2'), role: 'visitor', displayName: 'Camilia' },
  ]));
  assert.strictEqual(users.length, 2);
  assert.strictEqual(users[0].displayName, 'Jet18');
  assert.strictEqual(users[1].displayName, 'Camilia');
});

test('parseUsersConfig returns empty array for unset env var', () => {
  assert.deepStrictEqual(parseUsersConfig(undefined), []);
  assert.deepStrictEqual(parseUsersConfig(''), []);
});

test('parseUsersConfig throws on invalid JSON or non-array input', () => {
  assert.throws(() => parseUsersConfig('not json'));
  assert.throws(() => parseUsersConfig(JSON.stringify({ username: 'x' })));
});

test('findUser matches case-insensitively and ignores unknown users', () => {
  const users = parseUsersConfig(JSON.stringify([
    { username: 'Jet18', passwordHash: hashPassword('pw'), role: 'admin' },
  ]));
  assert.ok(findUser(users, '  jet18 '));
  assert.strictEqual(findUser(users, 'someone-else'), null);
});

test('createSessionToken + verifySessionToken round-trip correctly', () => {
  const secret = 'test-secret';
  const token = createSessionToken({ username: 'jet18', role: 'admin', displayName: 'Jet18' }, secret, 60000);
  const payload = verifySessionToken(token, secret);
  assert.ok(payload);
  assert.strictEqual(payload.username, 'jet18');
  assert.strictEqual(payload.role, 'admin');
});

test('verifySessionToken rejects tampered tokens', () => {
  const secret = 'test-secret';
  const token = createSessionToken({ username: 'jet18', role: 'admin', displayName: 'Jet18' }, secret, 60000);
  const [payload, signature] = token.split('.');
  const tampered = payload + 'x.' + signature;
  assert.strictEqual(verifySessionToken(tampered, secret), null);
});

test('verifySessionToken rejects tokens signed with a different secret', () => {
  const token = createSessionToken({ username: 'jet18', role: 'admin', displayName: 'Jet18' }, 'secret-a', 60000);
  assert.strictEqual(verifySessionToken(token, 'secret-b'), null);
});

test('verifySessionToken rejects expired tokens', () => {
  const secret = 'test-secret';
  const token = createSessionToken({ username: 'jet18', role: 'admin', displayName: 'Jet18' }, secret, -1000);
  assert.strictEqual(verifySessionToken(token, secret), null);
});

test('verifySessionToken rejects malformed input', () => {
  assert.strictEqual(verifySessionToken('', 'secret'), null);
  assert.strictEqual(verifySessionToken(null, 'secret'), null);
  assert.strictEqual(verifySessionToken('no-dot-here', 'secret'), null);
});

if (!process.exitCode) console.log('\nAll auth tests passed.');
