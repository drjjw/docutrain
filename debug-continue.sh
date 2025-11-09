# Continue debugging - verify code is deployed and restart PM2

# 1. Check if the code file has the updated ALLOW_DEBUG_OVERRIDE code
echo "Checking config-handler.js code:"
grep -A 5 "ALLOW_DEBUG_OVERRIDE" lib/routes/users/handlers/config-handler.js

# 2. Check if dist folder has it (if using dist)
echo ""
echo "Checking dist/config-handler.js code:"
grep -A 5 "ALLOW_DEBUG_OVERRIDE" dist/lib/routes/users/handlers/config-handler.js 2>/dev/null || echo "dist folder not found or doesn't have the file"

# 3. Test the actual config handler function
echo ""
echo "Testing config handler function:"
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
console.log('Full config object:');
console.log(JSON.stringify(config, null, 2));
console.log('');
console.log('ALLOW_DEBUG_OVERRIDE specifically:', config.ALLOW_DEBUG_OVERRIDE);
console.log('Type:', typeof config.ALLOW_DEBUG_OVERRIDE);
"

# 4. Restart PM2
echo ""
echo "Restarting PM2..."
pm2 restart docutrainio-bot

# 5. Wait a moment and check logs
echo ""
echo "Waiting 3 seconds for server to start..."
sleep 3
pm2 logs docutrainio-bot --lines 30 --nostream | tail -20

# 6. Check PM2 status
echo ""
echo "PM2 Status:"
pm2 status

