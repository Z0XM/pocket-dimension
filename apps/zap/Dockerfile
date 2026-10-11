# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/zap).
# Local: docker build -f apps/zap/Dockerfile -t zap .

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

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/zap/build ./apps/zap/build
COPY --from=builder /app/apps/zap/package.json ./apps/zap/package.json

WORKDIR /app/apps/zap
EXPOSE 3013

CMD ["bun", "./build/index.js"]
