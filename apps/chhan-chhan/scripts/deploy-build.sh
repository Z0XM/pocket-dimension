#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile

echo "Building @pocket-dimension/chhan-chhan..."
bun build:app:chhan-chhan

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "Running database migrations..."
  bun db:migrate
else
  echo "Skipping db:migrate — DATABASE_URL is not set at build time."
  echo "Run migrations manually before serving traffic."
fi

echo "Chhan Chhan deploy build complete."
