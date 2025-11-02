/**
 * DocumentSelector - Dropdown selector for switching between documents
 * Ported from vanilla JS document-selector.js
 * Only shown when ?document_selector=true or in owner mode
 * In owner mode, shows as centered modal (non-dismissible)
 */

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';

interface Document {
  slug: string;
  title: string;
  subtitle?: string;
  owner?: string;
  showDocumentSelector?: boolean; // Database value for selector visibility
  ownerInfo?: {
    slug: string;
    name: string;
  } | null;
}

interface DocumentSelectorProps {
  ownerSlug?: string | null; // For future use if needed
  currentDocSlug: string | null; // Can be null when no document is selected
  inline?: boolean; // If true, renders content only (no button/dropdown) for inline use
  onItemClick?: () => void; // Callback when document is selected (useful for closing mobile menu)
}

export function DocumentSelector({ currentDocSlug, inline = false, onItemClick }: DocumentSelectorProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [shouldShow, setShouldShow] = useState(false); // Now a state, computed after loading documents
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRootRef = useRef<HTMLDivElement>(null);
  const dropdownRootRef = useRef<HTMLDivElement>(null); // Ref for dropdown portal root
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for dropdown to prevent click propagation
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; right?: number; left?: number } | null>(null);

  const documentSelectorParam = searchParams.get('document_selector');
  const ownerParam = searchParams.get('owner');
  const passcodeParam = searchParams.get('passcode');
  const docParam = searchParams.get('doc'); // Check if document is already selected
  
  // In owner mode (with no doc param), use modal mode (centered, non-dismissible)
  // NOTE: When no owner param and no doc param, DocumentOwnerModal shows instead, not this component
  const isModalMode = !!ownerParam && !docParam;
  
  // Reset isOpen when URL changes back to modal mode (for browser back button)
  // This handles navigation back to the page with owner param
  useEffect(() => {
    setIsOpen(isModalMode);
  }, [isModalMode]); // Set isOpen directly based on isModalMode
  
  // Track if we're transitioning FROM owner mode (had owner param previously)
  // This prevents flashing when navigating away from owner mode
  const [wasInOwnerMode, setWasInOwnerMode] = useState(false);

  // Update wasInOwnerMode when we detect owner mode
  useEffect(() => {
    if (!!ownerParam && !docParam) {
      setWasInOwnerMode(true);
    } else if (docParam && !ownerParam && wasInOwnerMode) {
      // We're transitioning out of owner mode - reset after a brief delay
      setTimeout(() => setWasInOwnerMode(false), 100);
    }
  }, [ownerParam, docParam, wasInOwnerMode]);

  // Only hide immediately if we're actually transitioning FROM owner mode TO a document
  // Don't hide if we're just viewing a normal document (that's the normal case)
  const shouldHideImmediately = !!docParam && !ownerParam && wasInOwnerMode && documentSelectorParam !== 'true';

  // Reset shouldShow immediately when transitioning out of owner mode (prevents flash)
  useEffect(() => {
    if (shouldHideImmediately && shouldShow) {
      setShouldShow(false);
    }
  }, [shouldHideImmediately, shouldShow]);

  // Load documents and determine visibility (matches vanilla JS logic)
  useEffect(() => {
    async function loadDocuments() {
      try {
        setLoading(true);

        let apiUrl = '/api/documents';
        
        if (ownerParam) {
          apiUrl += `?owner=${encodeURIComponent(ownerParam)}`;
          if (passcodeParam) {
            apiUrl += `&passcode=${encodeURIComponent(passcodeParam)}`;
          }
        } else if (currentDocSlug) {
          // If we have a document slug, fetch that specific document
          apiUrl += `?doc=${encodeURIComponent(currentDocSlug)}`;
          if (passcodeParam) {
            apiUrl += `&passcode=${encodeURIComponent(passcodeParam)}`;
          }
        } else {
          // No doc param and no owner param: load all documents to show in selector
          if (passcodeParam) {
            apiUrl += `?passcode=${encodeURIComponent(passcodeParam)}`;
          }
        }

        // Get JWT token if available
        const headers: HeadersInit = {
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
            }
          }
        } catch (error) {
          // Ignore token errors
        }

        const response = await fetch(apiUrl, { headers });
        const data = await response.json();
        const loadedDocuments = data.documents || [];
        setDocuments(loadedDocuments);

        // Determine if selector should be shown (matches vanilla JS logic)
        // Priority: URL parameter (true/false) > owner mode (with no doc) > database value > default (false)
        // NOTE: Do NOT show when no doc param AND no owner param - that's when DocumentOwnerModal shows
        let showSelector = false;
        
        if (documentSelectorParam !== null) {
          // URL parameter explicitly set - it overrides everything
          showSelector = documentSelectorParam === 'true';
        } else if (ownerParam && !docParam) {
          // Show selector ONLY when in owner mode with no doc selected
          // When no owner param and no doc param, DocumentOwnerModal shows instead
          showSelector = true;
        } else if (currentDocSlug) {
          // Check database value for current document
          const currentDoc = loadedDocuments.find((d: Document) => d.slug === currentDocSlug);
          showSelector = currentDoc?.showDocumentSelector !== false; // Default to true if not explicitly false
        }

        setShouldShow(showSelector);

        // If we only fetched one document and should expand to owner documents, fetch all from the same owner
        // Use ownerInfo (matches vanilla JS logic)
        if (loadedDocuments.length === 1 && showSelector && loadedDocuments[0].ownerInfo) {
          const ownerApiUrl = `/api/documents?owner=${encodeURIComponent(loadedDocuments[0].ownerInfo.slug)}${passcodeParam ? `&passcode=${encodeURIComponent(passcodeParam)}` : ''}`;
          const ownerResponse = await fetch(ownerApiUrl, { headers });
          const ownerData = await ownerResponse.json();
          setDocuments(ownerData.documents || []);
        }
      } catch (error) {
        console.error('Error loading documents:', error);
        setDocuments([]);
        setShouldShow(false);
      } finally {
        setLoading(false);
      }
    }

    loadDocuments();
  }, [ownerParam, currentDocSlug, passcodeParam, documentSelectorParam, docParam]);

  // Ensure modal is open when shouldShow becomes true (after documents load)
  // This is a secondary check in case documents load after URL change
  useEffect(() => {
    if (shouldShow && isModalMode) {
      setIsOpen(true);
    }
  }, [shouldShow, isModalMode]);

  // Create modal root for portal when in modal mode
  useEffect(() => {
    if (isModalMode && isOpen && !modalRootRef.current) {
      const modalRoot = document.createElement('div');
      modalRoot.id = 'document-selector-modal-root';
      document.body.appendChild(modalRoot);
      modalRootRef.current = modalRoot;
    }
    
    return () => {
      if (modalRootRef.current && modalRootRef.current.parentNode) {
        modalRootRef.current.parentNode.removeChild(modalRootRef.current);
        modalRootRef.current = null;
      }
    };
  }, [isModalMode, isOpen]);

  // Create dropdown root for portal when in dropdown mode
  useEffect(() => {
    if (!isModalMode && isOpen && !dropdownRootRef.current) {
      const dropdownRoot = document.createElement('div');
      dropdownRoot.id = 'document-selector-dropdown-root';
      dropdownRoot.style.position = 'fixed';
      dropdownRoot.style.top = '0';
      dropdownRoot.style.left = '0';
      dropdownRoot.style.width = '100%';
      dropdownRoot.style.height = '100%';
      dropdownRoot.style.pointerEvents = 'none';
      dropdownRoot.style.zIndex = '9999';
      document.body.appendChild(dropdownRoot);
      dropdownRootRef.current = dropdownRoot;
    }
    
    return () => {
      if (dropdownRootRef.current && dropdownRootRef.current.parentNode) {
        dropdownRootRef.current.parentNode.removeChild(dropdownRootRef.current);
        dropdownRootRef.current = null;
      }
    };
  }, [isModalMode, isOpen]);

  // Calculate dropdown position based on button position
  useEffect(() => {
    if (!isModalMode && isOpen && buttonRef.current) {
      const updatePosition = () => {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const dropdownWidth = 320; // w-80 = 320px
          const margin = 16; // Add some margin from screen edge
          
          // Calculate position, ensuring dropdown doesn't go off-screen
          const rightFromButton = window.innerWidth - rect.right;
          
          // Check if dropdown would overflow on the right
          if (rightFromButton + dropdownWidth > window.innerWidth - margin) {
            // Position from left edge instead
            setDropdownPosition({
              top: rect.bottom + 8, // mt-2 = 8px
              left: Math.max(margin, rect.left - dropdownWidth + rect.width), // Align right edge of dropdown to right edge of button, but keep margin from left
            });
          } else {
            // Position from right edge (normal case)
            setDropdownPosition({
              top: rect.bottom + 8, // mt-2 = 8px
              right: rightFromButton,
            });
          }
        }
      };
      
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    } else {
      setDropdownPosition(null);
    }
  }, [isModalMode, isOpen]);

  // Close dropdown when clicking outside (only in dropdown mode, not modal mode)
  useEffect(() => {
    if (isModalMode || !isOpen) return; // Don't close on outside click in modal mode
    
    // Use a ref to track if we're in the process of opening (to prevent immediate close)
    const openingRef = { current: true };
    setTimeout(() => {
      openingRef.current = false;
    }, 100);
    
    function handleClickOutside(event: MouseEvent) {
      // Don't close if we just opened
      if (openingRef.current) return;
      
      // Check if click is outside both button and dropdown
      const target = event.target as Node;
      if (
        containerRef.current &&
        buttonRef.current &&
        dropdownRef.current &&
        !containerRef.current.contains(target) &&
        !buttonRef.current.contains(target) &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    // Use a slight delay to prevent immediate closing when button is clicked
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true); // Use capture phase
    }, 50);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isOpen, isModalMode]);

  // Close on escape key (only in dropdown mode, not modal mode)
  useEffect(() => {
    if (isModalMode) return; // Don't close on escape in modal mode
    
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, isModalMode]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Hide immediately if transitioning out of owner mode (prevents flash)
  // Only hide if we actually had an owner param before (not just a normal document view)
  if (shouldHideImmediately && !inline) {
    return null;
  }
  
  // Also hide if no doc param and no owner param - DocumentOwnerModal shows instead
  if (!docParam && !ownerParam && !inline) {
    return null;
  }
  
  if (!shouldShow && !inline) {
    return null;
  }

  const currentDoc = currentDocSlug ? documents.find(d => d.slug === currentDocSlug) : null;

  // Filter documents based on search query
  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.subtitle && doc.subtitle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle document selection (defined before inline check)
  const handleDocumentSelect = (docSlug: string) => {
    // Close modal immediately before navigation to ensure it closes
    setIsOpen(false);
    setSearchQuery('');
    
    // Call onItemClick callback if provided (for closing mobile menu)
    if (onItemClick) {
      onItemClick();
    }
    
    const newParams = new URLSearchParams(searchParams);
    newParams.set('doc', docSlug);
    
    // If in owner mode, remove the owner parameter since user has selected a document
    // (matches vanilla JS behavior)
    if (ownerParam) {
      newParams.delete('owner');
    }
    
    // Preserve other params
    if (passcodeParam) newParams.set('passcode', passcodeParam);
    if (documentSelectorParam === 'true') newParams.set('document_selector', 'true');
    
    // Note: basename="/app" is set in AppRouter, so we use /chat not /app/chat
    navigate(`/chat?${newParams.toString()}`);
  };

  // If inline mode, render just the document list without button/dropdown wrapper
  if (inline) {
    return (
      <div className="w-full h-full flex flex-col">
        {/* Search */}
        <div className="mb-4 flex-shrink-0">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Document List - Scrollable, fills available space */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="py-8 text-center">
              <div className="inline-flex items-center gap-2 text-gray-500">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Loading documents...</span>
              </div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-8 text-center">
              <div className="text-gray-500 text-sm">
                {searchQuery ? 'No documents found' : 'No documents available'}
              </div>
            </div>
          ) : (
            <div className="space-y-1 pr-2">
              {filteredDocuments.map((doc) => (
                <button
                  key={doc.slug}
                  onClick={() => handleDocumentSelect(doc.slug)}
                  className={`w-full text-left transition-all duration-200 rounded-lg px-4 py-3 ${
                    doc.slug === currentDocSlug
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 shadow-sm'
                      : 'hover:bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-8 h-8 rounded-lg ${
                        doc.slug === currentDocSlug
                          ? 'bg-blue-500'
                          : 'bg-gray-200'
                      } flex items-center justify-center transition-colors`}>
                        <svg
                          className={`w-5 h-5 ${
                            doc.slug === currentDocSlug ? 'text-white' : 'text-gray-600'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold ${
                        doc.slug === currentDocSlug
                          ? 'text-blue-900'
                          : 'text-gray-900'
                      } text-sm leading-tight`}>
                        {doc.title}
                      </div>
                      {doc.subtitle && (
                        <div className={`text-xs mt-1 ${
                          doc.slug === currentDocSlug
                            ? 'text-blue-700'
                            : 'text-gray-600'
                        } leading-relaxed`}>
                          {doc.subtitle}
                        </div>
                      )}
                    </div>
                    {doc.slug === currentDocSlug && (
                      <div className="flex-shrink-0 flex items-center">
                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Get owner display name for modal title
  const getOwnerDisplayName = () => {
    if (!ownerParam) return 'Available Documents';
    let displayName = ownerParam.charAt(0).toUpperCase() + ownerParam.slice(1);
    if (ownerParam === 'ukidney') {
      displayName = 'UKidney Medical';
    }
    return `${displayName} Documents`;
  };

  // Modal content (reusable for both dropdown and modal)
  const modalContent = (
    <>
      {/* Overlay for modal mode */}
      {isModalMode && isOpen && (
        <div 
          className="document-selector-overlay active"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9999998,
            pointerEvents: 'none', // Don't allow closing by clicking overlay in owner mode
          }}
        />
      )}
      
      <div 
        ref={dropdownRef}
        className={`bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col ${
          isModalMode 
            ? 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[800px] max-w-[95vw] max-h-[85vh] z-[9999999]'
            : 'fixed w-80 max-h-[60vh] pointer-events-auto max-w-[calc(100vw-32px)]'
        }`}
        style={!isModalMode && dropdownPosition ? {
          top: `${dropdownPosition.top}px`,
          ...(dropdownPosition.right !== undefined ? { right: `${dropdownPosition.right}px` } : {}),
          ...(dropdownPosition.left !== undefined ? { left: `${dropdownPosition.left}px` } : {}),
        } : undefined}
        onClick={(e) => {
          e.stopPropagation(); // Prevent clicks inside dropdown from bubbling
        }}
        onMouseDown={(e) => {
          e.stopPropagation(); // Prevent mousedown from triggering outside click handler
        }}
      >
        {/* Header - Enhanced styling */}
        <div className={`${isModalMode ? 'px-8 py-6' : 'px-4 py-3'} border-b ${isModalMode ? 'border-gray-300 bg-gradient-to-r from-gray-50 to-white' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`${isModalMode ? 'w-10 h-10' : 'w-8 h-8'} rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <svg
                className={`${isModalMode ? 'w-6 h-6' : 'w-5 h-5'} text-white`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`${isModalMode ? 'text-xl' : 'text-sm'} font-bold text-gray-900 leading-tight`}>
                {isModalMode ? getOwnerDisplayName() : 'Available Documents'}
              </h3>
              {isModalMode && (
                <p className="text-sm text-gray-600 mt-1">
                  Select a document to begin chatting
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className={`${isModalMode ? 'px-8 py-4' : 'px-4 py-2'} border-b border-gray-200 bg-gray-50`}>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isModalMode ? 'pl-11 pr-4 py-3 text-base' : 'pl-10 pr-3 py-2 text-sm'} border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-shadow`}
            />
          </div>
        </div>

        {/* Document List */}
        <div className={`flex-1 overflow-y-auto ${isModalMode ? 'py-4' : 'py-2'}`}>
          {loading ? (
            <div className={`${isModalMode ? 'px-8 py-12' : 'px-4 py-8'} text-center`}>
              <div className="inline-flex items-center gap-2 text-gray-500">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className={`${isModalMode ? 'text-base' : 'text-sm'}`}>Loading documents...</span>
              </div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className={`${isModalMode ? 'px-8 py-12' : 'px-4 py-8'} text-center`}>
              <div className={`text-gray-500 ${isModalMode ? 'text-base' : 'text-sm'}`}>
                {searchQuery ? 'No documents found' : 'No documents available'}
              </div>
            </div>
          ) : (
            <div className={`${isModalMode ? 'space-y-2 px-4' : 'space-y-1 px-2'}`}>
              {filteredDocuments.map((doc) => (
                <button
                  key={doc.slug}
                  onClick={() => handleDocumentSelect(doc.slug)}
                  className={`w-full text-left transition-all duration-200 rounded-lg ${
                    doc.slug === currentDocSlug
                      ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 shadow-sm'
                      : 'hover:bg-gray-50 border-2 border-transparent hover:border-gray-200 hover:shadow-sm'
                  } ${isModalMode ? 'px-6 py-4' : 'px-4 py-2'}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 ${isModalMode ? 'mt-1' : ''}`}>
                      <div className={`${isModalMode ? 'w-10 h-10' : 'w-8 h-8'} rounded-lg ${
                        doc.slug === currentDocSlug
                          ? 'bg-blue-500'
                          : 'bg-gray-200 group-hover:bg-gray-300'
                      } flex items-center justify-center transition-colors`}>
                        <svg
                          className={`${isModalMode ? 'w-6 h-6' : 'w-5 h-5'} ${
                            doc.slug === currentDocSlug ? 'text-white' : 'text-gray-600'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold ${
                        doc.slug === currentDocSlug
                          ? 'text-blue-900'
                          : 'text-gray-900'
                      } ${isModalMode ? 'text-lg' : 'text-sm'} leading-tight`}>
                        {doc.title}
                      </div>
                      {doc.subtitle && (
                        <div className={`${isModalMode ? 'text-sm mt-1.5' : 'text-xs mt-1'} ${
                          doc.slug === currentDocSlug
                            ? 'text-blue-700'
                            : 'text-gray-600'
                        } leading-relaxed`}>
                          {doc.subtitle}
                        </div>
                      )}
                    </div>
                    {doc.slug === currentDocSlug && (
                      <div className="flex-shrink-0 flex items-center">
                        <svg
                          className={`${isModalMode ? 'w-6 h-6' : 'w-5 h-5'} text-blue-600`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Footer with escape links - only shown in modal mode */}
        {isModalMode && (
          <div className="flex-shrink-0 px-8 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-center gap-6">
              <a
                href="/app/login"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                Login
              </a>
              <span className="text-gray-300">|</span>
              <a
                href="/app/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Home
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Button (hidden in modal mode) */}
      {!isModalMode && (
        <div ref={containerRef} className="relative flex items-center flex-shrink-0 min-w-0">
          <button
            ref={buttonRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // Use a small delay to ensure state updates properly
              requestAnimationFrame(() => {
                setIsOpen(prev => !prev);
              });
            }}
            onMouseDown={(e) => {
              // Prevent mousedown from triggering outside click handler
              e.stopPropagation();
              e.preventDefault();
            }}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors max-w-[240px] min-w-0 ${
              isOpen
                ? 'bg-gray-50 border-gray-300 text-gray-900'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <svg
              className="w-5 h-5 flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-sm font-medium truncate min-w-0">
              {currentDoc ? currentDoc.title : 'Select Document'}
            </span>
            <svg
              className={`w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {/* Button only - dropdown rendered via portal */}
        </div>
      )}

      {/* Dropdown mode - render via portal */}
      {!isModalMode && isOpen && dropdownRootRef.current && createPortal(modalContent, dropdownRootRef.current)}

      {/* Modal mode - render via portal */}
      {isModalMode && isOpen && modalRootRef.current && createPortal(modalContent, modalRootRef.current)}
    </>
  );
}
