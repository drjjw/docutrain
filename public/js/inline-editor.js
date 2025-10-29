// Inline editor component for document fields
import { API_URL } from './config.js';

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
 * Get JWT token from Supabase localStorage
 */
function getSupabaseToken() {
    try {
        const sessionKey = 'sb-mlxctdgnojvkgfqldaob-auth-token';
        const sessionData = localStorage.getItem(sessionKey);
        if (!sessionData) return null;
        const session = JSON.parse(sessionData);
        return session?.access_token || null;
    } catch (error) {
        console.error('Error getting Supabase token:', error);
        return null;
    }
}

/**
 * Normalize line breaks in contentEditable HTML
 * Converts <div> tags (created by Enter key) to <p> tags or <br> tags
 */
function normalizeLineBreaks(html) {
    if (!html) return '';
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Convert all <div> tags to <p> tags (preserves line breaks)
    const divs = tempDiv.querySelectorAll('div');
    divs.forEach(div => {
        const p = document.createElement('p');
        // Move all children from div to p
        while (div.firstChild) {
            p.appendChild(div.firstChild);
        }
        // Copy attributes if needed (though we'll sanitize these later)
        div.parentNode.replaceChild(p, div);
    });
    
    // Convert empty <p> tags to <br> tags for single line breaks
    const emptyPs = tempDiv.querySelectorAll('p:empty');
    emptyPs.forEach(p => {
        const br = document.createElement('br');
        p.parentNode.replaceChild(br, p);
    });
    
    return tempDiv.innerHTML;
}

/**
 * Sanitize HTML to prevent XSS attacks
 * Allows only safe HTML tags and attributes
 */
function sanitizeHTML(html) {
    if (!html) return '';
    
    // First normalize line breaks (convert <div> to <p>)
    html = normalizeLineBreaks(html);
    
    // Create a temporary div to parse HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Allowed tags and their allowed attributes
    const allowedTags = {
        'p': [],
        'strong': [],
        'em': [],
        'u': [],
        'br': [],
        'ul': [],
        'ol': [],
        'li': [],
        'a': ['href', 'title', 'target']
    };
    
    // Recursively clean the DOM tree
    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return node.cloneNode(true);
        }
        
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();
            
            if (!allowedTags[tagName]) {
                // Replace with text content, but preserve line breaks
                if (node.childNodes.length > 0) {
                    const fragment = document.createDocumentFragment();
                    Array.from(node.childNodes).forEach((child, index) => {
                        const cleaned = cleanNode(child);
                        if (cleaned) {
                            fragment.appendChild(cleaned);
                            // Add br for block-level elements (except last)
                            if (index < node.childNodes.length - 1 && 
                                (node.tagName === 'DIV' || node.tagName === 'P')) {
                                fragment.appendChild(document.createElement('br'));
                            }
                        }
                    });
                    return fragment;
                }
                return document.createTextNode(node.textContent);
            }
            
            const cleanElement = document.createElement(tagName);
            const allowedAttrs = allowedTags[tagName];
            
            // Copy allowed attributes
            Array.from(node.attributes).forEach(attr => {
                if (allowedAttrs.includes(attr.name)) {
                    // Sanitize href attribute to prevent javascript: and data: URLs
                    if (attr.name === 'href') {
                        const href = attr.value.trim();
                        if (href && !href.startsWith('javascript:') && !href.startsWith('data:')) {
                            cleanElement.setAttribute(attr.name, href);
                        }
                    } else {
                        cleanElement.setAttribute(attr.name, attr.value);
                    }
                }
            });
            
            // Recursively clean children
            Array.from(node.childNodes).forEach(child => {
                const cleanedChild = cleanNode(child);
                if (cleanedChild) {
                    if (cleanedChild.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                        // If child was converted to fragment, append all its children
                        Array.from(cleanedChild.childNodes).forEach(childOfFragment => {
                            cleanElement.appendChild(childOfFragment.cloneNode(true));
                        });
                    } else {
                        cleanElement.appendChild(cleanedChild);
                    }
                }
            });
            
            return cleanElement;
        }
        
        return null;
    }
    
    // Clean all nodes
    const fragment = document.createDocumentFragment();
    Array.from(tempDiv.childNodes).forEach(node => {
        const cleaned = cleanNode(node);
        if (cleaned) {
            if (cleaned.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                Array.from(cleaned.childNodes).forEach(child => {
                    fragment.appendChild(child.cloneNode(true));
                });
            } else {
                fragment.appendChild(cleaned);
            }
        }
    });
    
    // Convert back to HTML string
    const resultDiv = document.createElement('div');
    resultDiv.appendChild(fragment);
    return resultDiv.innerHTML;
}

