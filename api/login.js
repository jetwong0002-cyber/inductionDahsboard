const { parseUsersConfig, findUser, verifyPassword, createSessionToken } = require('../lib/auth');

// 30 days: the client's own idle-timeout (2 hours of inactivity) is what
// actually signs users out during normal use; this just bounds how long a
// stolen/leaked token could be replayed if activity tracking is bypassed.
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: ' + req.method });
  }

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) {
    return res.status(500).json({
      error: 'Server misconfigured: AUTH_SECRET is not set in the Vercel environment variables. See README.md for setup instructions.',
    });
  }

  let users;
  try {
    users = parseUsersConfig(process.env.AUTH_USERS);
  } catch (e) {
    return res.status(500).json({ error: 'Server misconfigured: ' + e.message });
  }
  if (!users.length) {
    return res.status(500).json({
      error: 'Server misconfigured: AUTH_USERS has no valid entries. See README.md for setup instructions.',
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const user = findUser(users, username);
  const passwordOk = user ? verifyPassword(password, user.passwordHash) : false;

  if (!user || !passwordOk) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = createSessionToken(
    { username: user.username, role: user.role, displayName: user.displayName },
    authSecret,
    TOKEN_TTL_MS
  );

  return res.status(200).json({
    token,
    role: user.role,
    displayName: user.displayName,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });
};
