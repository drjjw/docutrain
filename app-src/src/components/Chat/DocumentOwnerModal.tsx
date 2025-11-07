/**
 * DocumentOwnerModal - Modal for selecting document or owner slug
 * Ported from vanilla JS ui-document.js SweetAlert modal
 * Shown when no document is selected and no owner parameter is present
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { docutrainIconUrl } from '@/assets';
import { useAuth } from '@/hooks/useAuth';

interface DocumentOwnerModalProps {
  isOpen: boolean;
  customMessage?: string; // Optional custom message to display (e.g., for document not found)
  attemptedSlug?: string; // Optional slug that was attempted (for pre-filling input)
}

export function DocumentOwnerModal({ isOpen, customMessage, attemptedSlug }: DocumentOwnerModalProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [documentSlug, setDocumentSlug] = useState(attemptedSlug || '');
  const [ownerSlug, setOwnerSlug] = useState('');
  const [availableOwners, setAvailableOwners] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const ownerInputRef = useRef<HTMLInputElement>(null);

  // Load available owners for autocomplete
  useEffect(() => {
    if (isOpen) {
      async function loadOwners() {
        try {
          const response = await fetch('/api/owner-logos');
          if (response.ok) {
            const data = await response.json();
            setAvailableOwners(Object.keys(data.owners || {}));
          }
        } catch (error) {
          console.warn('Failed to fetch owners for autocomplete:', error);
        }
      }
      loadOwners();
      
      // Pre-fill document slug if attemptedSlug is provided
      if (attemptedSlug) {
        setDocumentSlug(attemptedSlug);
      }
      
      // Focus document input when modal opens
      setTimeout(() => {
        documentInputRef.current?.focus();
        // Select the text if there's an attempted slug
        if (attemptedSlug && documentInputRef.current) {
          documentInputRef.current.select();
        }
      }, 100);
    }
  }, [isOpen, attemptedSlug]);

  // Clear owner input when typing in document input
  const handleDocumentChange = (value: string) => {
    setDocumentSlug(value);
    if (value.trim()) {
      setOwnerSlug('');
    }
  };

  // Clear document input when typing in owner input
  const handleOwnerChange = (value: string) => {
    setOwnerSlug(value);
    if (value.trim()) {
      setDocumentSlug('');
    }
  };

  const handleLoadDocument = () => {
    const slug = documentSlug.trim();
    if (!slug) {
      setErrorMessage('Please enter a document slug');
      return;
    }
    setErrorMessage(null);
    // Preserve existing URL parameters (like document_selector)
    const newParams = new URLSearchParams(searchParams);
    newParams.set('doc', slug);
    // Remove owner param when selecting a document
    newParams.delete('owner');
    navigate(`/chat?${newParams.toString()}`);
  };

  const handleLoadOwner = () => {
    const owner = ownerSlug.trim();
    if (!owner) {
      setErrorMessage('Please enter an owner group');
      return;
    }
    setErrorMessage(null);
    // Preserve existing URL parameters (like document_selector)
    const newParams = new URLSearchParams(searchParams);
    newParams.set('owner', owner);
    // Remove doc param when selecting an owner
    newParams.delete('doc');
    navigate(`/chat?${newParams.toString()}`);
  };

  const handleDocumentKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLoadDocument();
    }
  };

  const handleOwnerKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLoadOwner();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={(e) => e.stopPropagation()} // Prevent dismissal on backdrop click
    >
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Document or Owner Required
          </h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 min-h-0">
          {/* Custom Message (e.g., document not found) */}
          {customMessage && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <div className="flex items-start gap-3">
                <svg 
                  className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                  />
                </svg>
                <div className="flex-1">
                  <div className="font-semibold text-amber-900 mb-1">Document Not Found</div>
                  <p className="text-amber-800 text-sm leading-relaxed">{customMessage}</p>
                  <p className="text-amber-700 text-sm mt-2">Please try entering a different document slug or owner information below.</p>
                </div>
              </div>
            </div>
          )}
          
          {/* Error Message */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {errorMessage}
            </div>
          )}

          {/* DocuTrain Icon */}
          <div className="flex justify-center mb-6">
            <img
              src={docutrainIconUrl}
              alt="DocuTrain"
              className="w-24 h-auto object-contain"
            />
          </div>

          {/* Inputs Side by Side (Desktop) / Stacked (Mobile) */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6 mb-6 min-w-0">
            {/* Document Slug Input */}
            <div className="flex-1 min-w-0 md:pr-4">
              <label
                htmlFor="documentSlugInput"
                className="block mb-2 font-semibold text-gray-700"
              >
                Enter document slug:
              </label>
              <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                <input
                  ref={documentInputRef}
                  id="documentSlugInput"
                  type="text"
                  placeholder="e.g., smh, maker-foh"
                  value={documentSlug}
                  onChange={(e) => handleDocumentChange(e.target.value)}
                  onKeyPress={handleDocumentKeyPress}
                  className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleLoadDocument}
                  className="px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Load Document
                </button>
              </div>
            </div>

            {/* Visual Separator - Desktop Only */}
            <div className="hidden md:flex items-center justify-center shrink-0 w-12">
              <div className="flex flex-col items-center gap-2">
                <div className="w-px h-16 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300"></div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">OR</div>
                <div className="w-px h-16 bg-gradient-to-b from-gray-300 via-gray-400 to-gray-300"></div>
              </div>
            </div>

            {/* Owner Group Input */}
            <div className="flex-1 min-w-0 md:pl-4">
              <label
                htmlFor="ownerSlugInput"
                className="block mb-2 font-semibold text-gray-700"
              >
                Or enter owner group:
              </label>
              <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                <input
                  ref={ownerInputRef}
                  id="ownerSlugInput"
                  type="text"
                  placeholder="e.g., ukidney, maker"
                  value={ownerSlug}
                  onChange={(e) => handleOwnerChange(e.target.value)}
                  onKeyPress={handleOwnerKeyPress}
                  className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-lg text-base focus:outline-none focus:border-green-500"
                />
                <button
                  onClick={handleLoadOwner}
                  className="px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Load Owner
                </button>
              </div>
            </div>
          </div>

          {/* Footer Explanation */}
          <div className="mb-6 pb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg 
                  className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
                <div className="text-sm text-blue-900">
                  <div className="font-semibold mb-1">What's happening?</div>
                  <p className="text-blue-800 leading-relaxed">
                    DocuTrain needs either a specific document or an owner group to start. 
                    Enter a <strong>document slug</strong> to chat with a single document, or enter an 
                    <strong> owner group</strong> to access all documents belonging to that owner. 
                    These fields are mutually exclusive—entering one will clear the other.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with escape links */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            {!user && (
              <>
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
                <span className="hidden sm:inline text-gray-300">|</span>
              </>
            )}
            <a
              href="/"
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
            {user && (
              <>
                <span className="hidden sm:inline text-gray-300">|</span>
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
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  Dashboard
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