/**
 * Create a simple WYSIWYG editor toolbar
 */
function createWysiwygToolbar(editorElement, onSave, onCancel) {
    const toolbar = document.createElement('div');
    toolbar.className = 'inline-editor-toolbar';
    
    const buttons = [
        { command: 'bold', icon: 'B', label: 'Bold' },
        { command: 'italic', icon: 'I', label: 'Italic' },
        { command: 'underline', icon: 'U', label: 'Underline' },
        { separator: true },
        { command: 'insertUnorderedList', icon: '•', label: 'Bullet List' },
        { command: 'insertOrderedList', icon: '1.', label: 'Numbered List' },
        { separator: true },
        { command: 'createLink', icon: '🔗', label: 'Link' },
    ];
    
    buttons.forEach(btn => {
        if (btn.separator) {
            const separator = document.createElement('div');
            separator.className = 'inline-editor-toolbar-separator';
            toolbar.appendChild(separator);
        } else {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'inline-editor-toolbar-btn';
            button.textContent = btn.icon;
            button.title = btn.label;
            button.addEventListener('click', (e) => {
                e.preventDefault();
                editorElement.focus();
                if (btn.command === 'createLink') {
                    const url = prompt('Enter URL:');
                    if (url) {
                        document.execCommand('createLink', false, url);
                    }
                } else {
                    document.execCommand(btn.command, false);
                }
            });
            toolbar.appendChild(button);
        }
    });
    
    // Save and Cancel buttons
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'inline-editor-toolbar-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'inline-editor-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', onSave);
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'inline-editor-cancel-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', onCancel);
    
    buttonGroup.appendChild(saveBtn);
    buttonGroup.appendChild(cancelBtn);
    toolbar.appendChild(buttonGroup);
    
    return toolbar;
}

/**
 * Initialize inline editor for an element
 * @param {HTMLElement} element - The element to make editable
 * @param {Object} options - Configuration options
 * @param {string} options.field - Field name (e.g., 'title', 'subtitle', 'welcome_message')
 * @param {string} options.documentSlug - Document slug
 * @param {string} options.type - Field type: 'text', 'textarea', or 'wysiwyg'
 * @param {string} options.originalValue - Original value before editing
 */
