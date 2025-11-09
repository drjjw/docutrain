const fs = require('fs');
const path = require('path');

/**
 * Helper function to extract VITE_MAX_CONVERSATION_LENGTH from frontend bundle
 */
function extractFrontendConfig() {
    try {
        const isDist = __dirname.endsWith('/dist');
        // Determine app directory path
        const appDir = isDist 
            ? path.join(__dirname, 'app')  // Running from dist/lib/routes/users.js -> dist/app
            : path.join(__dirname, '../../dist/app');  // Running from lib/routes/users.js -> dist/app
        
        // Look for main JavaScript bundle files
        const possibleFiles = [
            path.join(appDir, 'assets', 'index-*.js'),
            path.join(appDir, 'index-*.js'),
        ];
        
        // Try to find and read the actual bundle file
        let viteMaxConversationLength = null;
        let errorMessage = null;
        
        try {
            // Check if app directory exists
            if (!fs.existsSync(appDir)) {
                errorMessage = `Frontend build not found at ${appDir}`;
            } else {
                // Look for JavaScript files in assets directory
                const assetsDir = path.join(appDir, 'assets');
                if (fs.existsSync(assetsDir)) {
                    const files = fs.readdirSync(assetsDir);
                    const jsFiles = files.filter(f => f.endsWith('.js') && f.startsWith('index-'));
                    
                    if (jsFiles.length > 0) {
                        // Read the first (usually only) index file
                        const bundlePath = path.join(assetsDir, jsFiles[0]);
                        const bundleContent = fs.readFileSync(bundlePath, 'utf8');
                        
                        // Search for VITE_MAX_CONVERSATION_LENGTH in the bundle
                        // Vite replaces import.meta.env.VITE_MAX_CONVERSATION_LENGTH with the actual value
                        // The code becomes: const MAX_CONVERSATION_LENGTH = parseInt("20" || '3', 10);
                        // Or: const MAX_CONVERSATION_LENGTH = parseInt(import.meta.env.VITE_MAX_CONVERSATION_LENGTH || '3', 10);
                        // But Vite replaces it, so we look for the actual value in context
                        
                        const patterns = [
                            // Pattern 1: parseInt("20" || '3', 10) where 20 is the VITE value
                            /parseInt\(["'](\d+)["']\s*\|\|\s*["']\d+["'],\s*\d+\)/,
                            // Pattern 2: parseInt(import\.meta\.env\.VITE_MAX_CONVERSATION_LENGTH || '3', 10) - if not replaced
                            /VITE_MAX_CONVERSATION_LENGTH.*?parseInt\([^,]*\|\|\s*["'](\d+)["']/i,
                            // Pattern 3: MAX_CONVERSATION_LENGTH = parseInt("20", 10) or parseInt('20', 10)
                            /MAX_CONVERSATION_LENGTH\s*=\s*parseInt\(["'](\d+)["'],\s*\d+\)/i,
                            // Pattern 4: const MAX_CONVERSATION_LENGTH = parseInt("20" || '3', 10)
                            /const\s+MAX_CONVERSATION_LENGTH\s*=\s*parseInt\(["'](\d+)["']/i,
                            // Pattern 5: MAX_CONVERSATION_LENGTH.*parseInt.*["'](\d+)["']
                            /MAX_CONVERSATION_LENGTH[^=]*=\s*parseInt\([^,]*["'](\d+)["']/i,
                        ];
                        
                        for (const pattern of patterns) {
                            const match = bundleContent.match(pattern);
                            if (match && match[1]) {
                                const value = parseInt(match[1], 10);
                                // Only accept reasonable values (1-1000)
                                if (value >= 1 && value <= 1000) {
                                    viteMaxConversationLength = value;
                                    break;
                                }
                            }
                        }
                        
                        // Fallback: look for the value directly near "MAX_CONVERSATION_LENGTH" followed by a number
                        if (!viteMaxConversationLength) {
                            const maxLengthMatch = bundleContent.match(/MAX_CONVERSATION_LENGTH[^=]*=\s*parseInt\([^)]*\)/i);
                            if (maxLengthMatch) {
                                const numberMatch = maxLengthMatch[0].match(/(\d+)/);
                                if (numberMatch && numberMatch[1]) {
                                    const value = parseInt(numberMatch[1], 10);
                                    if (value >= 1 && value <= 1000) {
                                        viteMaxConversationLength = value;
                                    }
                                }
                            }
                        }
                        
                        if (!viteMaxConversationLength) {
                            errorMessage = `Found bundle but could not extract VITE_MAX_CONVERSATION_LENGTH from ${jsFiles[0]}`;
                        }
                    } else {
                        errorMessage = `No index-*.js files found in ${assetsDir}`;
                    }
                } else {
                    errorMessage = `Assets directory not found at ${assetsDir}`;
                }
            }
        } catch (err) {
            errorMessage = `Error reading frontend bundle: ${err.message}`;
        }
        
        return {
            value: viteMaxConversationLength,
            error: errorMessage,
            bundlePath: appDir
        };
    } catch (error) {
        return {
            value: null,
            error: `Failed to extract frontend config: ${error.message}`,
            bundlePath: null
        };
    }
}

module.exports = { extractFrontendConfig };

