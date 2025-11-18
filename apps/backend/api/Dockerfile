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
RUN cd /temp/prod && HUSKY=0 bun install --frozen-lockfile --production

# --- prerelease: assemble source + dev deps, run workspace build if needed ---
FROM base AS prerelease

WORKDIR /app

# use dev node_modules here so any build tooling is available
COPY --from=install /temp/dev/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

# runs the package build script (currently a no-op, but keeps the flow consistent)
RUN bun run --filter "@pocket-dimension/backend-api" build

# --- runner: minimal runtime image with only prod deps + this app's code ---
FROM base AS runner

WORKDIR /app

# only production dependencies
COPY --from=prod-deps /temp/prod/node_modules ./node_modules

# only copy this app into the final image
COPY --from=prerelease /app/apps/backend/api ./apps/backend/api

WORKDIR /app/apps/backend/api

ENV PORT=3001
USER bun
EXPOSE 3001/tcp

ENTRYPOINT [ "bun", "run", "start" ]
