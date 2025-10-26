#!/bin/bash
# Copy these commands to run on your server

echo "=== Check what JS bundle is in index.html ==="
cat /home/brightbeanio/public_html/app/index.html

echo ""
echo "=== List all JS bundles in assets ==="
ls -lah /home/brightbeanio/public_html/app/assets/

echo ""
echo "=== Check PM2 status and restart ==="
pm2 list
pm2 restart brightbean-bot

echo ""
echo "=== Test the /app route ==="
curl -I http://localhost:3456/app/

