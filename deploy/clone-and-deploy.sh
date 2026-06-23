#!/bin/bash
# Run on DigitalOcean droplet as root (first-time setup + build from GitHub)
set -euo pipefail

DOMAIN="${DOMAIN:-masteralex.co.uk}"
GITHUB_USER="${GITHUB_USER:-Naseef-Nusky}"
WEB_ROOT="${WEB_ROOT:-/var/www}"

echo "=== Master Alex — clone from GitHub ==="

apt update
apt install -y nginx git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2

mkdir -p "$WEB_ROOT"

# API
if [ ! -d "$WEB_ROOT/master-alex-api/.git" ]; then
  git clone "https://github.com/${GITHUB_USER}/Master-Alex-API.git" "$WEB_ROOT/master-alex-api"
else
  cd "$WEB_ROOT/master-alex-api" && git pull
fi

if [ ! -f "$WEB_ROOT/master-alex-api/.env" ]; then
  cp "$WEB_ROOT/master-alex-api/.env.example" "$WEB_ROOT/master-alex-api/.env"
  echo "Edit $WEB_ROOT/master-alex-api/.env then run this script again."
  exit 1
fi

cd "$WEB_ROOT/master-alex-api"
npm install --omit=dev
pm2 startOrRestart ecosystem.config.cjs
pm2 save

# Website (branch: master)
if [ ! -d "$WEB_ROOT/master-alex-website/.git" ]; then
  git clone -b master "https://github.com/${GITHUB_USER}/Master-Alex-Website.git" "$WEB_ROOT/master-alex-website"
else
  cd "$WEB_ROOT/master-alex-website" && git pull
fi

cd "$WEB_ROOT/master-alex-website"
npm install
npm run build

# Landing pages (branch: main)
if [ ! -d "$WEB_ROOT/master-alex-landing/.git" ]; then
  git clone -b main "https://github.com/${GITHUB_USER}/Master-Alex-LandingPages.git" "$WEB_ROOT/master-alex-landing"
else
  cd "$WEB_ROOT/master-alex-landing" && git pull
fi

if [ ! -f "$WEB_ROOT/master-alex-landing/.env" ]; then
  cat > "$WEB_ROOT/master-alex-landing/.env" <<EOF
VITE_SITE_URL=https://services.${DOMAIN}
VITE_MAIN_SITE_URL=https://${DOMAIN}
VITE_CONTACT_API_URL=
EOF
fi

cd "$WEB_ROOT/master-alex-landing"
npm install
npm run build

echo ""
echo "=== Builds complete ==="
echo "Website dist:  $WEB_ROOT/master-alex-website/dist"
echo "Landing dist:  $WEB_ROOT/master-alex-landing/dist"
echo "API:           pm2 status"
echo ""
echo "Next: configure nginx (see deploy/nginx.example.conf) and run certbot"
