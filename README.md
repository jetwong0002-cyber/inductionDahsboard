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

## Safety store dashboard: stock vs. total

Every item shows **在库 / 总数** — how many are left over how many the project
has bought in total (e.g. `240/250`):

- The **+** button opens *入库 Add Stock*. Whatever is added raises both numbers,
  so 50 in stock plus 100 bought reads `150/150`, and another 100 reads `250/250`.
- The **−** button opens *领取出库 Take Out* and **requires the company** that
  collected the items (chips remember the companies used before). Taking stock
  out lowers the stock but never the total, so `250/250` becomes `240/250`.
- Typing a smaller number on the quantity badge goes through the same Take Out
  sheet, so no stock can leave without a company on record.
- The History tab shows the company on each record and can be filtered by
  company; 操作记录 / stock CSV exports include the company and the totals.

Items saved before totals existed start with `total = current stock`, so nothing
has to be backfilled by hand. An admin can correct a wrong total in
*编辑物品 Edit Item → 总数 Total bought*.

## Testing

```bash
npm install
npm test
```

`test/safety-dashboard.test.js` boots the base64-embedded safety dashboard in
jsdom against a fake `/api/sync`, so it needs the `jsdom` devDependency
(`npm install`); it skips itself when jsdom is missing.
