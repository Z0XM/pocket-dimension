#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

if [[ ! -f shared/utils/package.json ]]; then
  echo "ERROR: Monorepo shared packages not found at $ROOT_DIR/shared/utils."
  echo ""
  echo "Workspace deps require the full repo at build time."
  echo "Use Dockerfile build (recommended): apps/pocket/Dockerfile with context /"
  echo "Or Railpack with root directory apps/pocket or / (see DEPLOY.md)."
  exit 1
fi

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile --ignore-scripts --linker hoisted --filter '@pocket-dimension/pocket'
find apps shared -type d -name node_modules -prune -exec rm -rf {} +

echo "Preparing SvelteKit (svelte-kit sync)..."
(cd apps/pocket && bun run prepare)

echo "Building @pocket-dimension/pocket..."
TURBO_FORCE=1 bun run build:shared:utils
TURBO_FORCE=1 bun run build:app:pocket

echo "Pocket deploy build complete."
