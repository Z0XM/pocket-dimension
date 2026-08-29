# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/heimdall).
# Local: docker build -f apps/heimdall/Dockerfile -t heimdall .
#
# Runtime needs BMAD trees + root config (not just the built SPA).

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps
COPY heimdall.config.mjs ./
COPY _bmad-output ./_bmad-output

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/heimdall'

# Hoisted filter install leaves broken symlinks under apps/*/node_modules; use root node_modules only.
RUN find apps shared -type d -name node_modules -prune -exec rm -rf {} +

ENV TURBO_FORCE=1
RUN bun run build:app:heimdall

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3012
ENV HOST=0.0.0.0
ENV HEIMDALL_REPO_ROOT=/app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/heimdall.config.mjs ./heimdall.config.mjs
COPY --from=builder /app/_bmad-output ./_bmad-output
COPY --from=builder /app/apps/heimdall/package.json ./apps/heimdall/package.json
COPY --from=builder /app/apps/heimdall/dist ./apps/heimdall/dist
COPY --from=builder /app/apps/heimdall/scripts/start.mjs ./apps/heimdall/scripts/start.mjs

WORKDIR /app/apps/heimdall
EXPOSE 3012

CMD ["bun", "./scripts/start.mjs"]
