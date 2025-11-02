// Document initialization and URL parameter handling
import { getEmbeddingType, parseDocumentSlugs } from './config.js';
import { updateDocumentUI, updateModelInTooltip } from './ui.js';
import { debugLog } from './debug-logger.js';

/**
 * Initialize document and method selection from URL parameters
 * Validates document slugs against registry and updates UI
 */
export async function initializeDocument(state) {
    debugLog.verbose('  ┌─ initializeDocument() started');
    const initStart = performance.now();
    
    const urlParams = new URLSearchParams(window.location.search);
    const docParam = urlParams.get('doc');
    const ownerParam = urlParams.get('owner');
    const methodParam = urlParams.get('method');
    const embeddingParam = getEmbeddingType();
    const modelParam = urlParams.get('model');

    debugLog.verbose('  │  → Parsing URL parameters...');
    debugLog.verbose(`  │     doc: ${docParam || 'none'}`);
    debugLog.verbose(`  │     owner: ${ownerParam || 'none'}`);
    debugLog.verbose(`  │     embedding: ${embeddingParam}`);
    debugLog.verbose(`  │     model: ${modelParam || 'default'}`);

    // Set model from URL parameter
    const modelStart = performance.now();
    if (modelParam && (modelParam === 'gemini' || modelParam === 'grok' || modelParam === 'grok-reasoning')) {
        state.selectedModel = modelParam;
        updateModelInTooltip(modelParam);
        debugLog.verbose(`  │  → Model set to: ${modelParam}`);
    } else {
        // Default model - update tooltip
        updateModelInTooltip(state.selectedModel);
        debugLog.verbose(`  │  → Using default model: ${state.selectedModel}`);
    }
    debugLog.verbose(`  │     (${(performance.now() - modelStart).toFixed(2)}ms)`);

    // Validate document slugs using registry - supports multi-document with + separator
    let validatedSlugs = [];
    if (docParam) {
        const validationStart = performance.now();
        debugLog.verbose('  │  → Starting document validation...');
        try {
            const importStart = performance.now();
            const { documentExists, getDocument } = await import('./config.js');
            debugLog.verbose(`  │     Config module imported (${(performance.now() - importStart).toFixed(2)}ms)`);
            
            const requestedSlugs = parseDocumentSlugs();
            debugLog.verbose(`  │     Validating ${requestedSlugs.length} document(s): ${requestedSlugs.join(', ')}`);
            
            // Validate each slug
            for (const slug of requestedSlugs) {
                const slugStart = performance.now();
                try {
                    // Force refresh to avoid stale cache
                    const exists = await documentExists(slug, true);
                    if (exists) {
                        // Get the actual document to ensure we use the correct case
                        const doc = await getDocument(slug, true);
                        if (doc && doc.slug) {
                            validatedSlugs.push(doc.slug);
                            debugLog.verbose(`  │       ✓ Validated: ${doc.slug} (${(performance.now() - slugStart).toFixed(2)}ms)`);
                        } else {
                            debugLog.warn(`  │       ⚠️  Document '${slug}' returned invalid config (${(performance.now() - slugStart).toFixed(2)}ms)`);
                        }
                    } else {
                        debugLog.warn(`  │       ⚠️  Document '${slug}' not found in registry (${(performance.now() - slugStart).toFixed(2)}ms)`);
                    }
                } catch (slugError) {
                    debugLog.error(`  │       ❌ Error validating '${slug}':`, slugError, `(${(performance.now() - slugStart).toFixed(2)}ms)`);
                }
            }
        } catch (error) {
            debugLog.error('  │     ❌ Error during document validation:', error);
        }
        debugLog.verbose(`  │     Total validation time: ${(performance.now() - validationStart).toFixed(2)}ms`);
    }
    
    // Set state based on validated slugs
    if (validatedSlugs.length > 0) {
        state.selectedDocuments = validatedSlugs;
        // For backward compatibility, set selectedDocument to joined string
        state.selectedDocument = validatedSlugs.join('+');
        debugLog.verbose(`  │  ✓ Documents set: ${state.selectedDocument}`);
    } else {
        state.selectedDocuments = [];
        state.selectedDocument = null;
        debugLog.warn('  │  ⚠️  No valid documents found, showing generic interface');
    }

    // Log all URL parameters
    debugLog.verbose('\n  │  📋 URL Parameters Applied:');
    debugLog.verbose('  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    debugLog.verbose(`  │    Document:        ${docParam || 'none specified'}`);
    debugLog.verbose(`  │    Owner:           ${ownerParam || 'none specified'}`);
    debugLog.verbose(`  │    Validated as:    ${validatedSlugs.length > 0 ? validatedSlugs.join(' + ') : 'none (generic interface)'}`);
    debugLog.verbose(`  │    Multi-document:  ${validatedSlugs.length > 1 ? 'Yes (' + validatedSlugs.length + ' docs)' : 'No'}`);
    debugLog.verbose(`  │    Model:           ${state.selectedModel}`);
    debugLog.verbose(`  │    Mode:            RAG-only (database retrieval)`);
    debugLog.verbose(`  │    Embedding Type:  ${embeddingParam} ${embeddingParam === 'openai' ? '(1536D)' : '(384D)'}`);
    debugLog.verbose('  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check if running on localhost
    state.isLocalEnv = window.location.hostname === 'localhost' ||
                 window.location.hostname === '127.0.0.1' ||
                 window.location.hostname === '';

    // Add class to body for CSS targeting
    if (state.isLocalEnv) {
        document.body.classList.add('local-env');
        console.log('🏠 Local environment detected - retrieval controls visible');

        // Show URL parameters info in welcome message
        const urlParamsInfo = document.getElementById('urlParamsInfo');
        if (urlParamsInfo) {
            urlParamsInfo.style.display = 'inline';
        }
    } else {
        console.log('🌐 Production environment - retrieval controls hidden');

        // In production, set default model to grok-4-fast-non-reasoning
        // UNLESS explicitly overridden by URL parameter
        if (!modelParam) {
            state.selectedModel = 'grok';
        }
    }

    // Handle owner parameter - show document selector modal for owner's documents
    if (ownerParam) {
        const ownerStart = performance.now();
        debugLog.verbose('  │  → Processing owner parameter...');
        
        // Try to show owner's logo in owner mode
        const { getOwnerLogoConfig, loadOwnerLogoConfigs } = await import('./config.js');

        // First ensure owner configs are loaded (should be preloaded but fallback)
        const preloadStart = performance.now();
        await loadOwnerLogoConfigs();
        debugLog.verbose(`  │     Owner configs preloaded (${(performance.now() - preloadStart).toFixed(2)}ms)`);

        const logoConfigStart = performance.now();
        const ownerLogoConfig = await getOwnerLogoConfig(ownerParam);
        debugLog.verbose(`  │     Owner logo config retrieved (${(performance.now() - logoConfigStart).toFixed(2)}ms)`);
        debugLog.verbose(`  │     Config:`, ownerLogoConfig);

        // In owner mode, update header to show owner name
        const headerTitle = document.getElementById('headerTitle');
        if (headerTitle) {
            // Use the owner's display name from the config, with smart fallbacks
            let ownerDisplayName = ownerLogoConfig?.name || ownerLogoConfig?.alt ||
                                 `${ownerParam.charAt(0).toUpperCase() + ownerParam.slice(1)}`;

            // Special handling for known owners to show full names
            if (ownerParam === 'ukidney' && ownerDisplayName === 'UKidney') {
                ownerDisplayName = 'UKidney Medical';
            }

            headerTitle.textContent = `${ownerDisplayName} Documents`;
            headerTitle.classList.remove('loading-text');
            debugLog.verbose(`  │     Header title set to: ${ownerDisplayName} Documents`);
        }

        if (ownerLogoConfig && ownerLogoConfig.logo) {
            const logoImg = document.getElementById('headerLogo');
            const logoLink = logoImg?.parentElement; // Get the <a> tag
            debugLog.verbose('  │     Logo img element found:', !!logoImg, 'Link element found:', !!logoLink);
            if (logoImg) {
                logoImg.src = ownerLogoConfig.logo;
                logoImg.alt = ownerLogoConfig.alt || `${ownerParam} logo`;
                logoImg.style.display = 'block';
                debugLog.verbose('  │     Owner logo set:', ownerLogoConfig.logo);
            }
            if (logoLink) {
                // Check if owner_link=false parameter is present to disable logo link
                const urlParams = new URLSearchParams(window.location.search);
                const ownerLinkDisabled = urlParams.get('owner_link') === 'false';
                
                if (ownerLinkDisabled) {
                    // Disable logo link functionality
                    logoLink.href = '#';
                    logoLink.title = `${ownerLogoConfig.alt || ownerParam} logo`;
                    logoLink.style.cursor = 'default';
                    logoLink.onclick = (e) => e.preventDefault();
                    
                    debugLog.verbose('  │     Owner logo link disabled due to owner_link=false parameter');
                } else {
                    // Override logo link to navigate to owner's chat page
                    logoLink.href = `/chat?owner=${encodeURIComponent(ownerParam)}`;
                    logoLink.title = `View all documents for ${ownerLogoConfig.alt || ownerParam}`;
                    
                    // Remove target="_blank" to navigate in same window
                    logoLink.removeAttribute('target');
                    logoLink.removeAttribute('rel');
                    
                    debugLog.verbose('  │     Owner logo link set to navigate to owner page:', logoLink.href);
                }
            }
        } else {
            debugLog.verbose('  │     ❌ No logo config found for owner:', ownerParam);
        }

        // In owner mode, don't update document UI - let document selector handle everything
        debugLog.verbose(`  │     Owner mode processing complete (${(performance.now() - ownerStart).toFixed(2)}ms)`);
        debugLog.verbose('  │  → Owner mode active - skipping document UI update');
        debugLog.verbose(`  └─ initializeDocument() completed in ${(performance.now() - initStart).toFixed(2)}ms`);
        return;
    }

    // Update UI based on selected document (async) - force refresh to get latest data
    const uiUpdateStart = performance.now();
    debugLog.verbose('  │  → Updating document UI...');
    await updateDocumentUI(state.selectedDocument, true);
    debugLog.verbose(`  │     Document UI updated (${(performance.now() - uiUpdateStart).toFixed(2)}ms)`);
    debugLog.verbose(`  └─ initializeDocument() completed in ${(performance.now() - initStart).toFixed(2)}ms`);
}

