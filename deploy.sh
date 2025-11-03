#!/bin/bash
npm run build && \
rsync -avz --delete --exclude='node_modules' --exclude='.env' \
  -e "ssh -i ~/.ssh/drjjw.pub -p 7022" \
  dist/ root@162.246.254.111:/home/docutrainio/public_html && \
ssh -i ~/.ssh/drjjw.pub -p 7022 root@162.246.254.111 \
  "chown -R docutrainio:docutrainio /home/docutrainio/public_html && cd /home/docutrainio/public_html && echo 'Cleaning old node_modules...' && rm -rf node_modules package-lock.json && echo 'Installing dependencies...' && npm install --ignore-scripts=false --legacy-peer-deps && echo 'Verifying sharp installation...' && (node -e \"require('sharp')\" 2>/dev/null && echo '✓ sharp module OK' || echo '⚠️  sharp may need rebuild: npm rebuild sharp') && (pm2 stop docutrainio-bot || true) && (pm2 delete docutrainio-bot || true) && pm2 start server.js --name docutrainio-bot && pm2 save && echo 'Sleeping 5 seconds for server to start...' && sleep 5 && curl -s http://localhost:3458 > /dev/null && echo 'Server ready' && echo '🗑️  Clearing backend cache...' && curl -X POST http://localhost:3458/api/refresh-registry && echo '' && echo '✅ Backend cache cleared'"
