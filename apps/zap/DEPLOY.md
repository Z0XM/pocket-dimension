# Deploying Zap

SvelteKit app (`svelte-adapter-bun`) with shared auth + db, R2 media, yt-dlp ingest, optional YouTube OAuth + Discord sink. Port **3013**.

Build from the **monorepo root** so `@pocket-dimension/*` workspace deps resolve. See root [DEPLOY.md](../../DEPLOY.md).

**Production recommendation:** use the **fat Dockerfile** (not Railpack alone). The runner installs `ffmpeg`, `yt-dlp`, and `Deno`. Railpack will not provide those for URL/playlist ingest or Discord audio.

## Dokploy (Dockerfile) — Hostinger / VPS

### Option A (simplest)

| Dokploy field | Value |
| --- | --- |
| Build type | **Dockerfile** |
| **Build Path** | **`/`** |
| **Docker Context Path** | `.` |
| **Dockerfile Path** | `apps/zap/Dockerfile` |
| Port | `3013` |

### Option B (app folder as Build Path)

| Dokploy field | Value |
| --- | --- |
| Build Path | `apps/zap` |
| **Docker Context Path** | **`/`** (not `.`) |
| Dockerfile Path | `Dockerfile` |
| Port | `3013` |

Start command is `bun run start` → `scripts/start.sh`, which:

1. Sets `HOST=0.0.0.0`, `PORT=3013`, `BODY_SIZE_LIMIT=50M` (override as needed)  
2. Serves `./build/index.js`

It does **not** run migrations — see [Migrations](#migrations).

Do **not** put media on the VPS disk — blobs go to **Cloudflare R2**.

## Alternative: Railpack (library-only / not for ingest)

| Setting | Value |
| --- | --- |
| Root directory | `apps/zap` **or** `/` |
| Build type | Railpack |
| Port | `3013` |

If root is `/`, set in Dokploy **Environment**:

```env
RAILPACK_CONFIG_FILE=apps/zap/railpack.json
```

Railpack builds the app but **does not install yt-dlp/ffmpeg/Deno**. Prefer Dockerfile once you need Add / YouTube import / Discord sink.

## Required env (production)

Copy from [`.env.example`](./.env.example). Minimum:

```env
NODE_ENV=production
PORT=3013
HOST=0.0.0.0
ORIGIN=https://zap.example.com
BODY_SIZE_LIMIT=50M

DATABASE_URL=postgresql://...
PUBLIC_BASE_AUTH_URL=https://auth.example.com
PUBLIC_BASE_AUTH_PATH=/
BETTER_AUTH_SECRET=<same as auth-service>
BETTER_AUTH_URL=https://auth.example.com
BETTER_AUTH_PATH=/
BETTER_AUTH_TRUSTED_ORIGINS=https://auth.example.com,https://zap.example.com
BETTER_AUTH_COOKIE_DOMAIN=.example.com

S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=zap-media
S3_REGION=auto
```

Auth and Zap must be **HTTPS** (`secure` / `sameSite=none` cookies).

### Cloudflare R2

Create an **R2 API token** (Dashboard → R2 → Manage R2 API Tokens), not a global Account API token.

| Var | Notes |
| --- | --- |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` — **no** bucket in the path |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | R2 key pair (aliases: `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`) |
| `S3_BUCKET` | e.g. `zap-media` |
| `S3_REGION` | `auto` |

### YouTube cookies (ingest)

Datacenter IPs almost always need Netscape cookies:

```env
YTDLP_COOKIES_B64=...   # preferred on Dokploy
# or YTDLP_COOKIES_FILE=/path/to/cookies.txt
```

Without cookies, yt-dlp often fails with a bot-check. Tracks over **10 minutes** are skipped. Parallelism: `ZAP_YT_INGEST_CONCURRENCY` (default 4, max 8).

### Connect YouTube (Google OAuth)

1. Google Cloud Console → OAuth client (Web application).  
2. Authorized redirect URI: **`https://<zap-host>/api/auth/youtube/callback`** (and `http://localhost:3013/api/auth/youtube/callback` for local).  
3. Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional `YOUTUBE_TOKEN_SECRET`, `YOUTUBE_DATA_API_KEY`).

OAuth lists playlists; **download still uses yt-dlp + cookies**.

### Discord sink

```env
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...   # or DISCORD_APPLICATION_ID
```

Invite needs View Channel + Connect + Speak (`permissions=3147776`). See project Discord setup doc for invite steps. Redeploy drops the voice link until re-attached.

## Migrations

PostgreSQL **18+** required (`uuidv7()`). Zap schema lives in migrations `0046+` under `shared/db`.

Migrations are an explicit deploy step, not part of container start. `shared/db/migrations` is shared by every app, so applying it migrates all schemas — run it deliberately, before rolling out a release that needs new tables.

- **Standard:** from monorepo root: `DATABASE_URL=... bun run db:migrate`  
- **Build-time (opt-in):** `ZAP_MIGRATE_AT_BUILD=1` during `deploy-build.sh` (Railpack path)

## Checklist

- [ ] Dokploy Build Path `/`, Dockerfile `apps/zap/Dockerfile`, port `3013`  
- [ ] Same Postgres as other PD apps; migrations applied  
- [ ] Auth service up; shared `BETTER_AUTH_SECRET`; trusted origins + cookie domain  
- [ ] `ORIGIN` = public HTTPS URL  
- [ ] R2 bucket + API token env  
- [ ] Fat image (yt-dlp/ffmpeg present in container)  
- [ ] `YTDLP_COOKIES_B64` if YouTube ingest is used  
- [ ] Google redirect URI if Connect YouTube  
- [ ] Discord token + invite if sink is used  
- [ ] `BODY_SIZE_LIMIT` ≥ upload needs (default **50M** in start script)

## Local / smoke

```bash
cp apps/zap/.env.example apps/zap/.env
# fill DATABASE_URL, auth, S3_*
bun run build:shared:utils && bun run build:shared:db && bun run build:shared:auth
bun run build:app:zap
cd apps/zap && bun run start
```

Docker (from monorepo root):

```bash
docker build -f apps/zap/Dockerfile -t zap .
docker run --rm -p 3013:3013 --env-file apps/zap/.env zap
```

Verify tools in the image: `docker run --rm zap yt-dlp --version` / `ffmpeg -version`.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Workspace dependency "@pocket-dimension/…" not found` | Build context must be repo root — use Dockerfile Option A/B above |
| `"/shared": not found` | Context Path is wrong (use `/` when Build Path is `apps/zap`) |
| Upload / ingest 413 or truncated body | Raise `BODY_SIZE_LIMIT` (default 50M; adapter alone is 512K) |
| yt-dlp bot check | Set `YTDLP_COOKIES_B64`; confirm fat Dockerfile |
| SignatureDoesNotMatch on R2 | Endpoint shape / credential type / quoted secrets |
| Google redirect_uri_mismatch | Exact URI: `/api/auth/youtube/callback` on `ORIGIN` |
| Discord Attach disabled | Missing `DISCORD_BOT_TOKEN` + client/application id |
