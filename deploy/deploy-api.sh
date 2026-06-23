#!/bin/bash
set -euo pipefail

echo "=== Master Alex API deploy ==="

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Error: .env file missing. Copy .env.example to .env and fill in SendGrid values."
  exit 1
fi

npm install --omit=dev

if command -v pm2 >/dev/null 2>&1; then
  pm2 startOrRestart ecosystem.config.cjs
  pm2 save
  echo "API running with PM2"
else
  echo "PM2 not found. Start manually with: npm start"
fi

echo "Health check: curl http://127.0.0.1:3001/api/health"
