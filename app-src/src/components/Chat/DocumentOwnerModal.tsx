/**
 * DocumentOwnerModal - Modal for selecting document or owner slug
 * Ported from vanilla JS ui-document.js SweetAlert modal
 * Shown when no document is selected and no owner parameter is present
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { docutrainIconUrl } from '@/assets';

interface DocumentOwnerModalProps {
  isOpen: boolean;
}

export function DocumentOwnerModal({ isOpen }: DocumentOwnerModalProps) {
  const navigate = useNavigate();
  const [documentSlug, setDocumentSlug] = useState('');
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
          const response = await fetch('/api/owners');
          if (response.ok) {
            const data = await response.json();
            setAvailableOwners(Object.keys(data.owners || {}));
          }
        } catch (error) {
          console.warn('Failed to fetch owners for autocomplete:', error);
        }
      }
      loadOwners();
      
      // Focus document input when modal opens
      setTimeout(() => {
        documentInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

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
    navigate(`/chat?doc=${encodeURIComponent(slug)}`);
  };

  const handleLoadOwner = () => {
    const owner = ownerSlug.trim();
    if (!owner) {
      setErrorMessage('Please enter an owner group');
      return;
    }
    setErrorMessage(null);
    navigate(`/chat?owner=${encodeURIComponent(owner)}`);
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
      className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black bg-opacity-50"
      onClick={(e) => e.stopPropagation()} // Prevent dismissal on backdrop click
    >
      <div 
        className="bg-white rounded-lg shadow-2xl max-w-4xl w-full mx-4 p-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Document or Owner Required
        </h2>
        
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
        <div className="mt-6 pt-6 border-t border-gray-200">
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
    </div>
  );
}

