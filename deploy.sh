#!/bin/bash

# Parse flags
SKIP_DEPS=false
if [[ "$1" == "--skip-deps" ]] || [[ "$1" == "-s" ]]; then
  SKIP_DEPS=true
  echo "🚀 Skipping dependency check/install (--skip-deps flag set)"
fi

# Build dependency check command
if [ "$SKIP_DEPS" = true ]; then
  DEPS_CMD="echo '📦 Skipping dependency check (--skip-deps flag)' &&"
else
  DEPS_CMD="PACKAGE_HASH=\$(md5sum package.json 2>/dev/null | cut -d' ' -f1 || md5 -q package.json 2>/dev/null) && \
    STORED_HASH=\$(cat .package.json.hash 2>/dev/null || echo '') && \
    if [ \"\$PACKAGE_HASH\" != \"\$STORED_HASH\" ] || [ ! -d node_modules ]; then \
      echo '📦 package.json changed or node_modules missing - cleaning and reinstalling...' && \
      rm -rf node_modules package-lock.json && \
      echo 'Installing dependencies...' && \
      npm install --ignore-scripts=false --legacy-peer-deps && \
      echo \$PACKAGE_HASH > .package.json.hash && \
      echo 'Verifying sharp installation...' && \
      (node -e \"require('sharp')\" 2>/dev/null && echo '✓ sharp module OK' || echo '⚠️  sharp may need rebuild: npm rebuild sharp'); \
    else \
      echo '📦 No package.json changes - skipping dependency reinstall'; \
    fi &&"
fi

npm run build && \
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/docutrainio/public_html && \
rsync -avz -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  package.json root@162.246.254.111:/home/docutrainio/public_html/ && \
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "chown -R docutrainio:docutrainio /home/docutrainio/public_html && cd /home/docutrainio/public_html && \
  $DEPS_CMD \
  (pm2 stop docutrainio-bot || true) && (pm2 delete docutrainio-bot || true) && \
  pm2 start server.js --name docutrainio-bot && pm2 save && \
  echo 'Sleeping 5 seconds for server to start...' && sleep 5 && \
  curl -s http://localhost:3458 > /dev/null && echo 'Server ready' && \
  echo '🗑️  Clearing backend cache...' && curl -X POST http://localhost:3458/api/refresh-registry && echo '' && echo '✅ Backend cache cleared'"
