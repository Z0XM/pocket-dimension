# Deployment Guide — Pocket Dimension

## Hard rules

1. Apps that depend on `@pocket-dimension/*` must build from the **repository root** (`/`), not `apps/<app>` alone.
2. PostgreSQL **18+** in every environment that runs migrations (`uuidv7()`).
3. Apply schema with `DATABASE_URL=… bun run db:migrate` (zeo `bun run start` can auto-migrate when `DATABASE_URL` is set).

## Dockerfile path (recommended)

Build context = **repo root**. Dokploy: do not mix Build Path `apps/<app>` with Context `.` (breaks `COPY shared/`).

## Railpack path

Per-app `railpack.json` no-ops install (`"true"`), then `scripts/deploy-build.sh` installs/builds from monorepo root. `deploy.startCommand` detects workspace root vs app dir.

## `.dockerignore`

Stub-only strategy for apps excluded from multi-app images (`markitdown`, `zeo-music-worker`). **Keeps** `_bmad-output` (Heimdall needs it).

## Heimdall

Needs `_bmad-output` + root `heimdall.config.mjs` in the image. See `apps/heimdall/DEPLOY.md`. Prod port **3012**.

## Auth runtime

- Identical `BETTER_AUTH_SECRET` across auth-service and frontends.
- Non-empty `RESEND_API_KEY` on any process importing `@pocket-dimension/auth`.
- `PUBLIC_BASE_AUTH_URL` → deployed auth-service origin.
- Cookie domain / HTTPS must match `secure` + `sameSite: "none"`.

## Ports

| App | Port |
| --- | --- |
| auth-service | 5001 |
| watchlist … zeo | 3002–3008 |
| markitdown | 3009 |
| zeo-music-worker | 3010 |
| dashboard | 3011 |
| heimdall | 3012 |

Full contract: root [`DEPLOY.md`](../../DEPLOY.md). Tooling detail: [architecture-monorepo-tools.md](./architecture-monorepo-tools.md).
