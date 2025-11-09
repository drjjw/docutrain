# Test the actual config handler function directly
# This simulates what happens when the API is called

cd /home/docutrainio/public_html

node -e "
require('dotenv').config();

// Simulate the exact code from config-handler.js
const config = {
    DEBUG: process.env.DEBUG === 'true',
    ALLOW_DEBUG_OVERRIDE: (process.env.ALLOW_DEBUG_OVERRIDE === undefined || 
                           process.env.ALLOW_DEBUG_OVERRIDE === null || 
                           process.env.ALLOW_DEBUG_OVERRIDE === '') 
        ? true 
        : (process.env.ALLOW_DEBUG_OVERRIDE !== 'false'),
};

console.log('=== Full Config Object ===');
console.log(JSON.stringify(config, null, 2));
console.log('');
console.log('=== Property Check ===');
console.log('ALLOW_DEBUG_OVERRIDE value:', config.ALLOW_DEBUG_OVERRIDE);
console.log('ALLOW_DEBUG_OVERRIDE type:', typeof config.ALLOW_DEBUG_OVERRIDE);
console.log('Has property:', 'ALLOW_DEBUG_OVERRIDE' in config);
console.log('Is undefined:', config.ALLOW_DEBUG_OVERRIDE === undefined);
console.log('Is null:', config.ALLOW_DEBUG_OVERRIDE === null);
"

