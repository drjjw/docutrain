const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔨 Building distribution files...\n');
console.log('⚠️  NOTE: Vanilla JS chat app is deprecated. Building React app + landing page only.\n');

const distDir = path.join(__dirname, 'dist');

// Note: dist/app directory should already exist from `npm run build:app`
// We only create dist if it doesn't exist, but preserve dist/app
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log('✓ Created dist/ directory');
} else {
    console.log('✓ dist/ directory exists (preserving dist/app from React build)');
}

// Create dist/public directory if it doesn't exist
const publicDistDir = path.join(distDir, 'public');
if (!fs.existsSync(publicDistDir)) {
    fs.mkdirSync(publicDistDir, { recursive: true });
    console.log('✓ Created dist/public/ directory');
}

// Create dist/public/css directory (for landing page CSS)
const cssDistDir = path.join(publicDistDir, 'css');
if (!fs.existsSync(cssDistDir)) {
    fs.mkdirSync(cssDistDir);
}

// Generate content hash for a file
function generateHash(content) {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// Copy file with hash and return the hashed filename (without updating content yet)
function copyWithHash(sourcePath, destDir, filename) {
    const content = fs.readFileSync(sourcePath);
    const hash = generateHash(content);
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext);
    const hashedFilename = `${baseName}.${hash}${ext}`;
    
    return { hashedFilename, content, hash };
}

// Process CSS files for landing page (public/index.html still uses some CSS)
const cssFiles = {
    'public/css/landing.css': 'css',
};

const hashedFiles = {};
const fileContents = {};

// Step 1: Process CSS files (for landing page)
console.log('\n📦 Processing CSS files (for landing page):');
Object.keys(cssFiles).forEach(filePath => {
    const sourcePath = path.join(__dirname, filePath);
    const filename = path.basename(filePath);
    const destSubdir = cssFiles[filePath];
    
    if (fs.existsSync(sourcePath)) {
        const { hashedFilename, content } = copyWithHash(sourcePath, null, filename);
        const originalPath = `${destSubdir}/${filename}`;
        const hashedPath = `${destSubdir}/${hashedFilename}`;
        
        hashedFiles[originalPath] = hashedPath;
        fileContents[hashedPath] = content;
        
        console.log(`✓ Hashed ${filename} → ${hashedFilename}`);
    } else {
        console.log(`⚠️  Missing CSS file: ${filePath} (landing page may not work correctly)`);
    }
});

// ⚠️ DEPRECATED: Vanilla JS files are no longer processed
// They have been moved to deprecated/public/js/ and are not used
// The React app (dist/app/) handles all chat functionality
console.log('\n⚠️  Skipping deprecated JS files (vanilla JS chat app is deprecated):');
console.log('   - All chat functionality is now handled by React app at /app/chat');
console.log('   - Deprecated files are archived in deprecated/public/js/');

// Step 2: Update import statements in CSS files (if any)
console.log('\n🔄 Updating import statements in CSS files:');
Object.keys(fileContents).forEach(filePath => {
    if (filePath.endsWith('.css')) {
        let content = fileContents[filePath].toString();
        let updated = false;

        // Replace @import statements
        Object.keys(hashedFiles).forEach(original => {
            const hashed = hashedFiles[original];
            const originalFilename = original.split('/').pop();
            const hashedFilename = hashed.split('/').pop();

            const cssImportPattern = new RegExp(`@import\\s+url\\(['"]?\\.\\/([^'")]+)(\\?[^'"]*)?['"]?\\)`, 'g');

            const newContent = content.replace(cssImportPattern, (match, importPath, queryString) => {
                const importFile = importPath.split('/').pop();
                if (importFile === originalFilename) {
                    updated = true;
                    return match.replace(importFile + (queryString || ''), hashedFilename);
                }
                return match;
            });

            content = newContent;
        });

        fileContents[filePath] = content;
        if (updated) {
            console.log(`✓ Updated imports in ${filePath.split('/').pop()}`);
        }
    }
});

// Step 3: Write all files to disk
console.log('\n💾 Writing files to dist:');
Object.keys(fileContents).forEach(filePath => {
    const destPath = path.join(publicDistDir, filePath);
    const destDir = path.dirname(destPath);
    
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    fs.writeFileSync(destPath, fileContents[filePath]);
    console.log(`✓ Wrote ${filePath}`);
});

