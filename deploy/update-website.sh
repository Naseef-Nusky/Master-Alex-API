#!/bin/bash
set -euo pipefail
cd /var/www/master-alex-website

if [ ! -f .env ]; then
  cat > .env <<'EOF'
VITE_CONTACT_API_URL=
VITE_GA_MEASUREMENT_ID=G-GQTV7YNWWK
EOF
fi

git pull origin master
npm install
npm run build
echo "Website updated."
