/**
 * Mobile Menu Module
 * Manages the full-screen mobile menu overlay that consolidates
 * document selector and user menu for better mobile UX
 */

import { API_URL } from './config.js';

class MobileMenu {
    constructor() {
        // DOM elements
        this.overlay = document.getElementById('mobileMenuOverlay');
        this.panel = document.getElementById('mobileMenuPanel');
        this.toggle = document.getElementById('mobileMenuToggle');
        this.closeBtn = document.getElementById('mobileMenuClose');
        
        // Document section elements
        this.docSection = document.getElementById('mobileMenuDocSection');
        this.docSearch = document.getElementById('mobileMenuDocSearch');
        this.docList = document.getElementById('mobileMenuDocList');
        
        // User section elements
        this.userSection = document.getElementById('mobileMenuUserSection');
        this.userAvatar = document.getElementById('mobileMenuUserAvatar');
        this.userEmail = document.getElementById('mobileMenuUserEmail');
        this.signOutBtn = document.getElementById('mobileMenuSignOut');
        
        // State
        this.isOpen = false;
        this.documents = [];
        this.currentDocSlug = null;
        this.currentOwner = null;
        this.isAuthenticated = false;
        this.hasDocumentSelector = false;
        
        this.init();
    }
    
    init() {
        // Event listeners
        this.toggle?.addEventListener('click', () => this.open());
        this.closeBtn?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
        
        // Document search
        this.docSearch?.addEventListener('input', (e) => {
            this.filterDocuments(e.target.value);
        });
        
        // Sign out
        this.signOutBtn?.addEventListener('click', () => this.handleSignOut());
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
        
        console.log('📱 Mobile menu initialized');
    }
    
    /**
     * Check if mobile menu should be shown
     * Shows when on mobile AND (document selector enabled OR user authenticated)
     */
    async updateVisibility() {
        const isMobile = window.innerWidth <= 768;
        
        if (!isMobile) {
            this.hide();
            return;
        }
        
        // Check authentication
        this.isAuthenticated = this.checkAuthentication();
        
        // Check document selector status
        await this.checkDocumentSelector();
        
        // Show toggle if either feature is available
        if (this.hasDocumentSelector || this.isAuthenticated) {
            this.show();
            
            // Add class to header to hide desktop elements
            const header = document.querySelector('.header');
            if (header) {
                header.classList.add('mobile-menu-active');
            }
        } else {
            this.hide();
        }
    }
    
    /**
     * Check if user is authenticated
     */
    checkAuthentication() {
        try {
            const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
            const sessionData = localStorage.getItem(sessionKey);
            
            if (sessionData) {
                const session = JSON.parse(sessionData);
                const token = session?.access_token;
                const user = session?.user;
                
                if (token && user) {
                    // Update user email in mobile menu
                    if (this.userEmail && user.email) {
                        this.userEmail.textContent = user.email;
                    }
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error checking authentication:', error);
            return false;
        }
    }
    
    /**
     * Check if document selector should be shown
     */
    async checkDocumentSelector() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const docParam = urlParams.get('doc');
            const ownerParam = urlParams.get('owner');
            
            // First, try to get data from the existing document selector if it's loaded
            if (window.documentSelector && window.documentSelector.documents && window.documentSelector.documents.length > 0) {
                console.log('📱 Mobile menu using data from document selector:', window.documentSelector.documents.length, 'documents');
                this.documents = window.documentSelector.documents;
                this.currentOwner = window.documentSelector.currentOwner;
                this.currentDocSlug = window.documentSelector.currentDocSlug;
                this.hasDocumentSelector = true;
                return;
            }
            
            // Check URL parameter first
            const urlSelectorParam = this.getCaseInsensitiveParam(urlParams, 'document_selector');
            if (urlSelectorParam !== null) {
                this.hasDocumentSelector = urlSelectorParam === 'true';
                if (this.hasDocumentSelector) {
                    await this.loadDocuments();
                }
                return;
            }
            
            // Check owner mode
            if (ownerParam) {
                this.hasDocumentSelector = true;
                this.currentOwner = ownerParam;
                await this.loadDocuments();
                return;
            }
            
            // Check database value for current document
            if (docParam) {
                const docSlugs = docParam.split(/[\s+]+/).map(s => s.trim()).filter(s => s);
                this.currentDocSlug = docSlugs[0];
                
                // Fetch document to check if selector is enabled
                const headers = this.getAuthHeaders();
                const response = await fetch(`/api/documents?doc=${encodeURIComponent(docParam)}`, { headers });
                const data = await response.json();
                
                if (data.documents && data.documents.length > 0) {
                    const doc = data.documents[0];
                    this.hasDocumentSelector = doc.showDocumentSelector || false;
                    
                    if (this.hasDocumentSelector && doc.ownerInfo) {
                        this.currentOwner = doc.ownerInfo.slug;
                        await this.loadDocuments();
                    }
                }
            }
        } catch (error) {
            console.error('Error checking document selector:', error);
            this.hasDocumentSelector = false;
        }
    }
    
