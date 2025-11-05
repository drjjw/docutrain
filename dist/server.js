const express = require('express');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Import modules
const { setupMiddleware } = require('./lib/middleware');
const { escapeHtml } = require('./lib/utils');
const { createChatRouter } = require('./lib/routes/chat');
const { createDocumentsRouter } = require('./lib/routes/documents');
const { createHealthRouter } = require('./lib/routes/health');
const { createRatingRouter } = require('./lib/routes/rating');
const { createCacheRouter } = require('./lib/routes/cache');
const { createAuthRouter } = require('./lib/routes/auth');
const { createPermissionsRouter } = require('./lib/routes/permissions');
const { createUsersRouter } = require('./lib/routes/users');
const { createProcessingRouter } = require('./lib/routes/processing');
const { createContactRouter } = require('./lib/routes/contact');
const { createMonitoringRouter } = require('./lib/routes/monitoring');
const rag = require('./lib/rag');

const app = express();
const PORT = process.env.PORT || 3458;

// Graceful shutdown handling
let server;
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  if (server) {
    server.close((err) => {
      if (err) {
        console.error('Error during server close:', err);
        process.exit(1);
      }

      console.log('✓ HTTP server closed gracefully');
      console.log('✓ All connections drained');

      // Close any database connections or cleanup here if needed
      console.log('✓ Cleanup complete. Exiting...');
      process.exit(0);
    });

    // Force shutdown after 30 seconds if graceful shutdown takes too long
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after 30 seconds');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Trust proxy (so Express can properly detect HTTPS from X-Forwarded headers)
app.set('trust proxy', true);

// Apply middleware
const middleware = setupMiddleware();
middleware.forEach(mw => app.use(mw));

// Initialize AI clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const xai = new OpenAI({
    apiKey: process.env.XAI_API_KEY,
    baseURL: 'https://api.x.ai/v1'
});

// Initialize OpenAI client for embeddings (RAG)
let openaiClient = null;
if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✓ OpenAI client initialized for RAG embeddings');
} else {
    console.warn('⚠️  OPENAI_API_KEY not found - OpenAI RAG mode will not work');
}

// Initialize local embeddings
const { generateLocalEmbedding, initializeModel: initLocalModel, getModelInfo } = require('./lib/local-embeddings');

let localEmbeddingsReady = false;

// Lazy-load local embedding model
async function ensureLocalEmbeddings() {
    if (!localEmbeddingsReady) {
        try {
            await initLocalModel();
            localEmbeddingsReady = true;
            const info = getModelInfo();
            console.log(`✓ Local embeddings ready: ${info.name} (${info.dimensions}D)`);
        } catch (error) {
            console.error('⚠️  Failed to initialize local embeddings:', error.message);
            throw error;
        }
    }
}

// Initialize Supabase client
// Use service role key for server-side operations to bypass RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseKeyType = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON';
const supabase = createClient(
    process.env.SUPABASE_URL,
    supabaseKey
);
console.log(`✓ Supabase client initialized with ${supabaseKeyType} key`);
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set - using ANON key (RLS policies will apply)');
}

// Initialize document registry
const documentRegistry = require('./lib/document-registry');

// Initialize embedding cache
const embeddingCache = require('./lib/embedding-cache');
const { initializeCacheCleanup } = embeddingCache;

// Track registry loading status
let documentRegistryLoaded = false;
let activeDocumentSlugs = [];

// Registry state object (shared with routes)
const registryState = {
    documentRegistryLoaded: false,
    activeDocumentSlugs: []
};

// Auto-refresh document registry every 2 minutes
function initializeRegistryAutoRefresh() {
    const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
    
    setInterval(async () => {
        try {
            console.log('🔄 Auto-refreshing document registry...');
            await documentRegistry.refreshRegistry();
            activeDocumentSlugs = await documentRegistry.getActiveSlugs();
            registryState.activeDocumentSlugs = activeDocumentSlugs;
            console.log(`✓ Registry auto-refreshed: ${activeDocumentSlugs.length} active documents`);
        } catch (error) {
            console.error('❌ Auto-refresh failed:', error.message);
        }
    }, REFRESH_INTERVAL);
    
    console.log(`✓ Registry auto-refresh enabled (every ${REFRESH_INTERVAL / 1000}s)`);
}

// Create dependencies object for routes
const routeDependencies = {
    supabase,
    documentRegistry,
    rag,
    localEmbeddings: {
        ensureLocalEmbeddings,
        generateLocalEmbedding
    },
    embeddingCache,
    clients: {
        genAI,
        xai,
        openai: openaiClient
    }
};

