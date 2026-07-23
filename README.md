# Safety Inventory / LONGMOTIVE Dashboards

Static dashboard app (`index.html`) with two small Vercel serverless functions
(`api/login.js`, `api/sync.js`) backed by Postgres (`@vercel/postgres`).

## Authentication setup (required)

Login credentials are **not** stored in this repository. They are configured
entirely through Vercel environment variables, and are verified server-side
by `api/login.js`. `api/sync.js` (the inventory data endpoint) requires a
valid session token issued by `api/login.js` for every request.

Configure these two environment variables in the Vercel project settings
(Project → Settings → Environment Variables) before deploying:

### `AUTH_SECRET`

A long random string used to sign session tokens (HMAC-SHA256). Generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### `AUTH_USERS`

A JSON array describing every valid account. Each entry needs a `username`,
a `passwordHash` (never a plaintext password), and a `role`
(`admin`, `visitor`, or `worker`). `displayName` is optional.

Generate a `passwordHash` for each account with:

```bash
node scripts/hash-password.js "the-persons-password"
```

Then assemble the `AUTH_USERS` value, for example:

```json
[
  { "username": "jet18", "passwordHash": "scrypt:...", "role": "admin", "displayName": "Jet" },
  { "username": "camilia01", "passwordHash": "scrypt:...", "role": "visitor" },
  { "username": "aungthu1", "passwordHash": "scrypt:...", "role": "worker" }
]
```

Paste the whole JSON array as the value of the `AUTH_USERS` environment
variable, then redeploy. Usernames are matched case-insensitively.

Without both `AUTH_SECRET` and `AUTH_USERS` configured, `/api/login` and
`/api/sync` will return a clear 500 error explaining what's missing instead
of silently failing.

## Testing

```bash
npm install
npm test
```
