# Shared Listening music-worker — build from monorepo root:
#   docker build -f apps/zeo-music-worker/Dockerfile -t zeo-music-worker .
#
# Dokploy:
#   Build type:      Dockerfile
#   Dockerfile path: apps/zeo-music-worker/Dockerfile
#   Build context:   /  (repo root)
#   Port:            3010
#   Public domain:   none (internal only — zeo calls it on the Docker network)

FROM oven/bun:1.2-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3010

# ffmpeg + yt-dlp (latest binary from GitHub releases)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    python3 \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && ffmpeg -version | head -n 1 \
  && yt-dlp --version

COPY package.json bun.lock turbo.json ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

RUN bun install --frozen-lockfile

WORKDIR /app/apps/zeo-music-worker
EXPOSE 3010

# Env injected by Dokploy: PORT, MUSIC_WORKER_SECRET, ZEO_APP_URL
CMD ["bun", "src/index.ts"]