// Register routes
app.use('/api/auth', createAuthRouter(supabase));
app.use('/api/permissions', createPermissionsRouter(supabase));
app.use('/api/users', createUsersRouter());

// Apply extended timeout for processing routes (large file uploads)
// Note: Server timeout is set globally below in server.listen()
const processingRouter = createProcessingRouter(supabase, openaiClient);
app.use('/api', processingRouter);

app.use('/api', createChatRouter(routeDependencies));
app.use('/api', createRatingRouter(supabase));
app.use('/api', createCacheRouter(embeddingCache));
app.use('/api', createHealthRouter(supabase, documentRegistry, registryState));
app.use('/api', createContactRouter());
app.use('/api/monitoring', createMonitoringRouter(supabase));

// Global error handler for API routes
app.use('/api', (err, req, res, next) => {
    console.error('❌ API Error:', err);
    console.error('   Path:', req.path);
    console.error('   Method:', req.method);
    console.error('   Stack:', err.stack);
    res.status(500).json({ 
        success: false, 
        error: err.message || 'Internal server error' 
    });
});

// Helper function to convert relative URLs to absolute URLs
function ensureAbsoluteUrl(url, protocol, host) {
    if (!url) return null;
    
    // If already absolute (starts with http:// or https://), return as-is
    if (/^https?:\/\//i.test(url)) {
        return url;
    }
    
    // If relative, make absolute
    // Remove leading slash if present to avoid double slashes
    const cleanPath = url.startsWith('/') ? url : `/${url}`;
    return `${protocol}://${host}${cleanPath}`;
}

