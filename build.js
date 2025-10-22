const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

console.log('🔨 Building distribution files...\n');

const distDir = path.join(__dirname, 'dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
    console.log('✓ Created dist/ directory');
}

// Create dist/public directory if it doesn't exist
const publicDistDir = path.join(distDir, 'public');
if (!fs.existsSync(publicDistDir)) {
    fs.mkdirSync(publicDistDir, { recursive: true });
    console.log('✓ Created dist/public/ directory');
}

// Create dist/public/css and dist/public/js directories
const cssDistDir = path.join(publicDistDir, 'css');
const jsDistDir = path.join(publicDistDir, 'js');
if (!fs.existsSync(cssDistDir)) {
    fs.mkdirSync(cssDistDir, { recursive: true });
}
if (!fs.existsSync(jsDistDir)) {
    fs.mkdirSync(jsDistDir, { recursive: true });
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

// Process CSS and JS files with hashing
const cssFiles = {
    'public/css/styles.css': 'css',
    'public/css/disclaimer.css': 'css'
};

const jsFiles = {
    'public/js/config.js': 'js',
    'public/js/facts.js': 'js',
    'public/js/api.js': 'js',
    'public/js/ui.js': 'js',
    'public/js/ui-utils.js': 'js',
    'public/js/ui-loading.js': 'js',
    'public/js/ui-downloads.js': 'js',
    'public/js/ui-content-styling.js': 'js',
    'public/js/ui-messages.js': 'js',
    'public/js/ui-document.js': 'js',
    'public/js/chat.js': 'js',
    'public/js/rating.js': 'js',
    'public/js/disclaimer.js': 'js',
    'public/js/pubmed-api.js': 'js',
    'public/js/pubmed-popup.js': 'js',
    'public/js/document-selector.js': 'js',
    'public/js/ai-hint.js': 'js',
    'public/js/main.js': 'js'
};

const hashedFiles = {};
const fileContents = {};

// Step 1: Read all files and generate hashes
console.log('\n📦 Processing CSS files:');
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
        console.log(`✗ Missing required file: ${filePath}`);
        process.exit(1);
    }
});

console.log('\n📦 Processing JS files:');
Object.keys(jsFiles).forEach(filePath => {
    const sourcePath = path.join(__dirname, filePath);
    const filename = path.basename(filePath);
    const destSubdir = jsFiles[filePath];
    
    if (fs.existsSync(sourcePath)) {
        const { hashedFilename, content } = copyWithHash(sourcePath, null, filename);
        const originalPath = `${destSubdir}/${filename}`;
        const hashedPath = `${destSubdir}/${hashedFilename}`;
        
        hashedFiles[originalPath] = hashedPath;
        fileContents[hashedPath] = content;
        
        console.log(`✓ Hashed ${filename} → ${hashedFilename}`);
    } else {
        console.log(`✗ Missing required file: ${filePath}`);
        process.exit(1);
    }
});

