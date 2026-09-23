# Dev Mode

Local-only auto-login + account switcher for auth-backed apps
(`watchlist`, `howwasyourday`, `chhan-chhan`, `me-via-you`, `zeo`).

## Gates (both required)

1. `DEV_MODE=true` (or `1`) in the app **and** `auth-service` `.env`
2. `NODE_ENV=development` (this repo’s env name; never enable when not `development`)

If either gate fails: normal login, no notch, `/dev/*` endpoints return 404.

## Config file

Location (gitignored):

```text
shared/auth/devMode.config.ts
```

Create from the tracked example:

```bash
cp shared/auth/devMode.config.example.ts shared/auth/devMode.config.ts
```

Shape:

```ts
export default {
  defaultAccount: "admin",
  allowedAccounts: [
    { username: "admin", email: "admin@local.dev", label: "admin" },
    { username: "z0xm", email: "user1@local.dev", label: "z0xm" },
    { username: "mukul", email: "user2@local.dev", label: "mukul" },
  ],
};
```

Usernames must already exist in Postgres (`auth.user`). No passwords in config —
Dev Mode creates a real Better Auth session via a gated auth-service endpoint.

## Enable locally

1. Copy the example config (above).
2. Set `DEV_MODE=true` in:
   - `apps/auth-service/.env`
   - each auth-backed app `.env` you want to use
3. Rebuild auth: `bun run build:shared:auth` (from repo root)
4. Restart `auth-service` and the app(s).

## Behavior

- Visiting an auth-backed app with no session redirects to
  `GET {BETTER_AUTH_URL}/dev/sign-in?redirect=<app-url>` which sets the session
  cookie for `defaultAccount` and redirects back.
- A compact notch banner appears at the top; click to switch among `allowedAccounts`.
- Switching navigates to `/dev/sign-in?account=<username>&redirect=<current-url>`.

## Security

Dev Mode must never run outside local development. Endpoints hard-check both gates
before creating sessions. Do not commit `devMode.config.ts` or set `DEV_MODE=true`
in production env files.
