#!/bin/bash
set -euo pipefail
cd /var/www/master-alex-api
git pull origin main
npm install --omit=dev
pm2 restart master-alex-api
echo "API updated."
