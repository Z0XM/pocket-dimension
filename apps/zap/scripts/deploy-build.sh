#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f shared/auth/package.json ]]; then
  echo "ERROR: Monorepo shared packages not found at $ROOT_DIR/shared/auth."
  echo "Use Dockerfile build (recommended): apps/zap/Dockerfile with context /"
  echo "Or Railpack with root directory apps/zap or / (see DEPLOY.md)."
  exit 1
fi

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/zap'
find apps shared -type d -name node_modules -prune -exec rm -rf {} +

echo "Preparing SvelteKit (svelte-kit sync)..."
(cd apps/zap && bun run prepare)

echo "Building @pocket-dimension/zap..."
TURBO_FORCE=1 bun run build:shared:utils
TURBO_FORCE=1 bun run build:shared:db
TURBO_FORCE=1 bun run build:shared:auth
TURBO_FORCE=1 bun run build:app:zap

# Opt-in build-time migrate (e.g. CI smoke). Normally run `bun run db:migrate` as an explicit deploy step.
if [[ -n "${DATABASE_URL:-}" && "${ZAP_MIGRATE_AT_BUILD:-}" == "1" ]]; then
  echo "Running database migrations at build (ZAP_MIGRATE_AT_BUILD=1)..."
  bun db:migrate
else
  echo "Skipping db:migrate — run \`DATABASE_URL=... bun run db:migrate\` from the repo root before serving a release with new migrations."
fi

echo "Zap deploy build complete."
echo "Production tip: use the fat Dockerfile (ffmpeg + yt-dlp + Deno). Railpack alone lacks those tools."
