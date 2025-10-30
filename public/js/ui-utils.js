// UI Utilities - Shared utilities for color manipulation, meta tags, and layout
// Used across multiple UI modules

/**
 * Update page meta tags with document information
 * @param {string} title - Document title
 * @param {string} description - Document description/subtitle
 */
export function updateMetaTags(title, description) {
    // Update page title
    document.title = title;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.setAttribute('content', description);
    }
    
    // Update Open Graph meta tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
        ogTitle.setAttribute('content', title);
    }
    
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
        ogDescription.setAttribute('content', description);
    }
    
    // Update Twitter Card meta tags
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
        twitterTitle.setAttribute('content', title);
    }
    
    const twitterDescription = document.querySelector('meta[name="twitter:description"]');
    if (twitterDescription) {
        twitterDescription.setAttribute('content', description);
    }
}

/**
 * Helper function to darken a hex color by a percentage
 * @param {string} hex - Hex color code (e.g., '#cc0000')
 * @param {number} percent - Percentage to darken (0-1)
 * @returns {string} Darkened hex color
 */
export function darkenColor(hex, percent) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Darken each component
    const newR = Math.max(0, Math.floor(r * (1 - percent)));
    const newG = Math.max(0, Math.floor(g * (1 - percent)));
    const newB = Math.max(0, Math.floor(b * (1 - percent)));

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

/**
 * Helper function to convert hex color to rgba
 * @param {string} hex - Hex color code (e.g., '#cc0000')
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, alpha) {
    // Remove # if present
    hex = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Function to equalize heights of cover and welcome sections
export function equalizeContainerHeights() {
    const coverSection = document.querySelector('.document-cover-section');
    const welcomeSection = document.querySelector('.welcome-message-section');
    
    if (!coverSection || !welcomeSection) return;
    
    // Only equalize on desktop (> 768px) - mobile uses vertical stacking
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        // Reset heights on mobile to allow natural sizing
        coverSection.style.height = '';
        welcomeSection.style.height = '';
        return;
    }
    
    // Desktop: Reset any previously set heights
    coverSection.style.height = '';
    welcomeSection.style.height = '';
    
    // Get natural heights
    const coverHeight = coverSection.offsetHeight;
    const welcomeHeight = welcomeSection.offsetHeight;
    
    // Set both to the maximum height
    const maxHeight = Math.max(coverHeight, welcomeHeight);
    coverSection.style.height = `${maxHeight}px`;
    welcomeSection.style.height = `${maxHeight}px`;
}

// Function to equalize heights of downloads and keywords containers
export function equalizeDownloadsKeywordsHeights() {
    const container = document.getElementById('downloadsKeywordsContainer');
    if (!container) return;
    
    // Only equalize when both are present (side-by-side)
    const downloadsSection = container.querySelector('.downloads-section');
    const keywordsSection = container.querySelector('.document-keywords');
    
    if (!downloadsSection || !keywordsSection) {
        // If only one is present, reset heights
        if (downloadsSection) downloadsSection.style.height = '';
        if (keywordsSection) keywordsSection.style.height = '';
        return;
    }
    
    // Only equalize on desktop (> 768px) - mobile uses vertical stacking
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        downloadsSection.style.height = '';
        keywordsSection.style.height = '';
        return;
    }
    
    // Desktop: Reset any previously set heights to get natural heights
    downloadsSection.style.height = '';
    keywordsSection.style.height = '';
    
    // Get natural heights
    const downloadsHeight = downloadsSection.offsetHeight;
    const keywordsHeight = keywordsSection.offsetHeight;
    
    // Set both to the maximum height
    const maxHeight = Math.max(downloadsHeight, keywordsHeight);
    if (maxHeight > 0) {
        downloadsSection.style.height = `${maxHeight}px`;
        keywordsSection.style.height = `${maxHeight}px`;
    }
}

// Add resize listener to re-equalize on window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        equalizeContainerHeights();
        equalizeDownloadsKeywordsHeights();
    }, 250); // Debounce resize events
});

