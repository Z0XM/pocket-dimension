# Deployment Guide

Canonical runbook: root [`DEPLOY.md`](../../DEPLOY.md). Apps with `@pocket-dimension/*` workspace deps **must build from the repository root**.

## Pattern

| Field | Typical value |
| --- | --- |
| Build type | Dockerfile (Dokploy) |
| Build Path | `/` |
| Docker Context | `.` (repo root) |
| Dockerfile | `apps/<app>/Dockerfile` |

Do not set Build Path `apps/<app>` with Context `.` — `COPY shared/` fails.

**Railpack alternative:** each app `railpack.json` skips default install and runs `scripts/deploy-build.sh` from the monorepo root.

## Ports

| App | Port | Dockerfile |
| --- | --- | --- |
| auth-service | 5001 | `apps/auth-service/Dockerfile` |
| watchlist | 3002 | `apps/watchlist/Dockerfile` |
| rhymes | 3003 | `apps/rhymes/Dockerfile` |
| howwasyourday | 3004 | `apps/howwasyourday/Dockerfile` |
| chhan-chhan | 3005 | `apps/chhan-chhan/Dockerfile` |
| me-via-you | 3006 | `apps/me-via-you/Dockerfile` |
| markitdown | 3009 | Railpack only (Python + ffmpeg + exiftool) |
| pocket | 3007 | `apps/pocket/Dockerfile` |
| zeo | 3008 | `apps/zeo/Dockerfile` |
| zeo-music-worker | 3010 | `apps/zeo-music-worker/Dockerfile` (internal) |

## Shared production env

Must match across auth-service and every auth frontend:

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`, `BETTER_AUTH_PATH`, `BETTER_AUTH_COOKIE_DOMAIN`
- `BETTER_AUTH_TRUSTED_ORIGINS` — all frontend origins
- `DATABASE_URL` — PostgreSQL 18+
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- Per-app `ORIGIN`, `PORT`, `PUBLIC_BASE_AUTH_URL`

`.env.example` is **not** loaded by Dokploy — copy into the service Environment panel.

## Database

```bash
DATABASE_URL=postgresql://... bun run db:migrate
```

zeo `bun run start` auto-migrates when `DATABASE_URL` is set.

## zeo extras

Primary runbook: `apps/zeo/deploy/dokploy/README.md`.

- LiveKit (Dokploy template) + Cloudflare DNS
- Production: `https://zeo.z0xm.com`, `wss://zeo-livekit.z0xm.com`
- Music worker stays on the internal Docker network (no public domain)
- Legacy Caddy/systemd: `apps/zeo/deploy/README.legacy-caddy-systemd.md`

## Per-app guides

| App | Doc |
| --- | --- |
| auth-service | `apps/auth-service/DEPLOY.md` |
| watchlist | `apps/watchlist/DEPLOY.md` |
| rhymes | `apps/rhymes/DEPLOY.md` |
| howwasyourday | `apps/howwasyourday/DEPLOY.md` |
| chhan-chhan | `apps/chhan-chhan/DEPLOY.md` |
| me-via-you | `apps/me-via-you/DEPLOY.md` |
| pocket | `apps/pocket/DEPLOY.md` |
| zeo | `apps/zeo/DEPLOY.md` |
| markitdown | `apps/markitdown/railpack.json` |
| zeo-music-worker | `apps/zeo-music-worker/README.md` |
