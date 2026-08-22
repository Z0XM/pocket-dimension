# watchlist production image — build from monorepo root:
#   docker build -f apps/watchlist/Dockerfile -t watchlist .
#
# Dokploy: Build type Dockerfile, Dockerfile path apps/watchlist/Dockerfile,
#          build context / (repo root). Root directory setting is ignored.

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps/watchlist ./apps/watchlist

RUN bun install --frozen-lockfile

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
