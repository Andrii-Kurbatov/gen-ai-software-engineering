#!/usr/bin/env bash
# Start the Expense Tracker sample app (dev mode, ts-node).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Expense Tracker API on http://localhost:${PORT:-3000} ..."
npm run dev
