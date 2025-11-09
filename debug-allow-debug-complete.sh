#!/bin/bash
# Comprehensive ALLOW_DEBUG_OVERRIDE Debugging Script
# Run this on production to diagnose why Mission Control shows "Not set"

echo "=========================================="
echo "🔍 COMPREHENSIVE ALLOW_DEBUG_OVERRIDE Debug Script"
echo "=========================================="
echo ""

cd /home/docutrainio/public_html

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
    fi
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check .env file
echo "1️⃣  Checking .env file:"
echo "----------------------------------------"
if grep -q "ALLOW_DEBUG_OVERRIDE" .env; then
    print_status 0 "Found in .env"
    grep "ALLOW_DEBUG_OVERRIDE" .env
else
    print_status 1 "NOT found in .env"
fi
echo ""

# 1b. Check if dist/lib has the code
echo "1b️⃣  Checking dist/lib (source of deployment):"
echo "----------------------------------------"
if [ -f "dist/lib/routes/users/handlers/config-handler.js" ]; then
    if grep -q "ALLOW_DEBUG_OVERRIDE" dist/lib/routes/users/handlers/config-handler.js 2>/dev/null; then
        print_status 0 "dist/lib has ALLOW_DEBUG_OVERRIDE code"
        grep -A 3 "ALLOW_DEBUG_OVERRIDE" dist/lib/routes/users/handlers/config-handler.js | head -5
    else
        print_status 1 "dist/lib does NOT have ALLOW_DEBUG_OVERRIDE code"
    fi
else
    print_warning "dist/lib/config-handler.js not found (may not exist locally)"
fi
echo ""

# 2. Test Node.js can read it
echo "2️⃣  Testing Node.js can read env var:"
echo "----------------------------------------"
node -e "require('dotenv').config(); console.log('Value:', process.env.ALLOW_DEBUG_OVERRIDE); console.log('Type:', typeof process.env.ALLOW_DEBUG_OVERRIDE);"
echo ""

# 3. Test config calculation
echo "3️⃣  Testing config calculation:"
echo "----------------------------------------"
node -e "
require('dotenv').config();
const value = process.env.ALLOW_DEBUG_OVERRIDE;
const result = (value === undefined || value === null || value === '') ? true : (value !== 'false');
console.log('Env value:', value === undefined ? 'undefined' : value);
console.log('Calculated result:', result);
console.log('Result type:', typeof result);
"
echo ""

# 4. Test full config object
echo "4️⃣  Testing full config object creation:"
echo "----------------------------------------"
node -e "
require('dotenv').config();
const config = {
    DEBUG: process.env.DEBUG === 'true',
    ALLOW_DEBUG_OVERRIDE: (process.env.ALLOW_DEBUG_OVERRIDE === undefined || process.env.ALLOW_DEBUG_OVERRIDE === null || process.env.ALLOW_DEBUG_OVERRIDE === '') ? true : (process.env.ALLOW_DEBUG_OVERRIDE !== 'false'),
};
console.log('Full config:');
console.log(JSON.stringify(config, null, 2));
console.log('');
console.log('ALLOW_DEBUG_OVERRIDE:', config.ALLOW_DEBUG_OVERRIDE);
console.log('Type:', typeof config.ALLOW_DEBUG_OVERRIDE);
console.log('Has property:', 'ALLOW_DEBUG_OVERRIDE' in config);
"
echo ""

# 5. Check code file EXISTS and has content
echo "5️⃣  Checking config-handler.js file:"
echo "----------------------------------------"
CONFIG_HANDLER="lib/routes/users/handlers/config-handler.js"
if [ ! -f "$CONFIG_HANDLER" ]; then
    print_status 1 "File does NOT exist: $CONFIG_HANDLER"
else
    print_status 0 "File exists: $CONFIG_HANDLER"
    echo "  File size: $(wc -c < "$CONFIG_HANDLER") bytes"
    echo "  Last modified: $(stat -c %y "$CONFIG_HANDLER" 2>/dev/null || stat -f %Sm "$CONFIG_HANDLER" 2>/dev/null || echo 'unknown')"
    
    if grep -q "ALLOW_DEBUG_OVERRIDE" "$CONFIG_HANDLER"; then
        print_status 0 "Code contains ALLOW_DEBUG_OVERRIDE"
        echo "  Code snippet:"
        grep -A 5 "ALLOW_DEBUG_OVERRIDE" "$CONFIG_HANDLER" | head -8 | sed 's/^/    /'
    else
        print_status 1 "Code does NOT contain ALLOW_DEBUG_OVERRIDE"
    fi
    
    # Check for debug logs
    if grep -q "FORCE.*getConfig CALLED" "$CONFIG_HANDLER"; then
        print_status 0 "File has debug logging code"
    else
        print_warning "File does NOT have debug logging code (may not be deployed)"
    fi
