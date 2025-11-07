import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export function Card({ children, className = '', header, footer }: CardProps) {
  return (
    <div className={`bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 overflow-hidden hover:shadow-xl transition-shadow duration-300 ${className}`}>
      {header && (
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-b border-gray-200/60 bg-gray-50">
          {header}
        </div>
      )}
      <div className="p-5 sm:p-7">
        {children}
      </div>
      {footer && (
        <div className="px-5 sm:px-7 py-4 sm:py-5 border-t border-gray-200/60 bg-gray-50">
          {footer}
        </div>
      )}
    </div>
  );
}

