/**
 * CombinedHeaderMenu - Combines UserMenu and DocumentSelector
 * On mobile: Shows as a hamburger menu with both options in an overlay
 * On desktop: Shows as separate buttons (original behavior)
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { UserMenu } from './UserMenu';
import { DocumentSelector } from './DocumentSelector';

interface CombinedHeaderMenuProps {
  documentSlug: string;
  ownerSlug?: string | null;
  shouldShowDocumentSelector: boolean;
}

export function CombinedHeaderMenu({ 
  documentSlug, 
  ownerSlug,
  shouldShowDocumentSelector 
}: CombinedHeaderMenuProps) {
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const portalRootRef = useRef<HTMLDivElement | null>(null);

  // Check if mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        isMobileMenuOpen &&
        menuRef.current &&
        overlayRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        overlayRef.current.contains(event.target as Node)
      ) {
        setIsMobileMenuOpen(false);
      }
    }

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden'; // Prevent body scroll
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.body.style.overflow = '';
      };
    }
  }, [isMobileMenuOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  // Create portal root for mobile menu overlay (renders outside header)
  useEffect(() => {
    if (isMobileMenuOpen) {
      // Create portal root immediately if it doesn't exist
      if (!portalRootRef.current) {
        const portalRoot = document.createElement('div');
        portalRoot.id = 'mobile-menu-portal-root';
        portalRoot.style.position = 'fixed';
        portalRoot.style.top = '0';
        portalRoot.style.left = '0';
        portalRoot.style.right = '0';
        portalRoot.style.bottom = '0';
        portalRoot.style.pointerEvents = 'auto';
        portalRoot.style.zIndex = '9999998';
        document.body.appendChild(portalRoot);
        portalRootRef.current = portalRoot;
        setPortalReady(true); // Trigger re-render now that portal root exists
      } else {
        // Re-enable pointer events when menu opens
        if (portalRootRef.current) {
          portalRootRef.current.style.pointerEvents = 'auto';
        }
        setPortalReady(true);
      }
    } else {
      // Disable pointer events when menu closes (for animation)
      if (portalRootRef.current) {
        portalRootRef.current.style.pointerEvents = 'none';
      }
      setPortalReady(false);
      
      // Note: Portal root cleanup happens on next open or component unmount
    }
    
    // Cleanup: remove portal root when component unmounts
    return () => {
      if (portalRootRef.current && portalRootRef.current.parentNode) {
        portalRootRef.current.parentNode.removeChild(portalRootRef.current);
        portalRootRef.current = null;
      }
    };
  }, [isMobileMenuOpen]);

  // Only show mobile menu if we have user OR document selector
  const shouldShowMobileMenu = isMobile && (!!user || shouldShowDocumentSelector);

  if (!shouldShowMobileMenu) {
    // Desktop view: show separate components
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <UserMenu />
        {shouldShowDocumentSelector && (
          <DocumentSelector
            ownerSlug={ownerSlug}
            currentDocSlug={documentSlug}
          />
        )}
      </div>
    );
  }

  // Mobile view: show hamburger menu
  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
          isMobileMenuOpen
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-700 hover:bg-gray-100'
        }`}
        aria-label="Menu"
      >
        <div className="flex flex-col justify-center gap-1.5 w-5 h-5">
          <span
            className={`block h-0.5 w-full bg-current transition-all ${
              isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''
            }`}
          />
          <span
            className={`block h-0.5 w-full bg-current transition-all ${
              isMobileMenuOpen ? 'opacity-0' : ''
            }`}
          />
          <span
            className={`block h-0.5 w-full bg-current transition-all ${
              isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
            }`}
          />
        </div>
      </button>

      {/* Mobile Menu Overlay - Render via portal to escape header constraints */}
      {isMobileMenuOpen && portalReady && portalRootRef.current && createPortal(
        <>
          {/* Backdrop */}
          <div
            ref={overlayRef}
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
            style={{ zIndex: 9999998 }}
          />

          {/* Menu Panel */}
          <div
            ref={menuRef}
            className="fixed right-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-2xl flex flex-col"
            style={{ 
              zIndex: 9999999,
              animation: 'slideInRight 0.3s ease-out'
            }}
          >
            {/* Header */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close menu"
              >
                <svg
                  className="w-6 h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Content - NOT scrollable, only DocumentSelector internal area scrolls */}
            <div className="flex-1 overflow-y-hidden min-h-0 flex flex-col">
              <div className="flex-1 flex flex-col min-h-0">
                {/* Document Selector Section - can be scrollable if needed */}
                {shouldShowDocumentSelector && (
                  <div className="flex-1 flex flex-col min-h-0 border-b border-gray-200">
                    <div className="flex-shrink-0 px-4 pt-4 pb-3">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        Documents
                      </h3>
                    </div>
                    {/* Render DocumentSelector in inline mode (no button/dropdown) - this will handle its own scrolling */}
                    <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4">
                      <DocumentSelector
                        ownerSlug={ownerSlug}
                        currentDocSlug={documentSlug}
                        inline={true}
                        onItemClick={() => setIsMobileMenuOpen(false)}
                      />
                    </div>
                  </div>
                )}

                {/* User Menu Section - fixed, no scroll */}
                {user && (
                  <div className="flex-shrink-0">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                        Account
                      </h3>
                    </div>
                    {/* Render UserMenu in inline mode (no button/dropdown) */}
                    <div className="px-4 py-4">
                      <UserMenu 
                        inline={true} 
                        onItemClick={() => setIsMobileMenuOpen(false)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>,
        portalRootRef.current
      )}

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
}

