# Debug script to test the actual config handler function
# Run this on production to see what the API actually returns

node -e "
const path = require('path');
process.chdir('/home/docutrainio/public_html');
require('dotenv').config();

// Simulate what the config handler does
const config = {
    DEBUG: process.env.DEBUG === 'true',
    ALLOW_DEBUG_OVERRIDE: (process.env.ALLOW_DEBUG_OVERRIDE === undefined || 
                           process.env.ALLOW_DEBUG_OVERRIDE === null || 
                           process.env.ALLOW_DEBUG_OVERRIDE === '') 
        ? true 
        : (process.env.ALLOW_DEBUG_OVERRIDE !== 'false'),
};

console.log('=== Config Object ===');
console.log(JSON.stringify(config, null, 2));
console.log('');
console.log('=== Individual Properties ===');
console.log('DEBUG:', config.DEBUG, typeof config.DEBUG);
console.log('ALLOW_DEBUG_OVERRIDE:', config.ALLOW_DEBUG_OVERRIDE, typeof config.ALLOW_DEBUG_OVERRIDE);
console.log('');
console.log('=== Has Property Check ===');
console.log('Has ALLOW_DEBUG_OVERRIDE:', 'ALLOW_DEBUG_OVERRIDE' in config);
console.log('Value is undefined:', config.ALLOW_DEBUG_OVERRIDE === undefined);
console.log('Value is null:', config.ALLOW_DEBUG_OVERRIDE === null);
"

