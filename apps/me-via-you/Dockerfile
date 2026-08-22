# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/me-via-you).
# Local: docker build -f apps/me-via-you/Dockerfile -t me-via-you .

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY vite-kysely-compat.ts ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/me-via-you'

# Hoisted filter install leaves broken symlinks under apps/*/node_modules; use root node_modules only.
RUN find apps shared -type d -name node_modules -prune -exec rm -rf {} +

# Fail fast if Dokploy/Docker reused a stale apps/ layer (old vite.config used ../../vite-kysely-compat).
RUN test -f apps/me-via-you/vite-kysely-compat.ts \
 && grep -q './vite-kysely-compat' apps/me-via-you/vite.config.ts

RUN cd apps/me-via-you && bun run prepare

ENV TURBO_FORCE=1
RUN bun run build:shared:utils \
 && bun run build:shared:db \
 && bun run build:shared:auth \
 && bun run build:app:me-via-you

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3006

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/me-via-you/build ./apps/me-via-you/build
COPY --from=builder /app/apps/me-via-you/package.json ./apps/me-via-you/package.json

WORKDIR /app/apps/me-via-you
EXPOSE 3006

CMD ["bun", "./build/index.js"]
