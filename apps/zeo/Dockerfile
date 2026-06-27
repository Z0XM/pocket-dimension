# zeo production image — build from monorepo root:
#   docker build -f apps/zeo/Dockerfile -t zeo .
#
# Dokploy: set Dockerfile path to apps/zeo/Dockerfile, build context to repo root.

FROM oven/bun:1.2 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps/zeo ./apps/zeo

RUN bun install --frozen-lockfile

RUN bun run build:shared:utils \
 && bun run build:shared:db \
 && bun run build:shared:auth \
 && bun run build:app:zeo

FROM oven/bun:1.2-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3008

# Runtime needs built workspace packages + zeo server bundle
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/zeo/build ./apps/zeo/build
COPY --from=builder /app/apps/zeo/package.json ./apps/zeo/package.json

# Migrations: Dokploy Terminal → cd /app/shared/db && bunx --bun drizzle-kit migrate
# (DATABASE_URL injected by Dokploy env)

WORKDIR /app/apps/zeo
EXPOSE 3008

# Env vars injected by Dokploy (no .env file in container)
CMD ["bun", "./build/index.js"]
