FROM oven/bun:1-alpine AS base

WORKDIR /app

# --- install stage: full dev dependencies (for builds, tests, etc.) ---
FROM base AS install

RUN mkdir -p /temp/dev
COPY . /temp/dev
RUN cd /temp/dev && bun install --frozen-lockfile

# --- production dependencies only (no devDependencies) ---
FROM base AS prod-deps

RUN mkdir -p /temp/prod
COPY . /temp/prod
RUN cd /temp/prod && bun install --frozen-lockfile --production

# --- prerelease: assemble source + dev deps, run workspace build if needed ---
FROM base AS prerelease

WORKDIR /app

# use dev node_modules here so any build tooling is available
COPY --from=install /temp/dev/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

# runs the package build script (currently a no-op, but keeps the flow consistent)
RUN bun run --filter "@pocket-dimension/backend-api" build

# verify the directory structure exists
RUN ls -la /app/apps/backend/api || (echo "Directory structure:" && find /app -type d -name "backend" 2>/dev/null | head -10 && exit 1)

# --- runner: minimal runtime image with only prod deps + this app's code ---
FROM base AS runner

WORKDIR /app

# only production dependencies
COPY --from=prod-deps /temp/prod/node_modules ./node_modules

# copy workspace root files needed for workspace resolution
COPY --from=prerelease /app/package.json ./package.json
COPY --from=prerelease /app/bun.lock ./bun.lock
COPY --from=prerelease /app/tsconfig.json ./tsconfig.json
COPY --from=prerelease /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=prerelease /app/turbo.json ./turbo.json

# copy shared dependencies (needed for @pocket-dimension/env)
COPY --from=prerelease /app/shared ./shared

# only copy this app into the final image
COPY --from=prerelease /app/apps/backend/api ./apps/backend/api

WORKDIR /app/apps/backend/api

ENV PORT=3001
USER bun
EXPOSE 3001/tcp

ENTRYPOINT [ "bun", "run", "start" ]
