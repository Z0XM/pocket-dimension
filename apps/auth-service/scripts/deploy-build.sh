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
  echo "Set Dokploy/Railway Root Directory to / (repository root), not apps/auth-service."
  echo "Then set RAILPACK_CONFIG_FILE=apps/auth-service/railpack.json"
  exit 1
fi

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile

echo "Building shared packages for auth-service..."
bun run build:shared:utils
bun run build:shared:db
bun run build:shared:auth

echo "Auth service deploy build complete."