// Step 2: Update import statements in JS files
console.log('\n🔄 Updating import statements in JS files:');
Object.keys(fileContents).forEach(filePath => {
    if (filePath.endsWith('.js')) {
        let content = fileContents[filePath].toString();
        let updated = false;
        
        // Replace import statements
        Object.keys(hashedFiles).forEach(original => {
            const hashed = hashedFiles[original];
            const originalFilename = original.split('/').pop();
            const hashedFilename = hashed.split('/').pop();
            
            // Update import statements: from './config.js?v=xxx' to './config.77794265.js'
            // Pattern matches: from './config.js' OR from './config.js?v=xxx'
            const importPattern = new RegExp(`from\\s+['"]\\.\\/([^'"?]+)(\\?[^'"]*)?['"]`, 'g');
            // Also update dynamic imports: import('./config.js?v=xxx') to import('./config.77794265.js')
            const dynamicImportPattern = new RegExp(`import\\(\\s*['"]\\.\\/([^'"?]+)(\\?[^'"]*)?['"]`, 'g');
            
            // Update static imports
            const newContent = content.replace(importPattern, (match, importPath, queryString) => {
                const importFile = importPath.split('/').pop();
                if (importFile === originalFilename) {
                    updated = true;
                    // Replace the entire filename (with or without query string) with hashed version
                    return match.replace(importFile + (queryString || ''), hashedFilename);
                }
                return match;
            });

            // Update dynamic imports
            const newContent2 = newContent.replace(dynamicImportPattern, (match, importPath, queryString) => {
                const importFile = importPath.split('/').pop();
                if (importFile === originalFilename) {
                    updated = true;
                    // Replace the entire filename (with or without query string) with hashed version
                    return match.replace(importFile + (queryString || ''), hashedFilename);
                }
                return match;
            });

            content = newContent2;
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

// Process index.html with hashed references
console.log('\n📝 Processing HTML:');
const htmlSourcePath = path.join(__dirname, 'public/index.html');
let htmlContent = fs.readFileSync(htmlSourcePath, 'utf8');

// Replace CSS and JS references (handles query parameters)
Object.keys(hashedFiles).forEach(original => {
    const hashed = hashedFiles[original];
    // Replace href with optional query parameters
    htmlContent = htmlContent.replace(
        new RegExp(`href="${original}(\\?[^"]*)?"`, 'g'),
        `href="${hashed}"`
    );
    // Replace src with optional query parameters
    htmlContent = htmlContent.replace(
        new RegExp(`src="${original}(\\?[^"]*)?"`, 'g'),
        `src="${hashed}"`
    );
});

// Write processed HTML
const htmlDestPath = path.join(publicDistDir, 'index.html');
fs.writeFileSync(htmlDestPath, htmlContent);
console.log('✓ Processed index.html with hashed references');

// Copy other required files
console.log('\n📦 Copying other files:');
const otherFiles = [
    { from: 'server.js', to: 'server.js' },
    { from: 'package.json', to: 'package.json' },
    { from: 'package-lock.json', to: 'package-lock.json' },
    { from: 'ecosystem.config.js', to: 'ecosystem.config.js' },
    { from: '.htaccess', to: '.htaccess', optional: true }
];

// PDFs are NOT copied to production (RAG-only mode)
// PDFs remain in development for training/embedding generation only
console.log('\n📄 PDFs excluded from production build (RAG-only mode):');
console.log('   - PDFs remain in development for training/embedding');
console.log('   - Production uses database-stored embeddings only');
console.log('   - ~500MB deployment size saved\n');

// Copy logos to public directory
console.log('\n🎨 Copying logo files:');
const logoFiles = [
    { from: 'public/logos/maker-logo-trns.png', to: 'public/logos/maker-logo-trns.png' },
    { from: 'public/logos/ukidney-logo.svg', to: 'public/logos/ukidney-logo.svg' }
];

// Copy lib directory (for local embeddings module)
console.log('\n📦 Copying lib directory:');
const libSourceDir = path.join(__dirname, 'lib');
const libDestDir = path.join(distDir, 'lib');
if (fs.existsSync(libSourceDir)) {
    if (!fs.existsSync(libDestDir)) {
        fs.mkdirSync(libDestDir, { recursive: true });
    }
    const libFiles = fs.readdirSync(libSourceDir);
    libFiles.forEach(file => {
        const sourcePath = path.join(libSourceDir, file);
        const destPath = path.join(libDestDir, file);
        if (fs.statSync(sourcePath).isFile()) {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`✓ Copied lib/${file}`);
        }
    });
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
        
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✓ Copied ${file.from}`);
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
console.log(`   - ${Object.keys(cssFiles).length} CSS files hashed and copied`);
console.log(`   - ${Object.keys(jsFiles).length} JS files hashed and copied`);
console.log(`   - 1 HTML file processed with hashed references`);
console.log(`   - ${logoFiles.length} logo files copied`);
console.log(`   - ${copiedCount - logoFiles.length} other files copied`);
if (skippedCount > 0) {
    console.log(`   - ${skippedCount} optional files skipped`);
}
console.log(`   - PDFs excluded (RAG-only mode)`);
console.log(`   - Output: dist/\n`);
console.log('💡 Note: .env file must be manually copied to server (not included in build)');
console.log('💡 Run "npm install --production" in dist/ on the server');
console.log('💡 Cache busting enabled: File hashes will change when content changes');
console.log('💡 RAG-only: PDFs remain in development for training/embedding only\n');
