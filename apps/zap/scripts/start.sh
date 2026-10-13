#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running database migrations..."
  cd shared/db
  bunx --bun drizzle-kit migrate
  cd "$ROOT_DIR"
else
  echo "Warning: DATABASE_URL is not set — skipping database migrations."
  echo "Zap catalogue/sessions will fail until migrations are applied (bun run db:migrate)."
fi

cd "$APP_DIR"

# svelte-adapter-bun defaults to 512K — too small for audio uploads / NDJSON ingest bodies.
export BODY_SIZE_LIMIT="${BODY_SIZE_LIMIT:-50M}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3013}"

if [[ -f .env ]]; then
  exec bun --env-file=.env ./build/index.js
fi

exec bun ./build/index.js
