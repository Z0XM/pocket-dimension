# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/zap).
# Local: docker build -f apps/zap/Dockerfile -t zap .
#
# Phase 3+: runner is a fat image (ffmpeg + yt-dlp + Deno) for public URL ingest.
# Same tool pattern as apps/zeo-music-worker/Dockerfile — do not expect Railpack to provide these.

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY vite-kysely-compat.ts ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/zap'

RUN find apps shared -type d -name node_modules -prune -exec rm -rf {} +

RUN test -f apps/zap/vite-kysely-compat.ts \
 && grep -q './vite-kysely-compat' apps/zap/vite.config.ts

RUN cd apps/zap && bun run prepare

ENV TURBO_FORCE=1
RUN bun run build:shared:utils \
 && bun run build:shared:db \
 && bun run build:shared:auth \
 && bun run build:app:zap

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3013
ENV HOST=0.0.0.0
ENV BODY_SIZE_LIMIT=50M
ENV PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# ffmpeg + yt-dlp + Deno (YouTube EJS challenge solving for yt-dlp)
# bash is required for scripts/start.sh (env defaults).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    ffmpeg \
    python3 \
    unzip \
  && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
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
  && ffmpeg -version | head -n 1 \
  && yt-dlp --version \
  && deno --version

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/zap/build ./apps/zap/build
COPY --from=builder /app/apps/zap/package.json ./apps/zap/package.json
COPY --from=builder /app/apps/zap/scripts ./apps/zap/scripts

WORKDIR /app/apps/zap
EXPOSE 3013

# Migrations are not run on start — apply them with `bun run db:migrate` (see DEPLOY.md).
# Env: DATABASE_URL, BETTER_AUTH_*, ORIGIN, S3_*, optional Google/Discord/YTDLP cookies — see DEPLOY.md
CMD ["bash", "scripts/start.sh"]
