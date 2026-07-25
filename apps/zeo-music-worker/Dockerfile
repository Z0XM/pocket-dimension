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
ENV HOST=0.0.0.0
ENV HUSKY=0
# Ensure /usr/bin (apt ffmpeg) is always visible even if Dokploy overrides PATH
ENV PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# ffmpeg + yt-dlp + Deno (required for YouTube EJS challenge solving)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    ffmpeg \
    python3 \
    unzip \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && ln -sf /usr/bin/ffmpeg /usr/local/bin/ffmpeg \
  && arch="$(dpkg --print-architecture)" \
  && case "$arch" in \
       amd64) denofile=deno-x86_64-unknown-linux-gnu.zip ;; \
       arm64) denofile=deno-aarch64-unknown-linux-gnu.zip ;; \
       *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
     esac \
  && curl -fsSL "https://github.com/denoland/deno/releases/latest/download/${denofile}" \
    -o /tmp/deno.zip \
  && unzip -o /tmp/deno.zip -d /usr/local/bin \
  && chmod a+rx /usr/local/bin/deno \
  && rm -f /tmp/deno.zip \
  && apt-get purge -y unzip \
  && apt-get autoremove -y \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && /usr/bin/ffmpeg -version | head -n 1 \
  && /usr/local/bin/yt-dlp --version \
  && /usr/local/bin/deno --version

# Standalone package root (not the monorepo) — only worker runtime deps.
# Do not run `bun pm ls` here: there is no lockfile in this image context.
COPY apps/zeo-music-worker/package.json ./
RUN bun install --production --ignore-scripts \
  && test -e node_modules/@livekit/rtc-node

ENV NODE_ENV=production

COPY apps/zeo-music-worker/src ./src

EXPOSE 3010

# Env injected by Dokploy: PORT, MUSIC_WORKER_SECRET, ZEO_APP_URL, YTDLP_COOKIES_FILE / YTDLP_COOKIES
CMD ["bun", "src/index.ts"]
