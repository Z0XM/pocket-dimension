# zeo music-worker

Discord-style Shared Listening worker: `yt-dlp` → `ffmpeg` → LiveKit bot audio.

## Local

Needs `yt-dlp`, `ffmpeg`, and a JS runtime (`deno` preferred) on `PATH`:

```bash
# Debian/Ubuntu
sudo apt-get install -y ffmpeg
sudo curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
# Deno: https://docs.deno.com/runtime/getting_started/installation/

cp .env.example .env
# set MUSIC_WORKER_SECRET + ZEO_APP_URL
# for VPS-like bot checks, also set YTDLP_COOKIES_FILE or YTDLP_COOKIES

bun run --filter @pocket-dimension/zeo-music-worker dev
```

## Production (Dokploy Dockerfile)

Railpack images do **not** include `ffmpeg` / `yt-dlp` / Deno. Deploy this worker as a **Dockerfile** app.

The image uses **`oven/bun:1.3.5-slim`** (debian/glibc — required by `@livekit/rtc-node`; Alpine/musl will not work).

### Dokploy settings

| Setting | Value |
|---------|-------|
| Build type | **Dockerfile** |
| Dockerfile path | `apps/zeo-music-worker/Dockerfile` |
| Build context | `/` (monorepo root) |
| Port | `3010` |
| Public domain | **none** (zeo reaches it on the private Docker network) |

### Env

```env
PORT=3010
MUSIC_WORKER_SECRET=<same as zeo MUSIC_WORKER_SECRET>
ZEO_APP_URL=https://zeo.z0xm.com

# Strongly recommended — without cookies YouTube often returns:
# "Sign in to confirm you’re not a bot"
YTDLP_COOKIES_FILE=/cookies/youtube.txt
# or inline Netscape cookie file contents:
# YTDLP_COOKIES=...
```

### YouTube cookies (bot check)

Datacenter IPs usually need cookies. OAuth tokens from zeo’s Google link are **not** enough for yt-dlp (YouTube disabled OAuth login for yt-dlp).

Export cookies that won’t rotate immediately:

1. Open a **private/incognito** window and sign into YouTube  
2. In that same tab, open `https://www.youtube.com/robots.txt`  
3. Export `youtube.com` cookies with a browser extension (e.g. “Get cookies.txt LOCALLY”)  
4. Close the private window (don’t browse YouTube with that session again)  
5. Mount the file into the worker and set `YTDLP_COOKIES_FILE`, or paste into `YTDLP_COOKIES`

See [yt-dlp cookie export tips](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies). Prefer a **throwaway** Google account — using a main account risks bans.

Dokploy: upload the file as a mount (e.g. `/cookies/youtube.txt`) or paste into an env var.

### zeo env (pair)

```env
# Dokploy Swarm: service name only (strip .1.<taskid> from docker ps)
MUSIC_WORKER_URL=http://pocketdimension-zeomusicworker-XXXXXX:3010
MUSIC_WORKER_SECRET=<same secret>
```

Both apps must share `dokploy-network`. From zeo’s terminal:

```bash
curl -sS http://pocketdimension-zeomusicworker-XXXXXX:3010/health
```

### Verify in container

```bash
which ffmpeg yt-dlp deno
curl -sS http://127.0.0.1:3010/health
# expect ffmpeg/ytDlp/deno true; cookies true once configured
```

Smoke-test extraction:

```bash
yt-dlp --js-runtimes deno:/usr/local/bin/deno --cookies /cookies/youtube.txt \
  -f bestaudio -g "https://www.youtube.com/watch?v=jxtrPLp7Qao"
```

### Updating yt-dlp

Rebuild/redeploy periodically (Dockerfile pulls **latest** yt-dlp + Deno on each build).
