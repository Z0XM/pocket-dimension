# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/watchlist).
# Local: docker build -f apps/watchlist/Dockerfile -t watchlist .

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY vite-kysely-compat.ts ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/watchlist'

# Hoisted filter install leaves broken symlinks under apps/*/node_modules; use root node_modules only.
RUN find apps shared -type d -name node_modules -prune -exec rm -rf {} +

# Fail fast if Dokploy/Docker reused a stale apps/ layer (old vite.config used ../../vite-kysely-compat).
RUN test -f apps/watchlist/vite-kysely-compat.ts \
 && grep -q './vite-kysely-compat' apps/watchlist/vite.config.ts

RUN cd apps/watchlist && bun run prepare

ENV TURBO_FORCE=1
RUN bun run build:shared:utils \
 && bun run build:shared:db \
 && bun run build:shared:auth \
 && bun run build:app:watchlist

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/watchlist/build ./apps/watchlist/build
COPY --from=builder /app/apps/watchlist/package.json ./apps/watchlist/package.json

WORKDIR /app/apps/watchlist
EXPOSE 3002

CMD ["bun", "./build/index.js"]
