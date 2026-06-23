#!/bin/bash
set -euo pipefail
cd /var/www/master-alex-website
git pull origin master
npm install
npm run build
echo "Website updated."
