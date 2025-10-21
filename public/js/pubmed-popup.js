/**
 * PubMed Popup Component
 * Displays PubMed article information in a hover popup
 */

import { fetchPubMedArticle } from './pubmed-api.js';

/**
 * Fetch PubMed article with retry logic for rate limiting
 */
async function fetchPubMedArticleWithRetry(pmid, maxRetries = 2, delay = 1000) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fetchPubMedArticle(pmid);
        } catch (error) {
            lastError = error;

            // If it's the last attempt, throw the error
            if (attempt === maxRetries) {
                throw error;
            }

            // If it's a rate limit error (429) or network error, wait and retry
            if (error.message.includes('429') || error.message.includes('rate limit') || error.message.includes('fetch')) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                // For other errors (like article not found), don't retry
                throw error;
            }
        }
    }

    throw lastError;
}

// Global popup instance
let pubmedPopup = null;
let currentPopupTimeout = null;

/**
 * Initialize PubMed popup functionality
 */
export function initializePubMedPopup() {
    // Create popup element if it doesn't exist
    if (!pubmedPopup) {
        pubmedPopup = createPopupElement();
        document.body.appendChild(pubmedPopup);
    }

    // Add event listeners to PMID links
    setupPMIDLinkListeners();
}

/**
 * Create the popup DOM element
 */
function createPopupElement() {
    const popup = document.createElement('div');
    popup.className = 'pubmed-popup';
    popup.innerHTML = `
        <div class="pubmed-popup-content">
            <div class="pubmed-popup-header">
                <div class="pubmed-popup-title">PubMed Article</div>
                <button class="pubmed-popup-close" aria-label="Close popup">×</button>
            </div>
            <div class="pubmed-popup-body">
                <div class="pubmed-loading">
                    <div class="loading-spinner"></div>
                    <div class="loading-text">Loading article information...</div>
                </div>
                <div class="pubmed-content" style="display: none;">
                    <div class="pubmed-article-title"></div>
                    <div class="pubmed-article-authors"></div>
                    <div class="pubmed-article-meta"></div>
                    <div class="pubmed-article-abstract"></div>
                    <div class="pubmed-article-links"></div>
                </div>
                <div class="pubmed-error" style="display: none;">
                    <div class="error-message">Unable to load article information</div>
                </div>
            </div>
        </div>
    `;

    // Close button functionality
    const closeBtn = popup.querySelector('.pubmed-popup-close');
    closeBtn.addEventListener('click', hidePopup);

    // Click outside to close
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            hidePopup();
        }
    });

    return popup;
}

/**
 * Setup event listeners for PMID links
 */
function setupPMIDLinkListeners() {
    // Use event delegation for dynamic content
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    // Also listen for mouseenter/mouseleave on the popup itself
    if (pubmedPopup) {
        pubmedPopup.addEventListener('mouseenter', () => {
            // Cancel any pending hide when entering popup
            if (currentPopupTimeout) {
                clearTimeout(currentPopupTimeout);
                currentPopupTimeout = null;
            }
        });

        pubmedPopup.addEventListener('mouseleave', () => {
            // Schedule hide when leaving popup
            scheduleHidePopup();
        });
    }
}

/**
 * Handle mouseover events on PMID links and about icon
 */
function handleMouseOver(event) {
    const target = event.target;

    // Check if this is a PMID link
    if (target.classList.contains('pmid-link') || target.closest('.pmid-link')) {
        const linkElement = target.classList.contains('pmid-link') ? target : target.closest('.pmid-link');
        const pmid = extractPMIDFromLink(linkElement);

        if (pmid) {
            showPopupForPMID(pmid, linkElement);
        }
    }

    // Check if this is the about icon (question mark) with PMID data
    if (target.id === 'aboutIcon' || target.closest('#aboutIcon')) {
        const iconElement = target.id === 'aboutIcon' ? target : target.closest('#aboutIcon');
        const pmid = iconElement.dataset.pmid;

        if (pmid) {
            showPopupForPMID(pmid, iconElement);
        }
    }
}

/**
 * Handle mouseout events from PMID links and about icon
 */
function handleMouseOut(event) {
    const target = event.target;
    const relatedTarget = event.relatedTarget;

    // Handle mouseout from PMID links
    if (target.classList.contains('pmid-link') || target.closest('.pmid-link')) {
        // If we're not moving to the popup, schedule hide
        if (!relatedTarget || !pubmedPopup || !pubmedPopup.contains(relatedTarget)) {
            scheduleHidePopup();
        }
        // If we're moving to the popup, the popup's mouseenter will cancel the hide
    }

    // Handle mouseout from about icon (question mark)
    if (target.id === 'aboutIcon' || target.closest('#aboutIcon')) {
        // If we're not moving to the popup, schedule hide
        if (!relatedTarget || !pubmedPopup || !pubmedPopup.contains(relatedTarget)) {
            scheduleHidePopup();
        }
        // If we're moving to the popup, the popup's mouseenter will cancel the hide
    }
}

/**
 * Extract PMID from link element
 */
