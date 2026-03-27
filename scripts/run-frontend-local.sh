#!/usr/bin/env bash
set -euo pipefail

export VITE_API_URL="${VITE_API_URL:-http://localhost:3001}"
export VITE_PORT="${VITE_PORT:-5173}"

echo "Starting frontend with VITE_API_URL=$VITE_API_URL"
cd "$(dirname "$0")/../frontend"

if [ ! -d "node_modules" ]; then
  echo "node_modules not found. Installing dependencies..."
  npm install --no-audit --no-fund
fi

npm run dev -- --host 127.0.0.1 --port "$VITE_PORT"
