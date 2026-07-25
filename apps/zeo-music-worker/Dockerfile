# Shared Listening music-worker — build from monorepo root:
#   docker build -f apps/zeo-music-worker/Dockerfile -t zeo-music-worker .
#
# Dokploy:
#   Build type:      Dockerfile
#   Dockerfile path: apps/zeo-music-worker/Dockerfile
#   Build context:   /  (repo root)
#   Port:            3010
#   Public domain:   none (internal only — zeo calls it on the Docker network)
#
# Intentionally NOT a monorepo bun install: the root workspace lockfile + other
# apps' lifecycle scripts make frozen installs fragile in Docker. This image
# installs only the worker's own dependencies.

# Match root package.json packageManager (bun@1.3.5); debian/glibc required by @livekit/rtc-node
FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV PORT=3010
ENV HUSKY=0

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

# Standalone package root (not the monorepo) — only worker runtime deps
COPY apps/zeo-music-worker/package.json ./
RUN bun install --production --ignore-scripts \
  && bun pm ls \
  && test -e node_modules/@livekit/rtc-node

ENV NODE_ENV=production

COPY apps/zeo-music-worker/src ./src

EXPOSE 3010

# Env injected by Dokploy: PORT, MUSIC_WORKER_SECRET, ZEO_APP_URL
CMD ["bun", "src/index.ts"]
