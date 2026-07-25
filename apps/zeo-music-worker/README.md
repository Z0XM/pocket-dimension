# zeo music-worker

Discord-style Shared Listening worker: `yt-dlp` → `ffmpeg` → LiveKit bot audio.

## Local

Needs `yt-dlp` and `ffmpeg` on `PATH`:

```bash
# Debian/Ubuntu
sudo apt-get install -y ffmpeg
sudo curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

cp .env.example .env
# set MUSIC_WORKER_SECRET + ZEO_APP_URL

bun run --filter @pocket-dimension/zeo-music-worker dev
```

## Production (Dokploy Dockerfile)

Railpack images do **not** include `ffmpeg` / `yt-dlp`. Deploy this worker as a **Dockerfile** app.

The image uses **`oven/bun:1.3.5-slim`** (debian/glibc — required by `@livekit/rtc-node`; Alpine/musl will not work).

The Dockerfile installs the worker as a **standalone** package (`bun install --production` on `apps/zeo-music-worker/package.json` only). It does **not** run a monorepo `bun install --frozen-lockfile`, which was failing in Dokploy on unrelated workspace packages.

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
```

If the worker cannot call the public zeo URL, use Dokploy’s internal service URL instead (e.g. `http://zeo:3008`).

### zeo env (pair)

```env
MUSIC_WORKER_URL=http://<music-worker-service-name>:3010
MUSIC_WORKER_SECRET=<same secret>
```

Service name is whatever Dokploy assigns on the compose/network (check Dokploy → music-worker → Network / hostname).

### Verify in container

Dokploy → music-worker → Terminal:

```bash
which ffmpeg yt-dlp
ffmpeg -version | head -1
yt-dlp --version
curl -sS http://127.0.0.1:3010/health
```

Expect health JSON with `"ffmpeg": true` and `"ytDlp": true`.

### Updating yt-dlp

YouTube breaks extractors often. Rebuild/redeploy this image periodically (Dockerfile pulls **latest** yt-dlp on each build), or inside a running container:

```bash
curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
chmod a+rx /usr/local/bin/yt-dlp
yt-dlp --version
```

Prefer rebuild so the next deploy stays current.