// Process HTML files with hashed references
console.log('\n📝 Processing HTML:');

// Process index.html (landing page - still active)
const htmlSourcePath = path.join(__dirname, 'public/index.html');
if (!fs.existsSync(htmlSourcePath)) {
    console.log('⚠️  Warning: public/index.html not found - landing page will not be available');
} else {
    let htmlContent = fs.readFileSync(htmlSourcePath, 'utf8');

    // Replace CSS references (handles query parameters)
    Object.keys(hashedFiles).forEach(original => {
        const hashed = hashedFiles[original];
        // Replace href with optional query parameters
        htmlContent = htmlContent.replace(
            new RegExp(`href="${original}(\\?[^"]*)?"`, 'g'),
            `href="${hashed}"`
        );
    });

    // Copy landing.js if it exists (landing page still needs it for mobile menu, etc.)
    // Use the version from public/js/ instead of deprecated folder
    const landingJsSource = path.join(__dirname, 'public/js/landing.js');
    const landingJsDest = path.join(publicDistDir, 'js/landing.js');
    if (fs.existsSync(landingJsSource)) {
        // Create js directory if it doesn't exist
        const jsDistDir = path.join(publicDistDir, 'js');
        if (!fs.existsSync(jsDistDir)) {
            fs.mkdirSync(jsDistDir, { recursive: true });
        }
        fs.copyFileSync(landingJsSource, landingJsDest);
        console.log('   - Copied landing.js (required for landing page functionality)');
    } else {
        // Remove script tag if landing.js doesn't exist
        htmlContent = htmlContent.replace(/<script src="js\/landing\.js"><\/script>\s*/g, '');
        console.log('   - Removed landing.js script reference (file not found)');
    }

    // Write processed index.html
    const htmlDestPath = path.join(publicDistDir, 'index.html');
    fs.writeFileSync(htmlDestPath, htmlContent);
    console.log('✓ Processed index.html (landing page) with hashed references');
}

// ⚠️ DEPRECATED: chat.html is no longer processed
// It has been moved to deprecated/public/chat.html and is not used
// The /chat route now redirects to /app/chat (React app)
console.log('\n⚠️  Skipping deprecated chat.html:');
console.log('   - chat.html is deprecated and moved to deprecated/public/chat.html');
console.log('   - The /chat route now redirects to /app/chat (React app)');
console.log('   - All chat functionality is handled by React app');

// Copy other required files
console.log('\n📦 Copying other files:');
const otherFiles = [
    { from: 'server.js', to: 'server.js' },
    { from: 'package.json', to: 'package.json' },
    { from: 'package-lock.json', to: 'package-lock.json' },
    { from: 'docutrainio-bot.js', to: 'docutrainio-bot.js' },
    { from: '.htaccess', to: '.htaccess', optional: true }
];

// Create start.sh in dist
const startShContent = `#!/bin/bash
cd /home/docutrainio/public_html
export $(cat .env | grep -v '^#' | xargs)
node server.js
`;
fs.writeFileSync(path.join(distDir, 'start.sh'), startShContent);
fs.chmodSync(path.join(distDir, 'start.sh'), '755');
console.log('✓ Created start.sh');

// PDFs are NOT copied to production (RAG-only mode)
// PDFs remain in development for training/embedding generation only
console.log('\n📄 PDFs excluded from production build (RAG-only mode):');
console.log('   - PDFs remain in development for training/embedding');
console.log('   - Production uses database-stored embeddings only');
console.log('   - ~500MB deployment size saved\n');

// Copy logos and favicon to public directory
console.log('\n🎨 Copying logo and favicon files:');
const logoFiles = [
    { from: 'public/docutrain-logo.svg', to: 'public/docutrain-logo.svg' },
    { from: 'public/docutrain-logo.png', to: 'public/docutrain-logo.png' },
    { from: 'public/docutrain-icon.png', to: 'public/docutrain-icon.png' },
    { from: 'public/logos/maker-logo-trns.png', to: 'public/logos/maker-logo-trns.png' },
    { from: 'public/logos/ukidney-logo.svg', to: 'public/logos/ukidney-logo.svg' },
    { from: 'public/robot-favicon.png', to: 'public/robot-favicon.png' },
    { from: 'public/chat-cover-place.png', to: 'public/chat-cover-place.png' },
    { from: 'app-src/public/chat-cover-place.jpeg', to: 'public/chat-cover-place.jpeg' }
];

