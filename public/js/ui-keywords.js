/**
 * UI Keywords - Display document keywords as a word cloud
 */

/**
 * Add keywords display to a container element as a word cloud
 * @param {HTMLElement} container - Container element to add keywords to
 * @param {Array|null} keywords - Array of keyword objects with {term, weight}
 */
export function addKeywordsDisplay(container, keywords) {
    if (!container || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return;
    }

    // Safety check: NEVER add keywords to intro message container
    // Keywords should ONLY go to downloads-keywords-container
    const isIntroContainer = container.id === 'welcomeIntroContent' || 
                             container.querySelector('#welcomeIntroContent') ||
                             container.classList.contains('welcome-message-section');
    
    if (isIntroContainer) {
        console.error('❌ ERROR: Attempted to add keywords to intro message container! Keywords should only go to downloads-keywords-container.');
        return;
    }

    // Remove existing keywords display if present (in the target container only)
    const existingKeywords = container.querySelector('.document-keywords');
    if (existingKeywords) {
        existingKeywords.remove();
    }

    // Create keywords container
    const keywordsContainer = document.createElement('div');
    keywordsContainer.className = 'document-keywords';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'document-keywords-header';
    header.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
        <span class="keywords-title">Key Topics</span>
    `;
    
    // Create word cloud container
    const wordCloudContainer = document.createElement('div');
    wordCloudContainer.className = 'document-keywords-wordcloud';
    
    // Normalize weights to determine font size range
    // Weight range: 0.1 to 1.0
    // Font size range: 0.75rem (smallest) to 1.75rem (largest) for better visual distinction
    const minWeight = Math.min(...keywords.map(k => k.weight || 0.5));
    const maxWeight = Math.max(...keywords.map(k => k.weight || 0.5));
    const weightRange = maxWeight - minWeight || 1; // Avoid division by zero
    
    // Create word cloud items
    keywords.forEach((keyword, index) => {
        const word = document.createElement('span');
        word.className = 'keyword-word';
        word.textContent = keyword.term;
        
        // Calculate font size based on weight (larger = more important)
        // Normalize weight to 0-1 range, then scale to font size range
        const normalizedWeight = weightRange > 0 
            ? (keyword.weight - minWeight) / weightRange 
            : 0.5;
        
        // Font size range: 0.75rem to 1.75rem (base: 1rem)
        const minSize = 0.75;
        const maxSize = 1.75;
        const fontSize = minSize + (normalizedWeight * (maxSize - minSize));
        word.style.fontSize = `${fontSize}rem`;
        
        // Set font weight based on importance (bolder = more important)
        // Range: 400 (normal) to 700 (bold)
        const fontWeight = Math.round(400 + (normalizedWeight * 300));
        word.style.fontWeight = fontWeight;
        
        // Set color opacity based on weight (darker = more important)
        // Range: 0.7 to 1.0 opacity
        const opacity = 0.7 + (normalizedWeight * 0.3);
        word.style.opacity = opacity;
        
        wordCloudContainer.appendChild(word);
        
        // Add separator between words (except after last word)
        if (index < keywords.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'keyword-separator';
            separator.textContent = ' • ';
            wordCloudContainer.appendChild(separator);
        }
    });
    
    keywordsContainer.appendChild(header);
    keywordsContainer.appendChild(wordCloudContainer);
    
    // Simply append keywords to the target container
    // The container is already the downloads-keywords-container, not the intro message
    container.appendChild(keywordsContainer);
}