fi
echo ""

# 5b. Check middleware file
echo "5b️⃣  Checking middleware.js file:"
echo "----------------------------------------"
MIDDLEWARE="lib/routes/users/middleware.js"
if [ -f "$MIDDLEWARE" ]; then
    if grep -q "MIDDLEWARE.*requireSuperAdmin called" "$MIDDLEWARE"; then
        print_status 0 "Middleware has debug logging code"
    else
        print_warning "Middleware does NOT have debug logging code"
    fi
else
    print_status 1 "Middleware file not found"
fi
echo ""

# 6. Check syntax
echo "6️⃣  Checking file syntax:"
echo "----------------------------------------"
if node -c lib/routes/users/handlers/config-handler.js 2>&1; then
    echo "✓ Syntax OK"
else
    echo "✗ Syntax ERROR!"
fi
echo ""

# 7. PM2 status
echo "7️⃣  PM2 Status:"
echo "----------------------------------------"
pm2 status
echo ""

# 8. PM2 environment
echo "8️⃣  PM2 Environment:"
echo "----------------------------------------"
pm2 describe docutrainio-bot | grep -A 5 "node env\|exec cwd"
echo ""

# 9. Recent logs
echo "9️⃣  Recent PM2 Logs (last 20 lines):"
echo "----------------------------------------"
pm2 logs docutrainio-bot --lines 20 --nostream | tail -20
echo ""

# 10. Test actual module loading
echo "🔟 Testing actual module loading:"
echo "----------------------------------------"
node -e "
process.chdir('/home/docutrainio/public_html');
require('dotenv').config();
try {
    const { createConfigHandlers } = require('./lib/routes/users/handlers/config-handler');
    const mockSupabase = {};
    const mockMiddleware = { requireSuperAdmin: () => {} };
    const handlers = createConfigHandlers(mockSupabase, mockMiddleware);
    
    // Simulate what getConfig does
    const config = {
        DEBUG: process.env.DEBUG === 'true',
        ALLOW_DEBUG_OVERRIDE: (process.env.ALLOW_DEBUG_OVERRIDE === undefined || process.env.ALLOW_DEBUG_OVERRIDE === null || process.env.ALLOW_DEBUG_OVERRIDE === '') ? true : (process.env.ALLOW_DEBUG_OVERRIDE !== 'false'),
    };
    
    console.log('Module loaded successfully');
    console.log('Config from module:', JSON.stringify(config, null, 2));
    console.log('Handler function exists:', typeof handlers.getConfig === 'function');
} catch (e) {
    console.error('Error loading module:', e.message);
    console.error(e.stack);
}
"
echo ""

# 11. Check PM2 is running correct files
echo "1️⃣1️⃣  Checking PM2 configuration:"
echo "----------------------------------------"
PM2_INFO=$(pm2 describe docutrainio-bot 2>/dev/null)
if [ $? -eq 0 ]; then
    SCRIPT_PATH=$(echo "$PM2_INFO" | grep "script path" | awk -F'│' '{print $2}' | xargs)
    EXEC_CWD=$(echo "$PM2_INFO" | grep "exec cwd" | awk -F'│' '{print $2}' | xargs)
    echo "  Script path: $SCRIPT_PATH"
    echo "  Exec CWD: $EXEC_CWD"
    
    if [ -f "$SCRIPT_PATH" ]; then
        print_status 0 "PM2 script file exists"
        # Check if server.js requires lib correctly
        if grep -q "require.*lib/routes/users" "$SCRIPT_PATH" 2>/dev/null; then
            print_status 0 "server.js requires lib/routes/users"
        else
            print_warning "server.js may not require lib/routes/users correctly"
        fi
    else
        print_status 1 "PM2 script file does NOT exist: $SCRIPT_PATH"
    fi
else
    print_status 1 "PM2 process not found"
fi
echo ""

# 12. Test actual API response
echo "1️⃣2️⃣  Testing actual API response:"
echo "----------------------------------------"
echo "  Note: This requires a valid auth token"
echo "  To test: curl -H 'Authorization: Bearer YOUR_TOKEN' https://www.docutrain.io/api/users/config"
echo ""

# 13. Check for multiple copies of files
echo "1️⃣3️⃣  Checking for multiple file copies:"
echo "----------------------------------------"
FOUND_FILES=$(find /home/docutrainio/public_html -name "config-handler.js" -type f 2>/dev/null)
if [ -n "$FOUND_FILES" ]; then
    echo "  Found config-handler.js files:"
    echo "$FOUND_FILES" | while read file; do
        echo "    - $file ($(wc -c < "$file" 2>/dev/null || echo 0) bytes)"
        if grep -q "ALLOW_DEBUG_OVERRIDE" "$file" 2>/dev/null; then
            echo "      ✓ Contains ALLOW_DEBUG_OVERRIDE"
        else
            echo "      ✗ Does NOT contain ALLOW_DEBUG_OVERRIDE"
        fi
    done
