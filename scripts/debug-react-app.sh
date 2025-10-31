#!/bin/bash
echo "=========================================="
echo "React App Deployment Debug Report"
echo "=========================================="
echo ""

echo "1. CHECK INDEX.HTML CONTENT"
echo "-------------------------------------------"
cat /home/brightbeanio/public_html/app/index.html
echo ""

echo "2. LIST ALL ASSETS"
echo "-------------------------------------------"
ls -lah /home/brightbeanio/public_html/app/assets/
echo ""

echo "3. CHECK WHICH JS BUNDLE IS REFERENCED"
echo "-------------------------------------------"
grep -o 'main-[^"]*\.js' /home/brightbeanio/public_html/app/index.html
echo ""

echo "4. PM2 STATUS"
echo "-------------------------------------------"
pm2 list
echo ""

echo "5. PM2 PROCESS DETAILS"
echo "-------------------------------------------"
pm2 info brightbean-bot | grep -A 3 "exec cwd"
echo ""

echo "6. SERVER.JS APP PATH"
echo "-------------------------------------------"
grep -n "'app\|\"app" /home/brightbeanio/public_html/server.js | head -10
echo ""

echo "7. TEST /APP ROUTE"
echo "-------------------------------------------"
curl -I http://localhost:3456/app/ 2>&1
echo ""

echo "8. CHECK IF OLD BUNDLES EXIST"
echo "-------------------------------------------"
find /home/brightbeanio/public_html/app/assets/ -name "main-*.js" -exec ls -lh {} \;
echo ""

echo "=========================================="
echo "Debug Report Complete"
echo "=========================================="

