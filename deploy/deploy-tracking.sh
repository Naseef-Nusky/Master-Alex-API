#!/bin/bash
# Run on DigitalOcean droplet to deploy website + landing with Google Analytics
set -euo pipefail

echo "=== Website ==="
cd /var/www/master-alex-website
git pull origin master
npm install
npm run build
if grep -q "googletagmanager" dist/index.html; then
  echo "OK: Google Analytics found in website dist/index.html"
else
  echo "ERROR: Google Analytics missing from website build — check git pull"
  exit 1
fi

echo ""
echo "=== Landing pages ==="
cd /var/www/master-alex-landing
git pull origin main
npm install
npm run build
if grep -q "googletagmanager" dist/index.html; then
  echo "OK: Google Analytics found in landing dist/index.html"
else
  echo "ERROR: Google Analytics missing from landing build — check git pull"
  exit 1
fi

echo ""
echo "=== Done ==="
echo "Test: curl -s https://masteralex.co.uk/ | grep googletagmanager"
echo "Test: curl -s https://services.masteralex.co.uk/ | grep googletagmanager"
