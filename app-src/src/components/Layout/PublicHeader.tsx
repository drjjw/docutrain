/**
 * PublicHeader - Header for public pages (Terms, Contact, etc.)
 * Shows DocuTrain logo and navigation
 * Conditionally shows sign out button if user is logged in
 * Enhanced with more menu items and mobile menu support
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { docutrainLogoUrl } from '@/assets';

export function PublicHeader() {
  const { user, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Prevent body scroll when mobile menu is open
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    setIsMobileMenuOpen(false);
    // Redirect to login with logout message
    setTimeout(() => {
      window.location.href = '/app/login?logout=true';
    }, 100);
  };

  const handleLinkClick = (href: string, e?: React.MouseEvent<HTMLAnchorElement>) => {
    setIsMobileMenuOpen(false);
    
    // Handle anchor links to home page with scroll offset
    if (href.startsWith('/#')) {
      if (e) {
        e.preventDefault();
      }
      // Navigate to home page with hash - the landing.js will handle the scroll offset
      // href is '/#features', we need to navigate to '/#features' (home page + hash)
      const hash = href.substring(1); // Get '#features'
      window.location.href = '/' + hash; // Navigate to '/#features'
      return false;
    }
    // For non-anchor links, let them navigate normally (don't prevent default)
    return true;
  };

  const navLinks = [
    { href: '/#features', label: 'Features' },
    { href: '/#how-it-works', label: 'How It Works' },
    { href: '/#rationale', label: 'Why Context Matters' },
    { href: '/#about', label: 'About' },
    { href: '/app/chat', label: 'Chat' },
    { href: '/app/contact', label: 'Contact' },
    { href: '/app/terms', label: 'Terms' },
    ...(user ? [{ href: '/app/dashboard', label: 'Dashboard' }] : []),
  ];

  return (
    <>
      <header className="bg-white border-b border-gray-200/60 shadow-sm md:sticky md:top-0 z-50 backdrop-blur-sm bg-white/95">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
              aria-label="Go to home"
            >
              <img
                src={docutrainLogoUrl}
                alt="DocuTrain Logo"
                className="h-14 w-auto max-w-[200px]"
              />
            </button>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6 lg:gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    if (link.href.startsWith('/#')) {
                      e.preventDefault();
                      handleLinkClick(link.href, e);
                    }
                    // For non-anchor links, let them navigate normally
                  }}
                  className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors whitespace-nowrap"
                >
                  {link.label}
                </a>
              ))}
              
              {/* Sign Out Button - Desktop */}
              {user && (
                <>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={handleSignOut}
                    className="text-gray-600 hover:text-gray-900 font-medium text-sm transition-colors whitespace-nowrap"
                  >
                    Sign Out
                  </button>
                </>
              )}
            </nav>

            {/* Mobile: Show key navigation items + menu toggle */}
            <div className="md:hidden flex items-center gap-2">
              {/* Key navigation items - only show if user is not logged in */}
              {!user && (
                <nav className="flex items-center gap-3 mr-2">
                  {/* Show most important links */}
                  {navLinks
                    .filter(link => ['Chat', 'Contact'].includes(link.label))
                    .map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        onClick={(e) => {
                          if (link.href.startsWith('/#')) {
                            e.preventDefault();
                            handleLinkClick(link.href, e);
                          }
                        }}
                        className="text-gray-600 hover:text-gray-900 font-medium text-xs transition-colors whitespace-nowrap px-2 py-1.5 rounded-md hover:bg-gray-50"
                      >
                        {link.label}
                      </a>
                    ))}
                </nav>
              )}
              
              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="flex flex-col justify-center gap-1.5 w-10 h-10 rounded-lg transition-colors hover:bg-gray-100 flex-shrink-0"
                aria-label="Toggle menu"
                aria-expanded={isMobileMenuOpen}
              >
                <span
                  className={`block h-0.5 w-6 bg-gray-700 transition-all ${
                    isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''
                  }`}
                />
                <span
                  className={`block h-0.5 w-6 bg-gray-700 transition-all ${
                    isMobileMenuOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`block h-0.5 w-6 bg-gray-700 transition-all ${
                    isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          
          {/* Menu Panel */}
          <div
            className="absolute right-0 top-0 h-full w-[85%] max-w-sm bg-white shadow-xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => {
                      if (link.href.startsWith('/#')) {
                        e.preventDefault();
                        handleLinkClick(link.href, e);
                      } else {
                        setIsMobileMenuOpen(false);
                      }
                    }}
                    className="px-4 py-3 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium rounded-lg transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
                
                {/* Sign Out Button - Mobile */}
                {user && (
                  <>
                    <div className="h-px bg-gray-200 my-2" />
                    <button
                      onClick={handleSignOut}
                      className="px-4 py-3 text-left text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium rounded-lg transition-colors"
                    >
                      Sign Out
                    </button>
                  </>
                )}
              </nav>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

