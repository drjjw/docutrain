import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  allowClose?: boolean; // If false, prevents closing via backdrop click or close button
  fullscreen?: boolean; // If true, modal takes nearly full viewport width and height
  flexColumn?: boolean; // If true, content area uses flex column layout
}

export function Modal({ isOpen, onClose, title, children, size = 'md', allowClose = true, fullscreen = false, flexColumn = false }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Ensure we're in a browser environment before using portals
  if (typeof window === 'undefined' || !document.body) {
    return null;
  }

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full mx-4',
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] overflow-y-auto"
      onClick={(e) => {
        if (allowClose && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop - must be before content to be behind it */}
      <div className="fixed inset-0 bg-black bg-opacity-50" aria-hidden="true" />
      
      <div className={`flex min-h-screen ${fullscreen ? 'items-start p-2' : 'items-center justify-center p-4'}`}>
        <div
          className={`relative bg-white rounded-lg shadow-xl w-full z-10 ${
            fullscreen
              ? 'h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] flex flex-col' 
              : flexColumn
              ? `${sizeClasses[size]} max-h-[calc(100vh-2rem)] flex flex-col`
              : sizeClasses[size]
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b flex-shrink-0 ${fullscreen ? 'p-4' : 'p-6'}`}>
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            {allowClose && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Content */}
          <div className={`${fullscreen || flexColumn ? 'p-6 flex-1 overflow-y-auto min-h-0' : 'p-6'}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );

  // Use React Portal to render modal outside the component tree (at body level)
  // This prevents issues with overflow containers and z-index stacking
  return createPortal(modalContent, document.body);
}

