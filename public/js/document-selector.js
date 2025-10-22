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
        this.ownerMode = false; // New flag for owner parameter mode
        this.modalMode = false; // New flag for central modal mode
        this.originalParent = null; // For modal mode DOM manipulation
        this.originalNextSibling = null; // For modal mode DOM manipulation

        this.init();
    }

    /**
     * Set owner mode - show document selector for a specific owner
     */
    setOwnerMode(ownerSlug) {
        this.ownerMode = true;
        this.modalMode = true; // Owner mode uses central modal
        this.currentOwner = ownerSlug;
        // Force reload documents with owner mode
        this.loadDocuments();
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

        // Handle overlay clicks - only close in modal mode (but not in owner mode)
        this.overlay?.addEventListener('click', (e) => {
            if (this.modalMode && this.isOpen && !this.ownerMode) {
                handleClose();
            }
        });
        this.searchInput?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        // Close on escape key (but not in owner mode)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen && !this.ownerMode) {
                this.close();
            }
        });
        
        // Load documents and check if selector should be shown
        this.loadDocuments();
    }
    
    async loadDocuments() {
        try {
            // Get current document from URL
            const urlParams = new URLSearchParams(window.location.search);

            // Check for owner parameter first - if present, enable owner mode
            const ownerParam = urlParams.get('owner');
            const docParam = urlParams.get('doc');
            
            console.log('📋 Document Selector - Owner param:', ownerParam, 'Doc param:', docParam, 'URL:', window.location.href);
            
            if (ownerParam && !this.ownerMode) {
                this.ownerMode = true;
                this.modalMode = true;
                this.currentOwner = ownerParam;
                console.log('🎯 Document Selector - Owner mode activated for:', ownerParam, 'Modal mode:', this.modalMode);
            }

            // Set current document slug - in owner mode, don't default to 'smh' since no doc is selected
            this.currentDocSlug = this.ownerMode ? docParam : (docParam || 'smh');
            
            // First, fetch the current document to check if selector should be shown
            let apiUrl = '/api/documents';
            if (ownerParam) {
                // Owner mode: fetch only documents for this owner
                apiUrl += `?owner=${encodeURIComponent(ownerParam)}`;
                console.log('🔍 Fetching documents for owner:', ownerParam);
            } else if (docParam) {
                // Doc mode: fetch only the specific document(s)
                apiUrl += `?doc=${encodeURIComponent(docParam)}`;
                console.log('🔍 Fetching specific document(s):', docParam);
            } else {
                // No parameters: fetch default document
                apiUrl += '?doc=smh';
                console.log('🔍 Fetching default document: smh');
            }
            
            // Get JWT token from Supabase localStorage
            let headers = {
                'Content-Type': 'application/json',
            };

            try {
                const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
                const sessionData = localStorage.getItem(sessionKey);

                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    const token = session?.access_token;

                    if (token) {
                        headers['Authorization'] = `Bearer ${token}`;
                        console.log('🔑 Including JWT token in document selector API request');
                    }
                }
            } catch (error) {
                console.log('⚠️ Could not get JWT token for document selector request:', error);
            }

            const response = await fetch(apiUrl, { headers });
            const data = await response.json();
            this.documents = data.documents || [];

            // If we only fetched one document and it has show_document_selector enabled,
            // fetch all documents from the same owner for the dropdown
            if (this.documents.length === 1 && this.documents[0].showDocumentSelector && this.documents[0].ownerInfo) {
                console.log('🔍 Document selector enabled - fetching all documents from owner:', this.documents[0].ownerInfo.slug);
                const ownerApiUrl = `/api/documents?owner=${encodeURIComponent(this.documents[0].ownerInfo.slug)}`;
                const ownerResponse = await fetch(ownerApiUrl, { headers });
                const ownerData = await ownerResponse.json();
                this.documents = ownerData.documents || [];
                console.log('📚 Loaded', this.documents.length, 'documents from owner');
            }

            // Check if document selector should be shown
            // Priority: URL parameter (true/false) > database value > default (false)
            const urlSelectorParam = this.getCaseInsensitiveParam(urlParams, 'document_selector');
            let showSelector = false;
            
            if (urlSelectorParam !== null) {
                // URL parameter explicitly set - it overrides everything
                showSelector = urlSelectorParam === 'true';
                console.log('📋 Document Selector - URL parameter override:', showSelector);
            } else if (this.ownerMode) {
                // Owner mode always shows selector
                showSelector = true;
                console.log('📋 Document Selector - Owner mode enabled');
            } else {
                // Check database value for current document
                const currentDoc = this.documents.find(d => d.slug === this.currentDocSlug);
                showSelector = currentDoc?.showDocumentSelector || false;
                console.log('📋 Document Selector - Database value for', this.currentDocSlug, ':', showSelector);
            }

            if (showSelector) {
                console.log('🎨 Document Selector - Showing modal (showSelector:', showSelector, 'ownerMode:', this.ownerMode, ')');
                // If in owner mode, use the owner from owner mode
                if (this.ownerMode) {
                    console.log('📂 Document Selector - Owner mode: showing documents for owner:', this.currentOwner);
                    this.show(); // Show the container
                    this.open(); // Open the dropdown
                    this.renderDocuments();
                    // In owner mode, don't set a current doc name since we're showing all docs for the owner
                    if (this.currentDocName) {
                        // Use better display name for known owners
                        let displayName = this.currentOwner.charAt(0).toUpperCase() + this.currentOwner.slice(1);
                        if (this.currentOwner === 'ukidney') {
                            displayName = 'UKidney Medical';
                        }
                        this.currentDocName.textContent = `${displayName} Documents`;
                        console.log('🏷️ Document Selector - Set title to:', this.currentDocName.textContent);
                    }
                } else {
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
        console.log('🔍 Document Selector - show() called, container exists:', !!this.container, 'modalMode:', this.modalMode);
        if (this.container) {
            this.container.style.display = 'block';
            console.log('✅ Document Selector - Container shown, display:', this.container.style.display);
        } else {
            console.error('❌ Document Selector - Container not found!');
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

        if (this.modalMode) {
            // In modal mode, move dropdown to body and show as central modal
            if (this.dropdown && this.dropdown.parentNode) {
                // Store original parent for restoration
                this.originalParent = this.dropdown.parentNode;
                this.originalNextSibling = this.dropdown.nextSibling;

                // Move to body
                document.body.appendChild(this.dropdown);
                console.log('🎭 Moved dropdown to body for modal mode');
            }

            // Show overlay and style dropdown as central modal
            this.overlay?.classList.add('active');
            this.dropdown?.classList.add('modal');
            this.dropdown?.classList.add('active'); // Make it visible

            // Hide the button and close button in modal mode
            if (this.btn) {
                this.btn.style.display = 'none';
            }
            if (this.closeBtn) {
                this.closeBtn.style.display = 'none';
            }

            console.log('🎭 Document Selector - Opened in modal mode');
            console.log('🎭 Modal classes:', this.dropdown?.className);
            console.log('🎭 Modal computed style z-index:', window.getComputedStyle(this.dropdown).zIndex);
            console.log('🎭 Modal computed position:', window.getComputedStyle(this.dropdown).position);
            console.log('🎭 Modal computed top:', window.getComputedStyle(this.dropdown).top);
            console.log('🎭 Modal computed left:', window.getComputedStyle(this.dropdown).left);
            console.log('🎭 Modal computed transform:', window.getComputedStyle(this.dropdown).transform);
        } else {
            // Normal dropdown mode
            this.btn?.classList.add('active');
            this.dropdown?.classList.add('active');
        }

        this.searchInput?.focus();
    }
    
    close() {
        this.isOpen = false;

        if (this.modalMode) {
            // In modal mode, hide overlay and remove modal styling
            this.overlay?.classList.remove('active');
            this.dropdown?.classList.remove('modal');
            this.dropdown?.classList.remove('active'); // Hide it

            // Restore dropdown to original position
            if (this.dropdown && this.originalParent) {
                if (this.originalNextSibling) {
                    this.originalParent.insertBefore(this.dropdown, this.originalNextSibling);
                } else {
                    this.originalParent.appendChild(this.dropdown);
                }
                console.log('🎭 Restored dropdown to original position');
            }

            // Show the button again if we're closing the modal
            if (this.btn) {
                this.btn.style.display = 'block';
            }
            // Don't show close button in owner mode (modal should not be dismissible)
            if (this.closeBtn && !this.ownerMode) {
                this.closeBtn.style.display = 'block';
            }
            console.log('🎭 Document Selector - Closed modal mode');
        } else {
            // Normal dropdown mode
            this.btn?.classList.remove('active');
            this.dropdown?.classList.remove('active');
        }

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

        // Filter documents by owner - use owner from owner mode if active, otherwise current owner
        const filterOwner = this.ownerMode ? this.currentOwner : this.currentOwner;
        let ownerDocs = this.documents.filter(d =>
            d.ownerInfo && d.ownerInfo.slug === filterOwner
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

        // If in owner mode, remove the owner parameter since user has selected a document
        if (this.ownerMode) {
            url.searchParams.delete('owner');
        }

        // Normalize document_selector parameter to lowercase if it exists with different casing
        const currentParams = new URLSearchParams(window.location.search);
        const selectorValue = this.getCaseInsensitiveParam(currentParams, 'document_selector');
        if (selectorValue) {
            // Remove any existing variations and set the correct lowercase version
            for (let [key] of currentParams) {
                if (key.toLowerCase() === 'document_selector' && key !== 'document_selector') {
                    url.searchParams.delete(key);
                }
            }
            url.searchParams.set('document_selector', selectorValue);
        }

        window.location.href = url.toString();
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Helper method to get URL parameter case-insensitively
    getCaseInsensitiveParam(urlParams, paramName) {
        // First try exact match
        let value = urlParams.get(paramName);
        if (value !== null) return value;

        // If not found, try case-insensitive search
        for (let [key, val] of urlParams) {
            if (key.toLowerCase() === paramName.toLowerCase()) {
                return val;
            }
        }
        return null;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🏗️ Initializing document selector...');
        window.documentSelector = new DocumentSelector();
    });
} else {
    console.log('🏗️ Initializing document selector (already loaded)...');
    window.documentSelector = new DocumentSelector();
}

export default DocumentSelector;

