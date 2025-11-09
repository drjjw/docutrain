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
    NODE_MODULES_VALID=\$([ -d node_modules/express ] && echo 'true' || echo 'false') && \
    if [ \"\$PACKAGE_HASH\" != \"\$STORED_HASH\" ] || [ ! -d node_modules ] || [ \"\$NODE_MODULES_VALID\" != 'true' ]; then \
      echo '📦 package.json changed, node_modules missing, or invalid - cleaning and reinstalling...' && \
      rm -rf node_modules package-lock.json && \
      echo 'Installing dependencies...' && \
      if npm install --ignore-scripts=false --legacy-peer-deps; then \
        echo \$PACKAGE_HASH > .package.json.hash && \
        echo 'Verifying critical modules...' && \
        (node -e \"require('express')\" 2>/dev/null && echo '✓ express OK' || (echo '❌ express missing!' && exit 1)) && \
        (node -e \"require('sharp')\" 2>/dev/null && echo '✓ sharp OK' || echo '⚠️  sharp may need rebuild: npm rebuild sharp'); \
      else \
        echo '❌ npm install failed!' && exit 1; \
      fi; \
    else \
      echo '📦 No package.json changes and node_modules valid - skipping dependency reinstall'; \
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
  pm2 start ecosystem.config.js --env production && pm2 save && \
  echo 'Sleeping 5 seconds for server to start...' && sleep 5 && \
  curl -s http://localhost:3458 > /dev/null && echo 'Server ready' && \
  echo '🗑️  Clearing backend cache...' && curl -X POST http://localhost:3458/api/refresh-registry && echo '' && echo '✅ Backend cache cleared'"