// Helper function to update or insert meta tag
function updateOrInsertMetaTag(html, attr, attrValue, content, insertAfter = null) {
    const selector = `meta[${attr}="${attrValue}"]`;
    const regex = new RegExp(`<meta ${attr}="${attrValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" content=".*?"\\s*\\/?>`, 'i');
    
    if (html.match(regex)) {
        // Update existing tag
        return html.replace(regex, `<meta ${attr}="${attrValue}" content="${content}">`);
    } else {
        // Insert new tag
        if (insertAfter) {
            const insertAfterRegex = new RegExp(`(${insertAfter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
            if (html.match(insertAfterRegex)) {
                return html.replace(insertAfterRegex, `$1\n    <meta ${attr}="${attrValue}" content="${content}">`);
            }
        }
        // Fallback: insert before closing </head>
        return html.replace(/<\/head>/i, `    <meta ${attr}="${attrValue}" content="${content}">\n</head>`);
    }
}

// Helper function to generate structured data (JSON-LD) for documents
function generateDocumentStructuredData(docConfigs, url, baseUrl) {
    const isMultiDoc = docConfigs.length > 1;
    
    if (isMultiDoc) {
        // For multiple documents, create a collection
        return {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": docConfigs.map(c => c.title).join(' + '),
            "description": `Multi-document search across ${docConfigs.length} documents`,
            "url": url,
            "mainEntity": docConfigs.map(config => ({
                "@type": "DigitalDocument",
                "name": config.title,
                "description": config.subtitle || config.welcome_message || "AI-powered document assistant",
                "encodingFormat": "application/pdf",
                "inLanguage": "en-US"
            }))
        };
    } else {
        // Single document
        const config = docConfigs[0];
        return {
            "@context": "https://schema.org",
            "@type": "DigitalDocument",
            "name": config.title,
            "description": config.subtitle || config.welcome_message || "AI-powered document assistant",
            "url": url,
            "encodingFormat": "application/pdf",
            "inLanguage": "en-US",
            "isPartOf": {
                "@type": "WebApplication",
                "name": "DocuTrain",
                "url": baseUrl
            }
        };
    }
}

// Helper function to update or insert structured data script tag
function updateOrInsertStructuredData(html, structuredData) {
    const jsonLd = JSON.stringify(structuredData, null, 2);
    const scriptTag = `<script type="application/ld+json">\n    ${jsonLd.split('\n').join('\n    ')}\n    </script>`;
    
    // Check if structured data already exists
    const existingRegex = /<script type="application\/ld\+json">[\s\S]*?<\/script>/i;
    if (html.match(existingRegex)) {
        // Replace existing structured data
        return html.replace(existingRegex, scriptTag);
    } else {
        // Insert before closing </head>
        return html.replace(/<\/head>/i, `    ${scriptTag}\n</head>`);
    }
}

// Helper function to serve React app index.html with dynamic meta tags
async function serveReactAppWithMetaTags(req, res) {
    try {
        const indexPath = path.join(__dirname, 'app/index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // Hardcode to production URL base
        const canonicalBaseUrl = 'https://www.docutrain.io';
        
        // Always set og:url and canonical for the base page (even without doc param)
        const currentUrl = `${canonicalBaseUrl}${req.originalUrl}`;
        const escapedCurrentUrl = escapeHtml(currentUrl);
        
        // Convert default image to absolute URL
        const defaultOgImage = ensureAbsoluteUrl('/chat-cover-place.jpeg', 'https', 'www.docutrain.io');
        const escapedDefaultOgImage = defaultOgImage ? escapeHtml(defaultOgImage) : '';
        
        // Update og:url and canonical for base page
        html = updateOrInsertMetaTag(html, 'property', 'og:url', escapedCurrentUrl);
        // Always replace canonical URL - handle both empty href="" and any existing href
        html = html.replace(
            /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
            `<link rel="canonical" href="${escapedCurrentUrl}">`
        );
        // If no canonical tag exists at all, insert it
        if (!html.includes('<link rel="canonical"')) {
            html = html.replace(
                /<\/head>/i,
                `    <link rel="canonical" href="${escapedCurrentUrl}">\n</head>`
            );
        }
        
        // Update default og:image URLs to absolute (if no doc param, this will be used)
        if (escapedDefaultOgImage) {
            html = updateOrInsertMetaTag(html, 'property', 'og:image', escapedDefaultOgImage);
            html = updateOrInsertMetaTag(html, 'property', 'og:image:secure_url', escapedDefaultOgImage);
            html = updateOrInsertMetaTag(html, 'name', 'twitter:image', escapedDefaultOgImage);
        }
        
        // Check if doc parameter is provided
        const docParam = req.query.doc;
        
        console.log(`📄 Serving React app - URL: ${req.originalUrl}, doc param: ${docParam || 'none'}`);
        
        if (docParam) {
            // Parse multiple documents (support for + separator)
            const docSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);
            
            if (docSlugs.length > 0) {
                // Fetch document configs
                const docConfigs = await Promise.all(
                    docSlugs.map(slug => documentRegistry.getDocumentBySlug(slug))
                );
                
                // Filter out null results
                const validConfigs = docConfigs.filter(c => c !== null);
                
                console.log(`📄 Found ${validConfigs.length} valid config(s) for ${docSlugs.length} slug(s)`);
                
                if (validConfigs.length > 0) {
                    // Build title and description
                    const isMultiDoc = validConfigs.length > 1;
                    const combinedTitle = validConfigs.map(c => c.title).join(' + ');
                    const metaDescription = isMultiDoc 
                        ? `Multi-document search across ${validConfigs.length} documents: ${combinedTitle}`
                        : (validConfigs[0].subtitle || validConfigs[0].welcome_message || 'AI-powered document assistant');
                    
                    // Escape HTML to prevent XSS
                    const escapedTitle = escapeHtml(combinedTitle);
                    const escapedDescription = escapeHtml(metaDescription);
                    
                    // Get the current URL for og:url and canonical
                    const url = `${canonicalBaseUrl}${req.originalUrl}`;
                    const escapedUrl = escapeHtml(url);
                    
                    // Get cover image if available (for og:image)
                    // Convert to absolute URL if needed
                    const coverImage = validConfigs[0].cover || null;
                    const ogImage = coverImage ? ensureAbsoluteUrl(coverImage, 'https', 'www.docutrain.io') : ensureAbsoluteUrl('/chat-cover-place.jpeg', 'https', 'www.docutrain.io');
                    const escapedOgImage = ogImage ? escapeHtml(ogImage) : '';
                    
                    // Replace title
                    html = html.replace(
                        /<title>.*?<\/title>/,
                        `<title>${escapedTitle}</title>`
                    );
                    
                    // Update description
                    html = updateOrInsertMetaTag(html, 'name', 'description', escapedDescription);
                    
                    // Update Open Graph tags
                    html = updateOrInsertMetaTag(html, 'property', 'og:type', 'website');
                    html = updateOrInsertMetaTag(html, 'property', 'og:title', escapedTitle);
                    html = updateOrInsertMetaTag(html, 'property', 'og:description', escapedDescription);
                    html = updateOrInsertMetaTag(html, 'property', 'og:url', escapedUrl, '<meta property="og:description"');
                    html = updateOrInsertMetaTag(html, 'property', 'og:site_name', 'DocuTrain', '<meta property="og:url"');
                    html = updateOrInsertMetaTag(html, 'property', 'og:locale', 'en_US', '<meta property="og:site_name"');
                    
                    // Update og:image with all related tags
                    if (escapedOgImage) {
                        html = updateOrInsertMetaTag(html, 'property', 'og:image', escapedOgImage, '<meta property="og:locale"');
                        html = updateOrInsertMetaTag(html, 'property', 'og:image:secure_url', escapedOgImage, '<meta property="og:image"');
                        html = updateOrInsertMetaTag(html, 'property', 'og:image:type', 'image/jpeg', '<meta property="og:image:secure_url"');
                        html = updateOrInsertMetaTag(html, 'property', 'og:image:width', '1200', '<meta property="og:image:type"');
                        html = updateOrInsertMetaTag(html, 'property', 'og:image:height', '630', '<meta property="og:image:width"');
                        html = updateOrInsertMetaTag(html, 'property', 'og:image:alt', escapedTitle, '<meta property="og:image:height"');
                    }
                    
                    // Update Twitter Card tags
                    html = updateOrInsertMetaTag(html, 'name', 'twitter:card', 'summary_large_image');
                    html = updateOrInsertMetaTag(html, 'name', 'twitter:title', escapedTitle, '<meta name="twitter:card"');
                    html = updateOrInsertMetaTag(html, 'name', 'twitter:description', escapedDescription, '<meta name="twitter:title"');
                    html = updateOrInsertMetaTag(html, 'name', 'twitter:site', '@DocuTrain', '<meta name="twitter:description"');
                    if (escapedOgImage) {
                        html = updateOrInsertMetaTag(html, 'name', 'twitter:image', escapedOgImage, '<meta name="twitter:site"');
                        html = updateOrInsertMetaTag(html, 'name', 'twitter:image:alt', escapedTitle, '<meta name="twitter:image"');
                    }
                    
                    // Always replace canonical URL - handle both empty href="" and any existing href
                    html = html.replace(
                        /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
                        `<link rel="canonical" href="${escapedUrl}">`
                    );
                    // If no canonical tag exists at all, insert it
                    if (!html.includes('<link rel="canonical"')) {
                        html = html.replace(
                            /<\/head>/i,
                            `    <link rel="canonical" href="${escapedUrl}">\n</head>`
                        );
                    }
                    
                    // Add document-specific structured data
                    const structuredData = generateDocumentStructuredData(validConfigs, escapedUrl, canonicalBaseUrl);
                    html = updateOrInsertStructuredData(html, structuredData);
                    
                    console.log(`✅ Serving React app with dynamic meta tags for: ${combinedTitle}`);
                } else {
                    console.warn(`⚠️  No valid configs found for slugs: ${docSlugs.join(', ')}`);
                }
            }
        }
        
        // Send the modified HTML
        res.send(html);
    } catch (error) {
        console.error('❌ Error serving React app with dynamic meta tags:', error);
        // Fallback to static file on error
        const indexPath = path.join(__dirname, 'app/index.html');
        res.sendFile(indexPath);
    }
}

// Serve React app static assets FIRST (so JS/CSS files are served correctly)
app.use('/app', express.static(path.join(__dirname, 'app')));

// Handle React Router - serve index.html for all /app routes and subroutes with dynamic meta tags
// These must come AFTER static middleware so asset requests (JS/CSS) are handled first
// Only match routes that don't have file extensions (to avoid catching asset requests)
app.get('/app/chat', async (req, res) => {
    await serveReactAppWithMetaTags(req, res);
});
app.get('/app', async (req, res) => {
    await serveReactAppWithMetaTags(req, res);
});
// Catch-all for React Router routes (but NOT for assets - those are handled by static middleware above)
app.get('/app/*', async (req, res) => {
    // Skip if this is an asset request (has a file extension)
    const pathname = req.path;
    if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i)) {
        return res.status(404).send('Asset not found');
    }
    await serveReactAppWithMetaTags(req, res);
});

// Serve landing page with dynamic canonical URL
// IMPORTANT: This must be BEFORE express.static middleware for public directory
app.get('/', async (req, res, next) => {
    console.log(`🏠 Home page route hit - ${req.method} ${req.path}`);
    
    try {
        // Check if running from dist directory (production) or root (development)
        const isDist = __dirname.endsWith('/dist');
        const indexPath = path.join(__dirname, 'public/index.html');
        
        if (!fs.existsSync(indexPath)) {
            console.error(`❌ Landing page not found at: ${indexPath}`);
            // Fallback to static file
            return res.sendFile(indexPath);
        }
        
        let html = fs.readFileSync(indexPath, 'utf8');
        
        // Hardcode to production URL base
        const canonicalBaseUrl = 'https://www.docutrain.io';
        
        // Set canonical URL for home page
        const canonicalUrl = canonicalBaseUrl;
        const escapedCanonicalUrl = escapeHtml(canonicalUrl);
        
        console.log(`🏠 Setting canonical URL for home page: ${canonicalUrl} (from ${indexPath})`);
        
        // Always replace canonical URL - handle both empty href="" and any existing href
        // Match various formats: <link rel="canonical" href="" /> or <link rel="canonical" href="">
        const canonicalRegex = /<link\s+rel=["']canonical["'][^>]*>/i;
        const originalCanonical = html.match(canonicalRegex);
        
        if (originalCanonical) {
            console.log(`🔍 Found canonical tag: ${originalCanonical[0]}`);
            html = html.replace(canonicalRegex, `<link rel="canonical" href="${escapedCanonicalUrl}">`);
            const afterReplace = html.match(canonicalRegex);
            if (afterReplace) {
                console.log(`✅ Replaced canonical tag: ${afterReplace[0]}`);
            } else {
                console.warn('⚠️  Canonical URL replacement may have failed');
            }
        } else {
            console.log('⚠️  No canonical tag found, will insert one');
        }
        
        // If no canonical tag exists at all, insert it
        if (!html.includes('<link rel="canonical"')) {
            html = html.replace(
                /<\/head>/i,
                `    <link rel="canonical" href="${escapedCanonicalUrl}">\n</head>`
            );
        }
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    } catch (error) {
        console.error('❌ Error serving landing page with canonical URL:', error);
        // Fallback to static file on error
        const isDist = __dirname.endsWith('/dist');
        res.sendFile(path.join(__dirname, 'public/index.html'));
    }
});

// Serve static files for main app BEFORE dynamic routes
app.use(express.static(path.join(__dirname, 'public')));

// DEPRECATED: Redirect /chat to React app (/app/chat)
// The vanilla JS chat.html is deprecated - all functionality migrated to React
app.get('/chat', async (req, res) => {
    // Redirect to React app, preserving query parameters
    const queryString = new URLSearchParams(req.query).toString();
    const redirectUrl = `/app/chat${queryString ? '?' + queryString : ''}`;
    console.log(`🔄 Redirecting deprecated /chat route to React app: ${redirectUrl}`);
    return res.redirect(redirectUrl);
    
    // OLD CODE BELOW - Kept for reference but never executed
    // NOTE: Files have been moved to deprecated/public/chat.html
    /*
    const chatPath = path.join(__dirname, 'deprecated/public/chat.html');
    
    // If there's a doc parameter, inject dynamic meta tags
    if (req.query.doc) {
        try {
            let html = require('fs').readFileSync(chatPath, 'utf8');
            
            // Parse multiple documents (support for + separator)
            const docSlugs = req.query.doc.split(/[\s+]+/).map(s => s.trim()).filter(s => s);
            
            if (docSlugs.length > 0) {
                // Fetch document configs
                const docConfigs = await Promise.all(
                    docSlugs.map(slug => documentRegistry.getDocumentBySlug(slug))
                );
                
                // Filter out null results
                const validConfigs = docConfigs.filter(c => c !== null);
                
                if (validConfigs.length > 0) {
                    // Build title and description
                    const isMultiDoc = validConfigs.length > 1;
                    const combinedTitle = validConfigs.map(c => c.title).join(' + ');
                    const metaDescription = isMultiDoc 
                        ? `Multi-document search across ${validConfigs.length} documents: ${combinedTitle}`
                        : (validConfigs[0].subtitle || validConfigs[0].welcome_message || 'AI-powered document assistant');
                    
                    // Escape HTML to prevent XSS
                    const escapedTitle = escapeHtml(combinedTitle);
                    const escapedDescription = escapeHtml(metaDescription);
                    
                    // Replace meta tags in HTML
                    html = html.replace(
                        /<title>.*?<\/title>/,
                        `<title>${escapedTitle}</title>`
                    );
                    
                    html = html.replace(
                        /<meta name="description" content=".*?">/,
                        `<meta name="description" content="${escapedDescription}">`
                    );
                    
                    html = html.replace(
                        /<meta property="og:title" content=".*?">/,
                        `<meta property="og:title" content="${escapedTitle}">`
                    );
                    
                    html = html.replace(
                        /<meta property="og:description" content=".*?">/,
                        `<meta property="og:description" content="${escapedDescription}">`
                    );
                    
                    html = html.replace(
                        /<meta name="twitter:title" content=".*?">/,
                        `<meta name="twitter:title" content="${escapedTitle}">`
                    );
                    
                    html = html.replace(
                        /<meta name="twitter:description" content=".*?">/,
                        `<meta name="twitter:description" content="${escapedDescription}">`
                    );
                    
                    console.log(`📄 Serving chat.html with dynamic meta tags for: ${combinedTitle}`);
                }
            }
            
            // Send the modified HTML
            res.send(html);
        } catch (error) {
            console.error('Error serving chat.html with dynamic meta tags:', error);
            // Fallback to static file on error
            res.sendFile(chatPath);
        }
    } else {
        // No doc parameter, just serve the chat page
        res.sendFile(chatPath);
    }
    */
});

// Document routes for main app (after static files so dynamic meta injection still works)
// This handles dynamic document routes like /?doc=slug
app.use('/', createDocumentsRouter(supabase, documentRegistry, registryState, escapeHtml));

// Start server
async function start() {
    const startupStart = Date.now();
    const isDist = __dirname.endsWith('/dist');
    const runningFrom = isDist ? 'PRODUCTION (dist/)' : 'DEVELOPMENT (root)';
    
    // Prominent mode indicator
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 RUNNING MODE: ${runningFrom}`);
    console.log(`📁 Working directory: ${__dirname}`);
    console.log(`📦 Running from: ${isDist ? 'dist/ (built files)' : 'source (original files)'}`);
    console.log('='.repeat(60) + '\n');
    
    console.log(`🔄 Starting RAG-only server...`);

    try {
        // Phase 1: Load document registry
        const phase1Start = Date.now();
        console.log('📋 Phase 1: Loading document registry...');

        await documentRegistry.loadDocuments();
        activeDocumentSlugs = await documentRegistry.getActiveSlugs();
        documentRegistryLoaded = true;
        registryState.documentRegistryLoaded = true;
        registryState.activeDocumentSlugs = activeDocumentSlugs;

        const phase1Time = Date.now() - phase1Start;
        console.log(`✓ Document registry loaded (${phase1Time}ms): ${activeDocumentSlugs.length} active documents available`);

        // Phase 2: Initialize services
        const phase2Start = Date.now();
        console.log('🔧 Phase 2: Initializing services...');

        initializeCacheCleanup();
        initializeRegistryAutoRefresh();

        const phase2Time = Date.now() - phase2Start;
        console.log(`✓ Services initialized (${phase2Time}ms)`);

        // Phase 3: Start HTTP server
        const phase3Start = Date.now();
        console.log('🌐 Phase 3: Starting HTTP server...');

        const serverStart = Date.now();
        server = app.listen(PORT, () => {
            const serverTime = Date.now() - serverStart;
            const totalStartupTime = Date.now() - startupStart;

            // Set server timeout to 15 minutes for large file uploads
            server.timeout = 15 * 60 * 1000; // 15 minutes
            server.keepAliveTimeout = 60000; // 60 seconds
            server.headersTimeout = 61000; // Must be > keepAliveTimeout

            console.log(`\n🚀 Server running at http://localhost:${PORT} (${serverTime}ms)`);
            console.log(`📚 RAG-only chatbot ready!`);
            console.log(`   - Total startup time: ${totalStartupTime}ms`);
            console.log(`   - Available documents: ${activeDocumentSlugs.length} total`);
            console.log(`   - Mode: RAG-only (database retrieval)`);
            console.log(`   - Use ?doc=<slug> URL parameter to select document`);
            console.log(`   - Server timeout: ${server.timeout / 1000}s (for large file uploads)\n`);

            // Signal to PM2 that the app is ready
            if (process.send) {
                process.send('ready');
                console.log('✓ Sent ready signal to PM2');
            }
        });
    } catch (error) {
        const totalStartupTime = Date.now() - startupStart;
        console.error(`❌ Failed to start server after ${totalStartupTime}ms:`, error);
        process.exit(1);
    }
}

start();