else
    print_warning "No config-handler.js files found"
fi
echo ""

# 14. Check Node.js module cache (if possible)
echo "1️⃣4️⃣  Checking for potential caching issues:"
echo "----------------------------------------"
echo "  PM2 restart count: $(pm2 describe docutrainio-bot 2>/dev/null | grep 'restart time' | awk '{print $NF}' || echo 'unknown')"
echo "  Server uptime: $(pm2 describe docutrainio-bot 2>/dev/null | grep 'uptime' | head -1 || echo 'unknown')"
echo "  Last restart: $(pm2 describe docutrainio-bot 2>/dev/null | grep 'created at' | awk -F'│' '{print $2}' | xargs || echo 'unknown')"
echo ""

# 15. Check route registration
echo "1️⃣5️⃣  Checking route registration:"
echo "----------------------------------------"
if [ -f "lib/routes/users/index.js" ]; then
    if grep -q "router.get.*config" lib/routes/users/index.js; then
        print_status 0 "Route is registered in index.js"
        echo "  Route definition:"
        grep -A 1 "router.get.*config" lib/routes/users/index.js | sed 's/^/    /'
    else
        print_status 1 "Route NOT found in index.js"
    fi
else
    print_status 1 "index.js not found"
fi
echo ""

# 16. Final diagnosis
echo "=========================================="
echo "🔍 FINAL DIAGNOSIS"
echo "=========================================="
echo ""

# Check if everything is in place
HAS_ENV=$(grep -q "ALLOW_DEBUG_OVERRIDE" .env && echo "yes" || echo "no")
HAS_CODE=$(grep -q "ALLOW_DEBUG_OVERRIDE" lib/routes/users/handlers/config-handler.js 2>/dev/null && echo "yes" || echo "no")
HAS_ROUTE=$(grep -q "router.get.*config" lib/routes/users/index.js 2>/dev/null && echo "yes" || echo "no")
PM2_RUNNING=$(pm2 describe docutrainio-bot >/dev/null 2>&1 && echo "yes" || echo "no")

echo "Summary:"
echo "  .env has variable: $HAS_ENV"
echo "  Code file has property: $HAS_CODE"
echo "  Route is registered: $HAS_ROUTE"
echo "  PM2 is running: $PM2_RUNNING"
echo ""

if [ "$HAS_ENV" = "yes" ] && [ "$HAS_CODE" = "yes" ] && [ "$HAS_ROUTE" = "yes" ] && [ "$PM2_RUNNING" = "yes" ]; then
    echo -e "${YELLOW}⚠ DIAGNOSIS:${NC} Code is correct but not executing"
    echo ""
    echo "Possible causes:"
    echo "  1. Node.js module cache - PM2 needs complete restart"
    echo "  2. Code not deployed - dist/lib may be outdated"
    echo "  3. Different code path - check if another handler is responding"
    echo "  4. Middleware blocking - check auth/permissions"
    echo ""
    echo "Recommended actions:"
    echo "  1. Verify dist/lib has updated code: grep ALLOW_DEBUG_OVERRIDE dist/lib/routes/users/handlers/config-handler.js"
    echo "  2. Force PM2 restart: pm2 delete docutrainio-bot && pm2 start ecosystem.config.js --env production"
    echo "  3. Check API response: curl -H 'Authorization: Bearer TOKEN' https://www.docutrain.io/api/users/config | jq .config.ALLOW_DEBUG_OVERRIDE"
    echo "  4. Check logs after API call: pm2 logs docutrainio-bot --lines 50 --nostream | grep -i 'debug\|middleware\|force'"
else
    echo -e "${RED}✗ DIAGNOSIS:${NC} Missing components"
    if [ "$HAS_ENV" = "no" ]; then
        echo "  - Add ALLOW_DEBUG_OVERRIDE to .env file"
    fi
    if [ "$HAS_CODE" = "no" ]; then
        echo "  - Code file missing or outdated - rebuild and deploy"
    fi
    if [ "$HAS_ROUTE" = "no" ]; then
        echo "  - Route not registered - check lib/routes/users/index.js"
    fi
    if [ "$PM2_RUNNING" = "no" ]; then
        echo "  - PM2 not running - start with: pm2 start ecosystem.config.js --env production"
    fi
fi

echo ""
echo "=========================================="
echo "✅ Debugging complete!"
echo "=========================================="

