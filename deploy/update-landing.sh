#!/bin/bash
set -euo pipefail
cd /var/www/master-alex-landing
git pull origin main
npm install
npm run build
echo "Landing pages updated."
