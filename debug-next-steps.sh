# Next debugging steps - run these on production:

# 1. Test if Node.js can read the env var
node -e "require('dotenv').config(); console.log('ALLOW_DEBUG_OVERRIDE:', process.env.ALLOW_DEBUG_OVERRIDE); console.log('Type:', typeof process.env.ALLOW_DEBUG_OVERRIDE);"

# 2. Test the exact config calculation
node -e "
require('dotenv').config();
const value = process.env.ALLOW_DEBUG_OVERRIDE;
console.log('Raw value:', value === undefined ? 'undefined' : value);
const result = (value === undefined || value === null || value === '') ? true : (value !== 'false');
console.log('Computed result:', result);
console.log('Result type:', typeof result);
const config = { ALLOW_DEBUG_OVERRIDE: result };
console.log('Config object:', JSON.stringify(config));
"

# 3. Check if the code file has the updated code
grep -A 5 "ALLOW_DEBUG_OVERRIDE" lib/routes/users/handlers/config-handler.js

# 4. Check PM2 status and restart if needed
pm2 status
pm2 restart docutrainio-bot

# 5. After restart, check logs
pm2 logs docutrainio-bot --lines 20 --nostream

# 6. Test the API endpoint (if you have auth token)
# curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3458/api/users/config | jq '.config.ALLOW_DEBUG_OVERRIDE'

