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
  echo "Room pages will fail until migrations are applied."
fi

cd "$APP_DIR"

export BODY_SIZE_LIMIT="${BODY_SIZE_LIMIT:-2M}"

if [[ -f .env ]]; then
  exec bun --env-file=.env ./build/index.js
fi

exec bun ./build/index.js
