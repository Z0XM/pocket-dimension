# Development Guide — `@pocket-dimension/auth`

## Setup

Ensure auth `.env` (or process env) has all required vars before any process imports this package:

```bash
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=http://localhost:5001
BETTER_AUTH_PATH=/api/auth   # match your deployment
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3002,...
BETTER_AUTH_COOKIE_DOMAIN=localhost
RESEND_API_KEY=re_placeholder_local_dev_only
```

```bash
bun run build:shared:db      # auth depends on db dist
bun run build:shared:auth
bun run dev:app:auth
```

## Scripts

```bash
cd shared/auth
bun run typecheck
bun run lint
bun run auth:generate   # better-auth generate --config ./src/index.ts
bun run auth:secret     # generate BETTER_AUTH_SECRET
```

## New auth-backed SvelteKit app checklist

1. Depend on `@pocket-dimension/auth` + `db` + build shared.
2. Copy hooks pattern from watchlist/zeo (`getSession` + `svelteKitHandler` + route groups).
3. Point client at `PUBLIC_BASE_AUTH_URL`.
4. Align `BETTER_AUTH_SECRET` and trusted origins.
5. Expect localhost cookie limitations (document in app README/AGENTS if needed).

## Eager vs lazy

Unlike `shared/db`, this package crashes at **import** if env is incomplete. Do not import auth from build-time or tool contexts that lack secrets.
