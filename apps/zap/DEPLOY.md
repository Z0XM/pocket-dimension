# Deploying Zap

SvelteKit app (svelte-adapter-bun) with shared auth + db. Port **3013**.

Build from the **monorepo root** so `@pocket-dimension/*` workspace deps resolve. See root [DEPLOY.md](../../DEPLOY.md).

## Dokploy (Dockerfile)

| Setting | Value |
| --- | --- |
| Build type | Dockerfile |
| Dockerfile path | `apps/zap/Dockerfile` |
| Build context | `/` (repo root) |
| Port | `3013` |

## Env

Copy from `.env.example`. Required in production:

- `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PUBLIC_BASE_AUTH_URL`
- R2 (S3 API — see below)
- `ORIGIN=https://your-zap-host`

### Phase 3 URL ingest

The Zap **Dockerfile runner is fat**: `ffmpeg`, `yt-dlp`, and `Deno` (for yt-dlp JS challenges). Railpack alone will not provide these — use the Dockerfile path for production once URL ingest is needed.

Optional: `YTDLP_COOKIES_B64` or `YTDLP_COOKIES_FILE` (Netscape cookies) if YouTube blocks datacenter IPs. Public URL paste does **not** need Google OAuth (Phase 4). Tracks over **10 minutes** are skipped/rejected.

### Phase 4 Connect YouTube

Create a **Google Cloud OAuth client** for Zap. Authorized redirect URI: `https://<zap-host>/api/auth/youtube/callback`. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (and optionally `YOUTUBE_TOKEN_SECRET` for AES-GCM token encryption; defaults to `BETTER_AUTH_SECRET`). Tokens live in `zap.youtube_account_links`.

### Cloudflare R2 (uploads + ingest)

Create an **R2 API token** (Dashboard → R2 → Manage R2 API Tokens), not a global Cloudflare Account API token.

| Var | Example |
| --- | --- |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` (no bucket in the path) |
| `S3_ACCESS_KEY` | R2 access key id (alias: `S3_ACCESS_KEY_ID`) |
| `S3_SECRET_KEY` | R2 secret (alias: `S3_SECRET_ACCESS_KEY`) — no quotes/spaces |
| `S3_BUCKET` | e.g. `zap-media` |
| `S3_REGION` | `auto` |

Signature mismatch usually means wrong endpoint shape (bucket embedded incorrectly), wrong credential type, or quoted/whitespace secrets. Zap normalizes trailing slashes, peels `/bucket` off the account endpoint, and auto-detects virtual-hosted `https://<bucket>.<account>.r2.cloudflarestorage.com`.

Apply migrations: `bun run db:migrate` (PG 18+) after deploy or when `DATABASE_URL` is set at build.

## Local

```bash
cp apps/zap/.env.example apps/zap/.env
bun run build:shared:db && bun run build:shared:auth
bun run dev:app:zap
```
