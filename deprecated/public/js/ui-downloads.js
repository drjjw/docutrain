// UI Downloads - Downloads section management for welcome messages

// Helper to safely use debugLog (fallback to console if not available yet)
const log = {
    verbose: (...args) => window.debugLog ? window.debugLog.verbose(...args) : console.log(...args),
    normal: (...args) => window.debugLog ? window.debugLog.normal(...args) : console.log(...args),
    quiet: (...args) => window.debugLog ? window.debugLog.quiet(...args) : console.log(...args),
    always: (...args) => console.log(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args)
};

/**
 * Add downloads section to welcome message
 * @param {HTMLElement} container - The container element to add downloads to
 * @param {Array} validConfigs - Array of valid document configurations
 */
export function addDownloadsToWelcome(container, validConfigs) {
    if (!container) return;
    
    // Remove any existing downloads section
    const existingDownloads = container.querySelector('.downloads-section');
    if (existingDownloads) {
        existingDownloads.remove();
    }
    
    // Collect all downloads from all documents
    const allDownloads = [];
    validConfigs.forEach(config => {
        if (config.downloads && Array.isArray(config.downloads) && config.downloads.length > 0) {
            config.downloads.forEach(download => {
                // Validate download object has required fields
                if (download.title && download.url) {
                    allDownloads.push({
                        title: download.title,
                        url: download.url,
                        documentTitle: config.title
                    });
                }
            });
        }
    });
    
    // If no downloads, return early
    if (allDownloads.length === 0) {
        log.verbose('📥 No downloads available for current document(s)');
        return;
    }
    
    // Create downloads section
    const downloadsSection = document.createElement('div');
    downloadsSection.className = 'downloads-section';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'downloads-header';
    header.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
        </svg>
        <span>Available Downloads</span>
    `;
    downloadsSection.appendChild(header);
    
    // Create downloads list
    const downloadsList = document.createElement('div');
    downloadsList.className = 'downloads-list';
    
    allDownloads.forEach(download => {
        const button = document.createElement('a');
        button.className = 'download-button';
        button.href = '#'; // Prevent navigation
        
        // Extract filename from URL for download attribute
        const urlParts = download.url.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        // Prevent default and force download using fetch + blob
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                log.verbose(`📥 Starting download: ${filename}`);
                
                // Show downloading state
                button.classList.add('downloading');
                const titleDiv = button.querySelector('.download-title');
                const originalTitle = titleDiv.textContent;
                titleDiv.textContent = 'Downloading...';
                
                // Fetch the file
                const response = await fetch(download.url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                
                // Get the blob
                const blob = await response.blob();
                
                // Create blob URL
                const blobUrl = window.URL.createObjectURL(blob);
                
                // Create temporary link and trigger download
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Clean up blob URL
                window.URL.revokeObjectURL(blobUrl);
                
                // Reset button state
                button.classList.remove('downloading');
                titleDiv.textContent = originalTitle;
                
                log.verbose(`✅ Download complete: ${filename}`);
            } catch (error) {
                console.error(`❌ Download failed: ${filename}`, error);
                
                // Show error state
                button.classList.add('error');
                const titleDiv = button.querySelector('.download-title');
                const originalTitle = titleDiv.textContent;
                titleDiv.textContent = 'Failed - Click to retry';
                
                // Reset after 3 seconds
                setTimeout(() => {
                    button.classList.remove('error');
                    titleDiv.textContent = originalTitle;
                }, 3000);
            }
        });
        
        // Button content with improved layout (no download-action div)
        button.innerHTML = `
            <svg class="download-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <polyline points="9 15 12 18 15 15"></polyline>
            </svg>
            <div class="download-content">
                <div class="download-title">${download.title}</div>
                ${validConfigs.length > 1 ? `<div class="download-subtitle">${download.documentTitle}</div>` : ''}
            </div>
        `;
        
        downloadsList.appendChild(button);
    });
    
    downloadsSection.appendChild(downloadsList);
    container.appendChild(downloadsSection);
    
    log.verbose(`📥 Added ${allDownloads.length} download(s) to welcome message`);
}

