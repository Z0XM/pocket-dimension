#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f shared/auth/package.json ]]; then
  echo "ERROR: Monorepo shared packages not found at $ROOT_DIR/shared/auth."
  echo ""
  echo "Workspace deps require the full repo at build time."
  echo "Use Dockerfile build (recommended): apps/auth-service/Dockerfile with context /"
  echo "Or Railpack with root directory apps/auth-service or / (see DEPLOY.md)."
  exit 1
fi

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/auth-service'
find apps shared -type d -name node_modules -prune -exec rm -rf {} +

echo "Building shared packages for auth-service..."
TURBO_FORCE=1 bun run build:shared:utils
TURBO_FORCE=1 bun run build:shared:db
TURBO_FORCE=1 bun run build:shared:auth

echo "Auth service deploy build complete."
