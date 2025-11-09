const fs = require('fs');
const path = require('path');

/**
 * Helper function to extract VITE_MAX_CONVERSATION_LENGTH from frontend bundle
 */
function extractFrontendConfig() {
    try {
        // Determine app directory path
        // From lib/routes/users/utils.js, we need to go up 3 levels to reach root
        // On production: server runs from dist/, so app/ is at root level (dist/app/)
        // On development: server runs from project root/, so app/ is at dist/app/
        const rootDir = path.join(__dirname, '../../../');  // Go up 3 levels to root
        const appDirDirect = path.join(rootDir, 'app');  // Production: dist/app/
        const appDirDist = path.join(rootDir, 'dist/app');  // Development: dist/app/
        
        // Check which path exists (production or development)
        // In production, rootDir is dist/, so appDirDirect = dist/app/
        // In development, rootDir is project root/, so appDirDist = dist/app/
        const appDir = fs.existsSync(appDirDirect) 
            ? appDirDirect  // Production: app/ exists at dist/app/
            : appDirDist;   // Development: dist/app/ exists
        
        // Look for main JavaScript bundle files
        // Vite outputs main-*.js files in assets/ directory
        const possibleFiles = [
            path.join(appDir, 'assets', 'main-*.js'),
            path.join(appDir, 'assets', 'index-*.js'),  // Fallback for other build tools
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
                    // Vite outputs main-*.js files, not index-*.js
                    const jsFiles = files.filter(f => f.endsWith('.js') && (f.startsWith('main-') || f.startsWith('index-')));
                    
                    if (jsFiles.length > 0) {
                        // Read the first (usually only) main bundle file
                        const bundlePath = path.join(assetsDir, jsFiles[0]);
                        const bundleContent = fs.readFileSync(bundlePath, 'utf8');
                        
                        // Search for VITE_MAX_CONVERSATION_LENGTH in the bundle
                        // Vite replaces import.meta.env.VITE_MAX_CONVERSATION_LENGTH with the actual value
                        // In minified code, it becomes: A=parseInt("20",10) or const jj={VITE_MAX_CONVERSATION_LENGTH:"20"}
                        
                        const patterns = [
                            // Pattern 1: Look for VITE_MAX_CONVERSATION_LENGTH:"20" in the env object (most reliable)
                            /VITE_MAX_CONVERSATION_LENGTH\s*:\s*["'](\d+)["']/gi,
                            // Pattern 2: parseInt("20" || '3', 10) where 20 is the VITE value
                            /parseInt\(["'](\d+)["']\s*\|\|\s*["']\d+["'],\s*\d+\)/g,
                            // Pattern 3: MAX_CONVERSATION_LENGTH = parseInt("20", 10)
                            /MAX_CONVERSATION_LENGTH\s*=\s*parseInt\(["'](\d+)["'],\s*\d+\)/gi,
                            // Pattern 4: const MAX_CONVERSATION_LENGTH = parseInt("20" || '3', 10)
                            /const\s+MAX_CONVERSATION_LENGTH\s*=\s*parseInt\(["'](\d+)["']/gi,
                        ];
                        
                        for (let i = 0; i < patterns.length; i++) {
                            const pattern = patterns[i];
                            const matches = Array.from(bundleContent.matchAll(pattern));
                            for (const match of matches) {
                                if (match && match[1]) {
                                    const value = parseInt(match[1], 10);
                                    // Only accept reasonable values (1-1000)
                                    if (value >= 1 && value <= 1000) {
                                        // If we found it in the env object (pattern 0), that's most reliable
                                        if (i === 0) {
                                            viteMaxConversationLength = value;
                                            break;
                                        }
                                        // Otherwise, use the first reasonable value we find
                                        if (!viteMaxConversationLength) {
                                            viteMaxConversationLength = value;
                                        }
                                    }
                                }
                            }
                            if (viteMaxConversationLength) break;
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
                        errorMessage = `No main-*.js or index-*.js files found in ${assetsDir}`;
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

