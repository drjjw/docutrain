import React from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/UI/Button';
import type { DocumentWithOwner } from '@/types/admin';

interface DocumentConfigPromptModalProps {
  document: DocumentWithOwner | null;
  isOpen: boolean;
  onConfigure: () => void;
  onDismiss: () => void;
}

export function DocumentConfigPromptModal({ 
  document, 
  isOpen, 
  onConfigure, 
  onDismiss 
}: DocumentConfigPromptModalProps) {
  if (!isOpen || !document) return null;

  // Ensure we're in the browser before using portal
  if (typeof window === 'undefined' || !window.document.body) {
    return null;
  }

  const modalContent = (
    <div className="fixed inset-0 z-[10000] overflow-y-auto">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideIn {
          from {
            transform: translateY(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .modal-overlay {
          animation: fadeIn 0.3s ease-out;
        }
        .modal-content {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
      
      {/* Background overlay */}
      <div 
        className="fixed inset-0 z-10 bg-gray-900 bg-opacity-75 modal-overlay"
        onClick={onDismiss}
      ></div>

      {/* Modal container */}
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4">
        {/* Modal panel */}
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full modal-content relative">
          {/* Header with icon */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-8 py-6 rounded-t-2xl">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">
                  Document Processing Complete!
                </h2>
                <p className="text-blue-100 text-sm">
                  {document.title}
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6">
            <div className="mb-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Configure Your Document
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Your document has been processed successfully! To make it easier to find and organize, please add important details like:
                  </p>
                </div>
              </div>

              {/* Features list */}
              <div className="bg-gray-50 rounded-xl p-5 mb-6 border border-gray-200">
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span className="font-semibold text-gray-900">Category</span>
                      <span className="text-gray-600"> - Organize your document by type (Guidelines, Manuals, etc.)</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span className="font-semibold text-gray-900">Year</span>
                      <span className="text-gray-600"> - Help users find the most recent version</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span className="font-semibold text-gray-900">Subtitle & Description</span>
                      <span className="text-gray-600"> - Add context and additional information</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <span className="font-semibold text-gray-900">Access Settings</span>
                      <span className="text-gray-600"> - Control who can view and use this document</span>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-8 py-5 rounded-b-2xl border-t border-gray-200 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={onDismiss}
            >
              Configure Later
            </Button>
            <Button
              onClick={onConfigure}
              variant="primary"
            >
              Configure Now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, window.document.body);
}

