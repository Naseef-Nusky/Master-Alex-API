#!/bin/bash
set -euo pipefail
cd /var/www/master-alex-landing

if [ ! -f .env ]; then
  cat > .env <<'EOF'
VITE_SITE_URL=https://services.masteralex.co.uk
VITE_MAIN_SITE_URL=https://masteralex.co.uk
VITE_CONTACT_API_URL=
VITE_GA_MEASUREMENT_ID=G-P3665Z8JZW
EOF
fi

git pull origin main
npm install
npm run build
echo "Landing pages updated."
