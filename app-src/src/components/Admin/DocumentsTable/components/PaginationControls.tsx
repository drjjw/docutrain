import React from 'react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  totalDocuments: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  totalDocuments,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-t border-gray-200/60 bg-gray-50 px-5 py-4 sm:px-6 rounded-b-xl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-700">
        <span className="font-bold">Page {currentPage} of {totalPages}</span>
        <span className="text-gray-600 text-xs sm:text-sm font-medium">
          ({startIndex + 1}-{Math.min(endIndex, totalDocuments)} of {totalDocuments} documents)
        </span>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-md hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <svg className="w-4 h-4 sm:mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="hidden sm:inline">Previous</span>
        </button>

        {/* Page Numbers - Hide on very small screens */}
        <div className="hidden sm:flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`relative inline-flex items-center px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 ${
                  currentPage === pageNum
                    ? 'text-white bg-[#3399ff] border border-[#3399ff] shadow-md shadow-[#3399ff]/30'
                    : 'text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200 hover:bg-gray-50 hover:shadow-md hover:border-gray-300'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center px-4 py-2.5 text-sm font-semibold text-gray-700 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl hover:bg-gray-50 hover:shadow-md hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          <span className="hidden sm:inline">Next</span>
          <svg className="w-4 h-4 sm:ml-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

