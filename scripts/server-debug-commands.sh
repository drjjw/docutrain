#!/bin/bash
# Run these commands on your production server to debug the React app issue

echo "=== 1. Check if React app files exist ==="
ls -lah /home/brightbeanio/public_html/app/

echo ""
echo "=== 2. Check React app index.html ==="
cat /home/brightbeanio/public_html/app/index.html

echo ""
echo "=== 3. Check what JS bundle is being loaded ==="
grep -o 'main-[^"]*\.js' /home/brightbeanio/public_html/app/index.html

echo ""
echo "=== 4. Verify the JS bundle exists ==="
ls -lah /home/brightbeanio/public_html/app/assets/main-*.js

echo ""
echo "=== 5. Check PM2 status ==="
pm2 list

echo ""
echo "=== 6. Check if server is running from correct directory ==="
pm2 info brightbean-bot | grep -A 5 "exec cwd"

echo ""
echo "=== 7. Check server.js React app path ==="
grep -n "dist/app\|'app" /home/brightbeanio/public_html/server.js | head -5

echo ""
echo "=== 8. Test if /app route is accessible ==="
curl -I http://localhost:3456/app/ 2>&1 | head -10

echo ""
echo "=== 9. Check nginx/apache config for /app route ==="
# If using nginx:
# grep -r "location /app" /etc/nginx/
# If using Apache:
# cat /home/brightbeanio/public_html/.htaccess

echo ""
echo "=== 10. Check browser cache - look for this hash ==="
echo "Expected JS bundle: main-MVgw_J_6.js"
echo "If browser is loading a different hash, it's a caching issue"

