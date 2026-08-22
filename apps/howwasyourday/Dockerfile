# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/howwasyourday).
# Local: docker build -f apps/howwasyourday/Dockerfile -t howwasyourday .

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY vite-kysely-compat.ts ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/howwasyourday'

# Hoisted filter install leaves broken symlinks under apps/*/node_modules; use root node_modules only.
RUN find apps shared -type d -name node_modules -prune -exec rm -rf {} +

# Fail fast if Dokploy/Docker reused a stale apps/ layer (old vite.config used ../../vite-kysely-compat).
RUN test -f apps/howwasyourday/vite-kysely-compat.ts \
 && grep -q './vite-kysely-compat' apps/howwasyourday/vite.config.ts

RUN cd apps/howwasyourday && bun run prepare

ENV TURBO_FORCE=1
RUN bun run build:shared:utils \
 && bun run build:shared:db \
 && bun run build:shared:auth \
 && bun run build:app:howwasyourday

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3004

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/howwasyourday/build ./apps/howwasyourday/build
COPY --from=builder /app/apps/howwasyourday/package.json ./apps/howwasyourday/package.json

WORKDIR /app/apps/howwasyourday
EXPOSE 3004

CMD ["bun", "./build/index.js"]
