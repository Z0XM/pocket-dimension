# Deploy from monorepo root. Dokploy: Build Path /, Context Path . (or Context / if Build Path is apps/rhymes).
# Local: docker build -f apps/rhymes/Dockerfile -t rhymes .
# Standalone — no @pocket-dimension/* workspace deps, but lockfile still needs monorepo context.

FROM oven/bun:1.3.5 AS builder
WORKDIR /app

COPY package.json bun.lock turbo.json ./
COPY scripts ./scripts
COPY shared ./shared
COPY apps ./apps

ENV CI=true HUSKY=0
RUN bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/rhymes'

# Hoisted filter install leaves broken symlinks under apps/*/node_modules; use root node_modules only.
RUN find apps shared -type d -name node_modules -prune -exec rm -rf {} +

RUN cd apps/rhymes && bun run prepare

ENV TURBO_FORCE=1
RUN bun run build:app:rhymes

FROM oven/bun:1.3.5-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/rhymes/build ./apps/rhymes/build
COPY --from=builder /app/apps/rhymes/package.json ./apps/rhymes/package.json

WORKDIR /app/apps/rhymes
EXPOSE 3003

CMD ["bun", "./build/index.js"]
