#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/../.." && pwd)"

cd "$ROOT_DIR"

echo "Installing Bun workspace dependencies..."
bun install --frozen-lockfile

echo "Installing MarkItDown Python dependencies..."
python3 -m pip install --no-cache-dir -r "$APP_DIR/requirements.txt"

echo "Building @pocket-dimension/markitdown..."
bun build:app:markitdown

echo "MarkItDown deploy build complete."
