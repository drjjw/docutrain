/**
 * Document Selector Module
 * Provides a beautiful dropdown UI for navigating between documents
 * Only shown when URL parameter document_selector=true
 */

class DocumentSelector {
    constructor() {
        this.container = document.getElementById('documentSelectorContainer');
        this.btn = document.getElementById('documentSelectorBtn');
        this.dropdown = document.getElementById('documentSelectorDropdown');
        this.overlay = document.getElementById('documentSelectorOverlay');
        this.closeBtn = document.getElementById('closeDropdown');
        this.searchInput = document.getElementById('documentSearch');
        this.documentList = document.getElementById('documentList');
        this.currentDocName = document.getElementById('currentDocName');
        
        this.documents = [];
        this.currentOwner = null;
        this.currentDocSlug = null;
        this.isOpen = false;
        
        this.init();
    }
    
    init() {
        // Event listeners
        const handleToggle = () => this.toggle();
        const handleClose = () => this.close();

        // Add both click and touch events for mobile compatibility
        this.btn?.addEventListener('click', handleToggle);
        this.btn?.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleToggle();
        });

        this.closeBtn?.addEventListener('click', handleClose);
        this.closeBtn?.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleClose();
        });

        this.overlay?.addEventListener('click', handleClose);
        this.searchInput?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        // Load documents and check if selector should be shown
        this.loadDocuments();
    }
    
    async loadDocuments() {
        try {
            const response = await fetch('/api/documents');
            const data = await response.json();
            this.documents = data.documents || [];
            
            // Get current document from URL
            const urlParams = new URLSearchParams(window.location.search);
            this.currentDocSlug = urlParams.get('doc') || 'smh';
            
            // Check if document selector should be shown (URL parameter)
            const showSelector = urlParams.get('document_selector') === 'true';

            if (showSelector) {
                // Find current document to get owner info for filtering
                const currentDoc = this.documents.find(d => d.slug === this.currentDocSlug);
                if (currentDoc && currentDoc.ownerInfo) {
                    this.currentOwner = currentDoc.ownerInfo.slug;
                    this.show();
                    this.renderDocuments();
                    this.updateCurrentDocName(currentDoc);
                } else {
                    this.hide();
                }
            } else {
                this.hide();
            }
        } catch (error) {
            console.error('Error loading documents for selector:', error);
            this.hide();
        }
    }
    
    show() {
        if (this.container) {
            this.container.style.display = 'block';
        }
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
        }
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.isOpen = true;
        this.btn?.classList.add('active');
        this.dropdown?.classList.add('active');

        // Don't show overlay on mobile to avoid z-index issues
        // if (window.innerWidth <= 768) {
        //     this.overlay?.classList.add('active');
        // }

        this.searchInput?.focus();
    }
    
    close() {
        this.isOpen = false;
        this.btn?.classList.remove('active');
        this.dropdown?.classList.remove('active');
        // Don't remove overlay on mobile since we don't show it
        // this.overlay?.classList.remove('active');
        this.searchInput.value = '';
        this.renderDocuments(); // Reset search
    }
    
    updateCurrentDocName(doc) {
        if (this.currentDocName && doc) {
            this.currentDocName.textContent = doc.title || 'Unknown Document';
        }
    }
    
    renderDocuments(searchTerm = '') {
        if (!this.documentList) return;
        
        // Filter documents by current owner
        let ownerDocs = this.documents.filter(d => 
            d.ownerInfo && d.ownerInfo.slug === this.currentOwner
        );
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            ownerDocs = ownerDocs.filter(d => 
                d.title.toLowerCase().includes(term) ||
                (d.subtitle && d.subtitle.toLowerCase().includes(term))
            );
        }
        
        // Sort alphabetically
        ownerDocs.sort((a, b) => a.title.localeCompare(b.title));
        
        if (ownerDocs.length === 0) {
            this.documentList.innerHTML = `
                <div class="no-documents">
                    ${searchTerm ? 'No documents match your search' : 'No documents available'}
                </div>
            `;
            return;
        }
        
        this.documentList.innerHTML = ownerDocs.map(doc => `
            <div class="document-item ${doc.slug === this.currentDocSlug ? 'active' : ''}"
                 data-slug="${doc.slug}">
                ${doc.cover ? `<img class="doc-cover-thumb" src="${doc.cover}" alt="${this.escapeHtml(doc.title)} cover" loading="lazy">` :
                    `<svg class="doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>`}
                <div class="document-item-content">
                    <div class="document-item-title">${this.escapeHtml(doc.title)}</div>
                    ${doc.subtitle ? `<div class="document-item-subtitle">${this.escapeHtml(doc.subtitle)}</div>` : ''}
                </div>
            </div>
        `).join('');
        
        // Add click/touch handlers
        this.documentList.querySelectorAll('.document-item').forEach(item => {
            const handleSelect = () => {
                const slug = item.dataset.slug;
                this.navigateToDocument(slug);
            };

            // Add both click and touch events for mobile compatibility
            item.addEventListener('click', handleSelect);
            item.addEventListener('touchend', (e) => {
                e.preventDefault(); // Prevent default touch behavior
                handleSelect();
            });
        });
    }
    
    handleSearch(searchTerm) {
        this.renderDocuments(searchTerm);
    }
    
    navigateToDocument(slug) {
        if (slug === this.currentDocSlug) {
            this.close();
            return;
        }
        
        // Update URL and reload page
        const url = new URL(window.location.href);
        url.searchParams.set('doc', slug);
        window.location.href = url.toString();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.documentSelector = new DocumentSelector();
    });
} else {
    window.documentSelector = new DocumentSelector();
}

export default DocumentSelector;

