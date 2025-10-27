// Page load orchestration and initialization sequence
import { API_URL, preloadLogos, parseDocumentSlugs } from './config.js';
import { initializePubMedPopup } from './pubmed-popup.js';
import { initializeAIHint } from './ai-hint.js';
import { checkDocumentAccess } from './access-check.js';
import { initializeUserMenu, updateUserMenuVisibility } from './user-auth.js';
import { initializeDocument } from './document-init.js';
import { debugLog } from './debug-logger.js';
import mobileMenu from './mobile-menu.js';

/**
 * Run the complete page initialization sequence
 * Returns performance metrics for each step
 */
export async function initializePage(state, elements) {
    // Performance tracking
    performance.mark('page-load-start');
    const perfStart = performance.now();
    
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug');
    
    debugLog.normal('\n═══════════════════════════════════════════════════════════');
    debugLog.normal('🚀 PAGE LOAD STARTED');
    debugLog.normal('═══════════════════════════════════════════════════════════');
    debugLog.verbose(`⏱️  Start Time: ${new Date().toISOString()}`);
    debugLog.verbose(`📍 Location: ${window.location.href}`);
    debugLog.verbose(`🐛 Debug Level: ${debugParam || 'normal (default)'}`);
    
    // Step 1: Preload logos
    const step1Start = performance.now();
    debugLog.normal('\n[STEP 1/10] 🎨 Preloading logos...');
    await preloadLogos();
    const step1Time = performance.now() - step1Start;
    debugLog.normal(`✓ Logos preloaded in ${step1Time.toFixed(2)}ms`);
    
    // Step 2: Check document access
    const step2Start = performance.now();
    debugLog.normal('\n[STEP 2/10] 🔒 Checking document access...');
    const docParam = urlParams.get('doc');
    if (docParam) {
        // Handle multi-document URLs by parsing on + or space (URL decoding)
        const documentSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);

        debugLog.verbose(`  → Checking access for ${documentSlugs.length} document(s): ${documentSlugs.join(', ')}`);

        // Check access for each document individually
        const accessResults = await Promise.all(documentSlugs.map(slug => checkDocumentAccess(slug)));
        const hasAccess = accessResults.every(result => result === true);

        if (!hasAccess) {
            debugLog.always('🚫 Access denied for one or more documents - aborting initialization');
            debugLog.normal(`⏱️  Total time before abort: ${(performance.now() - perfStart).toFixed(2)}ms`);
            // Access denied - modal will handle redirect
            return null;
        }
        debugLog.verbose(`  → Access granted for all documents`);
    } else {
        debugLog.verbose('  → No document parameter specified');
    }
    const step2Time = performance.now() - step2Start;
    debugLog.normal(`✓ Access check completed in ${step2Time.toFixed(2)}ms`);

    // Step 3: Initialize document
    const step3Start = performance.now();
    debugLog.normal('\n[STEP 3/10] 📄 Initializing document...');
    await initializeDocument(state);
    const step3Time = performance.now() - step3Start;
    debugLog.normal(`✓ Document initialized in ${step3Time.toFixed(2)}ms`);

    // Step 4: Initialize PubMed popup
    const step4Start = performance.now();
    debugLog.normal('\n[STEP 4/10] 🔬 Initializing PubMed popup...');
    initializePubMedPopup();
    const step4Time = performance.now() - step4Start;
    debugLog.normal(`✓ PubMed popup initialized in ${step4Time.toFixed(2)}ms`);

    // Step 5: Initialize AI hint
    const step5Start = performance.now();
    debugLog.normal('\n[STEP 5/10] 💡 Initializing AI hint...');
    initializeAIHint();
    const step5Time = performance.now() - step5Start;
    debugLog.normal(`✓ AI hint initialized in ${step5Time.toFixed(2)}ms`);

    // Step 6: Initialize user menu
    const step6Start = performance.now();
    debugLog.normal('\n[STEP 6/10] 👤 Initializing user menu...');
    await initializeUserMenu();
    const step6Time = performance.now() - step6Start;
    debugLog.normal(`✓ User menu initialized in ${step6Time.toFixed(2)}ms`);

    // Step 7: Initialize mobile menu
    const step7Start = performance.now();
    debugLog.normal('\n[STEP 7/10] 📱 Initializing mobile menu...');
    await mobileMenu.updateVisibility();
    const step7Time = performance.now() - step7Start;
    debugLog.normal(`✓ Mobile menu initialized in ${step7Time.toFixed(2)}ms`);

    // Step 8: Health check
    const step8Start = performance.now();
    debugLog.normal('\n[STEP 8/10] 🏥 Running health check...');
    debugLog.verbose('  → Server health check - RAG-only mode active');
    const step8Time = performance.now() - step8Start;
    debugLog.normal(`✓ Health check completed in ${step8Time.toFixed(2)}ms`);

    // Step 9: Show disclaimer if needed
    const step9Start = performance.now();
    debugLog.normal('\n[STEP 9/10] ⚠️  Checking disclaimer requirements...');
    if (state.selectedDocuments && state.selectedDocuments.length > 0) {
        const { getDocument } = await import('./config.js');

        // Check if any selected document requires disclaimer (UKidney owner)
        let requiresDisclaimer = false;
        for (const docSlug of state.selectedDocuments) {
            try {
                const docConfig = await getDocument(docSlug);
                if (docConfig && docConfig.owner === 'ukidney') {
                    requiresDisclaimer = true;
                    debugLog.verbose(`  → UKidney document '${docSlug}' detected, disclaimer required`);
                    break;
                }
            } catch (error) {
                debugLog.warn(`  → Could not check disclaimer for '${docSlug}':`, error.message);
            }
        }

        if (requiresDisclaimer) {
            debugLog.verbose('  → Showing disclaimer (at least one UKidney document found)');
            const { showDisclaimerIfNeeded } = await import('./disclaimer.js');
            showDisclaimerIfNeeded();
        } else {
            debugLog.verbose('  → No disclaimer needed for selected documents');
        }
    } else {
        debugLog.verbose('  → No documents selected, skipping disclaimer');
    }
    const step9Time = performance.now() - step9Start;
    debugLog.normal(`✓ Disclaimer check completed in ${step9Time.toFixed(2)}ms`);

    // Step 10: Final setup
    const step10Start = performance.now();
    debugLog.normal('\n[STEP 10/10] 🎯 Final setup...');
    
    // Focus input
    debugLog.verbose('  → Focusing message input');
    elements.messageInput.focus();

    // Check authentication and show/hide user menu
    debugLog.verbose('  → Updating user menu visibility');
    updateUserMenuVisibility();
    
    const step10Time = performance.now() - step10Start;
    debugLog.normal(`✓ Final setup completed in ${step10Time.toFixed(2)}ms`);

    // Summary
    performance.mark('page-load-end');
    performance.measure('total-page-load', 'page-load-start', 'page-load-end');
    
    const totalTime = performance.now() - perfStart;
    
    // Always show summary (even in quiet mode)
    debugLog.quiet('\n═══════════════════════════════════════════════════════════');
    debugLog.quiet('✅ PAGE LOAD COMPLETE');
    debugLog.quiet('═══════════════════════════════════════════════════════════');
    debugLog.quiet('⏱️  Performance Summary:');
    debugLog.quiet(`  Step 1 (Logos):         ${step1Time.toFixed(2)}ms (${(step1Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 2 (Access):        ${step2Time.toFixed(2)}ms (${(step2Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 3 (Document):      ${step3Time.toFixed(2)}ms (${(step3Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 4 (PubMed):        ${step4Time.toFixed(2)}ms (${(step4Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 5 (AI Hint):       ${step5Time.toFixed(2)}ms (${(step5Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 6 (User Menu):     ${step6Time.toFixed(2)}ms (${(step6Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 7 (Mobile Menu):   ${step7Time.toFixed(2)}ms (${(step7Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 8 (Health Check):  ${step8Time.toFixed(2)}ms (${(step8Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 9 (Disclaimer):    ${step9Time.toFixed(2)}ms (${(step9Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  Step 10 (Final Setup):  ${step10Time.toFixed(2)}ms (${(step10Time/totalTime*100).toFixed(1)}%)`);
    debugLog.quiet(`  ─────────────────────────────────────────────────────────`);
    debugLog.quiet(`  🏁 TOTAL TIME:          ${totalTime.toFixed(2)}ms`);
    
    debugLog.normal('\n💡 Performance Tips:');
    debugLog.normal('  • Open DevTools → Performance tab to see detailed timeline');
    debugLog.normal('  • Look for "total-page-load" measure in User Timing');
    debugLog.normal('  • Check Network tab for slow resource loads');
    debugLog.normal('  • Bottlenecks are highlighted above with percentages');
    debugLog.normal('  • Use ?debug=verbose for detailed logs, ?debug=quiet for summary only, ?debug=off to disable');
    
    // Identify bottlenecks
    const steps = [
        { name: 'Logos', time: step1Time },
        { name: 'Access', time: step2Time },
        { name: 'Document', time: step3Time },
        { name: 'PubMed', time: step4Time },
        { name: 'AI Hint', time: step5Time },
        { name: 'User Menu', time: step6Time },
        { name: 'Mobile Menu', time: step7Time },
        { name: 'Health Check', time: step8Time },
        { name: 'Disclaimer', time: step9Time },
        { name: 'Final Setup', time: step10Time }
    ];
    
    const sortedSteps = [...steps].sort((a, b) => b.time - a.time);
    const slowestStep = sortedSteps[0];
    
    if (slowestStep.time > totalTime * 0.3) {
        debugLog.quiet(`\n⚠️  BOTTLENECK DETECTED: ${slowestStep.name} took ${slowestStep.time.toFixed(2)}ms (${(slowestStep.time/totalTime*100).toFixed(1)}%)`);
    }
    
    debugLog.quiet('═══════════════════════════════════════════════════════════\n');

    return {
        totalTime,
        steps: {
            logos: step1Time,
            access: step2Time,
            document: step3Time,
            pubmed: step4Time,
            aiHint: step5Time,
            userMenu: step6Time,
            mobileMenu: step7Time,
            healthCheck: step8Time,
            disclaimer: step9Time,
            finalSetup: step10Time
        }
    };
}

