# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/pocket).
# Local: docker build -f apps/pocket/Dockerfile -t pocket .

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/pocket'

# Hoisted filter install leaves broken symlinks under apps/*/node_modules; use root node_modules only.
RUN find apps shared -type d -name node_modules -prune -exec rm -rf {} +

RUN cd apps/pocket && bun run prepare

ENV TURBO_FORCE=1
RUN bun run build:shared:utils \
 && bun run build:app:pocket

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3007

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/pocket/build ./apps/pocket/build
COPY --from=builder /app/apps/pocket/package.json ./apps/pocket/package.json

WORKDIR /app/apps/pocket
EXPOSE 3007

CMD ["bun", "./build/index.js"]
