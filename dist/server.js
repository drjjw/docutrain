const express = require('express');
const path = require('path');
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
const rag = require('./lib/rag');

const app = express();
const PORT = process.env.PORT || 3456;

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
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

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
app.use('/api', createChatRouter(routeDependencies));
app.use('/api', createRatingRouter(supabase));
app.use('/api', createCacheRouter(embeddingCache));
app.use('/api', createHealthRouter(supabase, documentRegistry, registryState));

// Serve React app at /app route
app.use('/app', express.static(path.join(__dirname, 'app')));

// Handle React Router - serve index.html for all /app routes and subroutes
app.get('/app', (req, res) => {
    res.sendFile(path.join(__dirname, 'app/index.html'));
});
app.get('/app/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'app/index.html'));
});

// Serve static files for main app BEFORE dynamic routes
app.use(express.static(path.join(__dirname, 'public')));

// Document routes for main app (after static files so dynamic meta injection still works)
app.use('/', createDocumentsRouter(supabase, documentRegistry, registryState, escapeHtml));

// Start server
async function start() {
    const startupStart = Date.now();
    console.log('🔄 Starting RAG-only server...');

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

            console.log(`\n🚀 Server running at http://localhost:${PORT} (${serverTime}ms)`);
            console.log(`📚 RAG-only chatbot ready!`);
            console.log(`   - Total startup time: ${totalStartupTime}ms`);
            console.log(`   - Available documents: ${activeDocumentSlugs.length} total`);
            console.log(`   - Mode: RAG-only (database retrieval)`);
            console.log(`   - Use ?doc=<slug> URL parameter to select document\n`);

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
