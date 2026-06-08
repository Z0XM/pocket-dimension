# syntax=docker/dockerfile:1
#
# Prefer the root Dockerfile instead (works with Dokploy defaults):
#   Dockerfile path: Dockerfile.me-via-you
#
# Only use this file if Docker context path is explicitly set to repo root (.)
# and Dockerfile path is apps/me-via-you/Dockerfile.

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY scripts/package.json scripts/
COPY apps/me-via-you/package.json apps/me-via-you/
COPY shared/auth/package.json shared/auth/
COPY shared/db/package.json shared/db/
COPY shared/utils/package.json shared/utils/
COPY apps/auth-service/package.json apps/auth-service/
COPY apps/chhan-chhan/package.json apps/chhan-chhan/
COPY apps/howwasyourday/package.json apps/howwasyourday/
COPY apps/markitdown/package.json apps/markitdown/
COPY apps/rhymes/package.json apps/rhymes/
COPY apps/watchlist/package.json apps/watchlist/

RUN bun install --frozen-lockfile

COPY apps/me-via-you apps/me-via-you
COPY shared shared

RUN bunx turbo run build --filter=@pocket-dimension/me-via-you

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=builder /app/apps/me-via-you/build ./

EXPOSE 3000
CMD ["bun", "./index.js"]
