import React from 'react';

interface OwnerInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string;
}

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  ownerInfo?: OwnerInfo | null;
}

export function AuthLayout({ children, title, subtitle, ownerInfo }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Owner Logo */}
          {ownerInfo?.logo_url && (
            <div className="text-center mb-6">
              <img
                src={ownerInfo.logo_url}
                alt={`${ownerInfo.name} logo`}
                className="h-12 w-auto mx-auto"
              />
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
            {subtitle && (
              <p className="text-gray-600">{subtitle}</p>
            )}
          </div>

          {/* Content */}
          {children}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-600">
          <p>AI Document Assistant</p>
        </div>
      </div>
    </div>
  );
}