    /**
     * Load documents for the current owner
     */
    async loadDocuments() {
        try {
            if (!this.currentOwner) return;
            
            const headers = this.getAuthHeaders();
            const response = await fetch(`/api/documents?owner=${encodeURIComponent(this.currentOwner)}`, { headers });
            const data = await response.json();
            
            this.documents = data.documents || [];
            console.log(`📚 Loaded ${this.documents.length} documents for mobile menu`);
        } catch (error) {
            console.error('Error loading documents for mobile menu:', error);
            this.documents = [];
        }
    }
    
    /**
     * Get auth headers if available
     */
    getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        
        try {
            const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
            const sessionData = localStorage.getItem(sessionKey);
            
            if (sessionData) {
                const session = JSON.parse(sessionData);
                const token = session?.access_token;
                
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                    console.log('📱 Auth token added to headers (length:', token.length, ')');
                } else {
                    console.log('📱 No access_token found in session data');
                }
            } else {
                console.log('📱 No session data found in localStorage');
            }
        } catch (error) {
            console.log('⚠️ Could not get JWT token:', error);
        }
        
        return headers;
    }
    
    /**
     * Show the hamburger toggle button
     */
    show() {
        if (this.toggle) {
            this.toggle.style.display = 'flex';
        }
    }
    
    /**
     * Hide the hamburger toggle button
     */
    hide() {
        if (this.toggle) {
            this.toggle.style.display = 'none';
        }
        
        // Remove mobile-menu-active class
        const header = document.querySelector('.header');
        if (header) {
            header.classList.remove('mobile-menu-active');
        }
    }
    
    /**
     * Open the mobile menu
     */
    async open() {
        // Refresh document data from document selector if available
        if (window.documentSelector && window.documentSelector.documents && window.documentSelector.documents.length > 0) {
            console.log('📱 Refreshing mobile menu data from document selector');
            this.documents = window.documentSelector.documents;
            this.currentOwner = window.documentSelector.currentOwner;
            this.currentDocSlug = window.documentSelector.currentDocSlug;
        }
        
        // Load user avatar
        await this.loadUserAvatar();
        
        // Show appropriate sections
        if (this.hasDocumentSelector && this.docSection) {
            this.docSection.style.display = 'block';
            this.renderDocuments();
        } else if (this.docSection) {
            this.docSection.style.display = 'none';
        }
        
        if (this.isAuthenticated && this.userSection) {
            this.userSection.style.display = 'block';
        } else if (this.userSection) {
            this.userSection.style.display = 'none';
        }
        
        // Open overlay
        this.isOpen = true;
        this.overlay?.classList.add('active');
        this.toggle?.classList.add('active');
        document.body.classList.add('mobile-menu-open');
        
        console.log('📱 Mobile menu opened with', this.documents.length, 'documents');
    }
    
    /**
     * Close the mobile menu
     */
    close() {
        this.isOpen = false;
        this.overlay?.classList.remove('active');
        this.toggle?.classList.remove('active');
        document.body.classList.remove('mobile-menu-open');
        
        // Clear search
        if (this.docSearch) {
            this.docSearch.value = '';
        }
        
        console.log('📱 Mobile menu closed');
    }
    
    /**
     * Render documents in the list
     */
    renderDocuments(searchTerm = '') {
        if (!this.docList) return;
        
        let filteredDocs = [...this.documents];
        
        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filteredDocs = filteredDocs.filter(d =>
                d.title.toLowerCase().includes(term) ||
                (d.subtitle && d.subtitle.toLowerCase().includes(term))
            );
        }
        
        // Sort alphabetically
        filteredDocs.sort((a, b) => a.title.localeCompare(b.title));
        
        if (filteredDocs.length === 0) {
            this.docList.innerHTML = `
                <div class="no-documents">
                    ${searchTerm ? 'No matching documents found' : 'No documents available'}
                </div>
            `;
            return;
        }
        
        this.docList.innerHTML = filteredDocs.map(doc => `
            <div class="document-item ${doc.slug === this.currentDocSlug ? 'active' : ''}"
                 data-slug="${doc.slug}">
                ${doc.cover ? 
                    `<img class="doc-cover-thumb" src="${doc.cover}" alt="${this.escapeHtml(doc.title)} cover" loading="lazy">` :
                    `<svg class="doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>`
                }
                <div class="document-item-content">
                    <div class="document-item-title">${this.escapeHtml(doc.title)}</div>
                    ${doc.subtitle ? `<div class="document-item-subtitle">${this.escapeHtml(doc.subtitle)}</div>` : ''}
                </div>
            </div>
        `).join('');
        
        // Add click handlers
        this.docList.querySelectorAll('.document-item').forEach(item => {
            item.addEventListener('click', () => {
                const slug = item.dataset.slug;
                this.navigateToDocument(slug);
            });
        });
    }
    
    /**
     * Filter documents based on search term
     */
    filterDocuments(searchTerm) {
        this.renderDocuments(searchTerm);
    }
    
    /**
     * Navigate to a document
     */
    navigateToDocument(slug) {
        if (slug === this.currentDocSlug) {
            this.close();
            return;
        }
        
        const url = new URL(window.location.href);
        url.searchParams.set('doc', slug);
        
        // Remove owner parameter if present
        url.searchParams.delete('owner');
        
        // Preserve document_selector parameter if it exists
        const currentParams = new URLSearchParams(window.location.search);
        const selectorValue = this.getCaseInsensitiveParam(currentParams, 'document_selector');
        if (selectorValue) {
            url.searchParams.set('document_selector', selectorValue);
        }
        
        window.location.href = url.toString();
    }
    
    /**
     * Load user avatar (owner logo if applicable)
     */
    async loadUserAvatar() {
        if (!this.isAuthenticated || !this.userAvatar) return;
        
        try {
            const headers = this.getAuthHeaders();
            
            // Check if we have an auth token before making the request
            if (!headers['Authorization']) {
                console.log('📱 No auth token available, skipping avatar load');
                return;
            }
            
            const response = await fetch(`${API_URL}/api/permissions`, { headers });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.log('📱 Could not fetch user permissions for avatar');
                console.log('   Status:', response.status, response.statusText);
                console.log('   Response:', errorText);
                console.log('   Headers sent:', headers);
                return;
            }
            
            const data = await response.json();
            const ownerGroups = data.owner_groups || [];
            
            // For users with owner groups, use the first owner group's logo
            if (ownerGroups.length > 0) {
                const primaryOwner = ownerGroups[0];
                
                const ownerResponse = await fetch(`${API_URL}/api/permissions/accessible-owners`, { headers });
                
                if (ownerResponse.ok) {
                    const owners = await ownerResponse.json();
                    const ownerData = owners.find(o => o.owner_id === primaryOwner.owner_id);
                    
                    if (ownerData && ownerData.logo_url) {
                        this.userAvatar.innerHTML = `<img src="${ownerData.logo_url}" alt="${ownerData.owner_name}" class="owner-logo" />`;
                        console.log('📱 Loaded owner logo for mobile menu avatar');
                    }
                }
            }
        } catch (error) {
            // Silently fail - this is not critical functionality
            console.log('📱 Could not load user avatar for mobile menu:', error.message);
        }
    }
    
    /**
     * Handle sign out
     */
    async handleSignOut() {
        try {
            // Clear Supabase session
            const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
            localStorage.removeItem(sessionKey);
            
            // Close menu
            this.close();
            
            // Update visibility (will hide menu since user is no longer authenticated)
            this.isAuthenticated = false;
            await this.updateVisibility();
            
            console.log('👋 User signed out from mobile menu');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }
    
    /**
     * Escape HTML for safe rendering
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Get URL parameter case-insensitively
     */
    getCaseInsensitiveParam(urlParams, paramName) {
        let value = urlParams.get(paramName);
        if (value !== null) return value;
        
        for (let [key, val] of urlParams) {
            if (key.toLowerCase() === paramName.toLowerCase()) {
                return val;
            }
        }
        return null;
    }
}

// Initialize and export
const mobileMenu = new MobileMenu();

// Update visibility on window resize
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        mobileMenu.updateVisibility();
    }, 250);
});

export default mobileMenu;

