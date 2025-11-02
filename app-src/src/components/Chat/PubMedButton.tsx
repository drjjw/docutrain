/**
 * PubMedButton - Button that shows PubMed popup with article information
 * Ported from vanilla JS pubmed-popup.js
 */

import { useState } from 'react';
import { usePubMedPopup } from '@/hooks/usePubMedPopup';

interface PubMedButtonProps {
  pmid: string;
}

export function PubMedButton({ pmid }: PubMedButtonProps) {
  const { article, loading, error, isOpen, openPopup, closePopup } = usePubMedPopup();
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (!isOpen && !loading && !article) {
      openPopup(pmid);
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    // Small delay before closing to allow moving to popup
    setTimeout(() => {
      if (!isHovering && !document.querySelector('.pubmed-popup:hover')) {
        closePopup();
      }
    }, 100);
  };

  return (
    <>
      <button
        className="flex items-center text-gray-600 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
        title="View PubMed information"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label="View PubMed article information"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="m9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
      </button>

      {/* PubMed Popup */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={closePopup}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={handleMouseLeave}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="text-lg font-semibold text-gray-900">PubMed Article</div>
              <button
                onClick={closePopup}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                aria-label="Close popup"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading && (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <div className="text-gray-600">Loading article information...</div>
                </div>
              )}

              {error && (
                <div className="text-red-600 py-8 text-center">
                  <div>Unable to load article information</div>
                  <div className="text-sm text-gray-500 mt-2">{error}</div>
                </div>
              )}

              {article && !loading && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {article.title}
                    </h3>
                  </div>

                  {article.authors && article.authors.length > 0 && (
                    <div className="text-gray-700">
                      <strong>Authors:</strong> {article.authors.join(', ')}
                    </div>
                  )}

                  <div className="text-sm text-gray-600">
                    <strong>Journal:</strong> {article.journal}
                    {article.year && ` (${article.year})`}
                  </div>

                  {article.abstract && (
                    <div className="text-gray-700">
                      <strong>Abstract:</strong>
                      <p className="mt-2 leading-relaxed">{article.abstract}</p>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-200">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View on PubMed
                      <svg
                        className="ml-2 w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