function extractPMIDFromLink(linkElement) {
    const href = linkElement.getAttribute('href');
    if (href && href.includes('pubmed.ncbi.nlm.nih.gov/')) {
        const match = href.match(/\/(\d+)\//);
        return match ? match[1] : null;
    }

    // Fallback: extract from text content
    const text = linkElement.textContent;
    const match = text.match(/PMID:\s*(\d+)/i);
    return match ? match[1] : null;
}

/**
 * Show popup for a specific PMID
 */
async function showPopupForPMID(pmid, triggerElement) {
    // Cancel any pending hide
    if (currentPopupTimeout) {
        clearTimeout(currentPopupTimeout);
        currentPopupTimeout = null;
    }

    // Position popup near the trigger element
    positionPopup(triggerElement);

    // Show loading state
    showLoadingState();

    try {
        // Fetch article data with retry logic
        const articleData = await fetchPubMedArticleWithRetry(pmid);

        // Display article data
        showArticleData(articleData);

    } catch (error) {
        console.error('Error loading PubMed article:', error);

        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.message.includes('fetch')) {
            errorMessage = 'Network error: Unable to connect to PubMed. Please try again later.';
        } else if (error.message.includes('rate limit') || error.message.includes('429')) {
            errorMessage = 'PubMed API rate limit reached. Please wait a moment and try again.';
        } else if (error.message.includes('Article not found')) {
            errorMessage = 'Article not found in PubMed database.';
        }

        showErrorState(errorMessage);
    }

    // Show popup
    pubmedPopup.style.display = 'block';
}

/**
 * Position popup near trigger element
 */
function positionPopup(triggerElement) {
    const rect = triggerElement.getBoundingClientRect();
    const popupRect = pubmedPopup.getBoundingClientRect();

    // Default position: below and to the right of trigger
    let top = rect.bottom + 10;
    let left = rect.left;

    // Adjust if popup would go off-screen
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // If popup would go off the right edge, position it to the left of trigger
    if (left + popupRect.width > viewportWidth) {
        left = rect.right - popupRect.width;
    }

    // If popup would go off the bottom, position it above trigger
    if (top + popupRect.height > viewportHeight) {
        top = rect.top - popupRect.height - 10;
    }

    // Ensure popup doesn't go off the left edge
    left = Math.max(10, left);

    pubmedPopup.style.top = `${top}px`;
    pubmedPopup.style.left = `${left}px`;
}

/**
 * Show loading state
 */
function showLoadingState() {
    const loadingEl = pubmedPopup.querySelector('.pubmed-loading');
    const contentEl = pubmedPopup.querySelector('.pubmed-content');
    const errorEl = pubmedPopup.querySelector('.pubmed-error');

    loadingEl.style.display = 'flex';
    contentEl.style.display = 'none';
    errorEl.style.display = 'none';
}

/**
 * Show article data
 */
function showArticleData(article) {
    const loadingEl = pubmedPopup.querySelector('.pubmed-loading');
    const contentEl = pubmedPopup.querySelector('.pubmed-content');
    const errorEl = pubmedPopup.querySelector('.pubmed-error');

    // Hide loading, show content
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
    errorEl.style.display = 'none';

    // Populate content
    const titleEl = contentEl.querySelector('.pubmed-article-title');
    const authorsEl = contentEl.querySelector('.pubmed-article-authors');
    const metaEl = contentEl.querySelector('.pubmed-article-meta');
    const abstractEl = contentEl.querySelector('.pubmed-article-abstract');
    const linksEl = contentEl.querySelector('.pubmed-article-links');

    titleEl.textContent = article.title;
    authorsEl.textContent = article.authors;

    // Build meta information
    const metaParts = [];
    if (article.journal) metaParts.push(article.journal);
    if (article.pubDate) metaParts.push(article.pubDate);
    if (article.volume && article.issue) {
        metaParts.push(`${article.volume}(${article.issue})`);
    } else if (article.volume) {
        metaParts.push(`Vol ${article.volume}`);
    }
    if (article.pages) metaParts.push(`Pages ${article.pages}`);

    metaEl.textContent = metaParts.join(' • ');

    // Abstract
    if (article.abstract) {
        abstractEl.innerHTML = `<strong>Abstract:</strong> ${article.abstract}`;
        abstractEl.style.display = 'block';
    } else {
        abstractEl.style.display = 'none';
    }

    // Links
    linksEl.innerHTML = '';
    if (article.doi) {
        const doiLink = document.createElement('a');
        doiLink.href = `https://doi.org/${article.doi}`;
        doiLink.target = '_blank';
        doiLink.rel = 'noopener noreferrer';
        doiLink.textContent = `DOI: ${article.doi}`;
        doiLink.className = 'pubmed-doi-link';
        linksEl.appendChild(doiLink);
    }

    const pubmedLink = document.createElement('a');
    pubmedLink.href = `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`;
    pubmedLink.target = '_blank';
    pubmedLink.rel = 'noopener noreferrer';
    pubmedLink.textContent = `View on PubMed`;
    pubmedLink.className = 'pubmed-view-link';
    linksEl.appendChild(pubmedLink);
}

/**
 * Show error state
 */
function showErrorState(message) {
    const loadingEl = pubmedPopup.querySelector('.pubmed-loading');
    const contentEl = pubmedPopup.querySelector('.pubmed-content');
    const errorEl = pubmedPopup.querySelector('.pubmed-error');

    loadingEl.style.display = 'none';
    contentEl.style.display = 'none';
    errorEl.style.display = 'block';

    const errorMessageEl = errorEl.querySelector('.error-message');
    errorMessageEl.textContent = message || 'Unable to load article information';
}

/**
 * Schedule popup to hide
 */
function scheduleHidePopup() {
    if (currentPopupTimeout) {
        clearTimeout(currentPopupTimeout);
    }

    // Delay hiding to allow mouse movement to popup
    currentPopupTimeout = setTimeout(() => {
        hidePopup();
    }, 300);
}

/**
 * Hide popup
 */
function hidePopup() {
    if (pubmedPopup) {
        pubmedPopup.style.display = 'none';
    }

    if (currentPopupTimeout) {
        clearTimeout(currentPopupTimeout);
        currentPopupTimeout = null;
    }
}

/**
 * Force hide popup (for cleanup)
 */
export function forceHidePubMedPopup() {
    hidePopup();
}
