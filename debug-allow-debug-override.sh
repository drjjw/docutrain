#!/bin/bash
# Debug script for ALLOW_DEBUG_OVERRIDE issue in production

echo "=========================================="
echo "🔍 Debugging ALLOW_DEBUG_OVERRIDE"
echo "=========================================="
echo ""

# 1. Check if .env file exists and contains the variable
echo "1️⃣  Checking .env file:"
echo "----------------------------------------"
cd /home/docutrainio/public_html
if [ -f .env ]; then
    echo "✓ .env file exists"
    if grep -q "ALLOW_DEBUG_OVERRIDE" .env; then
        echo "✓ ALLOW_DEBUG_OVERRIDE found in .env:"
        grep "ALLOW_DEBUG_OVERRIDE" .env
    else
        echo "✗ ALLOW_DEBUG_OVERRIDE NOT found in .env"
        echo "  Add it with: echo 'ALLOW_DEBUG_OVERRIDE=true' >> .env"
    fi
else
    echo "✗ .env file not found!"
fi
echo ""

# 2. Test if Node.js can read the env var
echo "2️⃣  Testing if Node.js can read ALLOW_DEBUG_OVERRIDE:"
echo "----------------------------------------"
node -e "
require('dotenv').config();
const value = process.env.ALLOW_DEBUG_OVERRIDE;
console.log('Value:', value === undefined ? 'undefined' : value);
console.log('Type:', typeof value);
const result = (value === undefined || value === null || value === '') 
    ? true 
    : (value !== 'false');
console.log('Computed result:', result);
console.log('Result type:', typeof result);
"
echo ""

# 3. Check PM2 environment variables
echo "3️⃣  Checking PM2 environment variables:"
echo "----------------------------------------"
pm2 describe docutrainio-bot | grep -A 20 "env:"
echo ""

# 4. Check if the code file has the property
echo "4️⃣  Checking config-handler.js code:"
echo "----------------------------------------"
if grep -q "ALLOW_DEBUG_OVERRIDE" lib/routes/users/handlers/config-handler.js; then
    echo "✓ ALLOW_DEBUG_OVERRIDE found in config-handler.js"
    echo "  Showing relevant lines:"
    grep -A 5 "ALLOW_DEBUG_OVERRIDE" lib/routes/users/handlers/config-handler.js
else
    echo "✗ ALLOW_DEBUG_OVERRIDE NOT found in config-handler.js"
fi
echo ""

# 5. Test the API endpoint directly
echo "5️⃣  Testing /api/users/config endpoint:"
echo "----------------------------------------"
echo "Note: This requires authentication. Testing structure only..."
curl -s http://localhost:3458/api/users/config 2>&1 | head -20
echo ""

# 6. Check PM2 logs for any errors
echo "6️⃣  Checking recent PM2 logs for config-handler:"
echo "----------------------------------------"
pm2 logs docutrainio-bot --lines 50 --nostream | grep -i "config\|ALLOW_DEBUG" || echo "No relevant logs found"
echo ""

# 7. Verify the property is in the config object
echo "7️⃣  Testing config object creation:"
echo "----------------------------------------"
node -e "
require('dotenv').config();
const config = {
    DEBUG: process.env.DEBUG === 'true',
    ALLOW_DEBUG_OVERRIDE: (process.env.ALLOW_DEBUG_OVERRIDE === undefined || 
                           process.env.ALLOW_DEBUG_OVERRIDE === null || 
                           process.env.ALLOW_DEBUG_OVERRIDE === '') 
        ? true 
        : (process.env.ALLOW_DEBUG_OVERRIDE !== 'false'),
};
console.log('Config object:');
console.log(JSON.stringify(config, null, 2));
console.log('');
console.log('ALLOW_DEBUG_OVERRIDE value:', config.ALLOW_DEBUG_OVERRIDE);
console.log('ALLOW_DEBUG_OVERRIDE type:', typeof config.ALLOW_DEBUG_OVERRIDE);
"
echo ""

# 8. Check PM2 restart status
echo "8️⃣  PM2 Status:"
echo "----------------------------------------"
pm2 status
echo ""

echo "=========================================="
echo "✅ Debugging complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. If ALLOW_DEBUG_OVERRIDE is missing from .env, add it:"
echo "   echo 'ALLOW_DEBUG_OVERRIDE=true' >> /home/docutrainio/public_html/.env"
echo ""
echo "2. Restart PM2 to pick up changes:"
echo "   pm2 restart docutrainio-bot"
echo ""
echo "3. Check Mission Control again after restart"

