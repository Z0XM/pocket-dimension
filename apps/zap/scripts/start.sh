#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

# No migrations on boot: shared/db/migrations spans every app's schema. Run `bun run db:migrate` as a deploy step.

# svelte-adapter-bun defaults to 512K — too small for audio uploads / NDJSON ingest bodies.
export BODY_SIZE_LIMIT="${BODY_SIZE_LIMIT:-50M}"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-3013}"

if [[ -f .env ]]; then
  exec bun --env-file=.env ./build/index.js
fi

exec bun ./build/index.js
