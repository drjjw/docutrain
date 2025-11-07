#!/bin/bash

# Troubleshooting script for 503 errors on dev server
# Run this ON the remote server after SSH'ing in

echo "🔍 Troubleshooting 503 Error - Dev Server"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check PM2 status
echo "1️⃣  Checking PM2 status..."
pm2 status
echo ""

# 2. Check if process exists and its state
echo "2️⃣  Checking docutrainio-bot process details..."
if pm2 describe docutrainio-bot > /dev/null 2>&1; then
    pm2 describe docutrainio-bot | grep -E "status|restarts|uptime|memory|cpu|error"
else
    echo -e "${RED}❌ Process 'docutrainio-bot' not found in PM2${NC}"
fi
echo ""

# 3. Check recent logs (last 50 lines)
echo "3️⃣  Checking recent logs (last 50 lines)..."
echo "--- STDOUT ---"
pm2 logs docutrainio-bot --lines 50 --nostream --out 2>/dev/null || echo "No stdout logs"
echo ""
echo "--- STDERR ---"
pm2 logs docutrainio-bot --lines 50 --nostream --err 2>/dev/null || echo "No stderr logs"
echo ""

# 4. Check if .env file exists
echo "4️⃣  Checking .env file..."
if [ -f /home/docutrainio/public_html/.env ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"
    echo "Checking critical env vars..."
    grep -E "^PORT=|^SUPABASE_URL=|^GEMINI_API_KEY=" /home/docutrainio/public_html/.env | sed 's/=.*/=***/' || echo "Some vars missing"
else
    echo -e "${RED}❌ .env file MISSING at /home/docutrainio/public_html/.env${NC}"
fi
echo ""

# 5. Check if server responds locally
echo "5️⃣  Checking if server responds on localhost:3458..."
if curl -s -f http://localhost:3458/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is responding${NC}"
    curl -s http://localhost:3458/api/health | head -3
else
    echo -e "${RED}❌ Server NOT responding on localhost:3458${NC}"
fi
echo ""

# 6. Check port availability
echo "6️⃣  Checking port 3458..."
if netstat -tuln 2>/dev/null | grep -q ":3458 "; then
    echo -e "${GREEN}✓ Port 3458 is in use${NC}"
    netstat -tuln | grep ":3458 "
else
    echo -e "${YELLOW}⚠️  Port 3458 is NOT in use (server may not be running)${NC}"
fi
echo ""

# 7. Check if dependencies are installed
echo "7️⃣  Checking node_modules..."
cd /home/docutrainio/public_html
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓ node_modules exists${NC}"
    if [ -d "node_modules/express" ]; then
        echo -e "${GREEN}✓ express module found${NC}"
    else
        echo -e "${RED}❌ express module MISSING - dependencies may be incomplete${NC}"
    fi
else
    echo -e "${RED}❌ node_modules MISSING - run: npm install${NC}"
fi
echo ""

# 8. Try to start server manually (test for syntax errors)
echo "8️⃣  Testing server.js for syntax errors..."
cd /home/docutrainio/public_html
if node -c server.js 2>&1; then
    echo -e "${GREEN}✓ No syntax errors in server.js${NC}"
else
    echo -e "${RED}❌ Syntax error in server.js${NC}"
fi
echo ""

# 9. Check disk space
echo "9️⃣  Checking disk space..."
df -h /home/docutrainio | tail -1
echo ""

# 10. Check Node.js version
echo "🔟 Checking Node.js version..."
node --version
npm --version
echo ""

# 11. Check file permissions
echo "1️⃣1️⃣  Checking file permissions..."
ls -la /home/docutrainio/public_html/server.js /home/docutrainio/public_html/package.json 2>/dev/null | awk '{print $1, $3, $4, $9}'
echo ""

# 12. Check if PM2 config exists
echo "1️⃣2️⃣  Checking PM2 ecosystem config..."
if [ -f /home/docutrainio/public_html/docutrainio-bot.js ]; then
    echo -e "${GREEN}✓ docutrainio-bot.js config exists${NC}"
else
    echo -e "${YELLOW}⚠️  docutrainio-bot.js config not found${NC}"
fi
echo ""

# Summary and recommendations
echo ""
echo "=========================================="
echo "📋 SUMMARY & RECOMMENDATIONS"
echo "=========================================="
echo ""
echo "If server is stopped or crashing:"
echo "  1. Check logs above for error messages"
echo "  2. Verify .env file exists and has correct values"
echo "  3. Run: cd /home/docutrainio/public_html && npm install"
echo "  4. Try: pm2 restart docutrainio-bot"
echo ""
echo "If process doesn't exist:"
echo "  1. cd /home/docutrainio/public_html"
echo "  2. pm2 start server.js --name docutrainio-bot"
echo "  3. pm2 save"
echo ""
echo "To view real-time logs:"
echo "  pm2 logs docutrainio-bot"
echo ""
echo "To monitor PM2:"
echo "  pm2 monit"
echo ""

