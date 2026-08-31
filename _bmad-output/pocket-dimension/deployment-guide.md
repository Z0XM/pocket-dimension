# Deployment Guide — Pocket Dimension

## Hard rules

1. Apps that depend on `@pocket-dimension/*` must build from the **repository root** (`/`), not `apps/<app>` alone.
2. PostgreSQL **18+** in every environment that runs migrations (`uuidv7()`).
3. Apply schema with `DATABASE_URL=… bun run db:migrate` (zeo `bun run start` can auto-migrate when `DATABASE_URL` is set).

## Railpack / Dokploy

Per-app `Dockerfile`, `railpack.json`, and `scripts/deploy-build.sh` under `apps/<app>/` (exceptions: markitdown, zeo-music-worker, imposter-art). Set Docker context to repo root. Full contract: root [`DEPLOY.md`](../../DEPLOY.md).

## Heimdall

Needs `_bmad-output` + root `heimdall.config.mjs` in the image. See `apps/heimdall/DEPLOY.md`. Prod port **3012**.

## Auth runtime

- Identical `BETTER_AUTH_SECRET` across auth-service and frontends.
- Non-empty `RESEND_API_KEY` on any process importing `@pocket-dimension/auth`.
- `PUBLIC_BASE_AUTH_URL` must point at the deployed auth-service origin.
- Cookie domain / HTTPS must match Better Auth `secure` + `sameSite: "none"` expectations.

## Ports (prod-oriented defaults)

| App | Port |
| --- | --- |
| auth-service | 5001 |
| watchlist … zeo | 3002–3008 |
| markitdown | 3009 |
| zeo-music-worker | 3010 |
| dashboard | 3011 |
| heimdall | 3012 |