// Copy monitoring dashboard
console.log('\n📊 Copying monitoring dashboard:');
const monitorHtmlSource = path.join(__dirname, 'public/monitor.html');
const monitorHtmlDest = path.join(publicDistDir, 'monitor.html');
if (fs.existsSync(monitorHtmlSource)) {
    fs.copyFileSync(monitorHtmlSource, monitorHtmlDest);
    console.log('✓ Copied monitor.html (monitoring dashboard)');
} else {
    console.log('⚠️  Warning: monitor.html not found - monitoring dashboard will not be available');
}

// Copy lib directory (for local embeddings module)
console.log('\n📦 Copying lib directory:');
const libSourceDir = path.join(__dirname, 'lib');
const libDestDir = path.join(distDir, 'lib');
if (fs.existsSync(libSourceDir)) {
    // Function to copy directory recursively
    function copyDirRecursive(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        const entries = fs.readdirSync(src);
        entries.forEach(entry => {
            const srcPath = path.join(src, entry);
            const destPath = path.join(dest, entry);
            const stat = fs.statSync(srcPath);
            if (stat.isDirectory()) {
                copyDirRecursive(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
                console.log(`✓ Copied lib/${path.relative(libSourceDir, srcPath)}`);
            }
        });
    }
    copyDirRecursive(libSourceDir, libDestDir);
} else {
    console.log('⊘ No lib directory found (optional)');
}

let copiedCount = 0;
let skippedCount = 0;

// Copy logo files
logoFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file.from);
    const destPath = path.join(distDir, file.to);

    if (fs.existsSync(sourcePath)) {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        fs.copyFileSync(sourcePath, destPath);
        console.log(`✓ Copied logo ${file.from}`);
        copiedCount++;
    } else {
        console.log(`✗ Missing logo file: ${file.from}`);
        process.exit(1);
    }
});

otherFiles.forEach(file => {
    const sourcePath = path.join(__dirname, file.from);
    const destPath = path.join(distDir, file.to);
    
    if (fs.existsSync(sourcePath)) {
        // Ensure destination directory exists
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        
        // Special handling for server.js: fix paths for dist environment
        if (file.from === 'server.js') {
            let serverContent = fs.readFileSync(sourcePath, 'utf8');
            // Change dist/app paths to app (since server runs from dist/)
            // This handles paths like 'dist/app' and 'dist/app/index.html'
            serverContent = serverContent.replace(/'dist\/app/g, "'app");
            serverContent = serverContent.replace(/"dist\/app/g, '"app');
            fs.writeFileSync(destPath, serverContent);
            console.log(`✓ Copied and patched ${file.from} (fixed paths for dist environment)`);
        } else {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`✓ Copied ${file.from}`);
        }
        copiedCount++;
    } else if (!file.optional) {
        console.log(`✗ Missing required file: ${file.from}`);
        process.exit(1);
    } else {
        console.log(`⊘ Skipped optional file: ${file.from}`);
        skippedCount++;
    }
});

console.log(`\n📦 Build complete!`);
console.log(`   - ${Object.keys(cssFiles).length} CSS file(s) hashed and copied (for landing page)`);
console.log(`   - 1 HTML file processed (landing page)`);
console.log(`   - ${logoFiles.length} logo files copied`);
console.log(`   - ${copiedCount - logoFiles.length} other files copied`);
if (skippedCount > 0) {
    console.log(`   - ${skippedCount} optional files skipped`);
}
console.log(`   - PDFs excluded (RAG-only mode)`);
console.log(`   - React app build preserved in dist/app/`);
console.log(`   - Output: dist/\n`);
console.log('⚠️  DEPRECATED: Vanilla JS chat app files are no longer built');
console.log('   - Deprecated files are archived in deprecated/public/js/');
console.log('   - All chat functionality is handled by React app at /app/chat');
console.log('   - The /chat route redirects to /app/chat\n');
console.log('💡 Note: .env file must be manually copied to server (not included in build)');
console.log('💡 Run "npm install --production" in dist/ on the server');
console.log('💡 Cache busting enabled: File hashes will change when content changes');
console.log('💡 RAG-only: PDFs remain in development for training/embedding only');
console.log('💡 React app available at /app route\n');
