#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

# Dependencies are installed by Railpack (see apps/zeo/railpack.json).
# Do not use --frozen-lockfile here — partial monorepo checkouts fail frozen install.

echo "Building shared packages and zeo..."
bun build:shared:utils
bun build:shared:db
bun build:shared:auth
bun build:app:zeo

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running database migrations..."
  bun db:migrate
else
  echo "Skipping db:migrate — DATABASE_URL is not set at build time."
  echo "Run migrations manually before serving traffic."
fi

echo "Zeo deploy build complete."
