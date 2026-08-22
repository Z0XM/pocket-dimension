# zeo production image — build from monorepo root:
#   docker build -f apps/zeo/Dockerfile -t zeo .
#
# Dokploy: Dockerfile path apps/zeo/Dockerfile, Build Path /, Context Path .

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --filter '@pocket-dimension/zeo'

RUN bun run build:shared:utils \
 && bun run build:shared:db \
 && bun run build:shared:auth \
 && bun run build:app:zeo

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3008

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/apps/zeo/build ./apps/zeo/build
COPY --from=builder /app/apps/zeo/package.json ./apps/zeo/package.json

WORKDIR /app/apps/zeo
EXPOSE 3008

CMD ["bun", "./build/index.js"]
