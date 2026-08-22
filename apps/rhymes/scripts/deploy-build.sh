#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f package.json ]] || ! grep -q '"workspaces"' package.json 2>/dev/null; then
  echo "ERROR: Monorepo root not found at $ROOT_DIR."
  echo ""
  echo "Use Dockerfile build (recommended): apps/rhymes/Dockerfile with context /"
  echo "Or Railpack with root directory apps/rhymes or / (see DEPLOY.md)."
  exit 1
fi

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/rhymes'
find apps shared -type d -name node_modules -prune -exec rm -rf {} +

echo "Preparing SvelteKit (svelte-kit sync)..."
(cd apps/rhymes && bun run prepare)

echo "Building @pocket-dimension/rhymes..."
TURBO_FORCE=1 bun run build:app:rhymes

echo "Rhymes deploy build complete."
