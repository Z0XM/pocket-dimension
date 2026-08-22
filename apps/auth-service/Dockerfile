# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/auth-service).
# Local: docker build -f apps/auth-service/Dockerfile -t auth-service .

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/auth-service'

# Hoisted filter install leaves broken symlinks under apps/*/node_modules; use root node_modules only.
RUN find apps shared -type d -name node_modules -prune -exec rm -rf {} +

ENV TURBO_FORCE=1
RUN bun run build:shared:utils \
 && bun run build:shared:db \
 && bun run build:shared:auth

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/auth-service ./apps/auth-service

WORKDIR /app/apps/auth-service
EXPOSE 5001

CMD ["bun", "run", "src/index.ts"]
