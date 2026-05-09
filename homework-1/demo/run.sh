#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

cd "$ROOT"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

exec npm start
