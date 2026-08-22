#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f shared/auth/package.json ]]; then
  echo "ERROR: Monorepo shared packages not found at $ROOT_DIR/shared/auth."
  echo ""
  echo "Workspace deps (@pocket-dimension/auth, db, utils) require the full repo."
  echo "Set Dokploy/Railway Root Directory to / (repository root), not apps/watchlist."
  echo "Then set RAILPACK_CONFIG_FILE=apps/watchlist/railpack.json"
  exit 1
fi

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile

echo "Building @pocket-dimension/watchlist..."
bun build:app:watchlist

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running database migrations..."
  bun db:migrate
else
  echo "Skipping db:migrate — DATABASE_URL is not set at build time."
  echo "Run migrations manually before serving traffic."
fi

echo "Watchlist deploy build complete."