export function initInlineEditor(element, options) {
    const { field, documentSlug, type = 'text', originalValue } = options;
    
    if (!element || !field || !documentSlug) {
        log.error('Invalid inline editor options:', { element, field, documentSlug });
        return;
    }
    
    // Don't initialize if already initialized
    if (element.dataset.inlineEditor === 'true') {
        return;
    }
    
    element.dataset.inlineEditor = 'true';
    
    // Store original value
    const initialValue = originalValue || element.textContent || element.innerHTML || '';
    
    // Add edit icon on hover
    let editIcon = null;
    let isEditing = false;
    
    function showEditIcon() {
        if (isEditing || editIcon) return;
        
        editIcon = document.createElement('button');
        editIcon.className = 'inline-edit-icon';
        editIcon.innerHTML = '✏️';
        editIcon.title = 'Click to edit';
        editIcon.type = 'button';
        editIcon.style.cssText = `
            position: absolute;
            top: 4px;
            right: 4px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: none;
            border-radius: 4px;
            padding: 4px 8px;
            cursor: pointer;
            font-size: 12px;
            z-index: 100;
            opacity: 0;
            transition: opacity 0.2s;
            pointer-events: auto;
        `;
        
        // Always attach icon directly to the editable element, not parent
        // This prevents overlap when multiple editable elements share the same parent
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.position === 'static') {
            element.style.position = 'relative';
        }
        element.appendChild(editIcon);
        
        // Show on hover
        const showIcon = () => {
            if (!isEditing) editIcon.style.opacity = '1';
        };
        const hideIcon = () => {
            if (!isEditing) editIcon.style.opacity = '0';
        };
        
        element.addEventListener('mouseenter', showIcon);
        editIcon.addEventListener('mouseenter', showIcon);
        editIcon.addEventListener('mouseleave', hideIcon);
        
        editIcon.addEventListener('click', (e) => {
            e.stopPropagation();
            startEditing();
        });
    }
    
    function hideEditIcon() {
        if (editIcon) {
            editIcon.remove();
            editIcon = null;
        }
    }
    
    async function saveValue(value) {
        const token = getSupabaseToken();
        if (!token) {
            log.error('Cannot save: user not authenticated');
            return false;
        }
        
        try {
            // Show loading state
            element.classList.add('inline-editor-saving');
            
            const response = await fetch(`${API_URL}/api/documents/${documentSlug}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    [field]: value
                })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save');
            }
            
            const data = await response.json();
            
            // Clear document cache
            localStorage.removeItem('ukidney-documents-cache');
            
            // Clear edit permission cache for this document
            if (window.clearEditPermissionCacheForDocument) {
                window.clearEditPermissionCacheForDocument(documentSlug);
            }
            
            log.verbose(`✅ Saved ${field} for document ${documentSlug}`);
            
            // Update element with new value
            if (type === 'wysiwyg') {
                element.innerHTML = sanitizeHTML(value);
            } else {
                element.textContent = value;
            }
            
            return true;
            
        } catch (error) {
            console.error(`Failed to save ${field}:`, error);
            alert(`Failed to save changes: ${error.message}`);
            return false;
        } finally {
            element.classList.remove('inline-editor-saving');
        }
    }
    
    function startEditing() {
        if (isEditing) return;
        
        isEditing = true;
        hideEditIcon();
        
        const currentValue = type === 'wysiwyg' 
            ? element.innerHTML 
            : element.textContent;
        
        if (type === 'wysiwyg') {
            // WYSIWYG editing
            element.contentEditable = 'true';
            element.classList.add('inline-editor-active');
            
            // Set default paragraph tag for Enter key (so it creates <p> instead of <div>)
            document.execCommand('defaultParagraphSeparator', false, 'p');
            
            // Create toolbar
            const toolbar = createWysiwygToolbar(
                element,
                async () => {
                    // Normalize line breaks before sanitizing
                    let newValue = element.innerHTML;
                    // Replace <div> tags with <p> tags (browsers sometimes create divs)
                    newValue = newValue.replace(/<div>/gi, '<p>').replace(/<\/div>/gi, '</p>');
                    // Replace empty <p> tags with <br>
                    newValue = newValue.replace(/<p><\/p>/gi, '<br>');
                    newValue = sanitizeHTML(newValue);
                    const saved = await saveValue(newValue);
                    if (saved) {
                        stopEditing();
                    }
                },
                () => {
                    element.innerHTML = currentValue;
                    stopEditing();
                }
            );
            
            element.parentElement.insertBefore(toolbar, element);
            
            // Focus editor
            element.focus();
            
            // Select all text if element is empty or just whitespace
            if (!element.textContent.trim()) {
                const range = document.createRange();
                range.selectNodeContents(element);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // Handle Enter key to preserve line breaks
            element.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    // Default behavior creates <p> or <div> - we'll normalize it on save
                    // Shift+Enter creates <br> which is fine
                }
            });
            
        } else {
            // Text/textarea editing
            const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
            input.type = 'text';
            input.value = currentValue;
            input.className = 'inline-editor-input';
            input.style.cssText = `
                width: 100%;
                border: 2px solid #007bff;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: inherit;
                font-family: inherit;
                background: white;
            `;
            
            if (type === 'textarea') {
                input.style.minHeight = '60px';
                input.style.resize = 'vertical';
            }
            
            // Replace element content with input
            const originalDisplay = element.style.display;
            element.style.display = 'none';
            element.parentElement.insertBefore(input, element);
            
            input.focus();
            input.select();
            
            let saved = false;
            
            async function finishEditing() {
                if (saved) return;
                
                const newValue = input.value.trim();
                
                if (newValue !== currentValue.trim()) {
                    saved = await saveValue(newValue);
                    if (saved) {
                        element.textContent = newValue;
                    }
                }
                
                // Restore element
                input.remove();
                element.style.display = originalDisplay;
                isEditing = false;
                showEditIcon();
            }
            
            // Save on blur
            input.addEventListener('blur', finishEditing);
            
            // Save on Enter (for text inputs only)
            if (type === 'text') {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        input.blur();
                    }
                });
            }
            
            // Cancel on Escape
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    input.remove();
                    element.style.display = originalDisplay;
                    isEditing = false;
                    showEditIcon();
                }
            });
        }
    }
    
    function stopEditing() {
        if (!isEditing) return;
        
        isEditing = false;
        
        if (type === 'wysiwyg') {
            element.contentEditable = 'false';
            element.classList.remove('inline-editor-active');
            
            // Remove toolbar
            const toolbar = element.parentElement.querySelector('.inline-editor-toolbar');
            if (toolbar) {
                toolbar.remove();
            }
        }
        
        showEditIcon();
    }
    
    // Initialize edit icon on hover
    showEditIcon();
    
    // Also allow clicking the element to edit (for better UX)
    element.style.cursor = 'pointer';
    element.addEventListener('click', (e) => {
        if (!isEditing && editIcon && editIcon.style.opacity === '1') {
            startEditing();
        }
    });
}

