#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f apps/heimdall/package.json ]]; then
  echo "ERROR: apps/heimdall not found at $ROOT_DIR/apps/heimdall."
  echo ""
  echo "Heimdall deploy requires the full monorepo (BMAD docs + heimdall.config.mjs)."
  echo "Use Dockerfile build: apps/heimdall/Dockerfile with context /"
  echo "Or Railpack with root directory apps/heimdall or / (see DEPLOY.md)."
  exit 1
fi

if [[ ! -f heimdall.config.mjs ]]; then
  echo "ERROR: heimdall.config.mjs missing at monorepo root."
  exit 1
fi

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/heimdall'
find apps shared -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true

echo "Building @pocket-dimension/heimdall..."
TURBO_FORCE=1 bun run build:app:heimdall

echo "Heimdall deploy build complete."
